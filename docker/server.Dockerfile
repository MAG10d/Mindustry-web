FROM node:20-alpine

WORKDIR /app

# Install compatibility libraries for native modules (uWebSockets.js)
RUN apk add --no-cache libc6-compat

# Copy configuration files
COPY package.json package-lock.json tsconfig.base.json ./

# Copy workspaces
COPY client ./client
COPY server ./server
COPY shared ./shared
COPY simulation ./simulation

# Install dependencies
RUN npm ci

# Build packages
RUN npm run build:shared
RUN npm run build:simulation
RUN npm run build:server

EXPOSE 3000

CMD ["node", "server/dist/index.js"]
