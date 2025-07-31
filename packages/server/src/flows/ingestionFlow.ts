// ingestionFlow.ts
// Sundance project

// Ingest documents from a sitemap: 
// 1. fetch the documents listed in sitemap 
// 2. chunk and embed them them into Azure Cosmos DB

//
// Created by: Oleg Kleiman on 18/07/2025
// 

import * as fs from 'fs/promises';
import { fileURLToPath } from 'url';
import * as z from 'zod';
import { logger } from 'genkit/logging';
import { ai } from '../genkit.js';
import { GenerateResponse, MessageData } from 'genkit/beta';
import { XMLParser } from 'fast-xml-parser';
import * as cheerio from 'cheerio';
import OpenAI from "openai";
import { encoding_for_model } from '@dqbd/tiktoken';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';

// Define the exact shape expected by the llm-chunk package
type ChunkingConfig = {
    minLength: number;
    maxLength?: number;
    splitter?: 'sentence' | 'paragraph';
    overlap?: number;
    delimiters?: string;
};
import { getContainer } from '../cosmosDB/utils.js';
import { randomUUID } from "node:crypto";

const chunkingConfig: ChunkingConfig = {
    minLength: 1000,
    maxLength: 2000,
    splitter: 'sentence',
    overlap: 0,  // number of overlap chracters
    delimiters: '', // regex for base split method
};

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

interface SitemapUrl {
    loc: string;
    // lastmod is also available but not used
    lastmod?: string;
}

let openaiClient: OpenAI | null = null;

const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 512,
    chunkOverlap: 50,
});

function getOpenAIClient(): OpenAI {
    if (openaiClient) {
        return openaiClient;
    }
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        throw new Error('The OPENAI_API_KEY environment variable is missing or empty.');
    }
    openaiClient = new OpenAI({ apiKey });
    return openaiClient;
}

type EmbeddingModel = 'text-embedding-ada-002' | 'text-embedding-3-small' | 'text-embedding-3-large'; // Add other valid models as needed
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL as EmbeddingModel;
if (!EMBEDDING_MODEL) {
    throw new Error('The EMBEDDING_MODEL environment variable is missing or empty.');
}
const enc = encoding_for_model(EMBEDDING_MODEL);

const MAX_CHUNK_LENGTH = parseInt(process.env.MAX_CHUNK_LENGTH || "200");


// function chunkTextByTokens(text: string, maxTokens = 512): string[] {
//     const tokens = enc.encode(text);
//     const chunks: string[] = [];
  
//     for (let i = 0; i < tokens.length; i += maxTokens) {
//       const chunkTokens = tokens.slice(i, i + maxTokens);
//       const chunkText = enc.decode(chunkTokens);
//       chunks.push(chunkText);
//     }
  
//     return chunks;
//   }

// Accepts an array of texts and returns an array of embeddings
export async function embedTexts(texts: string[]): Promise<number[][]> {
    if( texts.length === 0 ) {
        return [];
    }

    logger.debug(`Embedding ${texts.length} texts`)
    try {
        const response = await getOpenAIClient().embeddings.create({
            model: EMBEDDING_MODEL,
            input: texts,
        });
        return response.data.map(item => item.embedding);
    } catch (error) {
        logger.error(`Error processing batch:`, error);
        throw error;
    }
}

