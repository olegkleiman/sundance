// 
// index.ts
// Sundance project, server part
//
// Created by: Oleg Kleiman on 14/07/2025
// 

// Load environment variables first, before any other imports
import dotenv from 'dotenv';
dotenv.config();
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient, RedisClientType } from 'redis';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.resolve(__dirname, '../.env')
dotenv.config({ path: envPath });

import express, { NextFunction, Request, Response } from 'express';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import session from 'express-session';
import cors from 'cors';
import { logger } from 'genkit/logging';
import { jwtDecode } from "jwt-decode";
import cookieParser from 'cookie-parser';

import { ai } from './genkit.js'
import { CompletionFlow } from './flows/completionFlow.js';
import { IngestionFlow } from './flows/ingestionFlow.js';
import { hybridRetriever } from './retrievers/hybridRetriever.js';

const redisConnectionKey = process.env.REDIS_CONNECTION_KEY;
if( !redisConnectionKey ) {
    throw new Error('REDIS_CONNECTION_KEY is not defined in environment variables.');
}

const redisHost = process.env.REDIS_HOST_NAME;
if( !redisHost ) {
    throw new Error('REDIS_HOST_NAME is not defined in environment variables.');
}

const redisPort = process.env.REDIS_PORT;
if( !redisPort ) {
    throw new Error('REDIS_PORT is not defined in environment variables.');
}

// Initialize Redis client
const redisClient: RedisClientType = createClient({
    url: `redis://:${redisConnectionKey}@${redisHost}:${redisPort}`,
    socket: {
        tls: true,
        rejectUnauthorized: false
    }
});

// Handle Redis connection events
redisClient.on('error', (err) => {
    logger.error('Redis Client Error:', err);
});

redisClient.on('connect', () => {
    logger.info('Redis client connected');
});

redisClient.on('reconnecting', () => {
    logger.info('Redis client reconnecting...');
});

// Connect to Redis when the server starts
async function initializeRedis() {
    try {
        await redisClient.connect();
        logger.info('Successfully connected to Redis');
    } catch (error) {
        logger.error('Failed to connect to Redis:', error);
        process.exit(1);
    }
}

// Initialize Redis connection
initializeRedis();

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

const swaggerOptions = {
    definition: {
      openapi: '3.0.0',
      info: {
        title: 'Sundance AI Chatbox API',
        version: '1.0.0',
        description: 'Privacy-respecting RAG-based AI chatbox',
      },
      servers: [
        {
          url: `http://localhost:${process.env.PORT || 8099}`,
          description: 'Development server',
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
          apiKeyAuth: {
            type: 'apiKey',
            in: 'header',
            name: 'x-api-key',
          },
        },
      },
    },
    apis: ['./src/**/*.ts', './index.ts'], // Include all TypeScript files
};

const specs = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

