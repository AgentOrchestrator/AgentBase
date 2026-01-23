/**
 * Notify Script Generator
 *
 * Generates the bash script that gets called by Claude Code hooks
 * to notify the orchestrator of lifecycle events.
 */

import { ENV_VARS } from './constants.js';

/**
 * Configuration for generating the notify script
 */
export interface NotifyScriptConfig {
  /** Port where the hooks server listens */
  port: number;
  /** Marker to identify orchestrator terminals */
  marker: string;
}

/**
 * Generate the notify.sh bash script
 *
 * This script is called by Claude Code hooks (e.g., UserPromptSubmit, Stop)
 * and sends an HTTP request to the orchestrator with all context.
 *
 * Key features:
 * - Exits early if not in an Agent Orchestrator terminal (checks marker env var)
 * - Sends all required context fields (terminalId, workspacePath, etc.)
 * - Uses short timeouts to not block the agent
 * - Runs fire-and-forget to minimize impact on agent performance
 *
 * @param config - Script configuration
 * @returns Bash script content as string
 */
export function generateNotifyScript(config: NotifyScriptConfig): string {
  return `#!/bin/bash
# Agent Orchestrator Notify Script
# Called by Claude Code hooks to notify the orchestrator of lifecycle events

# ============================================================================
# DEBUG LOGGING - Hypothesis testing for hook execution
# ============================================================================
DEBUG_LOG="/tmp/notify-hook-debug.log"

log_debug() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$DEBUG_LOG"
}

log_debug "========== HOOK SCRIPT CALLED =========="
log_debug "Step 1: Script invoked"
log_debug "  $0 = $0"
log_debug "  $1 = $1"
log_debug "  $@ = $@"
log_debug "  $# = $#"
log_debug "  PWD = $(pwd)"
log_debug "  PPID = $PPID"

# Log all AGENT_ORCHESTRATOR env vars
log_debug "Step 2: Environment variables"
log_debug "  MARKER = \${${ENV_VARS.MARKER}:-EMPTY}"
log_debug "  TERMINAL_ID = \${${ENV_VARS.TERMINAL_ID}:-EMPTY}"
log_debug "  WORKSPACE_PATH = \${${ENV_VARS.WORKSPACE_PATH}:-EMPTY}"
log_debug "  GIT_BRANCH = \${${ENV_VARS.GIT_BRANCH}:-EMPTY}"
log_debug "  AGENT_ID = \${${ENV_VARS.AGENT_ID}:-EMPTY}"
log_debug "  PORT = \${${ENV_VARS.PORT}:-EMPTY}"

# Check if stdin has data (Claude pipes JSON to stdin)
log_debug "Step 3: Checking stdin"
if [ -t 0 ]; then
  log_debug "  stdin is a terminal (no piped data)"
  STDIN_DATA=""
else
  log_debug "  stdin has piped data, reading..."
  STDIN_DATA=$(cat)
  log_debug "  stdin data length: \${#STDIN_DATA}"
  log_debug "  stdin data preview: \${STDIN_DATA:0:200}"
  # Save full stdin to separate file for debugging
  echo "$STDIN_DATA" >> /tmp/notify-hook-stdin.log
fi

# ============================================================================
# ORIGINAL LOGIC WITH DEBUG
# ============================================================================

# Exit early if not in an Agent Orchestrator terminal
log_debug "Step 4: Checking MARKER env var"
if [ -z "\${${ENV_VARS.MARKER}}" ]; then
  log_debug "  MARKER is empty - EXITING (not in orchestrator terminal)"
  exit 0
fi
log_debug "  MARKER is set, continuing"

# Get the hook event type from the first argument
HOOK_EVENT="$1"
log_debug "Step 5: Hook event from $1 = '$HOOK_EVENT'"

# If no argument, try to extract from stdin JSON (like Superset does)
if [ -z "$HOOK_EVENT" ] && [ -n "$STDIN_DATA" ]; then
  log_debug "Step 5b: No $1, trying to extract from stdin JSON"
  HOOK_EVENT=$(echo "$STDIN_DATA" | grep -oE '"hook_event_name"[[:space:]]*:[[:space:]]*"[^"]*"' | grep -oE '"[^"]*"$' | tr -d '"')
  log_debug "  Extracted from stdin: '$HOOK_EVENT'"
fi

# Bail if no event type provided
log_debug "Step 6: Final HOOK_EVENT = '$HOOK_EVENT'"
if [ -z "$HOOK_EVENT" ]; then
  log_debug "  HOOK_EVENT is empty - EXITING"
  exit 0
fi
log_debug "  HOOK_EVENT is set, proceeding to curl"

# Build JSON payload by merging terminal env vars with stdin data from Claude
# The stdin data already has session_id, tool_name, tool_input, tool_use_id
# We add our terminal context fields
# Use jq if available for proper JSON merging, fallback to simple approach
if command -v jq &> /dev/null && [ -n "$STDIN_DATA" ]; then
  JSON_PAYLOAD=$(echo "$STDIN_DATA" | jq --arg terminalId "\${${ENV_VARS.TERMINAL_ID}}" \\
    --arg workspacePath "\${${ENV_VARS.WORKSPACE_PATH}}" \\
    --arg gitBranch "\${${ENV_VARS.GIT_BRANCH}}" \\
    --arg agentId "\${${ENV_VARS.AGENT_ID}}" \\
    --arg eventType "$HOOK_EVENT" \\
    '. + {terminalId: $terminalId, workspacePath: $workspacePath, gitBranch: $gitBranch, agentId: $agentId, eventType: $eventType}')
else
  # Fallback: simple JSON without stdin data parsing
  JSON_PAYLOAD="{
    \\"terminalId\\": \\"\${${ENV_VARS.TERMINAL_ID}}\\",
    \\"workspacePath\\": \\"\${${ENV_VARS.WORKSPACE_PATH}}\\",
    \\"gitBranch\\": \\"\${${ENV_VARS.GIT_BRANCH}}\\",
    \\"sessionId\\": \\"\${CLAUDE_SESSION_ID:-unknown}\\",
    \\"agentId\\": \\"\${${ENV_VARS.AGENT_ID}}\\",
    \\"eventType\\": \\"$HOOK_EVENT\\"
  }"
fi

log_debug "Step 7: Sending HTTP request"
log_debug "  URL: http://localhost:${config.port}/hook"
log_debug "  Payload: $JSON_PAYLOAD"

# Send notification to orchestrator (fire-and-forget with short timeout)
# Uses --max-time 1 to ensure we don't block the agent
curl -s -X POST "http://localhost:${config.port}/hook" \\
  --max-time 1 \\
  --connect-timeout 1 \\
  -H "Content-Type: application/json" \\
  -d "$JSON_PAYLOAD" >> "$DEBUG_LOG" 2>&1 &

CURL_PID=$!
log_debug "Step 8: curl started with PID $CURL_PID"

# Exit immediately (don't wait for curl)
log_debug "Step 9: Exiting script"
log_debug "========================================="
exit 0
`;
}
