# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy configuration files
COPY package.json package-lock.json tsconfig.base.json ./
COPY scripts ./scripts

# Copy workspaces
COPY client ./client
COPY server ./server
COPY shared ./shared
COPY simulation ./simulation

# Install dependencies
RUN npm ci

# Fetch assets (if not present)
RUN npm run assets:fetch

# Build packages (order matters)
RUN npm run build:shared
RUN npm run build:simulation
RUN npm run build:client

# Stage 2: Serve
FROM nginx:alpine

# Copy config
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

# Copy build artifacts
COPY --from=builder /app/client/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
