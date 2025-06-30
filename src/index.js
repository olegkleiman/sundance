import express from 'express'
import session from 'express-session'
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { logger } from 'genkit/logging';
import { jwtDecode } from "jwt-decode";

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

const toolDefinitions = mcpResponse.tools.map( tool => {
        return {
            name: tool.name,
            description: tool.description,
            input_schema: tool.inputSchema
        }
});
const toolDescriptions = toolDefinitions
    .map((tool) => `- Tool Name: ${tool.name}\n  Description: ${tool.description}\n`)
    .join('\n');
console.log("Available tools:\n", toolDescriptions);

const app = express();

app.use(express.static(path.join(__dirname, '../public')));
app.use(express.json());
app.use(cors());

const isProduction = process.env.NODE_ENV === 'production';

app.use(session({
    resave: false,
    saveUninitialized: true,
    secret: process.env.SESSION_SECRET || 'secret',
    cookie: { secure: isProduction }
}))

// Serve index.html at root
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

app.post('/init', async (req, res) => {
    logger.debug('Session before /init:', req.sessionID, req.session);

    const userPrompt = req.body.data;

    const prompt = ai.prompt('general_agent'); // '.prompt' extension will be added automatically
    const renderedPrompt = await prompt.render( 
        { 
            userInput: userPrompt,
            toolList: toolDescriptions
         } 
    );

    req.session.prompt = renderedPrompt;
    logger.debug(`Prompt: ${JSON.stringify(req.session.prompt)}\n`);

    res.status(200).json({ message: 'Prompt received' })
});

const validateCall = async (req) => {
        const headers = req.headers;
        const access_token = headers?.authorization?.split(' ')[1];
        if (!access_token) {
            throw new Error('Authorization token not found.');
        }

        const token_validation_url = process.env.TOKEN_VALIDATION_URL;
        const validationRequestBody = {
            clientId: process.env.CLIENT_ID
        }
        const validation_resp = await fetch(token_validation_url, {
            method: 'POST',
            body: JSON.stringify(validationRequestBody),
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + access_token
            }
        })
        if( !validation_resp.ok ) {
            const errorJson = await validation_resp.json();
            logger.error(errorJson);
            throw new Error(errorJson.developerMessage);
        }

        const decoded = jwtDecode(access_token);
        return decoded["signInNames.citizenId"];

};

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

    const closeConnection = () => {
        if (!res.writableEnded) {
            res.end();
            logger.debug(`SSE connection closed for session ${req.sessionID}`);
        }
    };
    req.on('close', closeConnection);

    try {
        const userId = await validateCall(req);
        const prompt = req.session.prompt;

        const stream = await ToolsFlow(prompt
                                    // {
                                    //     context: 
                                    //     {
                                    //         headers,
                                    //         access_token,
                                    //         userId
                                    //     }
                                    // }
                                );
        for await (const chunk of stream) {
            const textContent = chunk.text || '';
            logger.debug(textContent);

            res.write(`event:message\ndata: ${textContent}\n\n`);
        }

    } catch (error) {
        logger.error(error)

        const errorMessage = JSON.stringify({ error: error.message || 'An unexpected error occurred.' });
        res.write(`event: error\ndata: ${errorMessage}\n\n`);

    } finally {
        closeConnection();
    }
});

const PORT = process.env.PORT || 8099;
app.listen(PORT, () => logger.info(`Sundance Server listening on http://localhost:${PORT}`) )