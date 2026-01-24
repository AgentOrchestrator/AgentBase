/**
 * Claude Wrapper Generator
 *
 * Generates Claude Code settings and wrapper scripts for hook integration.
 */

/**
 * Generate Claude Code settings JSON with hooks configuration
 *
 * Uses the new Claude Code hooks format with matcher and hooks array.
 * The format is: { "HookName": [{ "matcher": {...}, "hooks": [...] }] }
 * See: https://code.claude.com/docs/en/hooks
 *
 * @param notifyScriptPath - Absolute path to the notify.sh script
 * @returns Settings object for Claude Code hooks (no outer "hooks" wrapper)
 */
export function generateClaudeSettings(notifyScriptPath: string): object {
  // Outer "hooks" wrapper is REQUIRED for Claude Code to recognize hooks
  // Format follows Superset's working implementation with matcher: "*"
  return {
    hooks: {
      // Called when user submits a prompt (session start)
      UserPromptSubmit: [
        {
          matcher: '*',
          hooks: [
            {
              type: 'command',
              command: notifyScriptPath,
            },
          ],
        },
      ],
      // Called before tool use - only AskUserQuestion triggers ActionPill
      // (filtered in SharedEventDispatcher)
      PreToolUse: [
        {
          matcher: '*',
          hooks: [
            {
              type: 'command',
              command: notifyScriptPath,
            },
          ],
        },
      ],
      // Called when session ends
      Stop: [
        {
          matcher: '*',
          hooks: [
            {
              type: 'command',
              command: notifyScriptPath,
            },
          ],
        },
      ],
    },
  };
}

/**
 * Generate a wrapper script for Claude Code that ensures hooks are configured
 *
 * @param settingsPath - Path to the settings JSON file
 * @returns Bash script content
 */
export function generateClaudeWrapper(settingsPath: string): string {
  return `#!/bin/bash
# Claude Code Wrapper with Agent Orchestrator Hooks
# This wrapper ensures Claude Code uses the orchestrator's hook configuration

# Run claude with the settings file
exec claude --settings "${settingsPath}" "$@"
`;
}
