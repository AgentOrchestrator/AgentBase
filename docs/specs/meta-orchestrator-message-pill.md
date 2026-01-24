# Meta-Orchestrator MessagePill Specification

## Overview

Transform MessagePill from "send messages to individual agents" to a **meta-orchestrator** that provides high-level control over all agent nodes on the canvas via natural language.

## Problem Statement

The current MessagePill:
- Sends messages to individual selected agent nodes
- Requires users to manually select agents via ActionPill
- Limited UX value - users can already interact with agents directly

## Proposed Solution

A Claude-powered meta-orchestrator that:
1. **Creates** new agent nodes based on natural language requests
2. **Deletes** agent nodes by name/description
3. **Queries** agent session data (status, progress, summaries)
4. **Orchestrates** multi-agent workflows

## Architecture

### High-Level Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         Desktop App                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────┐       ┌──────────────────────────────────┐  │
│  │  MessagePill   │◄─────►│  OrchestratorMCPService          │  │
│  │  (Renderer)    │       │  (Main Process)                  │  │
│  └────────────────┘       │                                  │  │
│         │                 │  - Registers MCP tools           │  │
│         │                 │  - Manages canvas state access   │  │
│         │                 │  - Starts with desktop app       │  │
│         ▼                 └──────────────────────────────────┘  │
│  ┌────────────────┐                     │                       │
│  │  Chat Display  │                     │                       │
│  │  (JSON parsed) │                     ▼                       │
│  └────────────────┘       ┌──────────────────────────────────┐  │
│                           │  Claude CLI                       │  │
│                           │  --output-format json             │  │
│                           │  --mcp-config settings.local.json │  │
│                           └──────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Components

#### 1. OrchestratorMCPService (Main Process)

New service following the `AgentHooksService` pattern:

```typescript
// apps/desktop/src/main/services/orchestrator-mcp/OrchestratorMCPService.ts

export interface OrchestratorMCPServiceConfig {
  port: number;              // MCP server port (default: 31416)
  homeDir: string;           // For storing MCP server script
}

export class OrchestratorMCPService extends EventEmitter {
  // Lifecycle
  async ensureSetup(): Promise<void>;
  startServer(): void;
  stopServer(): void;

  // Health check
  isHealthy(): Promise<boolean>;

  // Canvas state access (injected)
  setCanvasStateProvider(provider: CanvasStateProvider): void;
}
```

#### 2. MCP Tools

The MCP server exposes these tools to Claude:

```typescript
interface MCPTools {
  // Agent Node Management
  'canvas/list_agents': () => AgentSummary[];
  'canvas/create_agent': (params: CreateAgentParams) => AgentNodeData;
  'canvas/delete_agent': (params: { agentId: string }) => void;

  // Agent Session Data
  'canvas/get_agent_status': (params: { agentId: string }) => AgentStatusInfo;
  'canvas/get_agent_summary': (params: { agentId: string }) => string;
  'canvas/get_agent_progress': (params: { agentId: string }) => AgentProgress;

  // Orchestration
  'canvas/send_message_to_agent': (params: { agentId: string; message: string }) => void;
}

interface AgentSummary {
  agentId: string;
  title: string;
  status: CodingAgentStatus;
  workspacePath: string;
  gitBranch: string;
  summary: string | null;
  progress: AgentProgress | null;
}

interface CreateAgentParams {
  workspacePath: string;
  initialPrompt?: string;
  title?: string;
  gitBranch?: string;
}
```

#### 3. settings.local.json MCP Registration

Extend the existing settings generation to include MCP server:

```json
{
  "hooks": {
    "on_session_start": "/path/to/notify.sh",
    "...": "..."
  },
  "mcpServers": {
    "agent-orchestrator": {
      "command": "node",
      "args": ["/path/to/orchestrator-mcp-server.js"],
      "env": {
        "ORCHESTRATOR_PORT": "31416"
      }
    }
  }
}
```

#### 4. MessagePill Transformation

Transform from channel-based message sending to orchestrator chat:

```typescript
// New store structure
interface OrchestratorPillStore {
  // Chat history
  messages: OrchestratorMessage[];

  // Input state
  inputValue: string;
  isSending: boolean;

  // Session state
  sessionId: string | null;
  isOrchestratorHealthy: boolean;

  // Actions
  sendMessage(content: string): Promise<void>;
  clearHistory(): void;
}

interface OrchestratorMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;

  // For tool calls/results
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
}
```

