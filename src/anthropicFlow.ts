import {
  CallToolResultSchema,
  ListToolsResultSchema,
} from "@modelcontextprotocol/sdk/types.js";
import Anthropic from "@anthropic-ai/sdk";
import * as z from 'zod';
import { ai } from './genkit.js';
import { mcpClient, toolDescriptions } from './mcpClient.js';

// TODO: use genkitx-anthropic plugin insead

const anthropic = new Anthropic();

export const anthropicFlow = ai.defineFlow(
    {
        name: "anthropicFlow",
        inputSchema: z.any(),
        // outputSchema: z.string(),
    },
    async (query: any) => {

        // Initialize messages array with user query
        let messages: Anthropic.MessageParam[] = [
        {
            role: "user",
            content: query,
        },
        ];
        // Get available tools
        const toolsResponse = await mcpClient.request(
            { method: "tools/list" },
            ListToolsResultSchema
        );
        const availableTools = toolsResponse.tools.map((tool: any) => ({
            name: tool.name,
            description: tool.description,
            input_schema: tool.inputSchema,
        })); 
        const finalText = [];
        let llmResponse = await anthropic.messages.create({
            model: "claude-3-5-sonnet-20241022",
            max_tokens: 1000,
            messages,
            tools: availableTools,
        });


        // const llmResponse = await ai.generate({
        //     ...structuredPrompt,
        //     model: claude3Haiku,
        // });

        return llmResponse.content;
    }
)