# Cursor Messages in Agent Orchestrator

## Source Location

Cursor chat histories are stored in:
```
~/Library/Application Support/Cursor/User/globalStorage/state.vscdb
```

This is a SQLite database containing all Cursor conversations.

## Database Structure

- **Table**: `cursorDiskKV`
- **Composer entries**: `composerData:{uuid}` - conversation metadata and messages

### Message Storage Patterns

Messages are stored in two different formats depending on the conversation:

1. **Embedded in Composer** (most common):
   - Messages stored in `composerData.conversation` array
   - Each item in the array contains `bubbleId`, `type`, `text`, `richText`
   - No separate `bubbleId:` entries needed

2. **Separate Bubble Entries** (legacy format):
   - Referenced in `composerData.fullConversationHeadersOnly` array
   - Actual content in separate `bubbleId:{composer-uuid}:{bubble-uuid}` entries

## Message Types

- **Type 1**: User messages
- **Type 2**: Assistant messages

## Implementation

**File**: `agent-orchestrator-daemon/src/cursor-reader.ts`

The module:
1. Opens Cursor's SQLite database in read-only mode
2. Extracts all `composerData:` entries from `cursorDiskKV` table
3. For each composer, checks for messages in two locations:
   - Primary: `composerData.conversation` array (embedded messages)
   - Fallback: Separate `bubbleId:` entries (legacy format)
4. Differentiates user vs assistant messages via `type` field (1=user, 2=assistant)
5. Extracts text from `text` field or parses `richText` JSON structure
6. Normalizes timestamps from Unix milliseconds to ISO 8601 format
7. Extracts project/workspace information:
   - **Conversation name** from `composerData.name`
   - **Project name and path** from file/folder selections in `composerData.context`
   - Looks for paths containing `/Developer/{projectName}/` pattern
8. Uploads to Supabase with `role`, `source: 'cursor'`, and project metadata

## Viewing Cursor Messages

Once uploaded, Cursor messages appear in:
- **Database**: `chat_histories` table with `metadata.source = 'cursor'`
- **Web UI**: http://localhost:3000 (mixed with Claude Code histories)
- Each message includes `role: 'user' | 'assistant'` field

## Metadata Extraction

Each conversation includes the following metadata:

- **conversationName**: The title/name of the Cursor composer session (available for ~99% of conversations)
- **projectName**: Extracted from file paths in the conversation context (available for ~62% of conversations)
- **projectPath**: Full path to the project directory
- **source**: Always set to `'cursor'` to distinguish from Claude Code conversations

### Project Extraction

Projects are automatically detected by analyzing file and folder selections in the conversation context. The system looks for paths matching the pattern `/Developer/{projectName}/` and extracts:
- The project name (e.g., "mercura", "agent-orchestrator")
- The full project path (e.g., "/Users/username/Developer/mercura")

## Notes

- Most Cursor conversations are empty (metadata only) - only ~58% have actual messages
- Only conversations with actual text content are uploaded
- Messages include model name when available
- Timestamps are stored as Unix milliseconds and converted to ISO 8601 format

## Database Lock Issues

When Cursor is running, the `state.vscdb` file may be locked. Solutions:

1. **Close Cursor** before running the daemon (simplest)
2. **Create a temporary copy** of the database before reading (recommended for production)
3. Use SQLite's WAL mode with `PRAGMA busy_timeout`

The current implementation uses read-only mode, which works when Cursor is closed but will fail with "database is locked" errors when Cursor is actively writing.
