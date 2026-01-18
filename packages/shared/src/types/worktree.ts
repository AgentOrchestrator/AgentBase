/**
 * Worktree Type Definitions
 *
 * Types for managing git worktrees for agent isolation.
 * Used across desktop app for parallel agent development.
 */

// =============================================================================
// Status Types
// =============================================================================

/**
 * Worktree lifecycle status
 */
export type WorktreeStatus =
  | 'provisioning' // Being created
  | 'active' // Ready for use
  | 'releasing' // Being cleaned up
  | 'orphaned' // Agent disconnected but worktree exists
  | 'error'; // Creation or operation failed

// =============================================================================
// Worktree Info
// =============================================================================

/**
 * Complete information about a git worktree
 */
export interface WorktreeInfo {
  /** Unique identifier for this worktree */
  id: string;
  /** Path to the main repository */
  repoPath: string;
  /** Path to this worktree directory */
  worktreePath: string;
  /** Branch name for this worktree */
  branchName: string;
  /** Current status */
  status: WorktreeStatus;
  /** ISO timestamp when provisioned */
  provisionedAt: string;
  /** ISO timestamp of last activity */
  lastActivityAt: string;
  /** Agent ID using this worktree (if any) */
  agentId?: string;
  /** Error message (when status is 'error') */
  errorMessage?: string;
}

// =============================================================================
// Options
// =============================================================================

/**
 * Options for provisioning a new worktree
 */
export interface WorktreeProvisionOptions {
  /** Branch to create worktree from (default: HEAD) */
  baseBranch?: string;
  /** Agent ID to associate with this worktree */
  agentId?: string;
  /**
   * Full path where the worktree should be created.
   * This is required - the caller must provide an explicit path.
   * Typically this should be a sibling folder to the parent workspace.
   */
  worktreePath: string;
}

/**
 * Options for releasing a worktree
 */
export interface WorktreeReleaseOptions {
  /** Delete branch on release (default: false) */
  deleteBranch?: boolean;
  /** Force removal with uncommitted changes (default: false) */
  force?: boolean;
}

/**
 * Configuration for the worktree manager
 */
export interface WorktreeManagerConfig {
  /** Base directory where all worktrees will be created */
  baseWorktreeDirectory: string;
}
