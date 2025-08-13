// 
// chat routes.ts
// Sundance project, server part
//
// Created by: Oleg Kleiman on  26/07/2025
// 

import express from 'express';
import { completion, init, stream_agent, stream_chunks } from '../controllers/chatController.js';
import { search } from '../controllers/searchController.js';
import { ingest } from '../controllers/ingestController.js';

const router = express.Router();

/**
 * @swagger
 * /chat/ingest:
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
router.post('/ingest', ingest);

router.get('/completion', completion);
router.post('/init', init);

/**
 * @swagger
 * /chat/search:
 *   post:
 *     summary: Search for relevant documents
 *     tags: [Chat]
 *     responses:
 *       200:
 *         description: Success 
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               data:
 *                 type: string
 *                 example: חוזה שכירות מומלץ
 */
router.post('/search', search);

/**
 * @swagger
 * /chat/stream_agent:
 *   post:
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               input:
 *                 type: string
 *                 example: מה החוב שלי לארנונה?* 
 */
router.post('/stream_agent', stream_agent);

/**
 * @swagger
 * /chat/stream_agent:
 *   post:
 *     summary: Get chat completion response via HTTP chunks
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               input:
 *                 type: string
 *                 example: מה החוב שלי לארנונה?* 
 */
router.post('/stream_chunks', stream_chunks);

export default router;