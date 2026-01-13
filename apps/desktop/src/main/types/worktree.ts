/**
 * Worktree type definitions
 * Types for managing git worktrees for agent isolation
 */

export type WorktreeStatus =
  | 'provisioning'
  | 'active'
  | 'releasing'
  | 'orphaned'
  | 'error';

export interface WorktreeInfo {
  id: string;
  repoPath: string;
  worktreePath: string;
  branchName: string;
  status: WorktreeStatus;
  provisionedAt: string;
  lastActivityAt: string;
  agentId?: string;
  errorMessage?: string;
}

export interface WorktreeProvisionOptions {
  /** Branch to create worktree from (default: HEAD) */
  baseBranch?: string;
  /** Agent ID to associate with this worktree */
  agentId?: string;
  /** Custom subdirectory name within base worktree directory */
  directoryName?: string;
}

export interface WorktreeReleaseOptions {
  /** Delete branch on release (default: false) */
  deleteBranch?: boolean;
  /** Force removal with uncommitted changes (default: false) */
  force?: boolean;
}

export interface WorktreeManagerConfig {
  /** Base directory where all worktrees will be created */
  baseWorktreeDirectory: string;
}

export interface WorktreeRow {
  id: string;
  repo_path: string;
  worktree_path: string;
  branch_name: string;
  status: WorktreeStatus;
  provisioned_at: string;
  last_activity_at: string;
  agent_id: string | null;
  error_message: string | null;
}
