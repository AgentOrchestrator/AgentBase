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
# Usage: notify.sh <event_type>
#   event_type: UserPromptSubmit, Stop, PermissionRequest, etc.

# Exit early if not in an Agent Orchestrator terminal
if [ -z "\${${ENV_VARS.MARKER}}" ]; then
  exit 0
fi

# Get the hook event type from the first argument
HOOK_EVENT="$1"

# Bail if no event type provided
if [ -z "$HOOK_EVENT" ]; then
  exit 0
fi

# Send notification to orchestrator (fire-and-forget with short timeout)
# Uses --max-time 1 to ensure we don't block the agent
curl -s -X POST "http://localhost:${config.port}/hook" \\
  --max-time 1 \\
  --connect-timeout 1 \\
  -H "Content-Type: application/json" \\
  -d "{
    \\"terminalId\\": \\"\${${ENV_VARS.TERMINAL_ID}}\\",
    \\"workspacePath\\": \\"\${${ENV_VARS.WORKSPACE_PATH}}\\",
    \\"gitBranch\\": \\"\${${ENV_VARS.GIT_BRANCH}}\\",
    \\"sessionId\\": \\"\${CLAUDE_SESSION_ID:-unknown}\\",
    \\"agentId\\": \\"\${${ENV_VARS.AGENT_ID}}\\",
    \\"eventType\\": \\"$HOOK_EVENT\\"
  }" > /dev/null 2>&1 &

# Exit immediately (don't wait for curl)
exit 0
`;
}
