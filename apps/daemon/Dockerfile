# Build stage
FROM node:20-alpine AS builder

# Install pnpm
RUN npm install -g pnpm@9.0.6

WORKDIR /app

# Copy root package files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY turbo.json ./

# Copy shared package
COPY packages/ ./packages/

# Copy daemon package
COPY apps/daemon/package.json ./apps/daemon/

# Install dependencies (skip optional dependencies to save space)
RUN pnpm install --frozen-lockfile --no-optional

# Copy daemon source (excluding electron files)
COPY apps/daemon/ ./apps/daemon/
RUN rm -f ./apps/daemon/src/electron-main.ts ./apps/daemon/src/tray-manager.ts

# Build daemon
RUN pnpm --filter agent-orchestrator-daemon run build

# Production stage
FROM node:20-alpine

# Install pnpm
RUN npm install -g pnpm@9.0.6

WORKDIR /app

# Copy root package files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY turbo.json ./

# Copy shared package
COPY packages/ ./packages/

# Copy daemon package.json
COPY apps/daemon/package.json ./apps/daemon/

# Install production dependencies only (skip optional dependencies)
RUN pnpm install --frozen-lockfile --prod --no-optional

# Copy built daemon from builder
COPY --from=builder /app/apps/daemon/dist ./apps/daemon/dist

# Set working directory to daemon
WORKDIR /app/apps/daemon

# Expose port if needed (for future API endpoints)
# EXPOSE 3001

# Run the daemon
CMD ["node", "dist/index.js"]
