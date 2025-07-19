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

const cosmosContainer = await getVectorContainer();

// Use CLIP as multimodal embedding model.
// Refer to this article for more information: https://www.tigerdata.com/blog/how-to-build-an-image-search-application-with-openai-clip-postgresql-in-javascript
const model_id = 'Xenova/clip-vit-base-patch32';

// Load the tokenizer and text model
const tokenizer = await CLIPTokenizer.from_pretrained(model_id);
const text_model = await CLIPTextModelWithProjection.from_pretrained(model_id, { quantized: true });
const MAX_TOKENS = 77;

// Returns standard JavaScript number array instead of Float32Array that by the default returned from CLIP Model
// This is because Cosmos DB used as vector DB, stores the enbeddings as plain JS Array.
// See VectorDistance documentation for more information: https://learn.microsoft.com/en-us/azure/cosmos-db/nosql/query/vectordistance
export async function embedText(text: string): Promise<number[]> {
    try {
        const text_inputs = tokenizer(text, { padding: true, truncation: true, max_length: MAX_TOKENS });
        const { text_embeds } = await text_model(text_inputs);

        // Convert TypedArray to a standard JavaScript number array for proper JSON serialization.
        return Array.from(text_embeds.data);
    } catch (error) {
        console.error(`Error processing text:`, error);
        throw error;
    }
}

export const IndexFlow = ai.defineFlow({
    name: "indexFlow",
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

    let index = 0;
    await Promise.all(
        json.urlset.url.map( async (url: any) => {

            if( url.loc.includes("/ar") ||
                url.loc.includes("/en") )
                return;

            logger.debug(`${++index}: ${url.loc}`);

            try {
                await sleep(300);

                const content = await fetch(url.loc);
                if( !content.ok) {
                    throw new Error(`Failed to fetch ${url.loc}`);
                }
                const contentText = await content.text(); // convert page content to string
 
                const $ = cheerio.load(contentText); // From this poin on, manipulate the page content using cheerio
                // Manipulation primarly means adaption the HTML to be more amenable to text extraction
                $('script, style, iframe, noscript, svg, link, meta, object, embed, head, xml').remove();

                $('body').contents().each(function () {
                    if(this.type==='comment'){
                        $(this).remove(); }
                });

                const pageText = $('body').text().replace(/<!\[CDATA\[.*?/gs, '').trim();

                const bodyText = pageText.replace(/\s+/g, ' ').trim();

                const chunks = chunk(bodyText, chunkingConfig);

                for( const chunk of chunks) {
                    const queryEmbedding = await embedText(chunk);

                    const item = {
                        id: randomUUID(),
                        embedding: queryEmbedding,
                        TenantId: "aa640f10-95f8-4f05-96f1-529dbbc11897",
                        payload: {
                            url: url.loc,
                            text: chunk
                        }
                    }

                    const cosmosItem = await cosmosContainer.items.upsert(item);
                    logger.debug(cosmosItem);

                }

            } catch (error: any) {
                logger.error(`Failed to fetch ${url.loc}:`, error);
                return null;
            }
        })
    );

    return;
})