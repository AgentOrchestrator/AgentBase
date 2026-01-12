import type { Result, AgentError } from '../types';

/**
 * Interface for process lifecycle management
 *
 * This interface handles the operational aspects of managing CLI processes,
 * separate from the chat/session interfaces.
 *
 * Design rationale:
 * - Process management is orthogonal to chat functionality
 * - Enables different process strategies (pooling, on-demand)
 * - Ensures proper resource cleanup
 *
 * Note: getCapabilities() is in ICodingAgentProvider, not here,
 * because all agents need capability checking.
 */
export interface IProcessLifecycle {
  /**
   * Initialize the agent
   *
   * Verifies CLI availability, sets up resources, etc.
   * Must be called before using other methods.
   */
  initialize(): Promise<Result<void, AgentError>>;

  /**
   * Check if the agent is available and ready
   *
   * Returns true if the CLI is installed and accessible.
   */
  isAvailable(): Promise<boolean>;

  /**
   * Dispose of resources
   *
   * Kills any running processes and cleans up.
   * The agent should not be used after this is called.
   */
  dispose(): Promise<void>;

  /**
   * Cancel all running operations
   *
   * Terminates any in-flight requests without full disposal.
   * The agent can still be used after this.
   */
  cancelAll(): Promise<void>;
}
