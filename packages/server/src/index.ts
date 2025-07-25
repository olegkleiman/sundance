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
import { ai } from './genkit.js';

// Initialize Redis connection
initializeRedisClient();

const PORT = process.env.PORT || 8099;
const server = app.listen(PORT, () => {
  const address = server.address();
  let host = 'localhost';
  
  if (address === null) {
    host = `localhost:${PORT}`;
  } else if (typeof address === 'string') {
    host = address;
  } else {
    // Handle IPv6 addresses by surrounding with brackets
    const hostname = address.address === '::' ? 'localhost' : 
                    (address.family === 'IPv6' ? `[${address.address}]` : address.address);
    host = `${hostname}:${address.port}`;
  }
  
  console.info(`✅ Sundance Server is listening on http://${host}`);
});

export default app;