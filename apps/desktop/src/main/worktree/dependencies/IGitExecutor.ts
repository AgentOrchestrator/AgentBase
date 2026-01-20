/**
 * Information about a git worktree from `git worktree list`
 */
export interface GitWorktreeEntry {
  /** Absolute path to the worktree */
  path: string;
  /** Branch name (null for detached HEAD or bare worktree) */
  branch: string | null;
  /** Whether this is the main worktree (not a linked worktree) */
  isMain: boolean;
}

/**
 * Git command execution abstraction
 */
export interface IGitExecutor {
  /**
   * Run a git command in the specified repository
   * @param repoPath - Absolute path to the git repository
   * @param args - Git command arguments (without 'git' prefix)
   * @returns stdout from the command
   * @throws Error if command fails
   */
  exec(repoPath: string, args: string[]): Promise<string>;

  /**
   * Check if a path is a valid git repository
   * @param path - Path to check
   * @returns true if path is a git repository
   */
  isRepository(path: string): Promise<boolean>;

  /**
   * List all worktrees for a repository
   * Uses `git worktree list --porcelain`
   * @param repoPath - Absolute path to the git repository
   * @returns Array of worktree entries with path and branch info
   */
  listWorktrees(repoPath: string): Promise<GitWorktreeEntry[]>;
}
