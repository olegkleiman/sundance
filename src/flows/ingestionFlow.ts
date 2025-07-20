// indexerFlow.ts
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
import {  CLIPTokenizer,
    CLIPTextModelWithProjection, 
    CLIPVisionModelWithProjection,
    AutoProcessor, 
    RawImage, 
    cos_sim, 
    cat} from '@xenova/transformers';
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
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Use CLIP as multimodal embedding model.
// Refer to this article for more information: https://www.tigerdata.com/blog/how-to-build-an-image-search-application-with-openai-clip-postgresql-in-javascript
const model_id = 'Xenova/clip-vit-base-patch32';

const embedding_model = process.env.EMBEDDING_MODEL;

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Load the tokenizer and text model
const tokenizer = await CLIPTokenizer.from_pretrained(model_id);
const text_model = await CLIPTextModelWithProjection.from_pretrained(model_id, { quantized: true });
const MAX_TOKENS = 77;

// Returns standard JavaScript number array instead of Float32Array that by the default returned from CLIP Model
// This is because Cosmos DB used as vector DB, stores the enbeddings as plain JS Array.
// See VectorDistance documentation for more information: https://learn.microsoft.com/en-us/azure/cosmos-db/nosql/query/vectordistance
export async function embedText(text: string): Promise<number[]> {
    try {
        
        const _embedding = await openai.embeddings.create({
            model: embedding_model ?? "text-embedding-ada-002", 
            input: text,
        });

        // const text_inputs = tokenizer(text, { padding: true, truncation: true, max_length: MAX_TOKENS });
        // logger.debug(`Text inputs: ${text_inputs}`);
        // const { text_embeds } = await text_model(text_inputs);

        // // Convert TypedArray to a standard JavaScript number array for proper JSON serialization.
        // return Array.from(text_embeds.data);
        return _embedding.data[0].embedding;
    } catch (error) {
        console.error(`Error processing text:`, error);
        throw error;
    }
}

export const IngestionFlow = ai.defineFlow({
    name: "ingestionFlow",
    inputSchema: z.string().describe("sitemap file path or URL"),
},
async (contentMapUrl: string) => {

    const cosmosContainer = await getVectorContainer();

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

    const tenantId = process.env.TENANT_ID;

    if( !tenantId ) {
        throw new Error('TENANT_ID is not defined in environment variables.');
    }

    const processUrl = async (url: any) => {
        logger.debug(`Processing URL: ${url.loc}`);

        const content = await fetch(url.loc);
        if (!content.ok) {
            throw new Error(`Request failed with status ${content.status}`);
        }
        const contentText = await content.text();
        const $ = cheerio.load(contentText);

        try {
            const contentBlocks = $('.DCContentBlock');
            for (const block of contentBlocks) {
                const chunk = $(block).text().replace(/\n/g, '').trim();
                if (chunk.length === 0) continue;

                const queryEmbedding = await embedText(chunk);
                const item = {
                    id: randomUUID(),
                    embedding: queryEmbedding,
                    TenantId: tenantId,
                    payload: {
                        url: url.loc,
                        text: chunk
                    }
                }
                const cosmosItem = await cosmosContainer.items.upsert(item);
                logger.debug(`Upserted item: ${cosmosItem.item.id} rom ${url.loc}`);
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
    
    // await Promise.all(
    //     json.urlset.url.map( async (url: any) => {

    //         const urls = json.urlset.url.filter((url: any) => 
    //             !url.loc.includes("/ar") && !url.loc.includes("/en")
    //         );                

    //         const batchSize = 10;
    //         logger.info(`Starting to process ${urls.length} URLs in batches of ${batchSize}...`);
    //         logger.debug(`${++index}: ${url.loc}`);

    //         let indexInBatch = 0;

    //         for (let i = 0; i < urls.length; i += batchSize) {
    //             const batch = urls.slice(i, i + batchSize);
    //             indexInBatch = i;

    //             await Promise.all(
    //                 batch.map(async (url: any) => {
    //                     const overallIndex = i + indexInBatch +  1;
    //                     logger.debug(`${overallIndex}: ${url.loc}`);
    //                     indexInBatch++;
    //                 })
    //             );

    //             try {
    //                 await sleep(300);

    //                 const content = await fetch(url.loc);
    //                 if (!content.ok) {
    //                     throw new Error(`Request failed with status ${content.status}`);
    //                 }
    //                 const contentText = await content.text();
    //                 const $ = cheerio.load(contentText);
                    
    //                 const contentBlocks = $('.DCContentBlock');
    //                 for (const block of contentBlocks) {
    //                     const chunk = $(block).text().replace(/\n/g, '').trim();
    //                     if (chunk.length === 0) continue;

    //                     const queryEmbedding = await embedText(chunk);
    //                     const item = {
    //                         id: randomUUID(),
    //                         embedding: queryEmbedding,
    //                         TenantId: tenantId,
    //                         payload: {
    //                             url: url.loc,
    //                             text: chunk
    //                         }
    //                     }
    //                     const cosmosItem = await cosmosContainer.items.upsert(item);
    //                     logger.debug(`Upserted item: ${cosmosItem.item.id} rom ${url.loc}`);
    //                 }

    //             } catch (error) {
    //                 console.error(`Error processing URL:`, error);
    //                 throw error;
    //             }
    //         }

    //     })
    // );

    return;
})