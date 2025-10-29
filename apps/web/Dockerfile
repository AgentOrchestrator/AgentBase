# Development stage
FROM node:20-slim

# Install pnpm
RUN npm install -g pnpm@9.0.6

WORKDIR /app

# Copy root package files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY turbo.json ./

# Copy shared package
COPY packages/ ./packages/

# Copy web app (including all source files)
COPY apps/web/ ./apps/web/

# Install all dependencies (including optional for native binaries)
RUN pnpm install --frozen-lockfile

# Set working directory to web
WORKDIR /app/apps/web

# Accept build arguments for Supabase credentials
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY

# Set as environment variables
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY

# Set environment to development
ENV NODE_ENV=development

# Expose Next.js port
EXPOSE 3000

# Run Next.js in development mode with hot reload
CMD ["pnpm", "run", "dev"]
