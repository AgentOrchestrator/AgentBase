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

# Check ALL workspaces for conversations
echo ""
echo "Workspace database contents (checking for conversations):"
echo "----------------------------------------------------------"
total_workspace_conversations=0
workspace_with_convos=0

find "$WORKSPACE_DIR" -name "state.vscdb" 2>/dev/null | while read workspace_db; do
    workspace_id=$(basename "$(dirname "$workspace_db")")

    # Check for composerData entries in workspace database
    composer_count=$(sqlite3 "$workspace_db" "SELECT COUNT(*) FROM cursorDiskKV WHERE key LIKE 'composerData:%';" 2>/dev/null || echo "0")
    bubble_composers=$(sqlite3 "$workspace_db" "SELECT COUNT(DISTINCT substr(key, 10, 36)) FROM cursorDiskKV WHERE key LIKE 'bubbleId:%';" 2>/dev/null || echo "0")

    if [ "$composer_count" -gt 0 ] || [ "$bubble_composers" -gt 0 ]; then
        echo "  ⚠️  Workspace: $workspace_id"
        echo "      composerData entries: $composer_count"
        echo "      bubbleId composers:   $bubble_composers"
        echo ""
        workspace_with_convos=$((workspace_with_convos + 1))
        total_workspace_conversations=$((total_workspace_conversations + composer_count))
    fi
done

if [ "$workspace_with_convos" -eq 0 ]; then
    echo "  ✓ No conversations found in workspace databases"
    echo "  ✓ All conversations are in the global database"
else
    echo "  ⚠️  WARNING: Found $workspace_with_convos workspaces with conversations!"
    echo "  ⚠️  Total workspace conversations: $total_workspace_conversations"
    echo "  ⚠️  These are NOT included in the global database count!"
fi

echo ""
echo "=== Summary ==="
echo ""
echo "Global database conversations:  $total_conversations"

# Note: workspace_with_convos is calculated in a subshell, so we need to recalculate
workspace_conv_count=$(find "$WORKSPACE_DIR" -name "state.vscdb" 2>/dev/null -exec sqlite3 {} "SELECT COUNT(*) FROM cursorDiskKV WHERE key LIKE 'composerData:%';" 2>/dev/null \; | awk '{sum+=$1} END {print sum}')
if [ -z "$workspace_conv_count" ]; then
    workspace_conv_count=0
fi

echo "Workspace conversations:        $workspace_conv_count"
total_all=$((total_conversations + workspace_conv_count))
echo "──────────────────────────────────────────"
echo "TOTAL conversations:            $total_all"
echo ""

if [ "$workspace_conv_count" -gt 0 ]; then
    echo "⚠️  IMPORTANT: Conversations are stored in BOTH locations!"
    echo "   To extract ALL conversations, you must read:"
    echo "   1. Global database: $GLOBAL_DB"
    echo "   2. All workspace databases in: $WORKSPACE_DIR"
else
    echo "✓ All conversations are in the global database"
    echo "✓ To extract conversations, read only the global database"
fi

echo ""
echo "See docs/CURSOR_MESSAGES.md and docs/CURSOR_CONVERSATION_ANALYSIS.md"
echo ""
echo "=== Analysis complete ==="
