/**
 * Worktree Service
 *
 * Handles git worktree operations for forking sessions.
 * Provides a clean interface to the worktreeAPI exposed by the main process.
 */

import type {
  WorktreeInfo,
  WorktreeProvisionOptions,
  WorktreeReleaseOptions,
} from '../../main/types/worktree';

/**
 * Result of worktree creation
 */
export interface WorktreeResult {
  /** Whether creation was successful */
  success: boolean;
  /** Path to the created worktree */
  path?: string;
  /** Branch name of the worktree */
  branchName?: string;
  /** Worktree ID for tracking */
  worktreeId?: string;
  /** Error message if failed */
  error?: string;
}

/**
 * Interface for worktree operations
 */
export interface IWorktreeService {
  /**
   * Create a new git worktree
   * @param repoPath - Path to the source repository
   * @param branchName - Name for the new branch
   * @param options - Optional provisioning options
   * @returns Promise resolving to worktree result
   */
  createWorktree(
    repoPath: string,
    branchName: string,
    options?: WorktreeProvisionOptions
  ): Promise<WorktreeResult>;

  /**
   * Release (remove) a worktree
   * @param worktreeId - ID of the worktree to release
   * @param options - Optional release options
   */
  releaseWorktree(worktreeId: string, options?: WorktreeReleaseOptions): Promise<void>;

  /**
   * Get worktree info by ID
   * @param worktreeId - ID of the worktree
   * @returns Worktree info or null if not found
   */
  getWorktree(worktreeId: string): Promise<WorktreeInfo | null>;

  /**
   * List all worktrees, optionally filtered by repo
   * @param repoPath - Optional repo path to filter by
   * @returns List of worktree infos
   */
  listWorktrees(repoPath?: string): Promise<WorktreeInfo[]>;
}

/**
 * Worktree service implementation using IPC
 */
export class WorktreeService implements IWorktreeService {
  /**
   * Create a new git worktree via IPC
   */
  async createWorktree(
    repoPath: string,
    branchName: string,
    options?: WorktreeProvisionOptions
  ): Promise<WorktreeResult> {
    console.log('[WorktreeService] Creating worktree:', { repoPath, branchName, options });

    if (!window.worktreeAPI) {
      return {
        success: false,
        error: 'Worktree API not available',
      };
    }

    try {
      const worktreeInfo = await window.worktreeAPI.provision(repoPath, branchName, options);

      console.log('[WorktreeService] Worktree created:', worktreeInfo);

      return {
        success: true,
        path: worktreeInfo.worktreePath,
        branchName: worktreeInfo.branchName,
        worktreeId: worktreeInfo.id,
      };
    } catch (error) {
      console.error('[WorktreeService] Failed to create worktree:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Release (remove) a worktree via IPC
   */
  async releaseWorktree(worktreeId: string, options?: WorktreeReleaseOptions): Promise<void> {
    console.log('[WorktreeService] Releasing worktree:', { worktreeId, options });

    if (!window.worktreeAPI) {
      throw new Error('Worktree API not available');
    }

    await window.worktreeAPI.release(worktreeId, options);
    console.log('[WorktreeService] Worktree released:', worktreeId);
  }

  /**
   * Get worktree info by ID via IPC
   */
  async getWorktree(worktreeId: string): Promise<WorktreeInfo | null> {
    if (!window.worktreeAPI) {
      throw new Error('Worktree API not available');
    }

    return window.worktreeAPI.get(worktreeId);
  }

  /**
   * List all worktrees via IPC
   */
  async listWorktrees(repoPath?: string): Promise<WorktreeInfo[]> {
    if (!window.worktreeAPI) {
      throw new Error('Worktree API not available');
    }

    return window.worktreeAPI.list(repoPath);
  }
}

/**
 * Singleton instance
 */
export const worktreeService: IWorktreeService = new WorktreeService();
