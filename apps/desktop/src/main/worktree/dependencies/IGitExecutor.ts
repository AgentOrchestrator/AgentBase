/**
 * Git command execution abstraction
 */
export interface IGitExecutor {
  /**
   * Execute a git command in the specified repository
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
}
