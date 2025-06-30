
import { genkit, z, Document } from 'genkit/beta';
import { googleAI, gemini20Flash, gemini25FlashPreview0417 } from '@genkit-ai/googleai';
import { textEmbedding004, vertexAI } from '@genkit-ai/vertexai';
import { 
    devLocalIndexerRef, 
    devLocalRetrieverRef,
    devLocalVectorstore
 } from '@genkit-ai/dev-local-vectorstore';

// const _googleAI = googleAI({ apiKey: process.env.GOOGLE_API_KEY });

export const ai = genkit({
    plugins: [
        googleAI(), // automatically look for GOOGLE_API_KEY in your environment.
        vertexAI(),
        devLocalVectorstore([
            {
                indexName: 'linguistic',
                embedder: textEmbedding004,            
            }
        ])        
    ],
    promptDir: './llm_prompts',
    model: gemini25FlashPreview0417// gemini20Flash,
})

export const ToolsFlow = ai.defineFlow(
    {
        name: "ToolsFlow",
    },
    async (structuredPrompt) => {
        
        const generateOptions = {
                ...structuredPrompt,
                // tools: [executeGraphQL],
        }
        const llmResponse = await ai.generate(generateOptions);
        // When using automatic tool execution, ai.generate() handles the entire
        // loop of calling tools and feeding results back to the model.
        // The final llmResponse.text contains the model's natural language answer.        
        return llmResponse.text;
    }
);