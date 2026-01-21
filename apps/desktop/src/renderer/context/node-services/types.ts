/**
 * Node Service Interfaces
 *
 * Core interfaces for lifecycle-scoped node services.
 * Each node type gets appropriate services via NodeContext.
 */

import type { GitInfo } from '@agent-orchestrator/shared';
import type {
  AgentType,
  CodingAgentStatus,
  CodingAgentStatusInfo,
  StatusChangeListener,
} from '../../../../types/coding-agent-status';
import type { WorktreeInfo } from '../../../main/types/worktree';
import type {
  AgentAdapterEventType,
  AgentEventHandler,
  CodingAgentSessionContent,
  GenerateResponse,
  MessageFilterOptions,
  SessionInfo,
  StreamCallback,
  StructuredStreamCallback,
} from './coding-agent-adapter';

// Re-export for consumers
export type { GitInfo };

// =============================================================================
// Node Types
// =============================================================================

/**
 * Discriminator for node types
 */
export type NodeType = 'agent' | 'terminal' | 'custom' | 'conversation';

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
// Terminal Service - Re-exported from feature module
// =============================================================================

// ITerminalService is now defined in features/terminal/services/ITerminalService.ts
// Re-export here for backward compatibility
export type { ITerminalService } from '../../features/terminal';

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
  provisionWorktree(branchName: string, worktreePath: string): Promise<WorktreeInfo>;
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

  /**
   * Start the coding agent CLI REPL in the terminal.
   * @param workspacePath - Working directory for the agent
   * @param sessionId - Optional session ID for resume
   * @param initialPrompt - Optional initial prompt
   */
  start(workspacePath: string, sessionId?: string, initialPrompt?: string): Promise<void>;
  /** Stop the coding agent (cancels operations) */
  stop(): Promise<void>;
  /**
   * Gracefully exit the CLI REPL and wait for process to terminate.
   * Sends vendor-specific exit command via adapter and waits for terminal exit.
   * @param timeoutMs - Max time to wait for graceful exit before forcing destroy
   */
  exitRepl(timeoutMs?: number): Promise<void>;

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
  // Generation (Adapter-driven, stateless)
  // =========================================================================

  /**
   * Send a message and get response (non-streaming).
   * Creates or continues a session based on whether the session file exists.
   * @param prompt - The message to send
   * @param workspacePath - Working directory for the agent
   * @param sessionId - Session ID (required - caller must provide)
   * @throws Error if adapter fails
   */
  sendMessage(prompt: string, workspacePath: string, sessionId: string): Promise<GenerateResponse>;

  /**
   * Send a message with streaming (chunks emitted via callback).
   * Creates or continues a session based on whether the session file exists.
   * @param prompt - The message to send
   * @param workspacePath - Working directory for the agent
   * @param sessionId - Session ID (required - caller must provide)
   * @param onChunk - Callback for streaming chunks
   * @throws Error if adapter fails
   */
  sendMessageStreaming(
    prompt: string,
    workspacePath: string,
    sessionId: string,
    onChunk: StreamCallback
  ): Promise<GenerateResponse>;

  /**
   * Send a message with structured streaming (content blocks).
   * Streams thinking, tool_use, and text blocks as they arrive.
   * Creates or continues a session based on whether the session file exists.
   * @param prompt - The message to send
   * @param workspacePath - Working directory for the agent
   * @param sessionId - Session ID (required - caller must provide)
   * @param onChunk - Callback for structured streaming chunks
   * @throws Error if adapter fails or structured streaming not supported
   */
  sendMessageStreamingStructured(
    prompt: string,
    workspacePath: string,
    sessionId: string,
    onChunk: StructuredStreamCallback
  ): Promise<GenerateResponse>;

  // =========================================================================
  // Session Queries (stateless)
  // =========================================================================

  /**
   * Get session content with optional message filtering.
   * @param sessionId - Session ID to retrieve
   * @param workspacePath - Working directory to scope session lookup
   * @param filter - Optional message filter options
   * @throws Error if adapter fails
   */
  getSession(
    sessionId: string,
    workspacePath: string,
    filter?: MessageFilterOptions
  ): Promise<CodingAgentSessionContent | null>;

  /**
   * Check if a session is active (file exists).
   * @param sessionId - Session ID to check
   * @param workspacePath - Working directory to scope session lookup
   */
  isSessionActive(sessionId: string, workspacePath: string): Promise<boolean>;

  /**
   * Get the latest session for a workspace.
   * Returns null if no sessions exist or capability not supported.
   * @param workspacePath - Working directory to scope session lookup
   */
  getLatestSession(workspacePath: string): Promise<SessionInfo | null>;

  // =========================================================================
  // Events
  // =========================================================================

  /**
   * Subscribe to typed agent events (permission requests, session events, etc.)
   * @param type - Event type to subscribe to
   * @param handler - Handler called when event occurs
   * @returns Unsubscribe function
   */
  onAgentEvent<T extends AgentAdapterEventType>(type: T, handler: AgentEventHandler<T>): () => void;
}
