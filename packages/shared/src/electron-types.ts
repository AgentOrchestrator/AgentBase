// =============================================================================
// Electron IPC Types
// Shared types for Electron main/renderer process communication
// =============================================================================

// =============================================================================
// Terminal IPC Types
// =============================================================================

/**
 * Terminal IPC interface for communication between renderer and main process.
 * Manages pseudo-terminal creation, input/output, and lifecycle.
 */
export interface ElectronAPI {
  /** Create a new terminal instance */
  createTerminal: (terminalId: string) => void;
  /** Subscribe to terminal output data */
  onTerminalData: (
    callback: (data: { terminalId: string; data: string }) => void
  ) => void;
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
export type EditorApp =
  | 'vscode'
  | 'cursor'
  | 'zed'
  | 'sublime'
  | 'atom'
  | 'webstorm'
  | 'finder';

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
// Git Worktree Types
// =============================================================================

/**
 * Status of a git worktree.
 */
export type WorktreeStatus =
  | 'provisioning'
  | 'active'
  | 'releasing'
  | 'orphaned'
  | 'error';

/**
 * Information about a git worktree.
 */
export interface WorktreeInfo {
  /** Unique identifier for the worktree */
  id: string;
  /** Path to the main repository */
  repoPath: string;
  /** Path to the worktree directory */
  worktreePath: string;
  /** Name of the branch associated with this worktree */
  branchName: string;
  /** Current status of the worktree */
  status: WorktreeStatus;
  /** ISO timestamp when the worktree was provisioned */
  provisionedAt: string;
  /** ISO timestamp of last activity */
  lastActivityAt: string;
  /** Agent ID associated with this worktree */
  agentId?: string;
  /** Error message if status is 'error' */
  errorMessage?: string;
}

/**
 * Options for provisioning a new worktree.
 */
export interface WorktreeProvisionOptions {
  /** Branch to create worktree from (default: HEAD) */
  baseBranch?: string;
  /** Agent ID to associate with this worktree */
  agentId?: string;
  /** Custom subdirectory name within base worktree directory */
  directoryName?: string;
}

/**
 * Options for releasing a worktree.
 */
export interface WorktreeReleaseOptions {
  /** Delete branch on release (default: false) */
  deleteBranch?: boolean;
  /** Force removal with uncommitted changes (default: false) */
  force?: boolean;
}

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
// Agent Status Types
// =============================================================================

/**
 * All possible status states for a coding agent.
 * Unified from Claude Code (thinking, executing_tool, awaiting_input) and
 * Cursor (idle, running, streaming, paused, completed, error).
 */
export type CodingAgentStatus =
  | 'idle'
  | 'running'
  | 'thinking'
  | 'streaming'
  | 'executing_tool'
  | 'awaiting_input'
  | 'paused'
  | 'completed'
  | 'error';

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
export type CodingAgentType =
  | 'claude_code'
  | 'cursor'
  | 'codex'
  | 'windsurf'
  | 'vscode'
  | 'factory'
  | 'other';

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

/**
 * Complete state of a coding agent including status, title, and summary.
 */
export interface CodingAgentState {
  /** Unique identifier for the agent */
  agentId: string;
  /** Type of coding agent */
  agentType: CodingAgentType;
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
