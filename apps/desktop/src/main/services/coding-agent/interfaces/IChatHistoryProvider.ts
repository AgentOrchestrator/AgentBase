import type { Result, AgentError } from '../types/result.types';
import type { SessionFilterOptions, MessageFilterOptions, SessionChange } from '../types/session.types';
import type { SessionSummary, SessionContent } from '../types/session.types';
import type { CodingAgentMessage } from '../types/message.types';

/**
 * Interface for chat history retrieval operations
 *
 * This interface provides methods for:
 * - Efficient listing without loading all messages
 * - Change detection for incremental sync
 * - Filtering by message type
 * - Streaming for large sessions
 * - Watch capabilities for real-time updates
 */
export interface IChatHistoryProvider {
  /**
   * Get modification times for incremental sync detection
   *
   * @param filter - Optional filter options
   * @returns Map of session ID to last modification timestamp (Unix ms)
   */
  getSessionModificationTimes(
    filter?: SessionFilterOptions
  ): Promise<Result<Map<string, number>, AgentError>>;

  /**
   * List sessions with summaries (without full messages)
   * More efficient than loading full sessions for listing views
   *
   * @param filter - Optional filter options
   * @returns Array of session summaries
   */
  listSessionSummaries(
    filter?: SessionFilterOptions
  ): Promise<Result<SessionSummary[], AgentError>>;

  /**
   * Get full session content with optional message filtering
   *
   * @param sessionId - Session ID to retrieve
   * @param filter - Optional message filter options
   * @returns Session content or null if not found
   */
  getFilteredSession(
    sessionId: string,
    filter?: MessageFilterOptions
  ): Promise<Result<SessionContent | null, AgentError>>;

  /**
   * Stream messages one at a time (memory efficient for large sessions)
   * Optional - not all providers need to implement this
   *
   * @param sessionId - Session ID to stream
   * @param filter - Optional message filter options
   * @yields CodingAgentMessage objects one at a time
   */
  streamSessionMessages?(
    sessionId: string,
    filter?: MessageFilterOptions
  ): AsyncGenerator<CodingAgentMessage, void, unknown>;

  /**
   * Watch for session changes (file modifications, new sessions, deletions)
   * Optional - not all providers need to implement this
   *
   * @param callback - Function called when a session changes
   * @returns Unsubscribe function to stop watching
   */
  watchSessions?(callback: (change: SessionChange) => void): () => void;

  /**
   * Get data source paths for this provider
   * Used for debugging and understanding where data comes from
   *
   * @returns Array of paths where this provider reads data from
   */
  getDataPaths(): string[];
}
