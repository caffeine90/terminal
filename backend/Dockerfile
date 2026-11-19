# Build stage
FROM node:26-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source
COPY src ./src
COPY .env.example ./.env.example

# Production stage
FROM node:26-alpine AS production

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy source from builder
COPY --from=builder /app/src ./src

# Change ownership
RUN chown -R nodejs:nodejs /app
USER nodejs

# Environment
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/api/health').then(r => { if (!r.ok) throw new Error('Health check failed') }).catch(() => process.exit(1))"

CMD ["node", "--experimental-strip-types", "src/index.ts"]