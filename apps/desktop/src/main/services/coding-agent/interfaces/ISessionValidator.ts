/**
 * Interface for validating session existence
 *
 * This interface is OPTIONAL - agents that support session file storage
 * can implement this to check if a session file exists on disk.
 *
 * Design rationale:
 * - Enables consumers to verify a session exists before attempting to resume it
 * - Prevents errors from trying to resume non-existent sessions
 * - Used to determine if a new session should be created vs resuming an existing one
 */
export interface ISessionValidator {
  /**
   * Check if a session file exists for the given session ID and workspace path.
   * A session is considered "active" if its JSONL file exists on disk.
   *
   * @param sessionId - The UUID of the session to check
   * @param workspacePath - The workspace path (used to locate the project directory)
   * @returns true if the session file exists, false otherwise
   */
  checkSessionActive(sessionId: string, workspacePath: string): Promise<boolean>;
}
