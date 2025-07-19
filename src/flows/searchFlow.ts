// 
// searchFlow.ts
// Sundance project
//
// Performs semantic search using Azure Cosmos DB vector search, i.e. kNN search with vector similarity
// Created by: Oleg Kleiman on 16/07/2025
// 

import { ai } from '../genkit.js';
import * as z from 'zod';
import { hybridRetriever } from '../retrievers/hybridRetriever.js';
import { cosmosContainer, embedText, EMBEDDING_VECTOR_SIZE } from '../flows/indexerFlow.js';

export const SearchFlow = ai.defineFlow(
    {
        name: "SearchFlow",
        inputSchema: z.any()
    },
    async (input: string) => {

        const embeddingArray = await embedText(input);
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

        // retrieve relevant documents. Uses kNN internally, then re-rank the retrieved docs
        const docs = await ai.retrieve({
            retriever: hybridRetriever, //use the custom retriever
            query: input,
            options: {
                k: 3,
                preRerankK: 10,
                customFilter: "words count > 5",
            }
        });

        return docs;
    }
)