# Cursor Messages in Agent Orchestrator

## Quick Reference

**TL;DR**: All Cursor conversations are stored in ONE global SQLite database. Workspace databases only contain UI state.

| What | Where | Contains |
|------|-------|----------|
| **All conversations** | `~/Library/Application Support/Cursor/User/globalStorage/state.vscdb` | 1,621+ composer conversations |
| **Workspace UI state** | `~/Library/Application Support/Cursor/User/workspaceStorage/{id}/state.vscdb` | File history, open tabs, terminal state |
| **Quick analysis** | `./scripts/analyze_cursor.sh` | Run this to explore your database |

**Key SQL Query**:
```sql
-- Get all conversations
SELECT value FROM cursorDiskKV
WHERE key LIKE 'composerData:%';
```

---

## Source Locations

Cursor data is stored in two separate locations:

### 1. Global Database (All Conversations)
```
~/Library/Application Support/Cursor/User/globalStorage/state.vscdb
```

This SQLite database contains **ALL 1,621+ Cursor composer conversations**. All chat histories are centralized here regardless of which workspace they were created in.

### 2. Workspace Storage (Project Metadata)
```
~/Library/Application Support/Cursor/User/workspaceStorage/{workspace-id}/
├── workspace.json          # Contains project folder path
├── state.vscdb            # Workspace-specific settings (typically empty)
└── state.vscdb.backup
```

There are **69 workspace directories** corresponding to different projects opened in Cursor. Each contains:
- **workspace.json**: Maps the workspace ID to a project folder path
- **state.vscdb**: Workspace-specific settings (does NOT contain conversations)

**Key Finding**: Workspace databases are typically empty. All conversations live in the global database, with project context embedded in the conversation messages themselves (via file/folder selections).

### Workspace Folder Formats

The `workspace.json` files show different project types:

```json
// Local project
{"folder": "file:///Users/username/Developer/project-name"}

// SSH remote
{"folder": "vscode-remote://ssh-remote%2Bserver-name/path/to/project"}

// Dev container
{"folder": "vscode-remote://attached-container+{encoded-json}/path"}
```

## Testing & Exploration Tools

This section provides command-line tools to explore Cursor's database on any machine. These commands work on macOS and Linux systems with SQLite installed.

### Quick Start: Run the Analysis Script

The easiest way to analyze your Cursor database:

```bash
# From the project root
./scripts/analyze_cursor.sh
```

This script will:
- Detect your platform (macOS/Linux)
- Find the Cursor database
- Count conversations and database keys
- Show key type statistics
- Display workspace information
- Verify that conversations are in the global database only

**Output Example**:
```
=== Cursor Database Analysis ===
Total conversations: 1621
Total database keys: 1900
With messages: 939
Empty conversations: 647
Total workspaces: 69
```

For manual exploration, use the commands below:

### Platform-Specific Paths

**macOS**:
```bash
GLOBAL_DB="$HOME/Library/Application Support/Cursor/User/globalStorage/state.vscdb"
WORKSPACE_DIR="$HOME/Library/Application Support/Cursor/User/workspaceStorage"
```

**Linux**:
```bash
GLOBAL_DB="$HOME/.config/Cursor/User/globalStorage/state.vscdb"
WORKSPACE_DIR="$HOME/.config/Cursor/User/workspaceStorage"
```

**Windows** (PowerShell):
```powershell
$GLOBAL_DB = "$env:APPDATA\Cursor\User\globalStorage\state.vscdb"
$WORKSPACE_DIR = "$env:APPDATA\Cursor\User\workspaceStorage"
```

### 1. Check if Cursor Database Exists

```bash
# macOS/Linux
if [ -f "$HOME/Library/Application Support/Cursor/User/globalStorage/state.vscdb" ]; then
  echo "✓ Cursor global database found"
else
  echo "✗ Cursor database not found"
fi
```

### 2. Count Total Conversations

