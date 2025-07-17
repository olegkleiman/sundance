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
import { QdrantClient } from '@qdrant/js-client-rest';
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

const qdrant_url = process.env.QDRANT_URL;
const qdrant_client = new QdrantClient({
    url: qdrant_url
});

const collection_name = process.env.QDRANT_COLLECTION_NAME;
if( !collection_name ) {
    throw new Error('QDRANT_COLLECTION_NAME is not defined in environment variables');
}

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

    let collection_info: any = {}

    try {
        // getCollection() does not return errors - it's throws exception
        collection_info = await qdrant_client.getCollection(collection_name);
    } catch (error) {
        logger.info(`Collection ${collection_name} does not exist. Creating...`);

        await qdrant_client.createCollection(collection_name, {
            vectors: {
                size: EMBEDDING_VECTOR_SIZE,
                distance: 'Cosine'
            }
        });

        collection_info = await qdrant_client.getCollection(collection_name);
    }

    const content = await fetch(contentMapUrl);
    const xmlContent = await content.text();

    const parser = new XMLParser();
    const json = parser.parse(xmlContent);

    let index = 0;
    const siteDocs = await Promise.all(
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
                console.debug(pageText);

                const $$ = cheerio.load(pageText);
                const bodyText = $$.text().replace(/\s+/g, ' ').trim();
                logger.debug(bodyText)

                const chunks = chunk(bodyText, chunkingConfig);
                logger.debug(chunks);

                const points = [];
                
                for( const chunk of chunks) {
                    const queryEmbedding = await embedText(chunk);

                    points.push({
                        id: randomUUID(),
                        vector: queryEmbedding,
                        payload: {
                            url: url.loc,
                            text: chunk
                        }
                    })
                }
                logger.debug(points);

                try {
                    const batch = {
                          ids: points.map(item => item.id),
                          vectors: points.map(item => item.vector),
                          payloads: points.map(item => item.payload),
                        // optionally add wait/ordering here
                      };

                    await qdrant_client.upsert(collection_name, {
                        wait: true,
                        batch: batch
                    });
                } catch (error) {
                    logger.error(`Error upserting data to collection ${collection_name}:`, error);
                }
             
                // return {
                //     url: url.loc,
                //     text: bodyText
                // }
            } catch (error: any) {
                logger.error(`Failed to fetch ${url.loc}:`, error);
                return null;
            }
        })
    );

    return docs.filter(Boolean);;
})