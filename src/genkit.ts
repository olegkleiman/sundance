import { genkit } from 'genkit/beta';
import { googleAI, gemini25ProExp0325 } from '@genkit-ai/googleai';
import { vertexAI } from '@genkit-ai/vertexai';
import { logger } from 'genkit/logging';

export const ai = genkit({
    plugins: [
        // anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }),
        googleAI(), // automatically look for GOOGLE_API_KEY in your environment.
        vertexAI(),
        
    ],
    promptDir: './llm_prompts',
    model: gemini25ProExp0325
    // enableTracingAndMetrics: true
})

logger.setLogLevel('debug');


