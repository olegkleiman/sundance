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
import { RRFusionReranker } from '../rerankers/RRFusionReranker.js';

const getDocumentHash = (doc: Document): string => {
    const content = doc.content?.[0]?.text || '';
    return crypto.createHash('sha256').update(content).digest('hex');
}

const hybridRetrieverOptionsSchema = CommonRetrieverOptionsSchema.extend({
    // 'k' is already in CommonRetrieverOptionsSchema, but you could add others:
    preRerankK: z.number().max(1000).optional().describe("Number of documents to retrieve before potential reranking"),
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
            const finalK = options.k ?? 5;
            const searchK = options.preRerankK ?? 10; // Retrieve more documents for better reranking

            // --- Merge & Deduplicate Results ---
            // Use a Map to store unique documents by content hash
            // Assign scores from both retrieval methods.        
            const allDocsMap = new Map<string, DocumentWithRanks>();
            
            // 1. Perform vector (dense) and keyword (sparse) searches in parallel
            const [denseDocs, sparseDocs] = await Promise.all([
                ai.retrieve({
                    retriever: vectorDbRetriever,
                    query,
                    options: { k: searchK }
                }).catch( e => {
                    logger.error('Error in vectorDbRetriever:', e);
                    return [];
                }),
                ai.retrieve({
                    retriever: keywordRetriever,
                    query,
                    options: { k: searchK }
                }).catch( e => {
                    logger.error('Error in keywordRetriever:', e);
                    return [];
                })
            ]);            

            // Actual relevance scores aren't readily available
            denseDocs.forEach((doc, i) => {
                const docHash = getDocumentHash(doc);
                // Assign a simple rank-based score (higher rank = higher score)
                allDocsMap.set(docHash, { doc, denseRank: i });
            }); 

            sparseDocs.forEach((doc, i) => {
                const docHash = getDocumentHash(doc);
                const existingDoc = allDocsMap.get(docHash);
                if (existingDoc) {
                    existingDoc.sparseRank = i;
                } else {
                    allDocsMap.set(docHash, { doc, sparseRank: i });
                }
            });
            logger.info(`Found ${allDocsMap.size} unique documents after merging results`);

            // 3. Merge and rerank results

            const combinedDocsWithScores = Array.from(allDocsMap.values())
            .map(({ doc, denseRank, sparseRank }) => 
            {
                doc.metadata = {
                    ...doc.metadata || {},
                    denseRank: denseRank ?? 0,
                    sparseRank: sparseRank ?? 0,
                }
                return doc;
            });

            const rerankedDocs = await ai.rerank({
                reranker: RRFusionReranker,
                query: query,
                documents: combinedDocsWithScores,
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