```bash
# macOS
sqlite3 "$HOME/Library/Application Support/Cursor/User/globalStorage/state.vscdb" \
  "SELECT COUNT(*) FROM cursorDiskKV WHERE key LIKE 'composerData:%';"

# Expected output: Number of conversations (e.g., 1621)
```

### 3. List All Workspaces

```bash
# macOS - List all workspace folders
find "$HOME/Library/Application Support/Cursor/User/workspaceStorage" \
  -name "workspace.json" \
  -exec sh -c 'echo "=== $(dirname {}) ==="; cat {}; echo ""' \;
```

### 4. Get Database Statistics

```bash
# Count keys by type in global database
sqlite3 "$HOME/Library/Application Support/Cursor/User/globalStorage/state.vscdb" \
  "SELECT
    substr(key, 1, instr(key || ':', ':') - 1) as key_type,
    COUNT(*) as count
   FROM cursorDiskKV
   GROUP BY key_type
   ORDER BY count DESC;"
```

### 5. Extract a Sample Conversation

```bash
# Get one conversation with all its data
sqlite3 "$HOME/Library/Application Support/Cursor/User/globalStorage/state.vscdb" \
  "SELECT value FROM cursorDiskKV WHERE key LIKE 'composerData:%' LIMIT 1;" \
  | python3 -m json.tool | head -100
```

### 6. Find Conversations with Messages

```bash
# Count conversations that have actual messages vs empty ones
sqlite3 "$HOME/Library/Application Support/Cursor/User/globalStorage/state.vscdb" <<EOF
SELECT
  COUNT(*) as total,
  SUM(CASE WHEN json_array_length(json_extract(value, '$.conversation')) > 0
      THEN 1 ELSE 0 END) as with_messages
FROM cursorDiskKV
WHERE key LIKE 'composerData:%';
EOF
```

### 7. Extract Conversation Names

```bash
# List conversation names (titles)
sqlite3 "$HOME/Library/Application Support/Cursor/User/globalStorage/state.vscdb" \
  "SELECT
    substr(key, 14) as composer_id,
    json_extract(value, '$.name') as conversation_name
   FROM cursorDiskKV
   WHERE key LIKE 'composerData:%'
     AND json_extract(value, '$.name') IS NOT NULL
   LIMIT 20;"
```

### 8. Find Conversations for a Specific Project

```bash
# Search for conversations mentioning a specific project path
PROJECT="mercura"  # Change this to your project name

sqlite3 "$HOME/Library/Application Support/Cursor/User/globalStorage/state.vscdb" \
  "SELECT
    substr(key, 14) as composer_id,
    json_extract(value, '$.name') as name
   FROM cursorDiskKV
   WHERE key LIKE 'composerData:%'
     AND value LIKE '%${PROJECT}%'
   LIMIT 10;"
```

### 9. Check Workspace-Specific State

```bash
# Check what's stored in a workspace database (ItemTable, not conversations)
WORKSPACE_ID="9815b9d5657687c44a589d7d0c1a5bf9"  # Replace with actual ID

sqlite3 "$HOME/Library/Application Support/Cursor/User/workspaceStorage/${WORKSPACE_ID}/state.vscdb" \
  "SELECT key FROM ItemTable ORDER BY key;"
```

### 10. Export All Conversations to JSON

```bash
# Export all conversations to a JSON file for analysis
sqlite3 "$HOME/Library/Application Support/Cursor/User/globalStorage/state.vscdb" \
  "SELECT value FROM cursorDiskKV WHERE key LIKE 'composerData:%';" \
  | while read line; do echo "$line" | python3 -m json.tool; done \
  > cursor_conversations_export.json
```

### 11. Complete Analysis Script

Save this as `analyze_cursor.sh`:

