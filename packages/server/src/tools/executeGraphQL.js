// 
// executeGraphQL.ts
// Sundance project
//
// Created by: Oleg Kleiman on 14/07/2025
// 
import dotenv from 'dotenv';
dotenv.config();
import * as z from 'zod';
import { logger } from 'genkit/logging';
import { ai } from '../genkit.js';
import { buildSchema, parse, validate } from 'graphql';
import { ApolloClient, gql, HttpLink, InMemoryCache } from "@apollo/client/core/index.js";
import * as fs from 'fs/promises';
import { fileURLToPath } from 'url';
import path from 'path';
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
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Load and build the GraphQL schema once at module startup.
const schemaPath = path.resolve(__dirname, '../../llm_prompts/schema.graphql');
const schemaSDL = await fs.readFile(schemaPath, 'utf-8');
export const graphQLSchema = buildSchema(schemaSDL);
export const executeGraphQLTool = ai.defineTool({
    name: "ExecuteraphQL",
    description: "Executes a GraphQL query to retrieve user data. Use this tool to answer any user question about their data.",
    inputSchema: z.object({
        query: z.string().describe("A valid GraphQL query."),
    })
}, async ({ query }, { context }) => {
    logger.debug(`The tool called with query: ${query}`, { userId: context.citizenId });
    try {
        if (query) {
            const parsedQuery = parse(query);
            const validationErrors = validate(graphQLSchema, parsedQuery);
            if (validationErrors.length > 0) {
                const errorMessages = validationErrors.map(error => error.message).join(', ');
                throw new Error(`GraphQL query validation error: ${errorMessages}`);
            }
            const gqlQuery = gql `${query}`;
            const graphql_result = await apolloClient.query({
                query: gqlQuery,
                context: {
                    headers: {
                        authorization: `Bearer ${context.access_token}`,
                        "x-user-location": context?.headers["x-user-location"] || ""
                    }
                }
            });
            logger.debug(graphql_result.data, { userId: context.citizenId });
            return graphql_result.data;
        }
    }
    catch (error) {
        logger.error(error, { userId: context.citizenId });
        throw error;
    }
});
