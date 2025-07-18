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
// import { QdrantClient } from '@qdrant/js-client-rest';
import { CosmosClient } from '@azure/cosmos';
import { randomUUID } from "node:crypto";

const chunkingConfig = {
    minLength: 1000,
    maxLength: 2000,
    splitter: 'sentence',
    overlap: 0,  // number of overlap chracters
    delimiters: '', // regex for base split method
  } as any;

  class DbStorePoint {
    url: string;
    text: string;
  
    constructor(url: string, text: string) {
      this.url = url;
      this.text = text;
    }
  
    display(): void {
      logger.debug(`Text: ${this.text}, URL: ${this.url}`);
    }
  }

const docs: DbStorePoint[] = [];

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

const EMBEDDING_VECTOR_SIZE = 512;

const cosmos_client = new CosmosClient({ 
    endpoint: process.env.COSMOS_CLIENT_URL,
    key: process.env.COSMOS_CLIENT_KEY
});
const cosmosDatabase = cosmos_client.database('danceR');
const container = cosmosDatabase.container('TextUnits');

// Use CLIP as multimodal embedding model.
// Refer to this article for more information: https://www.tigerdata.com/blog/how-to-build-an-image-search-application-with-openai-clip-postgresql-in-javascript
const model_id = 'Xenova/clip-vit-base-patch32';

// Load the tokenizer and text model
const tokenizer = await CLIPTokenizer.from_pretrained(model_id);
const text_model = await CLIPTextModelWithProjection.from_pretrained(model_id, { quantized: true });
const MAX_TOKENS = 77;

async function embedText(text: string): Promise<number[]> {
    try {
        const text_inputs = tokenizer(text, { padding: true, truncation: true, max_length: MAX_TOKENS });
        const { text_embeds } = await text_model(text_inputs);
        return text_embeds.data;
    } catch (error) {
        console.error(`Error processing text:`, error);
        throw error;
    }
}

export const IndexFlow = ai.defineFlow({
    name: "indexFlow",
    inputSchema: z.string().describe("sitemap file path"),
},
async (contentMapUrl: string) => {

    const content = await fetch(contentMapUrl);
    const xmlContent = await content.text();

    const parser = new XMLParser();
    const json = parser.parse(xmlContent);

    let index = 0;
    await Promise.all(
        json.urlset.url.map( async (url: any) => {

            if( url.loc.includes("/ar") ||
                url.loc.includes("/en") )
                return;

            console.log(`${++index}: ${url.loc}`);

            try {
                await sleep(300);

                const content = await fetch(url.loc);
                if (!content.ok) {
                    throw new Error(`Failed to fetch ${url.loc}`);
                }
                const contentText = await content.text(); // just convert to string
 
                const $ = cheerio.load(contentText);
                $('script, style, iframe, noscript, svg, link, meta, object, embed, head, xml').remove();

                $('body').contents().each(function () {
                    if(this.type==='comment'){
                        $(this).remove(); }
                });

                const pageText = $('body').text().replace(/<!\[CDATA\[.*?/gs, '').trim();

                const $$ = cheerio.load(pageText);
                const bodyText = $$.text().replace(/\s+/g, ' ').trim();

                const chunks = chunk(bodyText, chunkingConfig);

                for( const chunk of chunks) {
                    const queryEmbedding = await embedText(chunk);

                    const item = {
                        id: randomUUID(),
                        vector: queryEmbedding,
                        payload: {
                            url: url.loc,
                            text: chunk
                        }
                    }

                    const cosmosItem = await container.items.upsert(item);
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