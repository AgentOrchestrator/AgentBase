/**
 * Claude Wrapper Generator
 *
 * Generates Claude Code settings and wrapper scripts for hook integration.
 */

/**
 * Generate Claude Code settings JSON with hooks configuration
 *
 * @param notifyScriptPath - Absolute path to the notify.sh script
 * @returns Settings object for Claude Code hooks
 */
export function generateClaudeSettings(notifyScriptPath: string): object {
  return {
    hooks: {
      UserPromptSubmit: [
        {
          type: 'command',
          command: `${notifyScriptPath} UserPromptSubmit`,
        },
      ],
      Stop: [
        {
          type: 'command',
          command: `${notifyScriptPath} Stop`,
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
