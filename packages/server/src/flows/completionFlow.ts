// 
// sundanceFlow.ts
// Sundance project
//
// Created by: Oleg Kleiman on 14/07/2025
// 

import dotenv from 'dotenv';
dotenv.config();

import * as z from 'zod';
import { logger } from 'genkit/logging';
import { ai } from '../genkit.js';
import { executeGraphQLTool, 
         graphQLSchema } from '../tools/executeGraphQL.js';

export const CompletionFlow = ai.defineFlow(
    {
        name: "CompletionFlow",
        inputSchema: z.object({
            userInput: z.string(),
            retrievedDocs: z.array(z.any())
        }),
        outputSchema: z.any(),
    },
    async (input: { userInput: string, retrievedDocs: any[] }, { context }) => {

        const prompt = ai.prompt("graphql_agent");
        const rendered_prompt = await prompt.render(
            {
                schemaSDL: graphQLSchema,
                userInput: input.userInput,
                context: input.retrievedDocs                
            }
        );
        logger.debug(rendered_prompt);

        console.time('ai.generateStream');
        const { stream } = ai.generateStream({
            ...rendered_prompt,
            tools: [executeGraphQLTool]
        });
        console.timeEnd('ai.generateStream');

        return stream;
    }
)