```bash
#!/bin/bash

# Cross-platform Cursor database analyzer
# Works on macOS and Linux

# Detect platform
if [[ "$OSTYPE" == "darwin"* ]]; then
    GLOBAL_DB="$HOME/Library/Application Support/Cursor/User/globalStorage/state.vscdb"
    WORKSPACE_DIR="$HOME/Library/Application Support/Cursor/User/workspaceStorage"
else
    GLOBAL_DB="$HOME/.config/Cursor/User/globalStorage/state.vscdb"
    WORKSPACE_DIR="$HOME/.config/Cursor/User/workspaceStorage"
fi

echo "=== Cursor Database Analysis ==="
echo ""

# Check if database exists
if [ ! -f "$GLOBAL_DB" ]; then
    echo "ERROR: Cursor database not found at: $GLOBAL_DB"
    exit 1
fi

echo "✓ Database found: $GLOBAL_DB"
echo ""

# Total conversations
total_conversations=$(sqlite3 "$GLOBAL_DB" \
  "SELECT COUNT(*) FROM cursorDiskKV WHERE key LIKE 'composerData:%';")
echo "Total conversations: $total_conversations"

# Total database keys
total_keys=$(sqlite3 "$GLOBAL_DB" "SELECT COUNT(*) FROM cursorDiskKV;")
echo "Total database keys: $total_keys"

# Key types breakdown
echo ""
echo "Key types (top 10):"
sqlite3 "$GLOBAL_DB" \
  "SELECT
    substr(key, 1, instr(key || ':', ':') - 1) as key_type,
    COUNT(*) as count
   FROM cursorDiskKV
   GROUP BY key_type
   ORDER BY count DESC
   LIMIT 10;"

# Conversations with messages
echo ""
echo "Conversations with actual messages:"
sqlite3 "$GLOBAL_DB" <<EOF
SELECT
  SUM(CASE WHEN json_array_length(json_extract(value, '$.conversation')) > 0
      THEN 1 ELSE 0 END) as with_messages,
  SUM(CASE WHEN json_array_length(json_extract(value, '$.conversation')) = 0
      THEN 1 ELSE 0 END) as empty_conversations
FROM cursorDiskKV
WHERE key LIKE 'composerData:%';
EOF

# Workspace count
workspace_count=$(find "$WORKSPACE_DIR" -name "workspace.json" 2>/dev/null | wc -l)
echo ""
echo "Total workspaces: $workspace_count"

echo ""
echo "=== Analysis complete ==="
```

Usage:
```bash
chmod +x analyze_cursor.sh
./analyze_cursor.sh
```

### 12. Test on Remote Machines

For testing on different computers, use these one-liners:

```bash
# Quick check (copy-paste friendly)
sqlite3 ~/Library/Application\ Support/Cursor/User/globalStorage/state.vscdb \
  "SELECT COUNT(*) FROM cursorDiskKV WHERE key LIKE 'composerData:%';" \
  && echo "conversations found"

# Check workspace count
find ~/Library/Application\ Support/Cursor/User/workspaceStorage \
  -name "workspace.json" | wc -l | xargs echo "workspaces found"
```

## Database Structure

### Global Database Schema

- **Table**: `cursorDiskKV` (key-value store)
- **Total keys**: ~1,900 entries

**Key Types** (by frequency):
- `composerData:{uuid}` - 1,621 conversation entries
- `checkpointId:{uuid}` - 243 checkpoint entries
- `bubbleId:{composer-uuid}:{bubble-uuid}` - 18 legacy message entries
- `messageRequestContext:{uuid}` - 4 request contexts
- Various `inlineDiffs-*` entries

### Workspace Database Schema

Each workspace database has **two tables**:

1. **`cursorDiskKV`** - Always empty (0 keys)
   - Same structure as global database
   - Reserved for workspace-specific Cursor data
   - Not currently used for conversations

2. **`ItemTable`** - Contains 40-180 entries (active workspaces)
   - Stores VSCode/Cursor workspace UI state
   - **Does NOT contain conversation messages**
   - Contains workspace-specific settings only

