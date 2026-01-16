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


## Patterns

Rule: *.d.ts files should never define real domain types.

They should only do one thing:

connect a runtime object to a real imported type.

Correct pattern:

// global.d.ts
import type { ElectronAPI } from '@agent-orchestrator/shared';

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};


Wrong pattern:

// global.d.ts
interface ElectronAPI {
  createTerminal(...): void;
}

Type design:
- When designing interfaces/classes/type properties, default to required fields.
- Never assume a property is optional; only make it optional with a clear, explicit reason (document it in the code or the PR description).

## Agent integration guidelines (do/don't)

Do:
- Go through AgentService + vendor adapter for all lifecycle/session actions (start/resume/stop/history). Example: `const agent = useAgentService(); await agent.start();`
- Keep transport details inside adapters (CLI/SDK/IPC). Example: Claude adapter builds the CLI command or SDK call; UI never sees it.
- Let ITerminalService manage terminals. Example: render xterm bound to ITerminalService streams; do not call `window.electronAPI.createTerminal` directly.
- Scope per node/workspace/session. Example: create an agent via registry with `agentId`, `terminalId`, `workspacePath` specific to that node.

Don't:
- Build CLI strings or run vendor binaries from renderer components or hooks.
- Call `window.codingAgentAPI` / `window.electronAPI` from views; route through services.
- Start/stop terminals or agents in UI components; NodeContext/AgentService own lifecycle.
- Share singleton agent instances across nodes; always go through the registry/factories.
