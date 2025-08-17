// 
// completionSimpleFlow.ts
// Sundance project, server part
//
// Invokes fast, cheep LLM (gpt4oMini)  for simple user inputs.
// Inputs are categorized in ClassificationFlow into two categories:
// 1. Simple - short, simple queries
// 2. Complex - long, complex queries
//
// Created by: Oleg Kleiman on  26/07/2025
// 
import { ai } from '../genkit.js';
import * as z from 'zod';
import { logger } from 'genkit/logging';
import { gpt4oMini } from 'genkitx-openai'; 

export const CompletionSimpleFlow = ai.defineFlow({
        name: "CompletionSimpleFlow",
        inputSchema: z.object({
            userInput: z.string()
        }),
}, 
async (input: { userInput: string }, { context }) => {
    const prompt = ai.prompt("simple_completion");

    const rendered_prompt = await prompt.render(
        {
            userInput: input.userInput,
        }
    );
    logger.debug(rendered_prompt);

    console.time('ai.generateStream');
    const { stream } = ai.generateStream({
        ...rendered_prompt,
        model: gpt4oMini
    });
    console.timeEnd('ai.generateStream');

    return stream;
});
    
