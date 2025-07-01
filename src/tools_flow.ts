
import { genkit } from 'genkit/beta';
import * as z from 'zod';
import { googleAI } from '@genkit-ai/googleai';
import { vertexAI } from '@genkit-ai/vertexai';

import { ai } from './genkit.js';


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