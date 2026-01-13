import type {
  Result,
  AgentError,
  SessionIdentifier,
  SessionInfo,
  SessionContent,
  SessionFilter,
} from '../types';

/**
 * Interface for session management operations
 *
 * This interface is OPTIONAL - not all agents support session persistence.
 * Implement this interface if the agent can list, retrieve, and manage sessions.
 *
 * Design rationale:
 * - Separated from ICodingAgentProvider because session storage is not universal
 * - Agents like Claude Code store sessions locally, others may not
 * - Allows capability checking before attempting session operations
 */
export interface ISessionManager {
  /**
   * List available sessions
   *
   * Note: For CLI-only implementations, this may have limited functionality
   * if the CLI doesn't expose a session listing command.
   *
   * @param filter - Optional criteria to filter sessions
   * @returns List of session metadata or an error
   */
  listSessions(filter?: SessionFilter): Promise<Result<SessionInfo[], AgentError>>;

  /**
   * Get a session's full content including messages
   *
   * @param identifier - Session ID, name, or "latest"
   * @returns The session content or null if not found
   */
  getSession(
    identifier: SessionIdentifier
  ): Promise<Result<SessionContent | null, AgentError>>;

  /**
   * Delete a session
   *
   * @param identifier - Session to delete
   */
  deleteSession(identifier: SessionIdentifier): Promise<Result<void, AgentError>>;

  /**
   * Rename a session
   *
   * @param identifier - Session to rename
   * @param newName - The new name
   */
  renameSession(
    identifier: SessionIdentifier,
    newName: string
  ): Promise<Result<void, AgentError>>;
}
