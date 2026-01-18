import type { WorktreeRow, WorktreeStatus } from '../../types/worktree';

/**
 * Worktree persistence abstraction
 */
export interface IWorktreeStore {
  /**
   * Initialize the store (create tables if needed)
   */
  initialize(): Promise<void>;

  /**
   * Insert a new worktree record
   */
  insert(worktree: WorktreeRow): Promise<void>;

  /**
   * Update worktree status
   * @param id - Worktree ID
   * @param status - New status
   * @param errorMessage - Optional error message (for 'error' status)
   */
  updateStatus(id: string, status: WorktreeStatus, errorMessage?: string): Promise<void>;

  /**
   * Get worktree by ID
   */
  getById(id: string): Promise<WorktreeRow | null>;

  /**
   * Get worktree by path
   */
  getByPath(path: string): Promise<WorktreeRow | null>;

  /**
   * Get worktree by repo and branch
   */
  getByRepoBranch(repoPath: string, branchName: string): Promise<WorktreeRow | null>;

  /**
   * List worktrees, optionally filtered by repo path
   */
  list(repoPath?: string): Promise<WorktreeRow[]>;

  /**
   * List worktrees by status
   */
  listByStatus(statuses: WorktreeStatus[]): Promise<WorktreeRow[]>;

  /**
   * Delete a worktree record
   */
  delete(id: string): Promise<void>;

  /**
   * Close the store connection
   */
  close(): void;
}
