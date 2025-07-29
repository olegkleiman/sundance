/**
 * Configuration utility for the Sundance client
 * Centralizes all environment-based configuration
 */

const config = {
    // API Configuration
    API_BASE_URL: process.env.REACT_APP_API_BASE_URL,
    
    // Client Configuration
    CLIENT_PORT: process.env.REACT_APP_CLIENT_PORT,
    
    // Development flags
    IS_DEVELOPMENT: process.env.NODE_ENV === 'development',
    IS_PRODUCTION: process.env.NODE_ENV === 'production',
    
    // API Endpoints (constructed from base URL)
    get ENDPOINTS() {
        return {
            LOGIN: `${this.API_BASE_URL}/api/auth/login`,
            INIT: `${this.API_BASE_URL}/api/chat/init`,
            COMPLETION: `${this.API_BASE_URL}/api/chat/completion`,
            SEARCH: `${this.API_BASE_URL}/api/chat/search`,
            INGEST: `${this.API_BASE_URL}/api/chat/ingest`,
            HEALTH: `${this.API_BASE_URL}/`,
        };
    },
    
    // Request defaults
    REQUEST_DEFAULTS: {
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
        },
    },
};

// Validate required configuration
const requiredConfig = ['API_BASE_URL'];
const missingConfig = requiredConfig.filter(key => !config[key]);

if (missingConfig.length > 0) {
    console.error('Missing required configuration:', missingConfig);
    throw new Error(`Missing required environment variables: ${missingConfig.join(', ')}`);
}

// Log configuration in development
if (config.IS_DEVELOPMENT) {
    console.log('Client Configuration:', {
        API_BASE_URL: config.API_BASE_URL,
        CLIENT_PORT: config.CLIENT_PORT,
        NODE_ENV: process.env.NODE_ENV,
    });
}

export default config;
