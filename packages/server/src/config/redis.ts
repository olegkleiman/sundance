import { createClient, RedisClientType } from 'redis';
import { logger } from 'genkit/logging';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Configure dotenv to load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../../.env');

// Load environment variables from .env file
try {
    const result = dotenv.config({ path: envPath });
    if (result.error) {
        console.warn('Warning: Could not load .env file:', result.error.message);
    }
} catch (error: any) {
    console.warn('Warning: Failed to load .env file:', error.message);
}

const redisConnectionKey = process.env.REDIS_CONNECTION_KEY;
if( !redisConnectionKey ) {
    throw new Error('REDIS_CONNECTION_KEY is not defined in environment variables.');
}

const redisHost = process.env.REDIS_HOST_NAME;
if( !redisHost ) {
    throw new Error('REDIS_HOST_NAME is not defined in environment variables.');
}

const redisPort = process.env.REDIS_PORT;
if( !redisPort ) {
    throw new Error('REDIS_PORT is not defined in environment variables.');
}

// Initialize Redis client with connection details
export const redisClient: RedisClientType = createClient({
    url: `redis://:${redisConnectionKey}@${redisHost}:${redisPort}`,
    socket: {
        tls: true,
        rejectUnauthorized: false,
        reconnectStrategy: (retries) => {
            if (retries > 5) {
                console.error('Max reconnection attempts reached');
                return new Error('Could not connect to Redis after multiple attempts');
            }
            // Reconnect after 1 second
            return 1000;
        }
    }
});

// Handle Redis connection events
redisClient.on('error', (err) => {
    logger.error('Redis Client Error:', err);
    // You might want to implement additional error handling here
});

redisClient.on('connect', () => {
    logger.info('✅ Redis client connected successfully');
});

redisClient.on('reconnecting', () => { 
    logger.info('ℹ️ Redis client reconnecting...');
});

// Connect to Redis when the server starts
export const initializeRedisClient = async (): Promise<void> => {
    try {
        if (!redisClient.isOpen) {
            await redisClient.connect();
        } else {
            logger.info('ℹ️ Redis client already connected');
        }
        
        // Test the connection
        const pong = await redisClient.ping();
        if (pong !== 'PONG') {
            throw new Error('Failed to ping Redis server');
        }
        logger.info('✅ Redis server is responsive');
    } catch (error) {
        logger.error('❌ Failed to connect to Redis:', error);     
        // Instead of exiting, you might want to implement a retry mechanism
        // or let the application handle the error appropriately
        process.exitCode = 1;
        throw error; // Re-throw to allow the caller to handle the error
    }
};


