# Sundance Client

React-based client application for the Sundance AI chatbox.

## Environment Configuration

The client uses environment variables to configure server endpoints and other settings. This avoids hardcoding server addresses in the source code.

### Setup

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Update the `.env` file with your configuration:
   ```bash
   # API server base URL
   REACT_APP_API_BASE_URL=http://localhost:8099
   
   # Client development port
   REACT_APP_CLIENT_PORT=5001
   ```

### Available Environment Variables

- `REACT_APP_API_BASE_URL`: The base URL of the Sundance server API (default: http://localhost:8099)
- `REACT_APP_CLIENT_PORT`: The port for the development server (default: 5001)

### Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The client will be available at `http://localhost:5001` (or the port specified in `REACT_APP_CLIENT_PORT`).

### API Client

The application uses a centralized API client (`src/utils/apiClient.js`) that automatically uses the configured environment variables. This ensures all server communication uses the correct endpoints without hardcoded URLs.

### Configuration Management

- Configuration is centralized in `src/config/config.js`
- Environment variables are validated at startup
- Missing required configuration will throw an error
- Development mode logs the current configuration for debugging

## Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run compile` - Build the application for production
