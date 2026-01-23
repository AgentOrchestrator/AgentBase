/**
 * Git Utilities for Agent Setup
 *
 * Helper functions for resolving git information from workspace paths.
 */

import { execFileSync } from 'node:child_process';

/**
 * Resolve the current git branch for a workspace path
 *
 * Uses execFileSync instead of execSync for security (prevents shell injection).
 *
 * @param workspacePath - Path to the git repository
 * @returns Current branch name, or null if not a git repo or git unavailable
 */
export function resolveGitBranch(workspacePath: string): string | null {
  try {
    const branch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd: workspacePath,
      encoding: 'utf-8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();

    return branch || null;
  } catch {
    return null;
  }
}
