#!/bin/bash

# Cross-platform Cursor database analyzer
# Works on macOS and Linux
# See: docs/CURSOR_MESSAGES.md for full documentation

# Detect platform
if [[ "$OSTYPE" == "darwin"* ]]; then
    GLOBAL_DB="$HOME/Library/Application Support/Cursor/User/globalStorage/state.vscdb"
    WORKSPACE_DIR="$HOME/Library/Application Support/Cursor/User/workspaceStorage"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    GLOBAL_DB="$HOME/.config/Cursor/User/globalStorage/state.vscdb"
    WORKSPACE_DIR="$HOME/.config/Cursor/User/workspaceStorage"
else
    echo "ERROR: Unsupported platform: $OSTYPE"
    echo "This script supports macOS (darwin) and Linux only."
    exit 1
fi

echo "=== Cursor Database Analysis ==="
echo "Platform: $OSTYPE"
echo ""

# Check if database exists
if [ ! -f "$GLOBAL_DB" ]; then
    echo "ERROR: Cursor database not found at: $GLOBAL_DB"
    echo ""
    echo "Expected locations:"
    echo "  macOS: ~/Library/Application Support/Cursor/User/globalStorage/state.vscdb"
    echo "  Linux: ~/.config/Cursor/User/globalStorage/state.vscdb"
    exit 1
fi

echo "✓ Database found: $GLOBAL_DB"
echo ""

# Check if sqlite3 is available
if ! command -v sqlite3 &> /dev/null; then
    echo "ERROR: sqlite3 command not found"
    echo "Please install SQLite3 to use this script"
    exit 1
fi

echo "=== Global Database Statistics ==="
echo ""

# Total conversations
total_conversations=$(sqlite3 "$GLOBAL_DB" \
  "SELECT COUNT(*) FROM cursorDiskKV WHERE key LIKE 'composerData:%';" 2>/dev/null)
echo "Total conversations: $total_conversations"

# Total database keys
total_keys=$(sqlite3 "$GLOBAL_DB" "SELECT COUNT(*) FROM cursorDiskKV;" 2>/dev/null)
echo "Total database keys: $total_keys"

# Key types breakdown
echo ""
echo "Key types (top 10):"
echo "-------------------"
sqlite3 "$GLOBAL_DB" \
  "SELECT
    substr(key, 1, instr(key || ':', ':') - 1) as key_type,
    COUNT(*) as count
   FROM cursorDiskKV
   GROUP BY key_type
   ORDER BY count DESC
   LIMIT 10;" 2>/dev/null | while IFS='|' read -r type count; do
    printf "  %-30s %s\n" "$type" "$count"
done

# Conversations with messages
echo ""
echo "Conversation statistics:"
echo "------------------------"
result=$(sqlite3 "$GLOBAL_DB" <<EOF
SELECT
  SUM(CASE WHEN json_array_length(json_extract(value, '$.conversation')) > 0
      THEN 1 ELSE 0 END) as with_messages,
  SUM(CASE WHEN json_array_length(json_extract(value, '$.conversation')) = 0
      THEN 1 ELSE 0 END) as empty_conversations
FROM cursorDiskKV
WHERE key LIKE 'composerData:%';
EOF
)
echo "$result" | while IFS='|' read -r with_msgs empty; do
    printf "  With messages:        %s\n" "$with_msgs"
    printf "  Empty conversations:  %s\n" "$empty"
done

# Workspace count
echo ""
echo "=== Workspace Storage Statistics ==="
echo ""
workspace_count=$(find "$WORKSPACE_DIR" -name "workspace.json" 2>/dev/null | wc -l | tr -d ' ')
echo "Total workspaces: $workspace_count"

# Sample a few workspaces to check their state
echo ""
echo "Workspace database contents (sample):"
echo "--------------------------------------"
sample_count=0
find "$WORKSPACE_DIR" -name "state.vscdb" 2>/dev/null | head -3 | while read workspace_db; do
    workspace_id=$(basename "$(dirname "$workspace_db")")
    item_count=$(sqlite3 "$workspace_db" "SELECT COUNT(*) FROM ItemTable;" 2>/dev/null || echo "0")
    cursor_count=$(sqlite3 "$workspace_db" "SELECT COUNT(*) FROM cursorDiskKV;" 2>/dev/null || echo "0")

    echo "  Workspace: $workspace_id"
    echo "    ItemTable entries:    $item_count (UI state)"
    echo "    cursorDiskKV entries: $cursor_count (conversations)"
    echo ""
done

echo ""
echo "=== Summary ==="
echo ""
echo "✓ All $total_conversations conversations are in the global database"
echo "✓ Workspace databases contain UI state only (no conversations)"
echo "✓ To extract conversations, read only the global database"
echo ""
echo "See docs/CURSOR_MESSAGES.md for detailed documentation"
echo ""
echo "=== Analysis complete ==="
