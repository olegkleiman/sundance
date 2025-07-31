// 
// hybridRetriever.ts    
// Sundance project
//
// Created by: Oleg Kleiman on 16/07/2025
// 
import { ai } from '../genkit.js';
import { logger } from 'genkit/logging';
import { Document, CommonRetrieverOptionsSchema } from 'genkit/retriever';
import { getVectorContainer } from '../cosmosDB/utils.js';
import * as z from 'zod';
import { embedTexts } from '../flows/ingestionFlow.js';

export const cosmosDBRetriever = ai.defineRetriever(
    {
        name: "cosmosDBRetriever",
        info: { label: 'CosmosDB Retriever (dense vectors from Azure Cosmos DB)' },
    },
    async (query: Document, options: z.infer<typeof CommonRetrieverOptionsSchema>) => {
        
        logger.info(`CosmosDB Retriever received query: ${query.text}`);

        const cosmosContainer = await getVectorContainer();
        const finalK = options.k ?? 3; // Default final number of docs to 3 if k is not set

        const embeddingArray = await embedTexts([query.text]);
        const querySpec = {
            query: `
                SELECT TOP ${finalK}
                c.payload,
                VectorDistance(c.embedding, [${embeddingArray.join(',')}]) AS score
                FROM c
                ORDER BY VectorDistance(c.embedding, [${embeddingArray.join(',')}])          
          `
        };      
        const { resources } = await cosmosContainer.items.query(querySpec).fetchAll();
        logger.info(`CosmosDB Retriever found ${resources.length} documents`);

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