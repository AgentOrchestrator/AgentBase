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

// Re-export for consumers
export type { GitInfo };

// =============================================================================
// Node Types
// =============================================================================

/**
 * Discriminator for node types
 */
export type NodeType = 'agent' | 'terminal' | 'workspace' | 'custom' | 'conversation';

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
 * Agent service - manages coding agent CLI lifecycle.
 * Orchestrates terminal + coding agent operations.
 */
export interface IAgentService extends INodeService {
  /** Agent identifier */
  readonly agentId: string;
  /** Agent type (claude_code, cursor, etc.) */
  readonly agentType: AgentType;

  // Lifecycle
  /** Start the coding agent CLI in the terminal */
  start(command?: string): Promise<void>;
  /** Stop the coding agent (sends interrupt) */
  stop(): Promise<void>;

  // Status
  /** Get current agent status */
  getStatus(): CodingAgentStatusInfo | null;
  /** Update agent status */
  updateStatus(
    status: CodingAgentStatus,
    context?: Partial<Omit<CodingAgentStatusInfo, 'status' | 'startedAt'>>
  ): void;
  /** Subscribe to status changes */
  onStatusChange(listener: StatusChangeListener): () => void;

  // Configuration
  /** Check if CLI auto-start is enabled */
  isAutoStartEnabled(): boolean;
  /** Enable/disable CLI auto-start */
  setAutoStart(enabled: boolean): void;

  // Workspace
  /**
   * Set workspace and navigate terminal to it.
   * If autoStartCli is true, also starts the CLI after navigation.
   * If initialPrompt is provided, it will be sent to the agent after CLI starts.
   */
  setWorkspace(path: string, autoStartCli?: boolean, initialPrompt?: string): Promise<void>;

  // Session management
  /** Get CLI command for this agent type */
  getCliCommand(): string;
}
