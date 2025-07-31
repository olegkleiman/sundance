// 
// hybridRetriever.ts    
// Sundance project
//
// Created by: Oleg Kleiman on 16/07/2025
// 

import { ai } from '../genkit.js';
import * as z from 'zod';
import { logger } from 'genkit/logging';
import { Document, CommonRetrieverOptionsSchema } from 'genkit/retriever';
import { cosmosDBRetriever } from './cosmosDBRetriever.js';

const hybridRetrieverOptionsSchema = CommonRetrieverOptionsSchema.extend({
    // 'k' is already in CommonRetrieverOptionsSchema, but you could add others:
    preRerankK: z.number().max(1000).optional().describe("Number of documents to retrieve before potential reranking"),
    customFilter: z.string().optional().describe("A custom filter string"),
});

/**
 * Performs a keyword-based search against Cosmos DB.
 * Note: For production, ensure a full-text index is configured on `c.payload.text` for performance.
 */
// async function keywordSearch(queryText: string, k: number): Promise<Document[]> {
//     const cosmosContainer = await getVectorContainer();
//     const querySpec = {
//         // Using CONTAINS for a basic keyword search. The `true` enables case-insensitivity.
//         query: `SELECT TOP @k c.id, c.payload FROM c WHERE CONTAINS(c.payload.text, @query, true)`,
//         parameters: [
//             { name: "@k", value: k },
//             { name: "@query", value: queryText }
//         ]
//     };
//     const { resources } = await cosmosContainer.items.query(querySpec).fetchAll();
//     logger.info(`Keyword search retrieved ${resources.length} documents for query: "${queryText}"`);
//     return resources.map((doc) => Document.fromObject({
//         content: [{ text: doc.payload.text, url: doc.payload.url }],
//         metadata: doc,
//     }));
// }

/**
 * Merges and reranks document lists using Reciprocal Rank Fusion (RRF).
 */
function rerankAndMerge(results: Document[][], finalK: number): Document[] {
    const docScores = new Map<string, { doc: Document, score: number }>();
    const rrf_k = 60; // RRF ranking constant

    results.forEach(resultSet => {
        resultSet.forEach((doc, rank) => {
            const docId = doc.metadata?.id;
            if (!docId) return;

            const score = 1 / (rrf_k + rank);
            const existing = docScores.get(docId);
            if (existing) {
                existing.score += score;
            } else {
                docScores.set(docId, { doc, score });
            }
        });
    });

    const fusedResults = Array.from(docScores.values());
    fusedResults.sort((a, b) => b.score - a.score);

    return fusedResults.slice(0, finalK).map(item => item.doc);
}

export const hybridRetriever = ai.defineRetriever(
    {
        name: "hybridRetriever",
        info: { label: 'Hybrid Retriever (dense + sparse)' },
    },
    async( query: Document, options: z.infer<typeof hybridRetrieverOptionsSchema> ) => {
        logger.info(`Hybrid Retriever received query: "${query.text}"`);

        try {
            const finalK = options.k ?? 5;
            const searchK = options.preRerankK ?? 10; // Retrieve more documents for better reranking

            // 1. Perform vector (dense) search
            const denseDocs: Document[] = await ai.retrieve({
                retriever: cosmosDBRetriever,
                query: query,
                options: { k: searchK }
            });

            return {
                documents: denseDocs
            };

            // 2. Perform keyword (sparse) search
            // const keywordResults = await keywordSearch(query.text, searchK);

            // // 3. Merge and rerank results
            // const mergedDocs = rerankAndMerge([vectorResults.documents, keywordResults], finalK);

            // logger.info(`Hybrid Retriever returned ${mergedDocs.length} documents after merging.`);
            // return { documents: mergedDocs };

        } catch (error) {
            logger.error('Error in hybridRetriever:', error);
            return { documents: [] };
        }
    }
);
