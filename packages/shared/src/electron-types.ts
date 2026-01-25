// =============================================================================
// Electron IPC Types
// Shared types for Electron main/renderer process communication
// =============================================================================

import type { AgentType } from './loaders/types.js';
// Import domain types used in this file's interfaces
// These types are exported from './types/index.js' via the main index
import type { CodingAgentState } from './types/coding-agent.js';
import type { AddWorkspaceOptions, RecentWorkspace } from './types/workspace.js';
import type {
  WorktreeInfo,
  WorktreeProvisionOptions,
  WorktreeReleaseOptions,
} from './types/worktree.js';

/**
 * Coding agent types - alias for AgentType from loaders.
 * This alias is kept for backwards compatibility with existing code.
 */
export type CodingAgentType = AgentType;

// =============================================================================
// Terminal IPC Types
// =============================================================================

/**
 * Terminal IPC interface for communication between renderer and main process.
 * Manages pseudo-terminal creation, input/output, and lifecycle.
 */
export interface ElectronAPI {
  /** Create a new terminal instance. workspacePath is optional - if provided, hooks env vars are injected */
  createTerminal: (terminalId: string, workspacePath?: string) => void;
  /** Subscribe to terminal output data */
  onTerminalData: (callback: (data: { terminalId: string; data: string }) => void) => void;
  /** Subscribe to terminal exit events */
  onTerminalExit: (
    callback: (data: { terminalId: string; code: number; signal?: number }) => void
  ) => void;
  /** Send input to terminal */
  sendTerminalInput: (terminalId: string, data: string) => void;
  /** Resize terminal dimensions */
  sendTerminalResize: (terminalId: string, cols: number, rows: number) => void;
  /** Destroy a terminal instance */
  destroyTerminal: (terminalId: string) => void;
  /** Remove all listeners for a channel */
  removeAllListeners: (channel: string) => void;
}

// =============================================================================
// Terminal Session State Types
// =============================================================================

/**
 * State of a terminal session for tracking agent activity.
 * Persisted in main process to survive renderer refreshes.
 */
export interface TerminalSessionState {
  /** Whether a coding agent CLI is currently running */
  agentRunning: boolean;
  /** Type of agent running (e.g., 'claude_code', 'cursor') */
  agentType?: CodingAgentType;
  /** Session ID if agent supports sessions */
  sessionId?: string;
  /** Timestamp when agent was started */
  startedAt?: number;
}

/**
 * Terminal Session API for main/renderer state synchronization.
 * Used to persist terminal state across renderer refreshes.
 */
export interface TerminalSessionAPI {
  /** Get session state for a terminal */
  getTerminalSessionState: (terminalId: string) => Promise<TerminalSessionState | null>;
  /** Set session state for a terminal */
  setTerminalSessionState: (terminalId: string, state: TerminalSessionState) => Promise<void>;
  /** Clear session state for a terminal */
  clearTerminalSessionState: (terminalId: string) => Promise<void>;
  /** Get output buffer for a terminal (for restoring scrollback after refresh) */
  getTerminalBuffer: (terminalId: string) => Promise<string>;
}

// =============================================================================
// Canvas Persistence Types
// =============================================================================

/**
 * Canvas API for persisting and loading canvas state.
 * Uses Record<string, unknown> for flexibility with canvas state structures.
 */
export interface CanvasAPI {
  /** Save canvas state to storage */
  saveCanvas: (canvasId: string, state: Record<string, unknown>) => Promise<void>;
  /** Load canvas state from storage */
  loadCanvas: (canvasId: string) => Promise<Record<string, unknown> | null>;
  /** List all saved canvases with metadata */
  listCanvases: () => Promise<Array<{ id: string; name: string; updatedAt: string }>>;
  /** Delete a canvas from storage */
  deleteCanvas: (canvasId: string) => Promise<void>;
  /** Get the currently active canvas ID */
  getCurrentCanvasId: () => Promise<string | null>;
  /** Set the currently active canvas ID */
  setCurrentCanvasId: (canvasId: string) => Promise<void>;
}

// =============================================================================
// Shell & Editor Types
// =============================================================================

/**
 * Supported editor applications for opening directories.
 */
