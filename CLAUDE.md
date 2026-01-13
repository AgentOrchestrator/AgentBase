# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Purpose

Agent Orchestrator (branded as "Agent Base") aggregates chat histories from AI coding assistants (Claude Code, Cursor, VSCode, Factory, Codex) and displays them through a web dashboard with AI-powered summaries for team collaboration.

## Structure

Monorepo using **npm workspaces** and **Turborepo**.

```
apps/
  cli/              # Setup CLI (Ink - React for terminal)
  daemon/           # Background sync service (Node.js + SQLite)
  desktop/          # Electron app (Vite + React + xterm.js)
  memory-service/   # Rule extraction (Python FastAPI + mem0)
  web/              # Dashboard (Next.js 15 + React 19)
packages/
  shared/           # Shared TypeScript types
supabase/
  migrations/       # Database migrations
```

## Setup

```bash
npm install                 # Install all dependencies
cp .env.example .env        # Copy and configure environment variables
```

For git worktrees, copy `.env` from the main worktree instead:
```bash
cp /path/to/main-worktree/.env .env
```

See `.env.example` for Supabase configuration options (local vs remote).

## Commands

```bash
npm install                 # Install all dependencies
npm run dev                 # Run all apps
npm run dev:daemon          # Run daemon only
npm run dev:web             # Run web only
npm run dev:desktop         # Run desktop only
npm run dev:memory          # Run memory service only
npm run build               # Build all apps
```

## Data Flow

```
IDE files (~/.claude/, Cursor storage, etc.)
    ↓
Daemon (reads, normalizes to ChatHistory, syncs every 10 min)
    ↓
Supabase (with RLS)
    ↓
Web Dashboard
```
