/**
 * WorkspaceServiceImpl
 *
 * Implementation of IWorkspaceService that wraps Electron IPC.
 * Manages workspace metadata and git worktree operations.
 */

import type { WorktreeInfo } from '../../../main/types/worktree';
import type { GitInfo, IWorkspaceService } from '../../context/node-services';

/**
 * Workspace service implementation using Electron IPC
 */
export class WorkspaceServiceImpl implements IWorkspaceService {
  readonly nodeId: string;

  private _workspacePath: string | null;
  private activeWorktreeId: string | null = null;

  constructor(nodeId: string, workspacePath?: string) {
    this.nodeId = nodeId;
    this._workspacePath = workspacePath || null;
  }

  /**
   * Current workspace path
   */
  get workspacePath(): string | null {
    return this._workspacePath;
  }

  /**
   * Initialize the service
   */
  async initialize(): Promise<void> {
    // No async initialization needed for now
    // Could pre-fetch git info here if beneficial
  }

  /**
   * Set the workspace path
   */
  setWorkspacePath(path: string): void {
    this._workspacePath = path;
  }

  /**
   * Get the current workspace path
   */
  getWorkspacePath(): string | null {
    return this._workspacePath;
  }

  /**
   * Provision a new git worktree for agent isolation
   */
  async provisionWorktree(branchName: string, worktreePath: string): Promise<WorktreeInfo> {
    if (!this._workspacePath) {
      throw new Error('Workspace path not set - cannot provision worktree');
    }

    if (!window.worktreeAPI) {
      throw new Error('worktreeAPI not available');
    }

    const worktree = await window.worktreeAPI.provision(this._workspacePath, branchName, {
      agentId: this.nodeId,
      worktreePath,
    });

    this.activeWorktreeId = worktree.id;
    return worktree;
  }

  /**
   * Release a worktree
   */
  async releaseWorktree(worktreeId: string): Promise<void> {
    if (!window.worktreeAPI) {
      throw new Error('worktreeAPI not available');
    }

    await window.worktreeAPI.release(worktreeId);

    if (this.activeWorktreeId === worktreeId) {
      this.activeWorktreeId = null;
    }
  }

  /**
   * Get currently active worktree
   */
  async getActiveWorktree(): Promise<WorktreeInfo | null> {
    if (!this.activeWorktreeId) {
      return null;
    }

    if (!window.worktreeAPI) {
      return null;
    }

    return window.worktreeAPI.get(this.activeWorktreeId);
  }

  /**
   * Detect project type based on workspace contents
   */
  async getProjectType(): Promise<string | null> {
    if (!this._workspacePath) {
      return null;
    }

    // TODO: Implement project type detection
    // Could check for package.json (node), Cargo.toml (rust), etc.
    // For now, return null - can be enhanced later
    return null;
  }

  /**
   * Get git repository info
   */
  async getGitInfo(): Promise<GitInfo | null> {
    if (!this._workspacePath) {
      return null;
    }

    if (!window.gitAPI) {
      return null;
    }

    try {
      return await window.gitAPI.getInfo(this._workspacePath);
    } catch {
      // Not a git repository
      return null;
    }
  }

  /**
   * Dispose the service - cleanup resources
   */
  async dispose(): Promise<void> {
    // Release active worktree if any
    if (this.activeWorktreeId && window.worktreeAPI) {
      try {
        await window.worktreeAPI.release(this.activeWorktreeId);
      } catch (err) {
        console.error('[WorkspaceService] Error releasing worktree:', err);
      }
      this.activeWorktreeId = null;
    }
  }
}
