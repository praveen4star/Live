FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY backend/package*.json ./

# Install dependencies
RUN npm install --production

# Copy source code
COPY backend/src ./src

# Expose API port
EXPOSE 3000

# Start the application
CMD ["node", "src/index.js"] 