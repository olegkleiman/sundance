// 
// sundanceFlow.ts
// Sundance project
//
// Created by: Oleg Kleiman on 14/07/2025
// 

import dotenv from 'dotenv';
dotenv.config();

import path from 'path'; 

import { buildSchema, parse, validate, GraphQLError, GraphQLSchema } from 'graphql';
import { ApolloClient, gql, HttpLink, InMemoryCache } from "@apollo/client/core/index.js"; // Import directly from core
import * as fs from 'fs/promises';
import { fileURLToPath } from 'url';

import * as z from 'zod';
import { ai } from './genkit.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load and build the GraphQL schema once at module startup.
const schemaPath = path.resolve(__dirname, '../llm_prompts/schema.graphql');
const schemaSDL = await fs.readFile(schemaPath, 'utf-8');
const graphQLSchema: GraphQLSchema = buildSchema(schemaSDL);

const graphql_endpoint = process.env.GRAPHQL_URL;

// Module-level variables are only initialized once per process
// Hence ApolloClient is initialized only once per process  
const httpLink = new HttpLink({ 
    uri: graphql_endpoint, 
});
const apolloClient = new ApolloClient({
    link: httpLink,
    cache: new InMemoryCache(),
});

const executeGraphQL = ai.defineTool({
        name: "executedGraphQL",
        description: "Executes a GraphQL query to retrieve user data. Use this tool to answer any user question about their data.",
        inputSchema: z.object({
            query: z.string().describe("A valid GraphQL query."),
        })
    },
    async ({query}, { context }) => {
        
        console.log(`The tool called with query: ${query}`);

        try {

            if(query) {

                let parsedQuery;
                parsedQuery = parse(query);
                const validationErrors = validate(graphQLSchema, parsedQuery);
                if (validationErrors.length > 0) {
                    const errorMessages = validationErrors.map(error => error.message).join(', ');
                    throw new Error(`GraphQL query validation error: ${errorMessages}`);
                }

                const gqlQuery = gql`${query}`;
                const graphql_result = await apolloClient.query({
                    query: gqlQuery,
                    context: {
                        headers: {
                            authorization: `Bearer ${context.access_token}`,
                            "x-user-location": context?.headers["x-user-location"] || ""
                        }
                    }                    
                });

                console.log(graphql_result.data)

                return graphql_result.data;
            }
                
        } catch(error) {
            console.error(error);
            throw error;
        }
    }   
);

export const sundanceFlow = ai.defineFlow(
    {
        name: "sundanceFlow",
        inputSchema: z.any(),
        // outputSchema: z.string(),
    },
    async (userInput: any) => {

        const prompt = ai.prompt("graphql_agent");
        const rendered_prompt = await prompt.render(
            {
                schemaSDL: schemaSDL,
                userInput: userInput                
            }
        );
        console.log(rendered_prompt);

        const llmResponse = await ai.generate({
            ...rendered_prompt,
            tools: [executeGraphQL]
        });

        return llmResponse.text;
    }
)