# Cursor Conversation Storage

## Two Conversation Systems (NO OVERLAP)

1. **Composer**: Global DB - ~1,623 conversations
2. **Copilot Chat**: Workspace DBs - ~54 sessions

## Storage Locations

### Global Database (Composer)
```
~/Library/Application Support/Cursor/User/globalStorage/state.vscdb
```
- Table: `cursorDiskKV`
- Keys: `composerData:{id}` and `bubbleId:{id}`

### Workspace Databases (Copilot)
```
~/Library/Application Support/Cursor/User/workspaceStorage/{id}/state.vscdb
```
- Table: `ItemTable`
- Key: `interactive.sessions` (array)
- Also contains: `composer.composerData` linking to global

## Key Insights

- Workspace `cursorDiskKV` tables are **always empty** (100% verified)
- Workspace links to global via `composer.composerData` → `composerId` (99.6% success)
- Composer uses `conversation` array, Copilot uses `requests` array

## Timestamp Limitations

**Per-message timestamps are NOT reliably stored by Cursor:**

- **Composer**: `bubble.createdAt` is `None` for 100% of conversation array bubbles. When present in legacy format, timestamps are batch-assigned (multiple messages share identical timestamps).
- **Copilot**: Only `session.creationDate` exists. No per-message timestamps at all.

**Implementation uses conversation/session-level timestamps only:**
- Composer: `composerData.createdAt` and `lastUpdatedAt`
- Copilot: `session.creationDate`

This means all messages within a session show the same timestamp in the database - this is accurate to what Cursor stores, not a bug.

## Message Storage Details

### Composer Messages (Global DB)
- **Conversation structure**: `composerData:{composerId}`
  - Contains `fullConversationHeadersOnly` array with bubble references
- **Actual messages**: `bubbleId:{composerId}:{bubbleId}`
  - `type: 1` = User message
  - `type: 2` = Assistant response
  - Each bubble contains: `text`, `codeBlocks`, `toolResults`, `capabilities`, etc.

### Workspace Metadata (Workspace DBs)
- **Prompts metadata**: `aiService.prompts` (prompt text + commandType)
- **Generation tracking**: `aiService.generations` (UUID + timestamp + type)
- **Session UI state**: `composer.composerData` (links to global via composerId)

## Quick SQL Queries

```sql
-- Get all Composer conversations (global DB)
SELECT value FROM cursorDiskKV WHERE key LIKE 'composerData:%';

-- Get specific conversation messages (global DB)
SELECT value FROM cursorDiskKV WHERE key LIKE 'bubbleId:{composerId}:%';

-- Get Copilot sessions (workspace DB)
SELECT value FROM ItemTable WHERE key = 'interactive.sessions';

-- Get workspace metadata (workspace DB)
SELECT value FROM ItemTable WHERE key = 'composer.composerData';

-- Get prompt history (workspace DB)
SELECT value FROM ItemTable WHERE key = 'aiService.generations';
```

## Analysis Tools

```bash
# Analyze all Cursor databases
python3 scripts/analyze_cursor_workspaces.py

# Check database schemas
python3 scripts/check_all_db_schemas.py
```

## Implementation

See [cursor-reader.ts](../agent-orchestrator-daemon/src/cursor-reader.ts) for complete reader supporting both systems.
