# Claude Code Messages in Agent Orchestrator

## Source Location

Claude Code chat histories are stored in:
```
~/.claude/history.jsonl
```

This is a JSON Lines file containing all Claude Code conversations.

## File Structure

- **Format**: JSON Lines (JSONL) - one JSON object per line
- **Entry type**: Each line represents a single conversation
- **Key field**: `conversationId` - unique identifier for each conversation

### Message Storage

Messages are stored in a flat array structure:

- Messages stored in root-level `messages` array
- Each message contains `role`, `content`, `timestamp`
- Content can be text or structured tool use/results
- No separate reference lookups needed

## Message Types

- **Role**: `user` or `assistant`
- **Content types**:
  - Text messages
  - Tool uses (with `tool_name` and `parameters`)
  - Tool results (with `output`)

## Implementation

**File**: `agent-orchestrator-daemon/src/claude-code-reader.ts`

The module:
1. Reads `~/.claude/history.jsonl` file line by line
2. Parses each line as a JSON conversation object
3. Extracts messages from the `messages` array
4. Filters for text-only messages (ignores tool use/results)
5. Determines `role` from message type (`user` or `assistant`)
6. Normalizes timestamps to ISO 8601 format
7. Extracts project information:
   - **Conversation name** from first user message or `conversationTitle`
   - **Project path** from `workingDirectory` field in conversation metadata
   - **Project name** derived from the working directory path
8. Stores with `role`, `source: 'claude_code'`, and project metadata

## Viewing Claude Code Messages

Once uploaded, Claude Code messages appear in:
- **Database**: `chat_histories` table with `metadata.source = 'claude_code'`
- **Web UI**: http://localhost:3000 (mixed with Cursor histories)
- Each message includes `role: 'user' | 'assistant'` field

## Metadata Extraction

Each conversation includes the following metadata:

- **conversationName**: Derived from the first user message or conversation title
- **projectName**: Extracted from the working directory path
- **projectPath**: Full path from `workingDirectory` field
- **source**: Always set to `'claude_code'` to distinguish from Cursor conversations

### Project Extraction

Projects are automatically detected from the `workingDirectory` field in each conversation. The system extracts:
- The project name from the last segment of the path
- The full project path

## Notes

- All conversations in history.jsonl contain actual messages
- Tool use and tool result messages are filtered out during upload
- Only human-readable text messages are stored
- Timestamps are stored in ISO 8601 format
- Model information is included when available

## File Access

The history.jsonl file is:
- Continuously appended by Claude Code
- Safe to read while Claude Code is running
- No locking issues (unlike SQLite databases)
- Can be read with standard file I/O operations
