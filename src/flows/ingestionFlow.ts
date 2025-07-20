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

const embedding_model = process.env.EMBEDDING_MODEL;

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const MAX_CHUNK_LENGTH = parseInt(process.env.MAX_CHUNK_LENGTH || "200");
const tenantId = process.env.TENANT_ID;
const cosmosContainer = await getVectorContainer();

// Returns standard JavaScript number array instead of Float32Array that by default returned from soma models (like CLIP)
// This is because Cosmos DB used as vector DB, stores the enbeddings as plain JS Array.
// See VectorDistance documentation for more information: https://learn.microsoft.com/en-us/azure/cosmos-db/nosql/query/vectordistance
export async function embedText(text: string): Promise<number[]> {
    
    try {

        const _embedding = await openai.embeddings.create({
          model: embedding_model ?? 'text-embedding-ada-002',
          input: text,
        });

        return _embedding.data[0].embedding;

    } catch (error) {
        console.error(`Error processing text:`, error);
        throw error;
    }
}

const embedAndUpsert = async (text: string) => {
    const embedding = await embedText(text);
    const item = {
        id: randomUUID(),
        embedding: embedding,
        TenantId: tenantId,
        payload: {
            text: text
        }
    }
    const cosmosItem = await cosmosContainer.items.upsert(item);
    logger.debug(`Upserted item: ${cosmosItem.item.id}`);
}

export const IngestionFlow = ai.defineFlow({
    name: "ingestionFlow",
    inputSchema: z.string().describe("sitemap file path or URL"),
},
async (contentMapUrl: string) => {

    let xmlContent: string = "";

    try {
        const url = new URL(contentMapUrl);
        if (url.protocol === 'file:') {
            const filePath = fileURLToPath(contentMapUrl);
            xmlContent = await fs.readFile(filePath, 'utf8');
        } 
        else {
            const content = await fetch(contentMapUrl);
            xmlContent = await content.text();
        }
    } catch (error) {
        console.error(`Error processing URL:`, error);
        throw error;
    }

    const parser = new XMLParser();
    const json = parser.parse(xmlContent);

    if( !tenantId ) {
        throw new Error('TENANT_ID is not defined in environment variables.');
    }

    const processUrl = async (url: any) => {
        logger.debug(`Processing URL: ${url.loc}`);

        await sleep(200); // Simple rate limiting

        const content = await fetch(url.loc);
        if (!content.ok) {
            throw new Error(`Request failed with status ${content.status}`);
        }
        const contentText = await content.text();
        const $ = cheerio.load(contentText);

        try {
            const contentBlocks = $('.DCContentBlock');
            for (const block of contentBlocks) {
                const text = $(block).text().replace(/\n/g, '').trim();
                if (text.length > MAX_CHUNK_LENGTH ) {
                    const chunks = chunk(text, chunkingConfig);
                    for (const chunk of chunks) {
                        await embedAndUpsert(chunk);
                    } 
                } else {
                    await embedAndUpsert(text);
                }
            }
        } catch (error) {
            console.error(`Error processing URL:`, error);
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

    await processInBatches(urls, 10, processUrl);
    
    return;
})