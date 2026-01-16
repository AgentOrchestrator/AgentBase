/**
 * Node Service Interfaces
 *
 * Core interfaces for lifecycle-scoped node services.
 * Each node type gets appropriate services via NodeContext.
 */

import type { WorktreeInfo } from '../../../main/types/worktree';
import type {
  AgentType,
  CodingAgentStatus,
  CodingAgentStatusInfo,
  StatusChangeListener,
} from '../../../../types/coding-agent-status';
import type { GitInfo } from '@agent-orchestrator/shared';
import type {
  GenerateResponse,
  StreamCallback,
  SessionInfo,
  CodingAgentSessionContent,
  MessageFilterOptions,
  AgentAdapterEventType,
  AgentEventHandler,
} from './coding-agent-adapter';

// Re-export for consumers
export type { GitInfo };

// =============================================================================
// Node Types
// =============================================================================

/**
 * Discriminator for node types
 */
export type NodeType = 'agent' | 'terminal'| 'custom' | 'conversation';

// =============================================================================
// Base Service Interface
// =============================================================================

/**
 * Base interface all node services implement.
 * Provides lifecycle management for mount/unmount.
 */
export interface INodeService {
  /** Node ID this service belongs to */
  readonly nodeId: string;

  /** Initialize the service (called on mount) */
  initialize(): Promise<void>;

  /** Dispose the service (called on unmount) */
  dispose(): Promise<void>;
}

// =============================================================================
// Terminal Service
// =============================================================================

/**
 * Terminal service - manages terminal process lifecycle.
 * Wraps Electron IPC for terminal operations.
 */
export interface ITerminalService extends INodeService {
  /** Terminal process identifier */
  readonly terminalId: string;

  // Lifecycle
  /** Create the terminal process */
  create(): Promise<void>;
  /** Destroy the terminal process */
  destroy(): Promise<void>;
  /** Restart the terminal (destroy + create) */
  restart(): Promise<void>;

  // I/O
  /** Write data to terminal stdin */
  write(data: string): void;
  /** Resize terminal dimensions */
  resize(cols: number, rows: number): void;

  // Subscriptions
  /** Subscribe to terminal output */
  onData(callback: (data: string) => void): () => void;
  /** Subscribe to terminal exit events */
  onExit(callback: (code: number, signal?: number) => void): () => void;

  // State
  /** Check if terminal process is running */
  isRunning(): boolean;
}

// =============================================================================
// Workspace Service
// =============================================================================

/**
 * Workspace service - manages workspace metadata and worktrees.
 * Wraps Electron IPC for worktree operations.
 */
export interface IWorkspaceService extends INodeService {
  /** Current workspace path (may be null if not set) */
  readonly workspacePath: string | null;

  // Path management
  /** Set the workspace path */
  setWorkspacePath(path: string): void;
  /** Get the current workspace path */
  getWorkspacePath(): string | null;

  // Worktree integration
  /** Provision a new git worktree for agent isolation */
  provisionWorktree(branchName: string): Promise<WorktreeInfo>;
  /** Release a worktree */
  releaseWorktree(worktreeId: string): Promise<void>;
  /** Get currently active worktree */
  getActiveWorktree(): Promise<WorktreeInfo | null>;

  // Metadata
  /** Detect project type (e.g., 'node', 'python', 'rust') */
  getProjectType(): Promise<string | null>;
  /** Get git repository info */
  getGitInfo(): Promise<GitInfo | null>;
}

// =============================================================================
// Agent Service
// =============================================================================

/**
 * Agent service - manages coding agent lifecycle via adapter.
 * Orchestrates terminal display + adapter-driven agent operations.
 *
 * The service layer unwraps Result types from the adapter and throws
 * exceptions for cleaner consumer API, while maintaining status updates
 * and session persistence.
 */
export interface IAgentService extends INodeService {
  /** Agent identifier */
  readonly agentId: string;
  /** Agent type (claude_code, cursor, etc.) */
  readonly agentType: AgentType;

  // =========================================================================
  // Lifecycle
  // =========================================================================

  /** Start the coding agent (initializes adapter) */
  start(sessionId?: string, initialPrompt?: string): Promise<void>;
  /** Stop the coding agent (cancels operations) */
  stop(): Promise<void>;

  // =========================================================================
  // Status
  // =========================================================================

  /** Get current agent status */
  getStatus(): CodingAgentStatusInfo | null;
  /** Update agent status */
  updateStatus(
    status: CodingAgentStatus,
    context?: Partial<Omit<CodingAgentStatusInfo, 'status' | 'startedAt'>>
  ): void;
  /** Subscribe to status changes */
  onStatusChange(listener: StatusChangeListener): () => void;

  // =========================================================================
  // Configuration
  // =========================================================================

  /** Check if auto-start is enabled */
  isAutoStartEnabled(): boolean;
  /** Enable/disable auto-start */
  setAutoStart(enabled: boolean): void;

  // =========================================================================
  // Workspace
  // =========================================================================

  /** Current workspace path (null if not set) */
  get workspacePath(): string | null;

  /**
   * Set workspace path.
   * Does NOT start generation - use sendMessage/resumeSession for that.
   */
  setWorkspace(path: string): Promise<void>;

  // =========================================================================
  // Generation (Adapter-driven)
  // =========================================================================

  /**
   * Send a message and get response (non-streaming).
   * Creates a new session if no active session exists.
   * @throws Error if workspace not set or adapter fails
   */
  sendMessage(prompt: string): Promise<GenerateResponse>;

  /**
   * Send a message with streaming (chunks emitted via callback).
   * Returns the final complete response.
   * @throws Error if workspace not set or adapter fails
   */
  sendMessageStreaming(prompt: string, onChunk: StreamCallback): Promise<GenerateResponse>;

  /**
   * Resume an existing session with a new message (non-streaming).
   * @throws Error if workspace not set, session not found, or adapter fails
   */
  resumeSession(sessionId: string, prompt: string): Promise<GenerateResponse>;

  /**
   * Resume an existing session with streaming.
   * Returns the final complete response.
   * @throws Error if workspace not set, session not found, or adapter fails
   */
  resumeSessionStreaming(
    sessionId: string,
    prompt: string,
    onChunk: StreamCallback
  ): Promise<GenerateResponse>;

  // =========================================================================
  // Session Queries
  // =========================================================================

  /**
   * Get session content with optional message filtering.
   * @throws Error if adapter fails
   */
  getSession(
    sessionId: string,
    filter?: MessageFilterOptions
  ): Promise<CodingAgentSessionContent | null>;

  /**
   * Check if a session is active (file exists).
   * @throws Error if workspace not set
   */
  isSessionActive(sessionId: string): Promise<boolean>;

  /**
   * Get the latest session for the current workspace.
   * Returns null if no sessions exist or capability not supported.
   * @throws Error if workspace not set
   */
  getLatestSession(): Promise<SessionInfo | null>;

  // =========================================================================
  // Events
  // =========================================================================

  /**
   * Subscribe to typed agent events (permission requests, session events, etc.)
   * @param type - Event type to subscribe to
   * @param handler - Handler called when event occurs
   * @returns Unsubscribe function
   */
  onAgentEvent<T extends AgentAdapterEventType>(
    type: T,
    handler: AgentEventHandler<T>
  ): () => void;
}