**What's in ItemTable**:
- `composer.composerData` - Which composer tabs are open in this workspace (IDs only, not messages)
- `history.entries` - Recently opened files
- `terminal.*` - Terminal panel state and environment variables
- `debug.*` - Breakpoints and debug configurations
- `scm.*` - Source control panel state
- `memento/*` - Editor layout and panel states
- Extension-specific settings
- `notepadData` - Cursor notepad data for workspace

**Key Insight**: Workspace databases store which composers are OPEN in the UI, but the actual conversation content is in the global database.

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

Projects are automatically detected by analyzing file and folder selections embedded in each conversation message's context.

**Data Source**: Each message in `composerData.conversation[]` contains a `context` object with:
```json
{
  "context": {
    "fileSelections": [...],
    "folderSelections": [...],
    "selections": [
      {
        "uri": {
          "fsPath": "/Users/username/Developer/project-name/file.ts",
          "path": "/Users/username/Developer/project-name/file.ts",
          "scheme": "file"
        }
      }
    ]
  }
}
```

The system extracts project metadata from these file paths by looking for patterns like `/Developer/{projectName}/` and extracts:
- **Project name**: e.g., "mercura", "agent-orchestrator"
- **Project path**: e.g., "/Users/username/Developer/mercura"

**Important**: Since workspace databases are empty, the ONLY way to link conversations to projects is through these file/folder paths embedded in the conversation messages. There is no direct workspace-to-conversation mapping.

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

## Summary: Global vs Workspace Storage

### What We Discovered

After investigating both the global and workspace storage:

| Location | Purpose | Contains Conversations? | Contains UI State? |
|----------|---------|------------------------|-------------------|
| **Global Database** (`cursorDiskKV`) | All Cursor conversations | ✅ Yes (1,621+) | ❌ No |
| **Workspace Databases** (`cursorDiskKV`) | Reserved for workspace data | ❌ No (empty) | ❌ No |
| **Workspace Databases** (`ItemTable`) | VSCode/Cursor UI state | ❌ No | ✅ Yes (40-180 items) |
| **workspace.json** (69 files) | Workspace metadata | ❌ No | ❌ No (just folder path) |

### Key Insights

1. **Centralized Conversations**: All 1,621+ composer conversations are stored in ONE global database (`cursorDiskKV` table)
2. **Two-Table Workspace Structure**: Each workspace has:
   - `cursorDiskKV` - Always empty (reserved for future use)
   - `ItemTable` - Contains 40-180 UI state entries (file history, composer tabs, terminal state, etc.)
3. **Project Linking**: Projects are linked to conversations via file paths embedded in message contexts, NOT via workspace IDs
4. **Workspace Metadata**: The `workspace.json` files map workspace IDs to project folders, but this mapping is not used for conversations
5. **UI State Only**: Workspace `ItemTable` stores which composer tabs are OPEN (by ID), but NOT the conversation content
6. **Current Implementation is Correct**: The existing `cursor-reader.ts` implementation correctly reads from the global database and extracts project info from message contexts

### Union & Difference

**For Conversations**:
- **Union**: Global DB (`cursorDiskKV`) ∪ Workspace DBs (`cursorDiskKV`) = All conversations come from Global DB only
- **Difference**: Global DB (`cursorDiskKV`) \ Workspace DBs (`cursorDiskKV`) = All 1,621+ conversations
- **Workspace `cursorDiskKV`**: Empty, reserved for future use

**For UI State**:
- **Union**: Global DB (`cursorDiskKV`) ∪ Workspace DBs (`ItemTable`) = Conversations + UI state
- **Workspace `ItemTable`**: Contains workspace-specific UI state (file history, open composers, terminal state)

**Conclusion**: To extract conversations, only the global database is needed. Workspace databases provide additional context about which composers were open in which workspaces, but don't contain message content.
