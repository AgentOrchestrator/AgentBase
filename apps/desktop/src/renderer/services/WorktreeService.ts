/**
 * Worktree Service
 *
 * Handles git worktree operations for forking sessions.
 * MVP: Stub implementation that logs intent.
 * TODO: Implement real git worktree creation via IPC.
 */

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
  /** Error message if failed */
  error?: string;
}

/**
 * Interface for worktree operations
 */
export interface IWorktreeService {
  /**
   * Create a new git worktree
   * @param basePath - Path to the source repository
   * @param branchName - Name for the new branch
   * @returns Promise resolving to worktree result
   */
  createWorktree(basePath: string, branchName: string): Promise<WorktreeResult>;
}

/**
 * Stub implementation of worktree service
 * Logs intent and returns mock data for MVP
 */
export class WorktreeService implements IWorktreeService {
  /**
   * Create a new git worktree (stub)
   */
  async createWorktree(basePath: string, branchName: string): Promise<WorktreeResult> {
    console.log('[WorktreeService] Creating worktree:', {
      basePath,
      branchName,
    });

    // TODO: Implement real git worktree creation via IPC
    // Example: window.electronAPI.createWorktree(basePath, branchName)

    // Simulate async operation
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Return mock result for MVP
    const mockPath = `${basePath}-${branchName}`;
    console.log('[WorktreeService] Worktree created at:', mockPath);

    return {
      success: true,
      path: mockPath,
      branchName,
    };
  }
}

/**
 * Singleton instance
 */
export const worktreeService: IWorktreeService = new WorktreeService();
