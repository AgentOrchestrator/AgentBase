/**
 * Path constants for Agent Hooks Service
 */

import * as path from 'node:path';
import { HOOKS_DIRS, SCRIPT_FILES } from '@agent-orchestrator/shared';

/**
 * Get the base directory for agent hooks configuration
 */
export function getHooksBaseDir(homeDir: string): string {
  return path.join(homeDir, HOOKS_DIRS.BASE);
}

/**
 * Get the hooks scripts directory
 */
export function getHooksScriptsDir(homeDir: string): string {
  return path.join(getHooksBaseDir(homeDir), HOOKS_DIRS.HOOKS);
}

/**
 * Get the path to the notify script
 */
export function getNotifyScriptPath(homeDir: string): string {
  return path.join(getHooksScriptsDir(homeDir), SCRIPT_FILES.NOTIFY);
}

/**
 * Get the path to the Claude settings file
 */
export function getClaudeSettingsPath(homeDir: string): string {
  return path.join(getHooksScriptsDir(homeDir), SCRIPT_FILES.CLAUDE_SETTINGS);
}

/**
 * Get the path to the Claude wrapper script
 */
export function getClaudeWrapperPath(homeDir: string): string {
  return path.join(getHooksScriptsDir(homeDir), SCRIPT_FILES.CLAUDE_WRAPPER);
}
