import dotenv from 'dotenv';
dotenv.config();

import * as z from 'zod';
import { ai } from './genkit.js';

export const anthropicFlow = ai.defineFlow(
    {
        name: "anthropicFlow",
        inputSchema: z.any(),
        // outputSchema: z.string(),
    },
    async (query: any) => {

        const llmResponse = await ai.generate({
            ...query,
        });

        return llmResponse.text;
    }
)