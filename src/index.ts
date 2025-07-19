// 
// index.ts
// Sundance project
//
// Created by: Oleg Kleiman on 14/07/2025
// 

import express, { Request, Response, NextFunction } from 'express';
import session from 'express-session'
import cors from 'cors';

import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { logger } from 'genkit/logging';
import { jwtDecode } from "jwt-decode";
import cookieParser from 'cookie-parser';

import dotenv from 'dotenv';
dotenv.config();

import { ai } from './genkit.js' //'./genkit.ts';
import { ToolsFlow } from './tools_flow.js';
import { anthropicFlow } from './anthropicFlow.js';
import { toolDefinitions, toolDescriptions } from './mcpClient.js';
import { SearchFlow } from './flows/searchFlow.js';
import { SundanceFlow } from './flows/sundanceFlow.js';
import { IndexFlow } from './flows/indexerFlow.js';

const app = express();

app.use(express.static(path.join(__dirname, '../public')));
app.use(express.json());
app.use(cors());
app.use(cookieParser());

const isProduction = process.env.NODE_ENV === 'production';

app.use(session({
    resave: false,
    saveUninitialized: true,
    secret: process.env.SESSION_SECRET || 'secret',
    cookie: { secure: isProduction }
}))

export async function authenticateToken(req: Request, res: Response, next: NextFunction): Promise<void> {

    let access_token = req.cookies["access_token"];
    if (!access_token) {
        const headers = req.headers;
        access_token = headers?.authorization?.split(' ')[1];
    }
    if (!access_token) {
        throw new Error('Authorization token not found.');
    }

    const cached = tokenCache.get(access_token);
    if (cached && Date.now() - cached.timestamp < TOKEN_CACHE_TTL) {
        req.citizenId = cached.payload.citizenId;
        return next();
    }

    const token_validation_url = process.env.TOKEN_VALIDATION_URL;
    if (!token_validation_url) {
        throw new Error('TOKEN_VALIDATION_URL is not defined in environment variables.');
    }
    const validationRequestBody = {
        clientId: process.env.CLIENT_ID
    }
    const validation_resp = await fetch(token_validation_url, {
        method: 'POST',
        body: JSON.stringify(validationRequestBody),
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + access_token
        }
    })
    if( !validation_resp.ok ) {
        const errorJson = await validation_resp.json();
        tokenCache.delete(access_token); // Evict invalid token from cache
        logger.error(errorJson);
        throw new Error(errorJson.developerMessage);
    }

    const decodedJwt = jwtDecode(access_token);
    tokenCache.set(access_token, { payload: decodedJwt, timestamp: Date.now() });
    if( 'signInNames.citizenId' in decodedJwt )
        req.citizenId = decodedJwt['signInNames.citizenId'];

    next()
};

// Serve index.html at root
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

app.post('/init', authenticateToken, async (req, res) => {
    logger.debug('Session before /init:', req.sessionID, req.session);

    const userUtterance = req.body.data;

    req.session.userUtterance = userUtterance;
    logger.debug(`User utterance: ${JSON.stringify(req.session.userUtterance)}\n`);
    req.session.citizenId = req.citizenId;

    res.status(200).json({ message: "User's utterance received" });
});

const tokenCache = new Map<string, { payload: any; timestamp: number }>();
const TOKEN_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

app.post('/indexer', async (req, res) => {

    const url = req.body.url;
    if( !url ) {
        throw new Error('URL is not defined in request body.');
    }
    await IndexFlow(url);
    
    return res.status(202).send();
})

app.get('/tools', async (req, res) => {
    return res.status(200).send(toolDefinitions);
})

