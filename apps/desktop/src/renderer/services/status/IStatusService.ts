/**
 * IStatusService
 *
 * Interface for computed status retrieval.
 * Abstracts status computation logic from the hook layer.
 */

import type {
  CodingAgentStatusInfo,
  StatusChangeListener,
} from '../../../../types/coding-agent-status';

/**
 * Service interface for retrieving computed agent status.
 * Implementations can range from simple passthrough to complex computed status.
 */
export interface IStatusService {
  /**
   * Get the current computed status for a session.
   * @param agentId - The agent identifier
   * @returns Current status info or null if not available
   */
  getStatus(agentId: string): CodingAgentStatusInfo | null;

  /**
   * Subscribe to status changes.
   * @param listener - Callback invoked when status changes
   * @returns Unsubscribe function
   */
  onStatusChange(listener: StatusChangeListener): () => void;
}
