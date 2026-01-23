/**
 * Terminal Environment Builder
 *
 * Builds environment variables to inject into terminal processes
 * for agent-to-orchestrator communication.
 */

import { ENV_VARS, TERMINAL_MARKER } from './constants.js';

/**
 * Parameters for building terminal environment variables
 */
export interface TerminalEnvParams {
  /** Unique terminal identifier for routing events */
  terminalId: string;
  /** Workspace/project path for context */
  workspacePath: string;
  /** Current git branch for context (null if not in a git repo) */
  gitBranch: string | null;
  /** Agent identifier for tracking */
  agentId: string;
  /** Port for HTTP callbacks */
  port: number;
}

/**
 * Build environment variables to inject into terminal processes
 *
 * These env vars enable terminal-based agents (like Claude Code CLI)
 * to call back to the orchestrator via HTTP hooks.
 *
 * @param params - Terminal configuration parameters
 * @returns Record of environment variables to merge into process.env
 */
export function buildTerminalEnv(params: TerminalEnvParams): Record<string, string> {
  const env: Record<string, string> = {
    [ENV_VARS.TERMINAL_ID]: params.terminalId,
    [ENV_VARS.WORKSPACE_PATH]: params.workspacePath,
    [ENV_VARS.AGENT_ID]: params.agentId,
    [ENV_VARS.PORT]: String(params.port),
    [ENV_VARS.MARKER]: TERMINAL_MARKER,
  };

  // Only set git branch if available (null means not in a git repo)
  if (params.gitBranch !== null) {
    env[ENV_VARS.GIT_BRANCH] = params.gitBranch;
  }

  return env;
}
