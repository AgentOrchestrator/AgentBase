import type { Result, AgentError } from '../../coding-agent/types';

/**
 * Fork adapter interface for copying and transforming session files
 * when forking to a new worktree location.
 *
 * Responsibilities:
 * - Copy session JSONL files from source to destination
 * - Transform file paths within session content to match new worktree
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
   * @returns Result indicating success or error
   */
  forkSessionFile(
    sourceSessionId: string,
    targetSessionId: string,
    sourceWorkingDir: string,
    targetWorkingDir: string
  ): Promise<Result<void, AgentError>>;

  /**
   * Check if this adapter supports the given agent type
   */
  supportsAgentType(agentType: string): boolean;
}
