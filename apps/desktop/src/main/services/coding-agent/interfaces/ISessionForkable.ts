import type { AgentError, ForkOptions, Result, SessionInfo } from '../types';

/**
 * Interface for forking sessions
 *
 * This interface is OPTIONAL - an advanced capability that allows
 * creating a new session that branches from an existing one.
 *
 * Design rationale:
 * - Separated because forking is an advanced feature not all agents support
 * - Claude Code supports this via --fork-session --session-id <parent>
 * - Enables experimentation with different approaches from a common point
 */
export interface ISessionForkable {
  /**
   * Fork an existing session
   *
   * Creates a new session that inherits the conversation history
   * from the parent session up to the fork point.
   *
   * For Claude Code: `claude --fork-session --session-id <parent>`
   *
   * @param options - Fork options including sessionId to fork from
   * @returns Metadata of the newly created session
   */
  forkSession(options: ForkOptions): Promise<Result<SessionInfo, AgentError>>;
}
