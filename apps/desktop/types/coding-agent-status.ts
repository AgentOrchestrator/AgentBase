/**
 * CodingAgentStatusManager Type Definitions
 *
 * Unified status types derived from Claude Code and Cursor coding agents.
 * Designed for dependency injection with all implementations being swappable.
 */

// =============================================================================
// Status Types
// =============================================================================

/**
 * All possible status states for a coding agent.
 * Unified from Claude Code (thinking, executing_tool, awaiting_input) and
 * Cursor (idle, running, streaming, paused, completed, error).
 */
export type CodingAgentStatus =
  | 'idle' // Waiting for user input
  | 'running' // Actively processing a task
  | 'thinking' // Deep reasoning/planning mode
  | 'streaming' // Generating output in real-time
  | 'executing_tool' // Running a tool (bash, read, write, etc.)
  | 'awaiting_input' // Waiting for user response/permission
  | 'paused' // Temporarily suspended
  | 'completed' // Task finished
  | 'error'; // Error occurred

/**
 * Categories of tools that can be executed by a coding agent.
 */
export type ToolType =
  | 'bash'
  | 'read'
  | 'write'
  | 'edit'
  | 'search'
  | 'lsp'
  | 'fetch'
  | 'mcp'
  | 'unknown';

/**
 * Coding agent types (aligned with daemon's AgentType).
 */
export type AgentType =
  | 'claude_code'
  | 'cursor'
  | 'codex'
  | 'windsurf'
  | 'vscode'
  | 'factory'
  | 'other';

// =============================================================================
// Status Info
// =============================================================================

/**
 * Detailed status information with contextual data.
 */
export interface CodingAgentStatusInfo {
  /** Current status of the agent */
  status: CodingAgentStatus;

  /** Name of the tool being executed (when status is 'executing_tool') */
  toolName?: string;

  /** Category of the tool (when status is 'executing_tool') */
  toolType?: ToolType;

  /** Error message (when status is 'error') */
  errorMessage?: string;

  /** Name of subagent running (e.g., 'Plan Agent', 'Explore Agent') */
  subagentName?: string;

  /** Timestamp when this status was set */
  startedAt: number;
}

// =============================================================================
// Title Configuration
// =============================================================================

/**
 * Title configuration with manual/computed tracking.
 */
export interface TitleConfig {
  /** The title value */
  value: string;

  /** Whether the title was manually set by user */
  isManuallySet: boolean;

  /** First N user messages used for automatic computation (if not manual) */
  computedFrom?: string[];
}

// =============================================================================
// Full Agent State
// =============================================================================

/**
 * Complete state of a coding agent including status, title, and summary.
 */
export interface CodingAgentState {
  /** Unique identifier for the agent */
  agentId: string;

  /** Type of coding agent */
  agentType: AgentType;

  /** Current status with context */
  statusInfo: CodingAgentStatusInfo;

  /** Title configuration */
  title: TitleConfig;

  /** Short computed summary of the agent's task */
  summary: string | null;

  /** Timestamp when agent was registered */
  createdAt: number;

  /** Timestamp of last state update */
  updatedAt: number;
}

// =============================================================================
// Dependency Interfaces (for DI)
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
