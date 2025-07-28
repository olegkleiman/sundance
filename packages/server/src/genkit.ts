import { genkit } from 'genkit/beta';
import { googleAI, gemini15Flash } from '@genkit-ai/googleai';
import { vertexAI } from '@genkit-ai/vertexai';
import { logger } from 'genkit/logging';
import openAI, { gpt4oMini } from 'genkitx-openai';

export const ai = genkit({
    plugins: [
        googleAI(), // automatically look for GOOGLE_API_KEY in your environment.
        vertexAI(),
        openAI({ apiKey: process.env.OPENAI_API_KEY })
    ],
    promptDir: './llm_prompts',
    model: gpt4oMini, // or gemini15Flash
    // enableTracingAndMetrics: true
})

logger.setLogLevel('debug');
logger.debug('✅ GenKit initialized');



