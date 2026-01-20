/**
 * Tests for WorktreeManager - listBranches and openExistingBranch
 */

import { OpenExistingBranchError } from '@agent-orchestrator/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorktreeManagerConfig, WorktreeRow, WorktreeStatus } from '../../types/worktree';
import type { IFilesystem } from '../dependencies/IFilesystem';
import type { GitWorktreeEntry, IGitExecutor } from '../dependencies/IGitExecutor';
import type { IIdGenerator } from '../dependencies/IIdGenerator';
import type { ILogger } from '../dependencies/ILogger';
import type { IWorktreeStore } from '../dependencies/IWorktreeStore';
import { WorktreeManager } from '../WorktreeManager';

// =============================================================================
// Mock Implementations
// =============================================================================

/**
 * Mock git command runner for testing.
 * Uses execFile pattern (not shell) for safety - this is just a mock matching the interface.
 */
class MockGitExecutor implements IGitExecutor {
  private branches: string[] = ['main', 'feature-a', 'feature-b'];
  private currentBranch = 'main';
  private worktrees: GitWorktreeEntry[] = [];
  private isValidRepo = true;

  /** Run a git command - mock implementation */
  async exec(repoPath: string, args: string[]): Promise<string> {
    const command = args.join(' ');

    // Handle branch listing: git branch --format=%(refname:short)
    if (command.includes('branch') && command.includes('--format')) {
      return this.branches.join('\n') + '\n';
    }

    // Handle symbolic-ref for current branch
    if (command.includes('symbolic-ref') && command.includes('--short')) {
      return this.currentBranch + '\n';
    }

    // Handle rev-parse for branch existence check
    if (command.startsWith('rev-parse --verify')) {
      const branchRef = args[args.length - 1];
      const branchName = branchRef.replace('refs/heads/', '');
      if (!this.branches.includes(branchName)) {
        throw new Error(`fatal: Needed a single revision`);
      }
      return 'abc123';
    }

    // Handle worktree add
    if (command.startsWith('worktree add')) {
      return '';
    }

    return '';
  }

  async isRepository(path: string): Promise<boolean> {
    return this.isValidRepo;
  }

  async listWorktrees(repoPath: string): Promise<GitWorktreeEntry[]> {
    // Always include main worktree
    const mainWorktree: GitWorktreeEntry = {
      path: repoPath,
      branch: this.currentBranch,
      isMain: true,
    };
    return [mainWorktree, ...this.worktrees];
  }

  // Test helpers
  setBranches(branches: string[]): void {
    this.branches = branches;
  }

  setCurrentBranch(branch: string): void {
    this.currentBranch = branch;
  }

  setWorktrees(worktrees: GitWorktreeEntry[]): void {
    this.worktrees = worktrees;
  }

  setIsValidRepo(valid: boolean): void {
    this.isValidRepo = valid;
  }
}

class MockWorktreeStore implements IWorktreeStore {
  private storage = new Map<string, WorktreeRow>();

  async initialize(): Promise<void> {}

  async insert(worktree: WorktreeRow): Promise<void> {
    this.storage.set(worktree.id, { ...worktree });
  }

  async updateStatus(id: string, status: WorktreeStatus, errorMessage?: string): Promise<void> {
    const row = this.storage.get(id);
    if (row) {
      row.status = status;
      if (errorMessage) {
        row.error_message = errorMessage;
      }
    }
  }

  async getById(id: string): Promise<WorktreeRow | null> {
    return this.storage.get(id) ?? null;
  }

  async getByPath(path: string): Promise<WorktreeRow | null> {
    for (const row of this.storage.values()) {
      if (row.worktree_path === path) {
        return row;
      }
    }
    return null;
  }

  async getByRepoBranch(repoPath: string, branchName: string): Promise<WorktreeRow | null> {
    for (const row of this.storage.values()) {
      if (row.repo_path === repoPath && row.branch_name === branchName) {
        return row;
      }
    }
    return null;
  }

  async list(repoPath?: string): Promise<WorktreeRow[]> {
    const all = Array.from(this.storage.values());
    if (repoPath) {
      return all.filter((r) => r.repo_path === repoPath);
    }
    return all;
  }

  async listByStatus(statuses: WorktreeStatus[]): Promise<WorktreeRow[]> {
    return Array.from(this.storage.values()).filter((r) => statuses.includes(r.status));
  }

  async delete(id: string): Promise<void> {
    this.storage.delete(id);
  }

  close(): void {}

  // Test helper
  clear(): void {
    this.storage.clear();
  }
}

