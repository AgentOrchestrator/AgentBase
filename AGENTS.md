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

## Component Architecture

### Views/Components Separation of Concerns

**Rule:** Views should only observe and handle UI logic. Business logic should move to appropriate services and state hook stores.

**Responsibilities:**

- **Views/Components:**
  - Render UI based on props/state
  - Handle user interactions (clicks, input, etc.)
  - Manage local UI state (open/closed, hover, focus)
  - Observe and display data from stores/services
  - Trigger actions via callbacks or store methods

- **Services:**
  - Business logic and data transformations
  - API calls and data fetching
  - Complex calculations and algorithms
  - External integrations

- **State Hook Stores:**
  - Global application state management
  - State mutations and updates
  - Derived state and computed values
  - State persistence

**Correct pattern:**

```typescript
// service.ts - Business logic
export class AgentService {
  async createAgent(config: AgentConfig): Promise<Agent> {
    // Business logic here
    return await this.api.create(config);
  }
}

// store.ts - State management
export function useAgentStore() {
  const [agents, setAgents] = useState<Agent[]>([]);
  
  const createAgent = async (config: AgentConfig) => {
    const agent = await agentService.createAgent(config);
    setAgents(prev => [...prev, agent]);
  };
  
  return { agents, createAgent };
}

// Component.tsx - UI only
export function AgentView() {
  const { agents, createAgent } = useAgentStore();
  
  const handleCreate = () => {
    createAgent({ name: 'New Agent' });
  };
  
  return (
    <div>
      {agents.map(agent => <AgentCard key={agent.id} agent={agent} />)}
      <button onClick={handleCreate}>Create Agent</button>
    </div>
  );
}
```

**Wrong pattern:**

```typescript
// Component.tsx - Business logic mixed with UI
export function AgentView() {
  const [agents, setAgents] = useState<Agent[]>([]);
  
  const handleCreate = async () => {
    // ❌ Business logic in component
    const response = await fetch('/api/agents', {
      method: 'POST',
      body: JSON.stringify({ name: 'New Agent' })
    });
    const agent = await response.json();
    setAgents(prev => [...prev, agent]);
  };
  
  return <div>...</div>;
}
```
