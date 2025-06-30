import express from 'express'
import session from 'express-session'
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { logger } from 'genkit/logging';
import { googleAI, gemini25FlashPreview0417} from '@genkit-ai/googleai';

import {
  CallToolResultSchema,
  ListToolsResultSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";

import dotenv from 'dotenv';
dotenv.config();

import { ai, ToolsFlow } from './flow_manager.js';

logger.setLogLevel('debug');

const mcpClient = new Client({
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
 const availableTools = mcpResponse.tools.map( tool => {
        return {
        name: tool.name,
        description: tool.description,
        input_schema: tool.inputSchema
        }
    }
);
console.log("Available tools:", availableTools);

const app = express();
import { jwtDecode } from "jwt-decode";

app.use(express.static(path.join(__dirname, '../public')));
app.use(express.json());
app.use(cors());

app.use(session({
    resave: false,
    saveUninitialized: true,
    secret: 'secret',
    cookie: { secure: false }
}))

// Serve index.html at root
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

app.post('/init', async (req, res) => {
    logger.debug('Session before /init:', req.sessionID, req.session);

    const data = req.body;
    const question = data.question;

    const prompt = ai.prompt('general_agent'); // '.prompt' extension will be added automatically
    const renderedPrompt = await prompt.render( { input: question } );

    req.session.prompt = renderedPrompt;
    req.session.query = question;
    logger.debug(`Prompt: ${JSON.stringify(req.session.prompt)}\n Query: ${req.session.query}`);

    res.status(200).json({ message: 'Prompt received' })
});

app.get('/chat_events', async (req, res) => {
    if( !req.session || !req.session.prompt ) {
        logger.warn(`SSE request from session (${req.sessionID}) without a prompt.`);

        res.flushHeaders(); // Send headers before writing event
        res.write('event: error\ndata: {"message": "Chat not initialized. Please set a prompt first via /init."}\n\n');
        res.end();

        return;        
    }

    logger.info(`Prompt received from session: ${req.session.prompt}`);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders(); // send headers

    try {
        const headers = req.headers;
        const access_token = headers?.authorization?.split(' ')[1];
        const decoded = jwtDecode(access_token);
        const userId = decoded["signInNames.citizenId"];

        const prompt = req.session.prompt;
        const query = req.session.query;

        const result = await ToolsFlow(query, {
                                        context: {
                                            headers,
                                            access_token,
                                            userId
                                        }
                                    });
        res.json(result);                                    
    } catch (error) {
        logger.error(error)
        res.status(500).json({ error: error.message || 'An unexpected error occurred.' });
    }
});

const PORT = process.env.PORT || 8099;
app.listen(PORT, () => logger.info(`Sundance Server listening on http://localhost:${PORT}`) )