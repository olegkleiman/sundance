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
export const SearchFlow = ai.defineFlow({
    name: "SearchFlow",
    inputSchema: z.any()
}, async (input) => {
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
});
