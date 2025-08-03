# Use Node.js LTS
FROM node:20-slim

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY packages/server/package*.json ./packages/server/

# Install all workspace dependencies
RUN npm install

# Install TypeScript types for development dependencies
RUN npm install --save-dev @types/node @types/redis @types/express

# Copy application code
COPY . .

# Install workspace dependencies again to ensure everything is linked
RUN npm install

# Build the application
RUN npm run build -w server

# Expose the port the app runs on
EXPOSE 8099

# Command to run the application
CMD ["npm", "run", "dev", "-w", "server"]
