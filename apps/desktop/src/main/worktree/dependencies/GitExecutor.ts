import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { GitWorktreeEntry, IGitExecutor } from './IGitExecutor';

const execFileAsync = promisify(execFile);

/**
 * Production implementation of IGitExecutor using child_process.
 * Uses execFile (not shell exec) for safety against command injection.
 */
export class GitExecutor implements IGitExecutor {
  async exec(repoPath: string, args: string[]): Promise<string> {
    const { stdout } = await execFileAsync('git', ['-C', repoPath, ...args]);
    return stdout;
  }

  async isRepository(path: string): Promise<boolean> {
    try {
      await execFileAsync('git', ['-C', path, 'rev-parse', '--git-dir']);
      return true;
    } catch {
      return false;
    }
  }

  async listWorktrees(repoPath: string): Promise<GitWorktreeEntry[]> {
    const { stdout } = await execFileAsync('git', [
      '-C',
      repoPath,
      'worktree',
      'list',
      '--porcelain',
    ]);

    return this.parsePorcelainOutput(stdout);
  }

  /**
   * Parse git worktree list --porcelain output.
   *
   * Format:
   * ```
   * worktree /path/to/main
   * HEAD abc123...
   * branch refs/heads/main
   *
   * worktree /path/to/linked
   * HEAD def456...
   * branch refs/heads/feature
   * ```
   */
  private parsePorcelainOutput(output: string): GitWorktreeEntry[] {
    const entries: GitWorktreeEntry[] = [];
    const blocks = output.trim().split('\n\n');

    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      if (!block.trim()) continue;

      const lines = block.split('\n');
      let path = '';
      let branch: string | null = null;

      for (const line of lines) {
        if (line.startsWith('worktree ')) {
          path = line.substring('worktree '.length);
        } else if (line.startsWith('branch ')) {
          // branch refs/heads/feature -> feature
          const ref = line.substring('branch '.length);
          if (ref.startsWith('refs/heads/')) {
            branch = ref.substring('refs/heads/'.length);
          } else {
            branch = ref;
          }
        }
      }

      if (path) {
        entries.push({
          path,
          branch,
          isMain: i === 0, // First worktree in list is always the main worktree
        });
      }
    }

    return entries;
  }
}
