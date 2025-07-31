
// 
// RRFusionReranker.ts    
// Sundance project
//
// Created by: Oleg Kleiman on 16/07/2025
// 

import { ai } from '../genkit.js';

// The fundamental purpose of a re-ranker is to re-order the list of documents
// based on their relevance to the specific query.
// In the case of RRF-ranking, however, the re-ordiring is based on pre-calculated ranks
// and, hence, 'query' parameter is not used
export const RRFusionReranker = ai.defineReranker(
    {
        name: "rrfReranker"
    },
    async(query, documents, options) => {
                
        // --- Reciprocal Rank Fusion (RRF) ---
        // see here: https://medium.com/@devalshah1619/mathematical-intuition-behind-reciprocal-rank-fusion-rrf-explained-in-2-mins-002df0cc5e2a

        const rrfConstant = 60; // Common value for k in RRF
        
        const fusedDocs = documents.map(doc => {

            let rrfScore = 0;
        
            // Add score based on dense rank (lower rank is better)
            rrfScore += 1 / (rrfConstant + doc.metadata?.denseRank);
            // Add score based on sparse rank (lower rank is better)
            rrfScore += 1 / (rrfConstant + doc.metadata?.sparseRank);
            
            return {
                ...doc,
                metadata: {
                    score: rrfScore,
                    ...doc.metadata
                }
            };
        });

        const topK = fusedDocs
        .sort((a, b) => (b.metadata.score ?? 0) - (a.metadata.score ?? 0))
        .slice(0, options?.k || 3);

    return {
        documents: topK 
    }
    }
)