app.get('/chat_events', async (req, res) => {
    
    if( !req.session || !req.session.prompt ) {
        logger.warn(`SSE request from session (${req.sessionID}) without a prompt.`);

        res.flushHeaders(); // Send headers before writing event
        res.write('event: error\ndata: {"message": "Chat not initialized. Please set a prompt first via /init."}\n\n');
        res.end();

        return;        
    }

    logger.info(`Prompt received from session: ${req.session.prompt}`);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders(); // send headers

    const closeConnection = () => {
        if (!res.writableEnded) {
            res.end();
            logger.debug(`SSE connection closed for session ${req.sessionID}`);
        }
    };
    req.on('close', closeConnection);

    try {

        const userUtterance = req.session.userUtterance;

        const stream = await ToolsFlow(userUtterance
                                    // {
                                    //     context: 
                                    //     {
                                    //         headers,
                                    //         access_token,
                                    //         citizenId
                                    //     }
                                    // }
                                );
        for await (const chunk of stream) {
            const textContent = chunk.text || '';
            logger.debug(textContent);

            res.write(`event:message\ndata: ${textContent}\n\n`);
        }

    } catch (error: any) {
        logger.error(error)
        res.write(`event: error\ndata: ${error.message}\n\n`);

    } finally {
        closeConnection();
    }
});

app.post('/login', async (req, res) => {
    
    const otp = req.body.otp;
    const phoneNumber = req.body.phoneNumber;

    const clientId = process.env.CLIENT_ID;
    if( !clientId ) {
        throw new Error('CLIENT_ID is not defined in environment variables.');
    }

    const scope = process.env.LOGIN_SCOPE;
    if( !scope ) {
        throw new Error('LOGIN_SCOPE is not defined in environment variables.');
    }

    const deviceId = process.env.LOGIN_DEVICE_ID;
    if( !deviceId ) {
        throw new Error('LOGIN_DEVICE_ID is not defined in environment variables.');
    }

    const loginPayload = {
        phoneNumber,
        otp,
        clientId,
        scope,
        deviceId
      };

      const loginUrl = process.env.LOGIN_URL;
      if( !loginUrl ) {
        throw new Error('LOGIN_URL is not defined in environment variables.');
      }

      const login_response = await fetch(loginUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(loginPayload)
      });
      if( !login_response.ok ) {
        throw new Error('Failed to login');
      }

      const loginData = await login_response.json();
      res.cookie('access_token', loginData.access_token, {
        httpOnly: true,    // Not accessible from JS
        secure: true,      // Only sent over HTTPS
        // sameSite: 'Strict',// Prevent CSRF,
        maxAge: 60 * 60 * 1000 // 1 hour
      })

      return res.json({
        access_token: loginData.access_token
      })
})

app.get('/complete', async (req, res) => { 
    
    const access_token = req.cookies["access_token"];

    if( !req.session || !req.session.userUtterance ) {
        logger.warn(`SSE request from session (${req.sessionID}) without a prompt.`);

        res.flushHeaders(); // Send headers before writing event
        res.write('event: error\ndata: {"message": "Chat not initialized. Please set a prompt first via /init."}\n\n');
        res.end();

        return;        
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const closeConnection = () => {
        if (!res.writableEnded) {
            res.end();
            logger.debug(`SSE connection closed for session ${req.sessionID}`);
        }
    };
    req.on('close', closeConnection);

    try {
        const userUtterance = req.session.userUtterance;

        // Run SearchFlow - RAG step
        const docs = await SearchFlow(userUtterance);

        const stream = await SundanceFlow(userUtterance, {
            context: {
                headers: req.headers,
                access_token: access_token,
                citizenId: req.session.citizenId,
                docs: docs
            }
        });

        for await (const chunk of stream) {
            const textContent = chunk.text || '';
            logger.debug(textContent);

            res.write(`event:message\ndata: ${textContent}\n\n`);
        }
    } catch (err: any) {
        logger.error(err)
        res.write(`event: error\n`);
        res.write(`data: ${JSON.stringify({ message: err.message })}\n\n`);
    } finally {
        closeConnection();
    }
})

app.get('/anthropicFlow', async (req, res) => {
    try {
        const userUtterance = req.session.userUtterance;
        if (!userUtterance) {
            return res.status(400).json({ error: 'Chat not initialized. Please set a prompt first via /init.' });
        }
        const response = await anthropicFlow(userUtterance);
        res.status(200).send(response);
    } catch (error: any) {
        logger.error('Error in /anthropicFlow:', error);
        res.status(500).json({ error: error?.message || 'An unexpected error occurred.' });
    }
});

const PORT = process.env.PORT || 8099;
app.listen(PORT, () => console.info(`Sundance Server listening on http://localhost:${PORT}`) )