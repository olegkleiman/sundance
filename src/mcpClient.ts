import {
  CallToolResultSchema,
  ListToolsResultSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";

export const mcpClient = new Client({
  name: "Sundance MCP Client",
  version: "1.0.0",
});

const transport = new StdioClientTransport({
      command: "npx",
      args: ["@modelcontextprotocol/server-everything", "stdio"],
    });
await mcpClient.connect(transport);
console.log("Connected to MCP Server")
// Get available tools
const mcpResponse = await mcpClient.request(
    { method: "tools/list" },
    ListToolsResultSchema
);

const toolDefinitions = mcpResponse.tools.map( tool => {
        return {
            name: tool.name,
            description: tool.description,
            input_schema: tool.inputSchema
        }
});

export const toolDescriptions = toolDefinitions
    .map((tool) => `- Tool Name: ${tool.name}\n  Description: ${tool.description}\n`)
    .join('\n');
console.log("Available tools:\n", toolDescriptions);