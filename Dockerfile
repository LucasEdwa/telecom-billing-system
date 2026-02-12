FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Install TypeScript and build dependencies
RUN npm install -g typescript
RUN npm install --save-dev @types/node

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Remove dev dependencies and source files
RUN npm prune --production
RUN rm -rf src tsconfig.json

EXPOSE 8080

# Use production start command
CMD ["npm", "start"]
