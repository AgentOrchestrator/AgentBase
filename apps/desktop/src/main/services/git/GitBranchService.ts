/**
 * Git Branch Service
 *
 * Resolves git branch information for directories.
 * Only works for git-initialized directories - throws otherwise.
 */

import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import type { GitInfo } from '@agent-orchestrator/shared';

/**
 * Run a git command and return stdout
 */
function runGitCommand(cwd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const git = spawn('git', args, { cwd });
    let stdout = '';
    let stderr = '';

    git.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    git.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    git.on('close', (code) => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error(stderr.trim() || `git command failed with code ${code}`));
      }
    });

    git.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Git Branch Service
 *
 * Provides strict git info resolution - throws if directory is not a git repository.
 */
export class GitBranchService {
  /**
   * Check if a directory is a git repository
   */
  async isGitRepository(workspacePath: string): Promise<boolean> {
    try {
      await runGitCommand(workspacePath, ['rev-parse', '--git-dir']);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get git info for a workspace path.
   * @throws Error if directory does not exist
   * @throws Error if directory is not a git repository
   */
  async getGitInfo(workspacePath: string): Promise<GitInfo> {
    // Verify path exists
    if (!fs.existsSync(workspacePath)) {
      throw new Error(`Path does not exist: ${workspacePath}`);
    }

    // Get current branch - this also validates it's a git repo
    let branch: string;
    try {
      branch = await runGitCommand(workspacePath, ['rev-parse', '--abbrev-ref', 'HEAD']);
    } catch {
      throw new Error('Directory is not a git repository');
    }

    // Get remote (if any)
    let remote: string | undefined;
    try {
      remote = await runGitCommand(workspacePath, ['config', '--get', `branch.${branch}.remote`]);
    } catch {
      // No remote configured - this is fine
      remote = undefined;
    }

    // Get status (clean/dirty)
    let status: 'clean' | 'dirty' | 'unknown' = 'unknown';
    try {
      const statusOutput = await runGitCommand(workspacePath, ['status', '--porcelain']);
      status = statusOutput.length === 0 ? 'clean' : 'dirty';
    } catch {
      status = 'unknown';
    }

    // Get ahead/behind counts
    let ahead = 0;
    let behind = 0;
    if (remote) {
      try {
        const revList = await runGitCommand(workspacePath, [
          'rev-list',
          '--left-right',
          '--count',
          `${remote}/${branch}...HEAD`,
        ]);
        const [behindStr, aheadStr] = revList.split('\t');
        behind = parseInt(behindStr, 10) || 0;
        ahead = parseInt(aheadStr, 10) || 0;
      } catch {
        // Remote branch might not exist
      }
    }

    return {
      branch,
      remote,
      status,
      ahead,
      behind,
    };
  }
}

/**
 * Singleton instance
 */
export const gitBranchService = new GitBranchService();
