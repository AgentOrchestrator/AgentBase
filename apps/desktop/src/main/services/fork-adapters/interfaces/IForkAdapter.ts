import type { JsonlFilterOptions } from '@agent-orchestrator/shared';
import type { AgentError, Result } from '../../coding-agent/types';

/**
 * Fork adapter interface for copying and transforming session files
 * when forking to a new worktree location.
 *
 * Responsibilities:
 * - Copy session JSONL files from source to destination
 * - Transform file paths within session content to match new worktree
 * - Optionally filter messages to include only partial context
 * - Preserve session history and metadata
 */
export interface IForkAdapter {
  /**
   * Copy and transform a session file to a new worktree location
   *
   * @param sourceSessionId - The session ID to fork from
   * @param targetSessionId - The new session ID for the forked session
   * @param sourceWorkingDir - Source worktree path
   * @param targetWorkingDir - Target worktree path
   * @param filterOptions - Optional filter to include only messages up to a specific point
   * @returns Result indicating success or error
   */
  forkSessionFile(
    sourceSessionId: string,
    targetSessionId: string,
    sourceWorkingDir: string,
    targetWorkingDir: string,
    filterOptions?: JsonlFilterOptions
  ): Promise<Result<void, AgentError>>;

  /**
   * Check if this adapter supports the given agent type
   */
  supportsAgentType(agentType: string): boolean;
}