export type EditorApp = 'vscode' | 'cursor' | 'zed' | 'sublime' | 'atom' | 'webstorm' | 'finder';

/**
 * Shell API for system-level operations.
 * Handles opening files/directories with external applications.
 */
export interface ShellAPI {
  /** Open a directory with a specific editor application */
  openWithEditor: (directoryPath: string, editor: EditorApp) => Promise<void>;
  /** Get list of available editors on this system */
  getAvailableEditors: () => Promise<EditorApp[]>;
  /** Open a path in the system file manager */
  showInFolder: (path: string) => Promise<void>;
  /** Open a directory selection dialog */
  openDirectoryDialog: (options?: {
    title?: string;
    defaultPath?: string;
  }) => Promise<string | null>;
}

// =============================================================================
// Git Worktree API
// =============================================================================

/**
 * Worktree API for managing git worktrees.
 * Used for agent isolation with separate working directories.
 */
export interface WorktreeAPI {
  /** Create a new git worktree */
  provision: (
    repoPath: string,
    branchName: string,
    options?: WorktreeProvisionOptions
  ) => Promise<WorktreeInfo>;
  /** Remove a worktree */
  release: (worktreeId: string, options?: WorktreeReleaseOptions) => Promise<void>;
  /** Get worktree by ID */
  get: (worktreeId: string) => Promise<WorktreeInfo | null>;
  /** List worktrees, optionally filtered by repo */
  list: (repoPath?: string) => Promise<WorktreeInfo[]>;
}

// =============================================================================
// Agent Status API
// =============================================================================

/**
 * Agent Status API for persisting and loading agent state.
 */
export interface AgentStatusAPI {
  /** Save agent status */
  saveAgentStatus: (agentId: string, state: CodingAgentState) => Promise<void>;
  /** Load agent status */
  loadAgentStatus: (agentId: string) => Promise<CodingAgentState | null>;
  /** Delete agent status */
  deleteAgentStatus: (agentId: string) => Promise<void>;
  /** Load all agent statuses */
  loadAllAgentStatuses: () => Promise<CodingAgentState[]>;
}

// =============================================================================
// Session File Watcher Types
// =============================================================================

/**
 * Type of change detected in a session file.
 */
export type SessionFileChangeType = 'created' | 'updated' | 'deleted';

/**
 * Event emitted when a session file changes.
 * Used to synchronize views that display the same session data.
 */
export interface SessionFileChangeEvent {
  /** Type of change detected */
  type: SessionFileChangeType;
  /** Session ID extracted from filename */
  sessionId: string;
  /** Full path to the session file */
  filePath: string;
  /** Project path decoded from directory structure */
  projectPath: string;
  /** Agent type that owns this session */
  agentType: CodingAgentType;
  /** Unix timestamp (ms) when change was detected */
  timestamp: number;
}

/**
 * Session watcher API for monitoring session file changes.
 * Enables real-time synchronization between terminal and chat views.
 */
export interface SessionWatcherAPI {
  /** Start watching session files for an agent type */
  watch: (agentType: CodingAgentType) => Promise<void>;
  /** Stop watching session files for an agent type */
  unwatch: (agentType: CodingAgentType) => Promise<void>;
  /** Subscribe to session file change events. Returns cleanup function. */
  onSessionFileChanged: (callback: (event: SessionFileChangeEvent) => void) => () => void;
}

// =============================================================================
// Recent Workspaces API
// =============================================================================

/**
 * Recent Workspaces API for tracking recently opened workspace paths.
 */
export interface RecentWorkspacesAPI {
  /** Add or update a workspace (updates lastOpenedAt if exists) */
  addWorkspace: (path: string, options?: AddWorkspaceOptions) => Promise<void>;
  /** Get recent workspaces sorted by most recent first */
  getRecentWorkspaces: (limit?: number) => Promise<RecentWorkspace[]>;
  /** Remove a workspace from the list */
  removeWorkspace: (path: string) => Promise<void>;
  /** Clear all recent workspaces */
  clearAll: () => Promise<void>;
  /** Check if a workspace exists in recent list */
  hasWorkspace: (path: string) => Promise<boolean>;
}
