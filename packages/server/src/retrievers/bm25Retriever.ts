import { ai } from '../genkit.js';
import * as z from 'zod';
import { Document, CommonRetrieverOptionsSchema } from 'genkit/retriever';
import * as fs from 'fs/promises';
// @ts-ignore - No types available for wink-bm25-text-search
import bm25 from 'wink-bm25-text-search';
// @ts-ignore - No types available for wink-bm25-text-search
import nlp from 'wink-nlp-utils';

const hybridRetrieverOptionsSchema = CommonRetrieverOptionsSchema.extend({
    // 'k' is already in CommonRetrieverOptionsSchema, but you could add others:
    storePath: z.string().optional().describe("Path to the BM25 index file"),
    limit: z.number().max(1000).optional().describe("Limit of documents to retrieve"),
});

export const bm25Retriever = ai.defineRetriever(
    {
        name: "bm25Retriever",
        info: { label: 'BM25 Retriever (dense vectors from text-based search in Azure Cosmos DB)' },
    },
    async (query: Document, options: z.infer<typeof hybridRetrieverOptionsSchema>) => {
        const indexPath = options.storePath || process.env.BM25_STORE_NAME || "./bm25_index.json";
        const fileContent = await fs.readFile(indexPath, 'utf8');
        const savedData = JSON.parse(fileContent);

        const bm25engine = new bm25();
      
        bm25engine.defineConfig({
            fldWeights: { text: 1, title: 1}
          });

        bm25engine.importJSON(savedData);
        const pipe = [
            nlp.string.lowerCase,
            nlp.string.tokenize0,
            nlp.tokens.removeWords,
            nlp.tokens.stem,
            nlp.tokens.propagateNegations
          ]; 

        // Crucial: Re-apply config and prep tasks after importing          
        bm25engine.definePrepTasks(pipe);  

        // Ensure the query text is a string and not empty
        const queryText = typeof query.text === 'string' ? query.text.trim() : '';
        if (!queryText) {
            return {
                documents: [],
                metadata: {
                    retrievedCount: 0,
                    query: '',
                    searchEngine: 'BM25',
                    error: 'Empty query text'
                }
            };
        }

        // The engine.search() method returns [docInternalIndex, score][]
        const results = bm25engine.search(queryText, options.limit || 10) as [number, number][];
        
        // Get all documents from the engine
        const allDocs = bm25engine.docs || [];
        
        // Format documents to match Genkit's expected format
        const documents = results.map(([docIndex, score]) => {
            const doc = allDocs[docIndex];
            return {
                content: [{
                    text: doc.text || '',
                    metadata: {
                        title: doc.title || '',
                        url: doc.url || '',
                        score: score
                    }
                }]
            };
        });

        return {
            documents,
            metadata: {
                retrievedCount: documents.length,
                query: query.text,
                searchEngine: 'BM25'
            }
        };
    }
)