# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Purpose

Agent Orchestrator (branded as "Agent Base") aggregates chat histories from AI coding assistants (Claude Code, Cursor, VSCode, Factory, Codex) and displays them through a desktop application with AI-powered summaries for team collaboration.

## Structure

Monorepo using **npm workspaces** and **Turborepo**.

```
apps/
  desktop/          # Electron app (Vite + React + xterm.js)
packages/
  shared/           # Shared TypeScript types and readers
```

## Setup

```bash
npm install                 # Install all dependencies
cp .env.local.example .env  # Configure environment
```

For git worktrees, copy `.env` from the main worktree instead:
```bash
cp /path/to/main-worktree/.env .env
```

## Commands

```bash
npm install                 # Install all dependencies
npm run dev                 # Run the desktop app
npm run dev:desktop         # Run desktop only
npm run build               # Build all apps
```

## Data Flow

```
IDE files (~/.claude/, Cursor storage, etc.)
    ↓
Readers (packages/shared/src/readers/) - read and normalize to ChatHistory
    ↓
Desktop App (Electron main process)
    ↓
Storage (SQLite)
```


## Patterns

Rule: *.d.ts files should never define real domain types.

They should only do one thing:

connect a runtime object to a real imported type.

Rule: Avoid using the spread operator; use explicit replacement instead as much as possible, because the spread operator hides what is being replaced.

Rule: Never use defensive defaults. Let the code fail explicitly or ask for user input during implementation. Defensive defaults hide missing configuration and create silent failures.

This applies to:
- Configuration values
- Function parameters (prefer required parameters over optional with defaults)
- Object construction (throw if required fields are missing)
- Event/action building (require context, don't use placeholder values like 'unknown')

Correct pattern:

```typescript
// ❌ Wrong: Defensive default hides missing config
const apiUrl = config.apiUrl || 'http://localhost:3000';

// ✅ Correct: Fail explicitly
if (!config.apiUrl) {
  throw new Error('config.apiUrl is required');
}
const apiUrl = config.apiUrl;

// ✅ Also correct: Ask user during implementation
const apiUrl = config.apiUrl; // Will fail at runtime if missing, prompting proper setup
```

```typescript
// ❌ Wrong: Default parameter hides missing context
function buildEvent(context?: EventContext) {
  return {
    agentId: context?.agentId ?? 'unknown',  // Silent failure - bugs hidden
    sessionId: context?.sessionId ?? 'unknown',
  };
}

// ✅ Correct: Require the context parameter
function buildEvent(context: EventContext) {
  if (!context.agentId) {
    throw new Error('context.agentId is required');
  }
  if (!context.sessionId) {
    throw new Error('context.sessionId is required');
  }
  return {
    agentId: context.agentId,
    sessionId: context.sessionId,
  };
}
```

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
