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
import { GenerateResponse } from 'genkit/beta';

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
            
            const k = options.k ?? 3; // Set default final number of docs to 3 if k is not set

            const cosmosContainer = await getContainer();

            const prompt = ai.prompt("keywords_split");
            const rendered_prompt = await prompt.render({ utterance: query.text });

            const keywordsResponse: GenerateResponse = await ai.generate({
                ...rendered_prompt,            
            })
            const modelMessages = keywordsResponse.messages.filter( msg => msg.role === "model" );
            const keywordsText = modelMessages[0].content[0].text;
            logger.debug(`Keywords extracted: ${keywordsText}`);
            if( !keywordsText || keywordsText.length === 0 ) {
                throw new Error('No keywords extracted');
            }
            const keywords = JSON.parse(keywordsText);

            const whereClause = keywords.map( (k: string) => `CONTAINS(c.payload.text, "${k}", true)` ).join(" OR ");
            const querySpec = {
                query: `SELECT TOP @k c.id, c.payload FROM c WHERE ${whereClause}`,
                parameters: [
                    { name: "@k", value: k },
                ]
            }

            // const querySpec = {
            // // Using CONTAINS for a basic keyword search. The `true` enables case-insensitivity.
            // query: `SELECT TOP @k c.id, c.payload FROM c WHERE CONTAINS(c.payload.text, @query, true)`,
            // parameters: [
            //     { name: "@k", value: k },
            //     { name: "@query", value: query.text }
            //     ]
            // };
    
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