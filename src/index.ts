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

import dotenv from 'dotenv';
dotenv.config();

import { ai } from './genkit.js' //'./genkit.ts';
import { ToolsFlow } from './tools_flow.js';
import { anthropicFlow } from './anthropicFlow.js';
import { toolDefinitions, toolDescriptions } from './mcpClient.js';
import { sundanceFlow } from './sundanceFlow.js';

const app = express();

app.use(express.static(path.join(__dirname, '../public')));
app.use(express.json());
app.use(cors());

const isProduction = process.env.NODE_ENV === 'production';

app.use(session({
    resave: false,
    saveUninitialized: true,
    secret: process.env.SESSION_SECRET || 'secret',
    cookie: { secure: isProduction }
}))

// Serve index.html at root
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

app.post('/init', async (req, res) => {
    logger.debug('Session before /init:', req.sessionID, req.session);

    const userPrompt = req.body.data;
    const promptTemplate = req.body.prompt_template || 'general_agent';

    const prompt = ai.prompt(promptTemplate); // '.prompt' extension will be added automatically
    const renderedPrompt = await prompt.render( 
        { 
            userInput: userPrompt,
            toolList: toolDescriptions
         } 
    );

    req.session.prompt = renderedPrompt;
    logger.debug(`Prompt: ${JSON.stringify(req.session.prompt)}\n`);

    res.status(200).json({ message: 'Prompt received' });
});

const tokenCache = new Map<string, { payload: any; timestamp: number }>();
const TOKEN_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function authenticateToken(req: Request, res: Response, next: NextFunction): Promise<void> {
        const headers = req.headers;
        const access_token = headers?.authorization?.split(' ')[1];
        if (!access_token) {
            throw new Error('Authorization token not found.');
        }

        const cached = tokenCache.get(access_token);
        if (cached && Date.now() - cached.timestamp < TOKEN_CACHE_TTL) {
            req.citizenId = cached.payload.citizenId;
            return next();
            return;
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

        const prompt = req.session.prompt;

        const stream = await ToolsFlow(prompt
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

app.post('/chat', authenticateToken, async (req, res) => { 
    
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
        const userPrompt = req.body.data;

        const stream = await sundanceFlow(userPrompt, {
            context: {
                headers: req.headers,
                access_token: req.headers.authorization?.split(' ')[1],
                citizenId: req.citizenId
            }
        });

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
})

app.get('/anthropicFlow', async (req, res) => {
    try {
        const prompt = req.session.prompt;
        if (!prompt) {
            return res.status(400).json({ error: 'Chat not initialized. Please set a prompt first via /init.' });
        }
        const response = await anthropicFlow(prompt);
        res.status(200).send(response);
    } catch (error: any) {
        logger.error('Error in /anthropicFlow:', error);
        res.status(500).json({ error: error?.message || 'An unexpected error occurred.' });
    }
});

const PORT = process.env.PORT || 8099;
app.listen(PORT, () => logger.info(`Sundance Server listening on http://localhost:${PORT}`) )