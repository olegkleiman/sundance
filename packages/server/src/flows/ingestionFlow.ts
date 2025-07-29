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
import { getVectorContainer } from '../cosmosDB/utils.js';
import { randomUUID } from "node:crypto";

const chunkingConfig = {
    minLength: 1000,
    maxLength: 2000,
    splitter: 'sentence',
    overlap: 0,  // number of overlap chracters
    delimiters: '', // regex for base split method
} as any;

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
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

const MAX_CHUNK_LENGTH = parseInt(process.env.MAX_CHUNK_LENGTH || "200");

// Accepts an array of texts and returns an array of embeddings
export async function embedTexts(texts: string[]): Promise<number[][]> {

    const embedding_model = process.env.EMBEDDING_MODEL;
    if( !embedding_model ) {
        throw new Error('EMBEDDING_MODEL is not defined in environment variables.');
    }

    try {
        const response = await getOpenAIClient().embeddings.create({
            model: embedding_model,
            input: texts,
        });
        return response.data.map(item => item.embedding);
    } catch (error) {
        logger.error(`Error processing batch:`, error);
        throw error;
    }
}

// Returns standard JavaScript number array instead of Float32Array that by default returned from soma models (like CLIP)
// This is because Cosmos DB used as vector DB, stores the enbeddings as plain JS Array.
// See VectorDistance documentation for more information: https://learn.microsoft.com/en-us/azure/cosmos-db/nosql/query/vectordistance
export async function embedText(text: string): Promise<number[]> {
    
    const embedding_model = process.env.EMBEDDING_MODEL;
    if( !embedding_model ) {
        throw new Error('EMBEDDING_MODEL is not defined in environment variables.');
    }

    try {
        const _embedding = await getOpenAIClient().embeddings.create({
            model: embedding_model,
            input: text,
        });

        return _embedding.data[0].embedding;

    } catch (error) {
        logger.error(`Error processing text:`, error);
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

    const processUrl = async (url: any) => {
        logger.debug(`Processing URL: ${url.loc}`);

        await sleep(200); // Simple rate limiting

        const content:Response = await fetch(url.loc);
        if (!content.ok) {
            throw new Error(`Request failed with status ${content.status}`);
        }
        const contentText = await content.text();
        const $ = cheerio.load(contentText);

        // We'll embed the texts in batch, so gather the texts into the array
        // and embed them all at once.
        const texts = [];
        try {
            const contentBlocks = $('.DCContentBlock');
            for (const block of contentBlocks) {
                const text = $(block).text().replace(/\n/g, '').trim();
                if (text.length > MAX_CHUNK_LENGTH ) {
                    const chunks = chunk(text, chunkingConfig);
                    for (const chunk of chunks) {
                        if( chunk.length > 0 )
                            texts.push(chunk);
                        //await embedAndUpsert(chunk, url.loc);
                    } 
                } else {
                    if( text.length > 0 )
                        texts.push(text);
                    //await embedAndUpsert(text, url.loc);
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
                payload: { text, url }
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

    async function processInBatches(urls: any[], batchSize: number, processUrl: (url: any) => Promise<void>) {
        
        for (let i = 0; i < urls.length; i += batchSize) {
            const batch = urls.slice(i, i + batchSize);

            // Run all in parallel within the batch
            await Promise.all(batch.map(processUrl));
        }
    }

    const urls = json.urlset.url.filter((url: any) => 
        !url.loc.includes("/ar") && !url.loc.includes("/en")
    );                

    const batchSize = parseInt(process.env.INGESTION_BATCH_SIZE || "10");
    await processInBatches(urls, batchSize, processUrl);
    
    return;
})