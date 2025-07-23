// 
// searchFlow.ts
// Sundance project
//
// Created by: Oleg Kleiman on 16/07/2025
// 

import { ai } from '../genkit.js';
import * as z from 'zod';
import { logger } from 'genkit/logging';
import { Document, CommonRetrieverOptionsSchema } from 'genkit/retriever';
import { getVectorContainer } from '../cosmosDB/utils.js';
import { embedText } from '../flows/ingestionFlow.js';

const hybridRetrieverOptionsSchema = CommonRetrieverOptionsSchema.extend({
    // 'k' is already in CommonRetrieverOptionsSchema, but you could add others:
    preRerankK: z.number().max(1000).optional().describe("Number of documents to retrieve before potential reranking"),
    customFilter: z.string().optional().describe("A custom filter string"),
});

export const hybridRetriever = ai.defineRetriever(
    {
        name: "hybridRetriever",
        info: { label: 'Hybrid Retriever (dense + sparse)' },
    },
    async( query: Document, options: z.infer<typeof hybridRetrieverOptionsSchema> ) => {
        
        const cosmosContainer = await getVectorContainer();

        logger.info(`Hybrid Retriever received query: ${query.text}`);

        // const initialK = options.preRerankK || 10; // Default to 10 if not provided
        // const finalK = options.k ?? 3; // Default final number of docs to 3 if k is not set

        const embeddingArray = await embedText(query.text);
        const topN = process.env.SEARCH_TOP_N || 10;    // default to 10
        const querySpec = {
            query: `
                SELECT TOP ${topN}
                c.payload,
                VectorDistance(c.embedding, [${embeddingArray.join(',')}]) AS score
                FROM c
                ORDER BY VectorDistance(c.embedding, [${embeddingArray.join(',')}])          
          `
        };
        const { resources } = await cosmosContainer.items.query(querySpec).fetchAll();
        logger.info(`Hybrid Retriever retrieved ${resources.length} documents`);

        // --- Merge & Deduplicate Results ---
        // Use a Map to store unique documents by content hash
        // Assign scores from both retrieval methods.        
        const allDocsMap = new Map<string, 
            { 
                doc: Document; 
                denseRank?: number; 
                sparseRank?: number 
           }>();

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
    }
);
