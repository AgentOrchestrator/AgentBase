# Cursor Messages in Agent Orchestrator

## Source Location

Cursor chat histories are stored in:
```
~/Library/Application Support/Cursor/User/globalStorage/state.vscdb
```

This is a SQLite database containing all Cursor conversations.

## Database Structure

- **Table**: `cursorDiskKV`
- **Composer entries**: `composerData:{uuid}` - conversation metadata
- **Message entries**: `bubbleId:{composer-uuid}:{bubble-uuid}` - individual messages

## Message Types

- **Type 1**: User messages
- **Type 2**: Assistant messages

## Implementation

**File**: `agent-orchestrator-daemon/src/cursor-reader.ts`

The module:
1. Opens Cursor's SQLite database in read-only mode
2. Extracts composers (conversations) and bubbles (messages)
3. Differentiates user vs assistant messages via `type` field
4. Uploads to Supabase with `role` and `source: 'cursor'` metadata

## Viewing Cursor Messages

Once uploaded, Cursor messages appear in:
- **Database**: `chat_histories` table with `metadata.source = 'cursor'`
- **Web UI**: http://localhost:3000 (mixed with Claude Code histories)
- Each message includes `role: 'user' | 'assistant'` field

## Notes

- Most Cursor conversations are empty (metadata only)
- Only conversations with actual text content are uploaded
- Messages include model name when available
