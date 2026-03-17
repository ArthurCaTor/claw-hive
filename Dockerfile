# CLAW-HIVE Dockerfile
# Multi-stage build for production deployment

# Stage 1: Dependencies
FROM node:22-alpine AS deps
WORKDIR /app

# Install npm dependencies
COPY package.json package-lock.json ./
RUN npm ci --only=production

# Stage 2: Builder
FROM node:22-alpine AS builder
WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install all dependencies (including dev for build)
RUN npm ci

# Copy source code
COPY src/ src/
COPY dashboard/ dashboard/
COPY public/ public/
COPY bin/ bin/
COPY vite.config.js ./

# Build the frontend
RUN npm run build

# Stage 3: Production
FROM node:22-alpine AS production
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy production dependencies
COPY --from=deps /app/node_modules ./node_modules

# Copy built files
COPY --from=builder /app/public ./public
COPY --from=builder /app/src ./src
COPY --from=builder /app/bin ./bin
COPY --from=builder /app/package.json ./
COPY --from=builder /app/captures ./captures
COPY --from=builder /app/recordings ./recordings

# Create directories with correct ownership
RUN mkdir -p captures recordings && \
    chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/api/health || exit 1

# Start the server
CMD ["node", "src/server.js"]
