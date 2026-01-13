/**
 * Database interface for canvas state persistence
 * Defines the contract that all database implementations must follow
 */

import { CanvasState, CanvasMetadata } from '../types/database';
import type { CodingAgentState } from '../../../types/coding-agent-status';

export interface IDatabase {
  /**
   * Initialize the database (create tables, run migrations, etc.)
   */
  initialize(): Promise<void>;

  /**
   * Save a complete canvas state to the database
   * @param canvasId - Unique identifier for the canvas
   * @param state - The complete canvas state to save
   */
  saveCanvas(canvasId: string, state: CanvasState): Promise<void>;

  /**
   * Load a canvas state from the database
   * @param canvasId - Unique identifier for the canvas
   * @returns The canvas state, or null if not found
   */
  loadCanvas(canvasId: string): Promise<CanvasState | null>;

  /**
   * List all saved canvases with metadata
   * @returns Array of canvas metadata
   */
  listCanvases(): Promise<CanvasMetadata[]>;

  /**
   * Delete a canvas and all its associated data
   * @param canvasId - Unique identifier for the canvas to delete
   */
  deleteCanvas(canvasId: string): Promise<void>;

  /**
   * Get the current canvas ID (the last opened or created canvas)
   * @returns The current canvas ID, or null if none exists
   */
  getCurrentCanvasId(): Promise<string | null>;

  /**
   * Set the current canvas ID
   * @param canvasId - The canvas ID to set as current
   */
  setCurrentCanvasId(canvasId: string): Promise<void>;

  /**
   * Close the database connection
   */
  close(): void;

  // ==========================================================================
  // Agent Status Methods
  // ==========================================================================

  /**
   * Save an agent's status state
   * @param agentId - Unique identifier for the agent
   * @param state - The agent state to save
   */
  saveAgentStatus(agentId: string, state: CodingAgentState): Promise<void>;

  /**
   * Load an agent's status state
   * @param agentId - Unique identifier for the agent
   * @returns The agent state, or null if not found
   */
  loadAgentStatus(agentId: string): Promise<CodingAgentState | null>;

  /**
   * Delete an agent's status state
   * @param agentId - Unique identifier for the agent
   */
  deleteAgentStatus(agentId: string): Promise<void>;

  /**
   * Load all agent status states
   * @returns Array of all agent states
   */
  loadAllAgentStatuses(): Promise<CodingAgentState[]>;
}
