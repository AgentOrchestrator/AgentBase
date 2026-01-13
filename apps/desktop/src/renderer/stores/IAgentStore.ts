/**
 * Agent Store Interface
 *
 * Observable store interface for accessing agent data.
 * Implementations can be swapped (mock, real, etc.) via dependency injection.
 */

import type { AgentNodeData } from '../types/agent-node';

/**
 * Callback type for agent change events
 */
export type AgentChangeListener = (agent: AgentNodeData) => void;

/**
 * Callback type for all agents change events
 */
export type AllAgentsChangeListener = (agents: AgentNodeData[]) => void;

/**
 * Interface for agent data store
 * Provides read access and subscription capabilities
 */
export interface IAgentStore {
  /**
   * Get a single agent by ID
   * @param agentId - The agent ID to retrieve
   * @returns The agent data or null if not found
   */
  getAgent(agentId: string): AgentNodeData | null;

  /**
   * Get all agents
   * @returns Array of all agent data
   */
  getAllAgents(): AgentNodeData[];

  /**
   * Subscribe to changes for a specific agent
   * @param agentId - The agent ID to watch
   * @param listener - Callback invoked when agent changes
   * @returns Unsubscribe function
   */
  subscribe(agentId: string, listener: AgentChangeListener): () => void;

  /**
   * Subscribe to changes for all agents
   * @param listener - Callback invoked when any agent changes
   * @returns Unsubscribe function
   */
  subscribeAll(listener: AllAgentsChangeListener): () => void;
}
