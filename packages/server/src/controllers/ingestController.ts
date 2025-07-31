// 
// ingestController.ts
// Sundance project, server part
//
// Created by: Oleg Kleiman on  26/07/2025
// 

import { Request, Response } from 'express';
import { IngestionFlow } from '../flows/ingestionFlow.js';
/**
 * @swagger
 * /chat//ingest:
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
export const ingest = async (req: Request, res: Response) => {

    const url = req.body.url;
    if( !url ) {
        throw new Error('URL is not defined in request body.');
    }

    const lang = req.body.lang;
    await IngestionFlow({
        url, 
        lang
    });
    
    return res.status(202).send();
}