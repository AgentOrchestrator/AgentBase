# CLAUDE.md

Agent Orchestrator ("Agent Base") - Desktop app aggregating AI coding assistant chat histories with AI-powered summaries.

## Structure

```
apps/desktop/          # Electron + Vite + React + xterm.js
packages/shared/       # Shared types and readers
```

## Commands

```bash
npm install                 # Install dependencies
npm run dev                 # Run desktop app
npm run dev:mcp             # Run with MCP server (E2E automation)
npm run build               # Build all
```

## Data Flow

```
IDE files → Readers → Electron Main → SQLite
```

---

## E2E Automation

Start MCP mode: `npm run dev:mcp` → Server at `http://localhost:3100/mcp`

### MCP Tools

| Category | Tools |
|----------|-------|
| **Expose** | `expose_list`, `expose_get`, `expose_set`, `expose_call` |
| **UI** | `ui_screenshot`, `ui_click`, `ui_type`, `ui_query` |
| **Canvas** | `canvas_add_node`, `canvas_remove_node`, `canvas_connect`, `canvas_query` |
| **State** | `state_get`, `state_set` |
| **Logs** | `log_inject`, `log_read`, `log_clear` |

### Quick Example

```typescript
expose_list()                                              // Discover components
expose_call({ id: "chat:sess-1", key: "type", args: ["Hello"] })
expose_call({ id: "chat:sess-1", key: "send" })
expose_get({ id: "chat:sess-1", key: "isStreaming" })      // Check state
ui_screenshot()                                            // Verify visually
```

---

## Patterns

### 1. useExpose (Required for Interactive Components)

Every interactive component MUST expose state/actions for automation.

```typescript
import { useExpose } from '@agent-orchestrator/shared';

function ChatInput({ sessionId, onSend }) {
  const [value, setValue] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);

  useExpose(`chat:${sessionId}`, {
    value, isStreaming,           // State (read)
    setValue,                     // Setter (write)
    send: () => onSend(value),    // Action (call)
    clear: () => setValue(''),
  });

  return <input value={value} onChange={e => setValue(e.target.value)} />;
}
```

**Binding Types:**
```typescript
useExpose('id', {
  count: items.length,                    // Primitive → expose_get
  setValue,                               // setXxx → expose_set
  send: () => doSend(),                   // Function → expose_call
  data: { get: () => x, set: v => x = v } // Accessor → get/set
});
```

**DOM Bindings (third-party components):**
```typescript
useExpose('form', {
  value: domBinding(inputRef),    // Read/write DOM
  submit: domClick(buttonRef),    // Trigger click
});
```

**IDs:** `'sidebar'` (single) | `'chat:${sessionId}'` (multiple) | `useExposeId('prefix')` (auto)

**Tags:** `useExpose('id', {...}, ['critical-path'])` → `expose_list({ tag: 'critical-path' })`

**Non-React:** `const unregister = expose('id', {...})`

---

### 2. Log Injection

Ring buffer (1000 entries). Sources: `console` | `ipc` | `state` | `mcp` | `injected`

```typescript
// Inject
log_inject({ level: "info", message: "Test started" })
log_inject({ level: "error", message: "Failure", meta: { code: 500 } })

// Read with filters
log_read({ level: "warn", source: "mcp", limit: 50, pattern: "timeout" })

// Test pattern: bracket with markers
log_clear()
log_inject({ level: "info", message: "TEST:start" })
// ... actions ...
log_inject({ level: "info", message: "TEST:end" })
log_read({ pattern: "TEST:" })
```

**In code:**
```typescript
import { getLogServer } from './instrumentation/logging';
getLogServer().log('info', 'state', 'Session created', { sessionId });
```

---

### 3. No Defensive Defaults

Let code fail explicitly. No silent fallbacks.

```typescript
// ❌ const url = config.url || 'localhost';
// ❌ agentId: context?.agentId ?? 'unknown'

// ✅
if (!config.url) throw new Error('config.url required');
const url = config.url;
```

---

### 4. No Spread Operator

Use explicit assignment to show what's being replaced.

```typescript
// ❌ return { ...state, value: newValue };
// ✅ return { id: state.id, name: state.name, value: newValue };
```

---

### 5. Type Declarations

`*.d.ts` files only connect runtime objects to imported types.

```typescript
// ✅ global.d.ts
import type { ElectronAPI } from '@agent-orchestrator/shared';
declare global { interface Window { electronAPI: ElectronAPI } }

// ❌ Don't define types in .d.ts
interface ElectronAPI { createTerminal(): void }
```

---

### 6. Component Architecture

Views = UI only. Business logic → Services + Stores.

```typescript
// Service: business logic
class AgentService { async create(config) { return api.create(config); } }

// Store: state management
function useAgentStore() {
  const [agents, setAgents] = useState([]);
  const create = async (c) => setAgents([...agents, await service.create(c)]);
  return { agents, create };
}

// Component: UI only
function AgentView() {
  const { agents, create } = useAgentStore();
  return <button onClick={() => create({ name: 'New' })}>Add</button>;
}
```

```typescript
// ❌ Don't put fetch/business logic in components
const handleCreate = async () => {
  const res = await fetch('/api/agents', { method: 'POST', body: '...' });
  setAgents([...agents, await res.json()]);
};
```