#### 5. Claude CLI Integration

Use Claude CLI with JSON output for better parsing:

```bash
claude -p "Create a new agent to fix the login bug" \
  --output-format json \
  --mcp-config ~/.agent-orchestrator/settings.local.json
```

JSON output structure (Claude CLI `--output-format json`):

```typescript
interface ClaudeCLIJsonOutput {
  type: 'message' | 'tool_use' | 'tool_result' | 'error';

  // For message
  content?: string;

  // For tool_use
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  tool_use_id?: string;

  // For tool_result
  tool_result?: unknown;

  // For error
  error?: {
    type: string;
    message: string;
  };
}
```

### Data Flow

1. **User types in MessagePill**: "Create a new agent to work on the auth feature"

2. **MessagePill sends to Orchestrator**:
   - Spawns Claude CLI with `--output-format json`
   - Passes MCP config pointing to OrchestratorMCPService

3. **Claude processes request**:
   - Uses `canvas/list_agents` to see current state
   - Uses `canvas/create_agent` with appropriate params
   - Returns response

4. **JSON output parsed**:
   - Each line is a JSON object
   - Tool calls/results are tracked
   - Final message displayed in chat

5. **Canvas updates**:
   - OrchestratorMCPService calls into canvas state
   - New node appears on canvas

### Health Check Flow

Before starting a Claude session:

```typescript
async function ensureOrchestratorReady(): Promise<boolean> {
  const service = getOrchestratorMCPService();

  // 1. Check MCP server is running
  if (!await service.isHealthy()) {
    await service.startServer();
  }

  // 2. Verify settings.local.json has MCP registration
  await service.ensureWorkspaceMCPConfig(workspacePath);

  // 3. Test MCP connection
  return await service.testMCPConnection();
}
```

## Implementation Plan

### Phase 1: MCP Server Foundation
- [ ] Create `OrchestratorMCPService` following `AgentHooksService` pattern
- [ ] Implement basic MCP server with stdio transport
- [ ] Add `canvas/list_agents` tool
- [ ] Generate MCP registration in settings.local.json

### Phase 2: Canvas Integration
- [ ] Implement `CanvasStateProvider` interface
- [ ] Add `canvas/create_agent` tool with node creation
- [ ] Add `canvas/delete_agent` tool
- [ ] Wire up IPC between MCP server and renderer

### Phase 3: MessagePill Transformation
- [ ] Create `OrchestratorPillStore` replacing `messagePillStore`
- [ ] Build Claude CLI JSON output parser
- [ ] Implement chat message display
- [ ] Add streaming support for long responses

### Phase 4: Session Management
- [ ] Add session status query tools
- [ ] Implement progress tracking display
- [ ] Add agent summary retrieval
- [ ] Multi-turn conversation support

## Open Questions

1. **MCP Transport**: Use stdio or HTTP for MCP server?
   - stdio: Simpler, Claude CLI spawns process
   - HTTP: More flexible, can query independently

2. **Canvas State Access**: How to expose canvas state to main process?
   - Option A: IPC calls from main → renderer
   - Option B: Shared state via database
   - Option C: State synchronization service

3. **Session Persistence**: Should orchestrator conversations persist?
   - Store in SQLite alongside canvas state?
   - Ephemeral per-app-session?

4. **Multi-workspace**: How to handle multiple workspaces?
   - Per-workspace MCP config?
   - Global orchestrator with workspace context?

## Related Files

- `apps/desktop/src/main/services/agent-hooks/AgentHooksService.ts` - Pattern reference
- `apps/desktop/src/renderer/features/action-pill/MessagePill.tsx` - Current implementation
- `apps/desktop/src/renderer/features/action-pill/store/messagePillStore.ts` - Current store
- `packages/shared/src/types/agent-node.ts` - AgentNodeData types
- `packages/shared/src/types/canvas.ts` - Canvas types

## Success Criteria

1. User can type "Create an agent to fix bug X" and see new node appear
2. User can ask "What's the status of all agents?" and get summary
3. User can say "Delete the idle agents" and see them removed
4. Chat interface shows Claude's responses with tool calls
5. MCP server health verified before each interaction
