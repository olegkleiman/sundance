// 
// index.ts
// Sundance project, server part
//
// Created by: Oleg Kleiman on 14/07/2025
// 

// Load environment variables first, before any other imports
import dotenv from 'dotenv';
dotenv.config();
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.resolve(__dirname, '../.env')
dotenv.config({ path: envPath });

import { initializeRedisClient } from './config/redis.js';

import app from './app.js';

// Initialize Redis connection
initializeRedisClient();

const PORT = process.env.PORT || 8099;
const HOST = '0.0.0.0'; // Listen on all available network interfaces

app.listen(Number(PORT), HOST, () => {
  console.info(`✅ Sundance Server is running and accessible at \x1b[4;34m\x1b]8;;http://localhost:${PORT}\x1b\\http://localhost:${PORT}\x1b]8;;\x1b\\\x1b[0m`);
});

export default app;