class MockFilesystem implements IFilesystem {
  private existingPaths = new Set<string>();
  private directories = new Map<string, string[]>();

  async exists(path: string): Promise<boolean> {
    return this.existingPaths.has(path);
  }

  async mkdir(path: string): Promise<void> {
    this.existingPaths.add(path);
  }

  async rmdir(path: string): Promise<void> {
    this.existingPaths.delete(path);
  }

  async readdir(path: string): Promise<string[]> {
    return this.directories.get(path) ?? [];
  }

  // Test helpers
  addPath(path: string): void {
    this.existingPaths.add(path);
  }

  removePath(path: string): void {
    this.existingPaths.delete(path);
  }

  setDirectoryContents(path: string, contents: string[]): void {
    this.directories.set(path, contents);
    this.existingPaths.add(path);
  }
}

class MockIdGenerator implements IIdGenerator {
  private counter = 0;

  generate(): string {
    this.counter++;
    return `wt-${this.counter}`;
  }

  reset(): void {
    this.counter = 0;
  }
}

class MockLogger implements ILogger {
  info = vi.fn();
  warn = vi.fn();
  error = vi.fn();
}

// =============================================================================
// Test Suite
// =============================================================================

describe('WorktreeManager', () => {
  let manager: WorktreeManager;
  let git: MockGitExecutor;
  let store: MockWorktreeStore;
  let fs: MockFilesystem;
  let idGen: MockIdGenerator;
  let logger: MockLogger;
  let config: WorktreeManagerConfig;

  const repoPath = '/path/to/repo';

  beforeEach(() => {
    git = new MockGitExecutor();
    store = new MockWorktreeStore();
    fs = new MockFilesystem();
    idGen = new MockIdGenerator();
    logger = new MockLogger();
    config = { baseWorktreeDirectory: '/tmp/worktrees' };

    manager = new WorktreeManager(config, store, git, fs, idGen, logger);
  });

  // ===========================================================================
  // listBranches
  // ===========================================================================

  describe('listBranches', () => {
    it('should return branches with correct checkout status', async () => {
      git.setBranches(['main', 'feature-a', 'feature-b']);
      git.setCurrentBranch('main');
      git.setWorktrees([{ path: '/worktrees/feature-a', branch: 'feature-a', isMain: false }]);

      const branches = await manager.listBranches(repoPath);

      expect(branches).toHaveLength(3);

      const mainBranch = branches.find((b) => b.name === 'main');
      expect(mainBranch?.isCurrent).toBe(true);
      expect(mainBranch?.isCheckedOut).toBe(true);
      expect(mainBranch?.worktreePath).toBe(repoPath);

      const featureA = branches.find((b) => b.name === 'feature-a');
      expect(featureA?.isCurrent).toBe(false);
      expect(featureA?.isCheckedOut).toBe(true);
      expect(featureA?.worktreePath).toBe('/worktrees/feature-a');

      const featureB = branches.find((b) => b.name === 'feature-b');
      expect(featureB?.isCurrent).toBe(false);
      expect(featureB?.isCheckedOut).toBe(false);
      expect(featureB?.worktreePath).toBeUndefined();
    });

    it('should handle empty branch list', async () => {
      git.setBranches([]);
      git.setCurrentBranch('');

      const branches = await manager.listBranches(repoPath);

      expect(branches).toHaveLength(0);
    });

    it('should throw for invalid repository', async () => {
      git.setIsValidRepo(false);

      await expect(manager.listBranches(repoPath)).rejects.toThrow('Invalid git repository');
    });
  });

  // ===========================================================================
  // openExistingBranch
  // ===========================================================================

  describe('openExistingBranch', () => {
    const worktreePath = '/worktrees/feature-a';

    beforeEach(async () => {
      // Setup: valid repo with branches, 'main' is current
      git.setBranches(['main', 'feature-a', 'feature-b']);
      git.setCurrentBranch('main');
      await manager.initialize();
    });

    it('should successfully open a branch that exists and is not checked out', async () => {
      const result = await manager.openExistingBranch(repoPath, 'feature-a', {
        worktreePath,
      });

      expect(result.worktree.branchName).toBe('feature-a');
      expect(result.worktree.worktreePath).toBe(worktreePath);
      expect(result.worktree.status).toBe('active');
      expect(result.reusedExisting).toBe(false);
    });

    it('should fail with BRANCH_NOT_FOUND for non-existent branch', async () => {
      await expect(
        manager.openExistingBranch(repoPath, 'non-existent-branch', {
          worktreePath,
        })
      ).rejects.toThrow(OpenExistingBranchError);

      try {
        await manager.openExistingBranch(repoPath, 'non-existent-branch', {
          worktreePath,
        });
      } catch (error) {
        expect(error).toBeInstanceOf(OpenExistingBranchError);
        expect((error as OpenExistingBranchError).code).toBe('BRANCH_NOT_FOUND');
      }
    });

    it('should fail with BRANCH_CHECKED_OUT_IN_MAIN when branch is current HEAD', async () => {
      await expect(
        manager.openExistingBranch(repoPath, 'main', {
          worktreePath,
        })
      ).rejects.toThrow(OpenExistingBranchError);

      try {
        await manager.openExistingBranch(repoPath, 'main', {
          worktreePath,
        });
      } catch (error) {
        expect(error).toBeInstanceOf(OpenExistingBranchError);
        expect((error as OpenExistingBranchError).code).toBe('BRANCH_CHECKED_OUT_IN_MAIN');
      }
    });

    it('should return existing worktree when reuseExisting is true (default)', async () => {
      // First, create a worktree for feature-a
      git.setWorktrees([{ path: worktreePath, branch: 'feature-a', isMain: false }]);

      // Add to store
      await store.insert({
        id: 'existing-wt',
        repo_path: repoPath,
        worktree_path: worktreePath,
        branch_name: 'feature-a',
        status: 'active',
        provisioned_at: new Date().toISOString(),
        last_activity_at: new Date().toISOString(),
        agent_id: null,
        error_message: null,
      });

      const result = await manager.openExistingBranch(repoPath, 'feature-a', {
        worktreePath: '/worktrees/feature-a-new', // Different path
        reuseExisting: true,
      });

      expect(result.reusedExisting).toBe(true);
      expect(result.worktree.id).toBe('existing-wt');
      expect(result.worktree.worktreePath).toBe(worktreePath);
    });

    it('should fail with BRANCH_HAS_WORKTREE when reuseExisting is false', async () => {
      // Setup: branch already has a worktree
      git.setWorktrees([{ path: worktreePath, branch: 'feature-a', isMain: false }]);

      await store.insert({
        id: 'existing-wt',
        repo_path: repoPath,
        worktree_path: worktreePath,
        branch_name: 'feature-a',
        status: 'active',
        provisioned_at: new Date().toISOString(),
        last_activity_at: new Date().toISOString(),
        agent_id: null,
        error_message: null,
      });

      await expect(
        manager.openExistingBranch(repoPath, 'feature-a', {
          worktreePath: '/worktrees/feature-a-new',
          reuseExisting: false,
        })
      ).rejects.toThrow(OpenExistingBranchError);

      try {
        await manager.openExistingBranch(repoPath, 'feature-a', {
          worktreePath: '/worktrees/feature-a-new',
          reuseExisting: false,
        });
      } catch (error) {
        expect(error).toBeInstanceOf(OpenExistingBranchError);
        expect((error as OpenExistingBranchError).code).toBe('BRANCH_HAS_WORKTREE');
      }
    });

    it('should fail with WORKTREE_PATH_EXISTS when target path already exists', async () => {
      fs.addPath(worktreePath);

      await expect(
        manager.openExistingBranch(repoPath, 'feature-a', {
          worktreePath,
        })
      ).rejects.toThrow(OpenExistingBranchError);

      try {
        await manager.openExistingBranch(repoPath, 'feature-a', {
          worktreePath,
        });
      } catch (error) {
        expect(error).toBeInstanceOf(OpenExistingBranchError);
        expect((error as OpenExistingBranchError).code).toBe('WORKTREE_PATH_EXISTS');
      }
    });

    it('should fail with INVALID_REPOSITORY for invalid repo', async () => {
      git.setIsValidRepo(false);

      await expect(
        manager.openExistingBranch(repoPath, 'feature-a', {
          worktreePath,
        })
      ).rejects.toThrow(OpenExistingBranchError);

      try {
        await manager.openExistingBranch(repoPath, 'feature-a', {
          worktreePath,
        });
      } catch (error) {
        expect(error).toBeInstanceOf(OpenExistingBranchError);
        expect((error as OpenExistingBranchError).code).toBe('INVALID_REPOSITORY');
      }
    });

    it('should associate agentId when provided', async () => {
      const result = await manager.openExistingBranch(repoPath, 'feature-a', {
        worktreePath,
        agentId: 'agent-123',
      });

      expect(result.worktree.agentId).toBe('agent-123');
    });
  });
});
