// 
// hybridRetriever.ts    
// Sundance project
//
// Created by: Oleg Kleiman on 16/07/2025
// 

import crypto from 'crypto';
import { ai } from '../genkit.js';
import * as z from 'zod';
import { logger } from 'genkit/logging';
import { Document, CommonRetrieverOptionsSchema } from 'genkit/retriever';
import { vectorDbRetriever } from './vectorDbRetriever.js';
import { keywordRetriever } from './keywordRetriever.js';
import { bm25Retriever } from './bm25Retriever.js';
import { RRFusionReranker } from '../rerankers/RRFusionReranker.js';

const getDocumentHash = (doc: Document): string => {
    const content = doc.content?.[0]?.text || '';
    return crypto.createHash('sha256').update(content).digest('hex');
}

const hybridRetrieverOptionsSchema = CommonRetrieverOptionsSchema.extend({
    // 'k' is already in CommonRetrieverOptionsSchema, but you could add others:
    finalK: z.number().max(1000).optional().describe("Number of documents to retrieve after reranking"),
    customFilter: z.string().optional().describe("A custom filter string"),
});


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

type DocumentWithRanks = {
    doc: Document;
    denseRank?: number;
    sparseRank?: number;
};

/**
 * Hybrid retriever that combines vector (dense) and keyword (sparse) search results.
 * Uses Reciprocal Rank Fusion (RRF) for reranking.
 */
export const hybridRetriever = ai.defineRetriever(
    {
        name: "hybridRetriever",
        info: { label: 'Hybrid Retriever (dense + sparse)' },
    },
    async( query: Document, options: z.infer<typeof hybridRetrieverOptionsSchema> ) => {
        logger.info(`Hybrid Retriever received query: "${query.text}"`);

        try {
            const topK = options.k ?? 5;
            const finalK = options.finalK ?? 10;

            // 1. Perform vector (dense) and keyword (sparse) searches in parallel
            const [denseDocs, sparseDocs] = await Promise.all([
                ai.retrieve({
                    retriever: vectorDbRetriever,
                    query,
                    options: { k: topK }
                }).catch(e => {
                    logger.error('Error in vectorDbRetriever:', e);
                    return [];
                }),
                ai.retrieve({
                    retriever: keywordRetriever,
                    query,
                    options: { k: topK }
                }).catch(e => {
                    logger.error('Error in keywordRetriever:', e);
                    return [];
                })
            ]);

            // 2. Combine and deduplicate results, adding rank metadata for the reranker.
            // Using a Map with a content hash as the key ensures unique documents.
            const allDocsMap = new Map<string, DocumentWithRanks>();

            denseDocs.forEach((doc, index) => {
                const docHash = getDocumentHash(doc);
                allDocsMap.set(docHash, { doc, denseRank: index + 1 });
            });

            sparseDocs.forEach((doc, index) => {
                const docHash = getDocumentHash(doc);
                const existingDoc = allDocsMap.get(docHash);
                if (existingDoc) {
                    existingDoc.sparseRank = index + 1;
                } else {
                    allDocsMap.set(docHash, { doc, sparseRank: index + 1 });
                }
            });

            logger.info(`Found ${allDocsMap.size} unique documents after merging results`);

            const combinedDocs = Array.from(allDocsMap.values()).map(item => {
                item.doc.metadata = {
                    ...item.doc.metadata,
                    denseRank: item.denseRank,
                    sparseRank: item.sparseRank,
                };
                return item.doc;
            });

            // 3. Rerank the combined list of documents
            const rerankedDocs = await ai.rerank({
                reranker: RRFusionReranker,
                query: query,
                documents: combinedDocs,
                options: { k: finalK }
            });

            return {
                documents: rerankedDocs
            };

        } catch (error) {
            logger.error('Error in hybridRetriever:', error);
            return { documents: [] };
        }
    }
);
