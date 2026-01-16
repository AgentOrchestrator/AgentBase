/**
 * Adapter Configuration Types
 *
 * Configuration options for coding agent adapters.
 */

/**
 * Configuration for adapter initialization and operations.
 */
export interface AdapterConfig {
  /**
   * Working directory for agent operations.
   * Used as the default directory for generate and continue operations.
   */
  workingDirectory?: string;

  /**
   * Agent identifier for tracking and event correlation.
   * Used to associate operations with a specific agent instance.
   */
  agentId?: string;
}
