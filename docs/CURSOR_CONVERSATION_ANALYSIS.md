# Cursor Conversation Analysis - Complete Inventory

## Summary

**Storage Architecture**: Cursor stores conversations in a centralized global database, not in workspace-specific locations.

**Key Finding**: All conversations are stored in the global `state.vscdb` database under the `composerData:` key pattern. Workspace databases contain only UI state (ItemTable), not conversation data.

## Storage Architecture Details

### Database Locations

**macOS**:
- Global database: `~/Library/Application Support/Cursor/User/globalStorage/state.vscdb`
- Workspace storage: `~/Library/Application Support/Cursor/User/workspaceStorage/`

**Linux**:
- Global database: `~/.config/Cursor/User/globalStorage/state.vscdb`
- Workspace storage: `~/.config/Cursor/User/workspaceStorage/`

### Database Schema

The global database uses a key-value structure (`cursorDiskKV` table):

**Key Patterns**:
- `composerData:{conversation-uuid}` - Conversation metadata and messages
- `bubbleId:{conversation-uuid}:{bubble-uuid}` - Legacy individual message storage
- `checkpointId:{uuid}` - Conversation checkpoints/versions
- `messageRequestContext:{uuid}` - Message request metadata

### Conversation Storage Formats

Cursor uses two storage formats for conversations:

1. **Modern Format** (Current):
   - Key: `composerData:{uuid}`
   - Messages embedded in `conversation` array within the value JSON
   - Self-contained conversation object

2. **Legacy Format** (Older conversations):
   - Key: `bubbleId:{conversation-uuid}:{bubble-uuid}`
   - Messages stored as separate entries
   - Requires aggregation by conversation UUID to reconstruct full conversation

## Key Insights

### Centralized Storage
- **All conversations stored globally**: Conversations are NOT workspace-specific
- **Single source of truth**: The global `state.vscdb` database contains all conversations across all workspaces
- **Workspace databases**: Only contain UI state (window positions, tab layouts) via `ItemTable`

### Storage Format Evolution
- **Modern format**: Messages embedded in `composerData.conversation` array
- **Legacy format**: Messages as separate `bubbleId` entries
- **Backward compatibility**: Both formats coexist in the same database

### Conversation States
- **Active conversations**: Have non-empty `conversation` array
- **Empty conversations**: Exist as `composerData` entries but contain no messages (drafts or cleared conversations)
- **Checkpoints**: Versioned conversation states stored as `checkpointId` entries

## Implementation Recommendations

### For Data Extraction
1. **Single database read**: Only read from the global `state.vscdb` database
2. **Handle both formats**: Support both `composerData` (modern) and `bubbleId` (legacy) formats
3. **Filter empty conversations**: Skip conversations with empty `conversation` arrays if only interested in active conversations

### For Analysis Scripts
1. **Scan global database only**: No need to check workspace-specific databases for conversations
2. **Count both formats**: Include both `composerData` entries and unique `bubbleId` conversation UUIDs
3. **Report conversation states**: Distinguish between active (with messages) and empty conversations

## Commands Used

### Global Database Analysis
```bash
# Count direct composerData entries
sqlite3 "/Users/maxprokopp/Library/Application Support/Cursor/User/globalStorage/state.vscdb" \
  "SELECT COUNT(*) FROM cursorDiskKV WHERE key LIKE 'composerData:%';"

# Count unique bubbleId composers
sqlite3 "/Users/maxprokopp/Library/Application Support/Cursor/User/globalStorage/state.vscdb" \
  "SELECT COUNT(DISTINCT substr(key, 9, 37)) FROM cursorDiskKV WHERE key LIKE 'bubbleId:%';"

# List all conversation IDs
sqlite3 "/Users/maxprokopp/Library/Application Support/Cursor/User/globalStorage/state.vscdb" \
  "SELECT substr(key, 13) FROM cursorDiskKV WHERE key LIKE 'composerData:%' ORDER BY key;"
```

### Workspace Storage Investigation
```bash
# Find all workspace-specific databases
find "$HOME/Library/Application Support/Cursor/User/workspaceStorage" -name "*.vscdb" -type f

# Check if composerData has workspace info
sqlite3 "$HOME/Library/Application Support/Cursor/User/globalStorage/state.vscdb" \
  "SELECT key, json_extract(value, '$.workspaceFolder'), json_extract(value, '$.tabId') \
   FROM cursorDiskKV WHERE key LIKE 'composerData:%' LIMIT 5;"

# List all workspace storage directories
ls -la "$HOME/Library/Application Support/Cursor/User/workspaceStorage/"

# Search for state.vscdb files in workspace storage
find "$HOME/Library/Application Support/Cursor/User/workspaceStorage" -name "state.vscdb" -exec echo "=== {} ===" \; -exec sqlite3 {} "SELECT COUNT(*) FROM cursorDiskKV WHERE key LIKE 'composerData:%';" \;
```

## Analysis Results

Run `./scripts/analyze_cursor.sh` to get:
- Total conversation count across both storage formats
- Breakdown of active vs empty conversations
- Key type distribution
- Workspace count (for reference, but conversations are global)
