# Chat History Provider

A vendor-agnostic interface for retrieving chat history from AI coding assistants.

## Overview

`IChatHistoryProvider` abstracts chat history retrieval across different coding agents (Claude Code, Cursor, Codex, etc.). Write your code once against the interface, and it works with any supported agent.

```
┌─────────────────────────────────────────────────────────┐
│                    Your Application                      │
│                           │                              │
│                  IChatHistoryProvider                    │
│                           │                              │
├─────────────┬─────────────┼─────────────┬───────────────┤
│ ClaudeCode  │   Cursor    │    Codex    │    Factory    │
│   Agent     │   Agent     │    Agent    │    Agent      │
└─────────────┴─────────────┴─────────────┴───────────────┘
```

## Vendor-Agnostic Usage

### Basic Pattern

```typescript
import type { IChatHistoryProvider } from '../interfaces';

// Accept any provider - doesn't matter which agent
async function displayRecentSessions(provider: IChatHistoryProvider) {
  const result = await provider.listSessionSummaries({ lookbackDays: 7 });

  if (!result.success) {
    console.error('Failed:', result.error?.message);
    return;
  }

  for (const session of result.data) {
    console.log(`${session.id} - ${session.projectName}`);
    console.log(`  Messages: ${session.messageCount}, Tools: ${session.toolCallCount}`);
    console.log(`  First: ${session.firstUserMessage?.substring(0, 50)}...`);
  }
}
```

### Working with Multiple Providers

```typescript
import type { IChatHistoryProvider } from '../interfaces';
import type { SessionSummary } from '../types';

// Aggregate sessions from multiple agents
async function getAllSessions(
  providers: IChatHistoryProvider[]
): Promise<SessionSummary[]> {
  const allSessions: SessionSummary[] = [];

  for (const provider of providers) {
    const result = await provider.listSessionSummaries({ lookbackDays: 7 });
    if (result.success) {
      allSessions.push(...result.data);
    }
  }

  // Sort by timestamp across all providers
  return allSessions.sort((a, b) =>
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}
```

### Fetching Full Session Content

```typescript
async function getSessionMessages(
  provider: IChatHistoryProvider,
  sessionId: string
) {
  const result = await provider.getFilteredSession(sessionId);

  if (!result.success || !result.data) {
    return null;
  }

  const session = result.data;

  for (const message of session.messages) {
    switch (message.messageType) {
      case 'user':
        console.log(`User: ${message.content}`);
        break;
      case 'assistant':
        console.log(`Assistant: ${message.content}`);
        break;
      case 'tool_call':
        console.log(`Tool: ${message.tool?.name} (${message.tool?.category})`);
        break;
      case 'thinking':
        console.log(`Thinking: ${message.thinking?.content.substring(0, 100)}...`);
        break;
    }
  }

  return session;
}
```

## Filtering Messages

### By Message Type

```typescript
// Get only tool calls
const result = await provider.getFilteredSession(sessionId, {
  messageTypes: ['tool_call', 'tool_result']
});

// Get only user/assistant conversation (no tools, no thinking)
const result = await provider.getFilteredSession(sessionId, {
  messageTypes: ['user', 'assistant']
});
```

### By Role

```typescript
// Get only user messages
const result = await provider.getFilteredSession(sessionId, {
  roles: ['user']
});
```

### By Content

```typescript
// Search for specific text
const result = await provider.getFilteredSession(sessionId, {
  searchText: 'authentication'
});
```

### Session-Level Filtering

```typescript
// Only sessions with thinking blocks
const result = await provider.listSessionSummaries({
  hasThinking: true
});

// Only sessions with 10+ tool calls
const result = await provider.listSessionSummaries({
  minToolCallCount: 10
});

// Filter by project
const result = await provider.listSessionSummaries({
  projectName: 'my-project'
});
```

## Streaming (Memory Efficient)

For large sessions, use the streaming API to process messages one at a time:

```typescript
async function processLargeSession(
  provider: IChatHistoryProvider,
  sessionId: string
) {
  const stream = provider.streamSessionMessages?.(sessionId);
  if (!stream) {
    console.log('Provider does not support streaming');
    return;
  }

  let toolCount = 0;

  for await (const message of stream) {
    if (message.messageType === 'tool_call') {
      toolCount++;
      console.log(`Tool ${toolCount}: ${message.tool?.name}`);
    }
  }

  console.log(`Total tools: ${toolCount}`);
}
```

## Incremental Sync

For efficient polling/sync scenarios:

```typescript
let lastSyncTime = 0;

async function syncNewSessions(provider: IChatHistoryProvider) {
  // Get only sessions modified since last sync
  const modTimes = await provider.getSessionModificationTimes({
    sinceTimestamp: lastSyncTime
  });

  if (!modTimes.success) return;

  for (const [sessionId, mtime] of modTimes.data) {
    console.log(`Session ${sessionId} modified at ${new Date(mtime)}`);
    // Fetch and process the updated session...
  }

  lastSyncTime = Date.now();
}
```

## Message Types

| Type | Description |
|------|-------------|
| `user` | User input message |
| `assistant` | Assistant response text |
| `tool_call` | Tool invocation (Read, Write, Bash, etc.) |
| `tool_result` | Result from a tool call |
| `thinking` | Chain-of-thought reasoning |
| `mcp_tool` | MCP server tool call |
| `system` | System message |
| `summary` | Conversation summary |
| `error` | Error message |

## Tool Categories

| Category | Examples |
|----------|----------|
| `file_read` | Read, cat, head |
| `file_write` | Write, Edit |
| `file_search` | Glob, Grep, find |
| `shell` | Bash, terminal |
| `web` | WebFetch, WebSearch |
| `code_intel` | LSP operations |
| `mcp` | MCP server tools |
| `custom` | Unknown/other |

## Rich Message Fields

```typescript
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;

  // Rich type information
  messageType?: MessageType;

  // Tool details (when messageType is 'tool_call' or 'tool_result')
  tool?: {
    name: string;
    category: ToolCategory;
    input?: Record<string, unknown>;
    output?: string;
    status?: 'pending' | 'success' | 'error';
  };

  // Thinking content (when messageType is 'thinking')
  thinking?: {
    content: string;
    isRedacted?: boolean;
  };

  // Raw agent data (preserved for debugging)
  agentMetadata?: Record<string, unknown>;
}
```

## Creating a Provider Instance

```typescript
import { ClaudeCodeAgent } from '../implementations/ClaudeCodeAgent';

// Create and initialize
const agent = new ClaudeCodeAgent({});
await agent.initialize();

// Use as IChatHistoryProvider
const sessions = await agent.listSessionSummaries({ lookbackDays: 7 });
```

## Data Paths

Each provider reads from agent-specific locations:

```typescript
// Get where a provider reads data from
const paths = provider.getDataPaths();
// ClaudeCodeAgent: ['~/.claude/projects']
// CursorAgent: ['~/Library/Application Support/Cursor/...']
```

## Error Handling

All methods return a `Result<T, AgentError>` type:

```typescript
const result = await provider.listSessionSummaries();

if (result.success) {
  // result.data contains the sessions
  console.log(result.data);
} else {
  // result.error contains error details
  console.error(result.error?.code, result.error?.message);
}
```

## Interface Reference

```typescript
interface IChatHistoryProvider {
  // List sessions with metadata (fast, no full message loading)
  listSessionSummaries(filter?: SessionFilterOptions): Promise<Result<SessionSummary[], AgentError>>;

  // Get full session with messages
  getFilteredSession(sessionId: string, filter?: MessageFilterOptions): Promise<Result<SessionContent | null, AgentError>>;

  // Get modification times for sync
  getSessionModificationTimes(filter?: SessionFilterOptions): Promise<Result<Map<string, number>, AgentError>>;

  // Stream messages (optional, memory efficient)
  streamSessionMessages?(sessionId: string, filter?: MessageFilterOptions): AsyncGenerator<ChatMessage>;

  // Watch for changes (optional)
  watchSessions?(callback: (change: SessionChange) => void): () => void;

  // Get data source paths
  getDataPaths(): string[];
}
```
