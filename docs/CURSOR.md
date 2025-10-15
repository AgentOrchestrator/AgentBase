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

## Quick SQL Queries

```sql
-- Get all Composer conversations
SELECT value FROM cursorDiskKV WHERE key LIKE 'composerData:%';

-- Get Copilot sessions in workspace
SELECT value FROM ItemTable WHERE key = 'interactive.sessions';

-- Get workspace metadata
SELECT value FROM ItemTable WHERE key = 'composer.composerData';
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
