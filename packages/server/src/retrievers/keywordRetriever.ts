// 
// keywordRetriever.ts    
// Sundance project
//
// Created by: Oleg Kleiman on 16/07/2025
// 

import { ai } from '../genkit.js';
import { logger } from 'genkit/logging';
import { Document, CommonRetrieverOptionsSchema } from 'genkit/retriever';
import * as z from 'zod';
import { getContainer } from '../cosmosDB/utils.js';

/**
 * Performs a keyword-based search against Cosmos DB.
 * Note: For production, ensure a full-text index is configured on `c.payload.text` for performance.
 */
export const keywordRetriever = ai.defineRetriever(
    {
        name: "keywordRetriever",
        info: { label: 'Keyword Retriever (sparse vectors from text-based search in Azure Cosmos DB)' },
    },
    async (query: Document, options: z.infer<typeof CommonRetrieverOptionsSchema>) => {
            
        try {
            logger.info(`Keyword Retriever received query: ${query.text}`);
            const cosmosContainer = await getContainer();

            const k = options.k ?? 3; // Default final number of docs to 3 if k is not set

            const querySpec = {
            // Using CONTAINS for a basic keyword search. The `true` enables case-insensitivity.
            query: `SELECT TOP @k c.id, c.payload FROM c WHERE CONTAINS(c.payload.text, @query, true)`,
            parameters: [
                { name: "@k", value: k },
                { name: "@query", value: query.text }
                ]
            };
    
            const { resources } = await cosmosContainer.items.query(querySpec).fetchAll();
            logger.info(`Keyword search retrieved ${resources.length} documents for query: "${query.text}"`);

            return {
                documents: resources.map((doc) => ({
                    content: [
                        { 
                            text: doc.payload.text,
                            url: doc.payload.url
                        }
                    ],
                    metadata: doc,
                }))
            }

        } catch (error) {
            logger.error('Error in keywordRetriever:', error);
            return { documents: [] };
        }
    }
);