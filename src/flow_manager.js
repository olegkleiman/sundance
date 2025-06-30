
import { genkit } from 'genkit/beta';
import z from 'zod';
import { googleAI } from '@genkit-ai/googleai';
import { vertexAI } from '@genkit-ai/vertexai';

export const ai = genkit({
    plugins: [
        googleAI(), // automatically look for GOOGLE_API_KEY in your environment.
        vertexAI()
    ],
    promptDir: './llm_prompts',
})

export const ToolsFlow = ai.defineFlow(
    {
        name: "ToolsFlow",
        inputSchema: z.any()
    },
    async (structuredPrompt) => {
        
        const generateOptions = {
                ...structuredPrompt,
        }
        const { response, stream } = await ai.generateStream(generateOptions);
        return stream;

    }
);