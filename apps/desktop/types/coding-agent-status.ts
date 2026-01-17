/**
 * CodingAgentStatusManager Type Definitions
 *
 * Domain types are re-exported from @agent-orchestrator/shared.
 * DI interfaces for desktop-specific implementations are defined locally.
 */

// =============================================================================
// Re-export domain types from shared package
// =============================================================================

export type {
  AgentType,
  CodingAgentState,
  CodingAgentStatus,
  CodingAgentStatusInfo,
  TitleConfig,
  ToolType,
} from '@agent-orchestrator/shared';

// Import for use in local interfaces
import type {
  AgentType,
  CodingAgentState,
  CodingAgentStatus,
  CodingAgentStatusInfo,
  TitleConfig,
} from '@agent-orchestrator/shared';

// =============================================================================
// Dependency Interfaces (for DI - desktop-specific)
// =============================================================================

/**
 * Interface for title computation.
 * Implementations can range from simple extraction to LLM-powered.
 */
export interface ITitleComputer {
  /**
   * Compute a title from user messages.
   * @param messages - Array of user message strings
   * @returns Computed title
   */
  computeTitle(messages: string[]): Promise<string>;
}

/**
 * Interface for summary computation.
 * Implementations can range from simple extraction to LLM-powered.
 */
export interface ISummaryComputer {
  /**
   * Compute a summary from messages.
   * @param messages - Array of message strings
   * @returns Computed summary
   */
  computeSummary(messages: string[]): Promise<string>;
}

/**
 * Interface for persisting agent status.
 * Implementations can use SQLite, localStorage, or remote storage.
 */
export interface IStatusPersistence {
  /**
   * Save agent state to storage.
   * @param state - The agent state to persist
   */
  save(state: CodingAgentState): Promise<void>;

  /**
   * Load agent state from storage.
   * @param agentId - The agent ID to load
   * @returns The agent state or null if not found
   */
  load(agentId: string): Promise<CodingAgentState | null>;

  /**
   * Delete agent state from storage.
   * @param agentId - The agent ID to delete
   */
  delete(agentId: string): Promise<void>;

  /**
   * Load all agent states from storage.
   * @returns Array of all persisted agent states
   */
  loadAll(): Promise<CodingAgentState[]>;
}

// =============================================================================
// Event Types
// =============================================================================

/**
 * Callback type for status change events.
 */
export type StatusChangeListener = (
  agentId: string,
  oldStatus: CodingAgentStatusInfo,
  newStatus: CodingAgentStatusInfo
) => void;

// =============================================================================
// Manager Interface
// =============================================================================

/**
 * Protocol for managing coding agent status.
 * All dependencies are injected via constructor for testability.
 */
export interface ICodingAgentStatusManager {
  // Status management
  getStatus(agentId: string): CodingAgentStatusInfo | null;
  updateStatus(
    agentId: string,
    status: CodingAgentStatus,
    context?: Partial<Omit<CodingAgentStatusInfo, 'status' | 'startedAt'>>
  ): void;

  // Title management
  getTitle(agentId: string): TitleConfig | null;
  setTitle(agentId: string, title: string): void;
  computeTitle(agentId: string, userMessages: string[]): Promise<void>;

  // Summary management
  getSummary(agentId: string): string | null;
  computeSummary(agentId: string, messages: string[]): Promise<void>;

  // Full state access
  getState(agentId: string): CodingAgentState | null;
  getAllStates(): CodingAgentState[];

  // Agent lifecycle
  registerAgent(agentId: string, agentType: AgentType): void;
  unregisterAgent(agentId: string): void;

  // Event subscription (returns unsubscribe function)
  onStatusChange(listener: StatusChangeListener): () => void;

  // Persistence
  persist(agentId: string): Promise<void>;
  restore(agentId: string): Promise<void>;
  restoreAll(): Promise<void>;
}
