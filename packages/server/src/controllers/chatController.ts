// 
// chatController.ts
// Sundance project, server part
//
// Created by: Oleg Kleiman on  26/07/2025
// 

import { NextFunction, Request, Response } from 'express';
import { logger } from 'genkit/logging';
import { Document } from 'genkit/retriever';
import { jwtDecode } from "jwt-decode";

import { IngestionFlow } from '../flows/ingestionFlow.js';
import { CompletionFlow } from '../flows/completionFlow.js';

import { ai } from '../genkit.js';
import { hybridRetriever } from '../retrievers/hybridRetriever.js';


/**
 * @swagger
 * /chat//init:
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
export const init = async (req: Request, res: Response) => {
    logger.debug('Session before /init:', req.sessionID, req.session);

    const userUtterance = req.body.data;

    req.session.userUtterance = userUtterance;
    logger.debug(`User utterance: ${JSON.stringify(req.session.userUtterance)}\n`);
    req.session.citizenId = req.citizenId;

    res.status(200).json({ message: "User's utterance received" });
};


/**
 * @swagger
 * /chat/completion:
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
export const completion = async (req: Request, res: Response) => { 
    
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
};
//==============================

const tokenCache = new Map<string, { payload: any; timestamp: number }>();
const TOKEN_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

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