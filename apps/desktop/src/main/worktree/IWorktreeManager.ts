import type {
  WorktreeInfo,
  WorktreeProvisionOptions,
  WorktreeReleaseOptions,
} from '../types/worktree';

/**
 * Interface for managing git worktrees for agent isolation.
 * Enables multiple agents to work independently on the same repository.
 */
export interface IWorktreeManager {
  /**
   * Initialize the manager (create tables, recover orphaned worktrees)
   */
  initialize(): Promise<void>;

  /**
   * Provision a new worktree for an agent
   * @param repoPath - Absolute path to the main git repository
   * @param branchName - Branch name for the worktree (created if not exists)
   * @param options - Optional configuration
   * @returns WorktreeInfo with the provisioned worktree details
   */
  provision(
    repoPath: string,
    branchName: string,
    options?: WorktreeProvisionOptions
  ): Promise<WorktreeInfo>;

  /**
   * Release a worktree (remove from filesystem and optionally delete branch)
   * @param worktreeId - The unique ID of the worktree to release
   * @param options - Optional configuration (deleteBranch, force)
   */
  release(worktreeId: string, options?: WorktreeReleaseOptions): Promise<void>;

  /**
   * Get information about a specific worktree
   * @param worktreeId - The unique ID of the worktree
   * @returns WorktreeInfo or null if not found
   */
  get(worktreeId: string): Promise<WorktreeInfo | null>;

  /**
   * List all active worktrees, optionally filtered by repository
   * @param repoPath - Optional filter by repository path
   * @returns Array of WorktreeInfo
   */
  list(repoPath?: string): Promise<WorktreeInfo[]>;

  /**
   * Close the manager and cleanup resources
   */
  close(): void;
}