export const IngestionFlow = ai.defineFlow({
    name: "ingestionFlow",
    inputSchema: z.object({
        url: z.string().describe("sitemap file path or URL"),
        lang: z.string().describe("language code"),
    })
},
async (input: { url: string, lang: string }) => {

    const prompt = ai.prompt("split");

    const cosmosContainer = await getContainer();

    let xmlContent: string = "";

    try {
        const url = new URL(input.url);
        if (url.protocol === 'file:') {
            const filePath = fileURLToPath(input.url);
            xmlContent = await fs.readFile(filePath, 'utf8');
        } 
        else {
            const content = await fetch(input.url);
            xmlContent = await content.text();
        }
    } catch (error) {
        logger.error(`Error processing URL:`, error);
        throw error;
    }

    const parser = new XMLParser();
    const json = parser.parse(xmlContent);

    const tenantId = process.env.TENANT_ID;
    if( !tenantId ) {
        throw new Error('TENANT_ID is not defined in environment variables.');
    }

    const MAX_RETRIES = 3;
    const RETRY_DELAY = 1000; // 1 second

    async function withRetry<T>(
        fn: () => Promise<T>, 
        maxRetries = MAX_RETRIES,
        shouldRetry: (error: any) => boolean = () => true
    ): Promise<T> {
        let lastError: any;
        
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                return await fn();
            } catch (error) {
                lastError = error;
                
                // Check if we should retry this error
                if (attempt === maxRetries || !shouldRetry(error)) {
                    break;
                }
                
                const delayMs = Math.min(
                    RETRY_DELAY * Math.pow(2, attempt), // Exponential backoff
                    30000 // Max 30 seconds
                );
                
                const errorMessage = error instanceof Error ? error.message : String(error);
                logger.warn(`Attempt ${attempt + 1}/${maxRetries} failed: ${errorMessage}. Retrying in ${delayMs}ms...`);
                
                await sleep(delayMs);
            }
        }
        
        throw lastError;
    }

    const processUrl = async (url: SitemapUrl) => {
        try {

            logger.debug(`Processing URL: ${url.loc}`);

            await sleep(200); // Simple rate limiting

            const response:Response = await fetch(url.loc);
            if (!response.ok) {
                throw new Error(`Request failed with status ${response.status}`);
            }
            const html = await response.text();
            const $ = cheerio.load(html);            

            // We'll embed the texts in batch, so gather the texts into the array
            // and embed them all at once.
            const chunks: string[] = [];

            const h1 = $('h1').text();
            const ogTitle = $('meta[property="og:title"]').attr('content');
            const title = ogTitle || h1;
            if( title ) {
                chunks.push(title);
            }
            const ogDescription = $('meta[property="og:description"]').attr('content');
            if( ogDescription ) {
                chunks.push(ogDescription);
            }

            const contentBlocks = $('.DCContentBlock');
            for (const block of contentBlocks) {
                const text = $(block).text().replace(/\n/g, '').trim();

                if( !text || text.length === 0 ) {
                    logger.debug(`No texts found for URL: ${url.loc}`);
                    continue;
                }

                // const rendered_prompt = await prompt.render({ text: text });
                // const response: GenerateResponse = await ai.generate({ ...rendered_prompt });
                // const messages : MessageData[] = response.messages;
                // const modelMessages = messages.filter( msg => msg.role === "model");
                // for(const msg of modelMessages) {
                //     // Check if content exists and has at least one item
                //     if (msg.content && msg.content.length > 0 && 'text' in msg.content[0]) {
                //         const messageText = msg.content[0].text;
                //         if( messageText ) {
                //             logger.debug(`${msg.role}: ${messageText}`);
                //             chunks.push(messageText);
                //         }
                //     }
                // }

                const docs = await splitter.createDocuments([text]);
                if( docs.length > 0 ) {
                    const items = docs.map(doc => doc.pageContent);
                    chunks.push(...items);
                }

            }

            const embeddings = await embedTexts(chunks);
            const items = chunks.map((text, idx) => ({
                id: randomUUID(),
                embedding: embeddings[idx],
                TenantId: tenantId,
                payload: { text, title:title, url: url.loc }
            }));
            
            if( items.length != 0 ) {
                await cosmosContainer.items.bulk(
                    items.map(item => ({
                        operationType: "Upsert",
                        resourceBody: item
                    }))
                );
                logger.debug(`Upserted ${items.length} items`);
            }
            else {
                logger.debug(`No items to upsert`);
            }
        } catch (error) {
            logger.error(`Error processing URL:`, error);
            throw error;
        }
    }

    async function processInBatches(urls: SitemapUrl[], batchSize: number, processUrl: (url: SitemapUrl) => Promise<void>) {
        const BATCH_DELAY_MS = 1000; // 1 second delay between batches
        const ITEM_DELAY_MS = 100;   // 100ms delay between items in a batch
        
        for (let i = 0; i < urls.length; i += batchSize) {
            const batch = urls.slice(i, i + batchSize);
            logger.info(`Processing batch ${Math.floor(i/batchSize) + 1} of ${Math.ceil(urls.length/batchSize)}`);

            // Process items in batch with a small delay between each
            for (const url of batch) {
                try {
                    await withRetry(
                        async () => {
                            await processUrl(url);
                            // Add a small delay between items in the same batch
                            await sleep(ITEM_DELAY_MS);
                        },
                        3, // max retries
                        (error: any) => {
                            // Check if this is a rate limit error
                            if (error.message && error.message.includes('The request rate is too large')) {
                                logger.warn('Rate limit hit, will retry with backoff');
                                return true;
                            }
                            return false;
                        }
                    );
                } catch (error) {
                    logger.error(`Error processing URL: ${url.loc}`, error);
                    // Continue with next URL instead of failing the entire batch
                    continue;
                }
            }

            // Add delay between batches if not the last batch
            if (i + batchSize < urls.length) {
                logger.debug(`Waiting ${BATCH_DELAY_MS}ms before next batch...`);
                await sleep(BATCH_DELAY_MS);
            }
        }
    }

    // The 'lang' parameter from the input is currently unused.
    // The filter below is hardcoded to exclude common language paths.
    // This could be made dynamic based on the `input.lang` if needed.
    const urls: SitemapUrl[] = json.urlset.url.filter((url: SitemapUrl) => 
        !url.loc.includes("/ar/") && !url.loc.includes("/en/")
    );

    const batchSize = parseInt(process.env.INGESTION_BATCH_SIZE || "10");
    await processInBatches(urls, batchSize, processUrl);
    
    return;
})