export async function authenticateToken(req: Request, res: Response, next: NextFunction): Promise<void> {

    let access_token = req.cookies["access_token"];
    if (!access_token) {
        const authHeader = (req as any).get?.('authorization') || req.headers.authorization;
        const token = Array.isArray(authHeader) ? authHeader[0] : authHeader;
        access_token = token?.split(' ')[1];
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
    if ('signInNames.citizenId' in decodedJwt) {
        const citizenId = decodedJwt['signInNames.citizenId'];
        if (typeof citizenId === 'string') {
            req.citizenId = citizenId;
        }
    }

    next()
};

// Serve index.html at root
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

/**
 * @swagger
 * /init:
 *   post:
 *     summary: Initialize a new conversation
 *     tags: [Chat]
 *     responses:
 *       200:
 *         description: Success 
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               data:
 *                 type: string
 *                 example: מה החוב שלי לארנונה?
 */
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


// Middleware to check API key
const authenticateKey = (req: Request, res: Response, next: NextFunction) => {

  const API_KEY = process.env.API_KEY;
  if( !API_KEY ) {
      throw new Error('API_KEY is not defined in environment variables.');
  }
  
  const key = req.headers['x-api-key'];
  if (key === API_KEY) {
      next();
    } else {
      res.status(401).json({ error: 'Unauthorized: Invalid API Key' });
    }
  }

/**
 * @swagger
 * /ingest:
 *   tags: [Ingest]
 *   post:
 *     summary: Ingests website content for RAG
 *     tags: [RAG]
 *     responses:
 *       202:
 *         description: Accepted 
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               url:
 *                 type: string
 *                 example: "https://www.tel-aviv.gov.il:443/sitemap0.xml"
 *               lang:
 *                 type: string
 *                 example: "he"
 */    
app.post('/ingest', authenticateKey, async (req, res) => {

    const url = req.body.url;
    if( !url ) {
        throw new Error('URL is not defined in request body.');
    }
    await IngestionFlow(url);
    
    return res.status(202).send();
})

const set_cookie = (res: Response, token: string) => {
    res.cookie('access_token', token, {
        httpOnly: true,    // Not accessible from JS
        secure: true,      // Only sent over HTTPS
        // sameSite: 'Strict',// Prevent CSRF,
        maxAge: 0 // 1 hour
    })
}

app.get('/refresh_token', async (req: Request, res: Response) => {
    logger.debug('Session before /refresh_token:', req.session);

    try {
        // Check if Redis is connected
        if (!redisClient.isOpen) {
            await redisClient.connect();
        }
        
        // Test the connection with a simple command
        await redisClient.ping();
        logger.info('Redis connection is active');

        const refresh_token = await redisClient.hGet(`sessions:${req.session.id}`, 'refresh_token');
        
        const url = process.env.REFRESH_TOKEN_URL;
        if( !url ) {
            throw new Error('REFRESH_TOKEN_URL is not defined in environment variables.');
        }   

        const refreshTokenPayload = {
            clientId: process.env.CLIENT_ID,
            refresh_token: refresh_token,
            scope: process.env.REFRESH_SCOPE,
            isAnonymousLogin: false
        };

        const refreshTokenResponse = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(refreshTokenPayload)
        });
        if( !refreshTokenResponse.ok ) {
            throw new Error('Failed to refresh token');
        }

        const refreshTokenData = await refreshTokenResponse.json();
        set_cookie(res, refreshTokenData.id_token)

        await redisClient.hSet(`sessions:${req.session.id}`, 
            {
                refresh_token: refreshTokenData.refresh_token,
                access_token: refreshTokenData.id_token,
            });
        
        return res.json({
            access_token: refreshTokenData.id_token
        })

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        logger.error('Error with Redis connection:', error);
        return res.status(500).json({ 
            status: 'error', 
            message: 'Failed to connect to Redis',
            error: errorMessage
        });
    }
})

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
      set_cookie(res, loginData.id_token)

      await redisClient.hSet(`sessions:${req.session.id}`, 
        {
            refresh_token: loginData.refresh_token,
            access_token: loginData.access_token,
        });

      return res.json({
        access_token: loginData.access_token
      })
})

/**
 * @swagger
 * /completion:
 *   get:
 *     summary: Get chat completion response via Server-Sent Events (SSE)
 *     tags: [Chat]
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           text/event-stream:
 *             schema:
 *               type: string
 *               example: |
 *                 event: message
 *                 data: {"text":"להלן פרוט החובות שלך..."}
 *     security:
 *       - bearerAuth: []
 */
app.get('/completion', async (req, res) => { 
    
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

        // RAG step
        const docs = await ai.retrieve({
            retriever: hybridRetriever, //use the custom retriever
            query: userUtterance,
            options: {
                k: 3,
                preRerankK: 10,
                customFilter: "words count > 5",
            }
        });        

        // Completion step  
        const stream = await CompletionFlow(userUtterance, {
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

const PORT = process.env.PORT || 8099;
app.listen(PORT, () => console.info(`Sundance Server listening on http://localhost:${PORT}`) )