// 
// searchController.ts
// Sundance project, server part
//
// Created by: Oleg Kleiman on  26/07/2025
// 

import { Document } from 'genkit/retriever';
import { Request, Response } from 'express';
import { SearchFlow } from '../flows/searchFlow.js';

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

export const search = async(req: Request, res: Response) => {
    try {
        const docs: Document[] = await SearchFlow(req.body.data);
        
        // Process documents safely, handling potentially undefined metadata
        const processedDocs = docs.map(doc => ({
            text: doc.content[0].text,
            url: doc.metadata?.url || doc.metadata?.payload?.url || '', // Try to get URL from metadata
            score: doc.metadata?.score || 0
        }));

        res.status(200).json(processedDocs);
    } catch (error) {
        console.error('Error in search:', error);
        res.status(500).json({ error: 'An error occurred during search' });
    }

}
