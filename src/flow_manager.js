
import { genkit } from 'genkit/beta';
import * as z from 'zod';
import { googleAI } from '@genkit-ai/googleai';
import { vertexAI } from '@genkit-ai/vertexai';

import { anthropic, claude3Haiku } from 'genkitx-anthropic';

export const ai = genkit({
    plugins: [
        anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }),
        googleAI(), // automatically look for GOOGLE_API_KEY in your environment.
        vertexAI()
    ],
    promptDir: './llm_prompts',
    enableTracingAndMetrics: true,
})

export const anthropicFlow = ai.defineFlow(
    {
        name: "anthropicFlow",
        inputSchema: z.any(),
        outputSchema: z.string(),
    },
    async (structuredPrompt) => {
        const llmResponse = await ai.generate({
            ...structuredPrompt,
            model: claude3Haiku,
        });
        return llmResponse.text;
    }
)

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