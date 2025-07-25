// 
// app.ts
// Sundance project, server part
//
// Created by: Oleg Kleiman on  26/07/2025
// 

import express from 'express';
import dotenv from 'dotenv';
dotenv.config();

import { fileURLToPath } from 'url';
import path from 'path';
import session from 'express-session';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import authRoutes from './routes/auth.js';
import chatRoutes from './routes/chat.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middleware
app.use(express.static(path.join(__dirname, '../public')));
app.use(express.json());
app.use(cors());
app.use(cookieParser());

const isProduction = process.env.NODE_ENV === 'production';

app.use(session({
    resave: false,
    saveUninitialized: true,
    secret: process.env.SESSION_SECRET || 'secret',
    cookie: { secure: isProduction }
}));

// Swagger configuration
const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Sundance AI Chatbox API',
            version: '1.0.0',
            description: 'Privacy-respecting RAG-based AI chatbox',
        },
        servers: [
            {
                url: `http://localhost:${process.env.PORT || 8099}/api`,
                description: 'Development server',
            },
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                },
                apiKeyAuth: {
                    type: 'apiKey',
                    in: 'header',
                    name: 'x-api-key',
                },
            },
        },
    },
    apis: [
        path.join(__dirname, 'routes/*.ts'),
        path.join(__dirname, 'controllers/*.ts'),
    ],
};

const specs = swaggerJsdoc(swaggerOptions);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);

// Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, {
    explorer: true,
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Sundance API Documentation'
}));

// Serve index.html at root
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK' });
});

export default app;