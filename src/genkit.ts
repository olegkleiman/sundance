import { genkit } from 'genkit/beta';
import { googleAI } from '@genkit-ai/googleai';
import { anthropic } from 'genkitx-anthropic';
import { vertexAI } from '@genkit-ai/vertexai';

export const ai = genkit({
    plugins: [
        anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }),
        googleAI(), // automatically look for GOOGLE_API_KEY in your environment.
        vertexAI()
    ],
    promptDir: './llm_prompts'
    // enableTracingAndMetrics: true
})