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
import { XMLParser } from 'fast-xml-parser';
import * as cheerio from 'cheerio';
import OpenAI from "openai";
import { chunk } from 'llm-chunk';

// Define the exact shape expected by the llm-chunk package
type ChunkingConfig = {
    minLength: number;
    maxLength?: number;
    splitter?: 'sentence' | 'paragraph';
    overlap?: number;
    delimiters?: string;
};
import { getVectorContainer } from '../cosmosDB/utils.js';
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

const MAX_CHUNK_LENGTH = parseInt(process.env.MAX_CHUNK_LENGTH || "200");

// Accepts an array of texts and returns an array of embeddings
export async function embedTexts(texts: string[]): Promise<number[][]> {
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

    const cosmosContainer = await getVectorContainer();

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

    async function withRetry<T>(fn: () => Promise<T>, retries = MAX_RETRIES): Promise<T> {
        try {
            return await fn();
        } catch (error) {
            if (retries <= 0) throw error;
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.warn(`Retrying after error: ${errorMessage}. ${retries} attempts left.`);
            await sleep(RETRY_DELAY * (MAX_RETRIES - retries + 1));
            return withRetry(fn, retries - 1);
        }
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
            const texts = [];

            const contentBlocks = $('.DCContentBlock');
            for (const block of contentBlocks) {
                const text = $(block).text().replace(/\n/g, '').trim();
                if (text.length > MAX_CHUNK_LENGTH ) {
                    const chunks = chunk(text, chunkingConfig);
                    for (const chunk of chunks) {
                        if( chunk.length > 0 )
                            texts.push(chunk);
                    } 
                } else {
                    if( text.length > 0 )
                        texts.push(text);
                }
            }

            if( texts.length === 0 ) {
                logger.debug(`No texts found for URL: ${url.loc}`);
                return;
            }

            const embeddings = await embedTexts(texts);
            const items = texts.map((text, idx) => ({
                id: randomUUID(),
                embedding: embeddings[idx],
                TenantId: tenantId,
                payload: { text, url: url.loc }
            }));
            
            await cosmosContainer.items.bulk(
                items.map(item => ({
                    operationType: "Upsert",
                    resourceBody: item
                }))
            );
            logger.debug(`Upserted ${items.length} items`);

        } catch (error) {
            logger.error(`Error processing URL:`, error);
            throw error;
        }
    }

    async function processInBatches(urls: SitemapUrl[], batchSize: number, processUrl: (url: SitemapUrl) => Promise<void>) {
        
        for (let i = 0; i < urls.length; i += batchSize) {
            const batch = urls.slice(i, i + batchSize);

            // Run all in parallel within the batch
            await Promise.all(batch.map( async(url) => {
                try {
                    await withRetry( () => processUrl(url) );
                } catch (error) {
                    logger.error(`Error processing URL: ${url.loc}`);
                    throw error;
                }
            }));
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