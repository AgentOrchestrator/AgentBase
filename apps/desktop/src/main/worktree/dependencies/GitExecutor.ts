import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { IGitExecutor } from './IGitExecutor';

const execFileAsync = promisify(execFile);

/**
 * Production implementation of IGitExecutor using child_process
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
}
