/**
 * Database interface for canvas state persistence
 * Defines the contract that all database implementations must follow
 */

import type { RecentWorkspace } from '@agent-orchestrator/shared';
import type { CodingAgentState } from '../../../types/coding-agent-status';
import type {
  AddOrchestratorMessageInput,
  OrchestratorConversation,
  OrchestratorMessage,
} from '../services/orchestrator/interfaces';
import type { CanvasMetadata, CanvasState } from '../types/database';

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

  // ==========================================================================
  // Recent Workspaces Methods
  // ==========================================================================

  /**
   * Add or update a recent workspace entry
   * @param workspace - The workspace data to upsert
   */
  upsertRecentWorkspace(workspace: RecentWorkspace): Promise<void>;

  /**
   * Get recent workspaces sorted by lastOpenedAt descending
   * @param limit - Maximum number of entries to return (default: 20)
   */
  getRecentWorkspaces(limit?: number): Promise<RecentWorkspace[]>;

  /**
   * Remove a workspace from the recent list
   * @param path - Workspace path to remove
   */
  removeRecentWorkspace(path: string): Promise<void>;

  /**
   * Clear all recent workspaces
   */
  clearAllRecentWorkspaces(): Promise<void>;

  /**
   * Get a specific workspace by path
   * @param path - Workspace path to find
   */
  getRecentWorkspaceByPath(path: string): Promise<RecentWorkspace | null>;

  // ==========================================================================
  // Session Summary Cache Methods
  // ==========================================================================

  /**
   * Get a cached summary for a session
   * @param sessionId - Session ID
   * @param workspacePath - Workspace path
   * @returns The cached summary record, or null if not found
   */
  getSessionSummary(
    sessionId: string,
    workspacePath: string
  ): Promise<{ summary: string; messageCount: number } | null>;

  /**
   * Save or update a summary for a session
   * @param sessionId - Session ID
   * @param workspacePath - Workspace path
   * @param summary - The AI-generated summary
   * @param messageCount - Message count at time of generation (for staleness check)
   */
  saveSessionSummary(
    sessionId: string,
    workspacePath: string,
    summary: string,
    messageCount: number
  ): Promise<void>;

  /**
   * Check if a cached summary exists and is still valid
   * @param sessionId - Session ID
   * @param workspacePath - Workspace path
   * @param currentMessageCount - Current message count to compare against
   * @returns true if summary is stale or doesn't exist
   */
  isSessionSummaryStale(
    sessionId: string,
    workspacePath: string,
    currentMessageCount: number
  ): Promise<boolean>;

  /**
   * Delete a cached summary
   * @param sessionId - Session ID
   * @param workspacePath - Workspace path
   */
  deleteSessionSummary(sessionId: string, workspacePath: string): Promise<void>;

  // ==========================================================================
  // Orchestrator Conversation Methods
  // ==========================================================================

  /**
   * Create a new orchestrator conversation
   * @returns The created conversation with generated UUID
   */
  createOrchestratorConversation(): Promise<OrchestratorConversation>;

  /**
   * Get an orchestrator conversation by ID
   * @param id - Conversation ID
   * @returns The conversation, or null if not found
   */
  getOrchestratorConversation(id: string): Promise<OrchestratorConversation | null>;

  /**
   * Get the most recent orchestrator conversation
   * @returns The most recent conversation, or null if none exist
   */
  getMostRecentOrchestratorConversation(): Promise<OrchestratorConversation | null>;

  /**
   * Delete an orchestrator conversation and its messages
   * @param id - Conversation ID to delete
   */
  deleteOrchestratorConversation(id: string): Promise<void>;

  /**
   * Add a message to an orchestrator conversation
   * @param input - Message data (ID is generated)
   * @returns The created message with generated ID
   */
  addOrchestratorMessage(input: AddOrchestratorMessageInput): Promise<OrchestratorMessage>;

  /**
   * Get all messages in an orchestrator conversation
   * @param conversationId - Conversation ID
   * @returns Messages sorted by timestamp ascending
   */
  getOrchestratorMessages(conversationId: string): Promise<OrchestratorMessage[]>;
}
