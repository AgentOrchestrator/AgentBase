import * as path from 'node:path';
import type {
  WorktreeInfo,
  WorktreeManagerConfig,
  WorktreeProvisionOptions,
  WorktreeReleaseOptions,
  WorktreeRow,
} from '../types/worktree';
import type { IFilesystem } from './dependencies/IFilesystem';
import type { IGitExecutor } from './dependencies/IGitExecutor';
import type { IIdGenerator } from './dependencies/IIdGenerator';
import type { ILogger } from './dependencies/ILogger';
import type { IWorktreeStore } from './dependencies/IWorktreeStore';
import type { IWorktreeManager } from './IWorktreeManager';

/**
 * Manages git worktrees for agent isolation.
 * All dependencies are injected via constructor for testability.
 */
export class WorktreeManager implements IWorktreeManager {
  private readonly worktreesBeingProvisioned = new Set<string>();
  private readonly worktreesBeingReleased = new Set<string>();

  constructor(
    private readonly config: WorktreeManagerConfig,
    private readonly store: IWorktreeStore,
    private readonly git: IGitExecutor,
    private readonly fs: IFilesystem,
    private readonly idGenerator: IIdGenerator,
    private readonly logger: ILogger
  ) {}

  async initialize(): Promise<void> {
    await this.store.initialize();
    await this.fs.mkdir(this.config.baseWorktreeDirectory);
    await this.recoverOrphanedWorktrees();
  }

  async provision(
    repoPath: string,
    branchName: string,
    options?: WorktreeProvisionOptions
  ): Promise<WorktreeInfo> {
    const provisionKey = `${repoPath}:${branchName}`;

    if (this.worktreesBeingProvisioned.has(provisionKey)) {
      throw new Error(`Worktree for branch "${branchName}" is already being provisioned`);
    }

    const existing = await this.store.getByRepoBranch(repoPath, branchName);
    if (existing && existing.status === 'active') {
      return this.rowToWorktreeInfo(existing);
    }

    this.worktreesBeingProvisioned.add(provisionKey);
    const worktreeId = this.idGenerator.generate();
    const now = new Date().toISOString();

    try {
      await this.validateRepository(repoPath);

      // worktreePath is now required - caller must provide explicit path
      if (!options?.worktreePath) {
        throw new Error(
          'worktreePath is required: caller must provide an explicit path for the worktree'
        );
      }
      const worktreePath = options.worktreePath;

      await this.store.insert({
        id: worktreeId,
        repo_path: repoPath,
        worktree_path: worktreePath,
        branch_name: branchName,
        status: 'provisioning',
        provisioned_at: now,
        last_activity_at: now,
        agent_id: options?.agentId ?? null,
        error_message: null,
      });

      const branchExists = await this.branchExists(repoPath, branchName);
      if (!branchExists) {
        await this.createBranch(repoPath, branchName, options?.baseBranch);
      }

      await this.addWorktree(repoPath, worktreePath, branchName);
      await this.store.updateStatus(worktreeId, 'active');

      this.logger.info('Provisioned worktree', {
        id: worktreeId,
        path: worktreePath,
        branch: branchName,
      });

      return {
        id: worktreeId,
        repoPath,
        worktreePath,
        branchName,
        status: 'active',
        provisionedAt: now,
        lastActivityAt: now,
        agentId: options?.agentId,
      };
    } catch (error) {
      await this.store.updateStatus(worktreeId, 'error', (error as Error).message);
      this.logger.error('Failed to provision worktree', {
        id: worktreeId,
        error: (error as Error).message,
      });
      throw error;
    } finally {
      this.worktreesBeingProvisioned.delete(provisionKey);
    }
  }

  async release(worktreeId: string, options?: WorktreeReleaseOptions): Promise<void> {
    if (this.worktreesBeingReleased.has(worktreeId)) {
      throw new Error(`Worktree "${worktreeId}" is already being released`);
    }

    const worktree = await this.store.getById(worktreeId);
    if (!worktree) {
      throw new Error(`Worktree not found: ${worktreeId}`);
    }

    this.worktreesBeingReleased.add(worktreeId);

    try {
      await this.store.updateStatus(worktreeId, 'releasing');

      const force = options?.force ?? false;
      try {
        await this.removeWorktree(worktree.repo_path, worktree.worktree_path, force);
      } catch (error) {
        if (!force) {
          throw new Error(
            `Cannot remove worktree: ${(error as Error).message}. Use force: true to override.`
          );
        }
        await this.fs.rmdir(worktree.worktree_path);
      }

      if (options?.deleteBranch) {
        try {
          await this.deleteBranch(worktree.repo_path, worktree.branch_name, force);
        } catch (error) {
          this.logger.warn('Failed to delete branch', {
            branch: worktree.branch_name,
            error: (error as Error).message,
          });
        }
      }

      await this.store.delete(worktreeId);

      this.logger.info('Released worktree', {
        id: worktreeId,
        path: worktree.worktree_path,
      });
    } catch (error) {
      await this.store.updateStatus(worktreeId, 'error', (error as Error).message);
      this.logger.error('Failed to release worktree', {
        id: worktreeId,
        error: (error as Error).message,
      });
      throw error;
    } finally {
      this.worktreesBeingReleased.delete(worktreeId);
    }
  }

  async get(worktreeId: string): Promise<WorktreeInfo | null> {
    const row = await this.store.getById(worktreeId);
    return row ? this.rowToWorktreeInfo(row) : null;
  }

  async list(repoPath?: string): Promise<WorktreeInfo[]> {
    const rows = await this.store.list(repoPath);
    return rows.map((row) => this.rowToWorktreeInfo(row));
  }

  close(): void {
    this.store.close();
  }

  // ==================== Private Methods ====================

  private async validateRepository(repoPath: string): Promise<void> {
    const isRepo = await this.git.isRepository(repoPath);
    if (!isRepo) {
      throw new Error(`Invalid git repository: ${repoPath}`);
    }
  }

  private async branchExists(repoPath: string, branchName: string): Promise<boolean> {
    try {
      await this.git.exec(repoPath, ['rev-parse', '--verify', `refs/heads/${branchName}`]);
      return true;
    } catch {
      return false;
    }
  }

  private async createBranch(
    repoPath: string,
    branchName: string,
    baseBranch?: string
  ): Promise<void> {
    const args = ['branch', branchName];
    if (baseBranch) {
      args.push(baseBranch);
    }
    await this.git.exec(repoPath, args);
  }

  private async addWorktree(
    repoPath: string,
    worktreePath: string,
    branchName: string
  ): Promise<void> {
    console.log('Adding worktree:', { repoPath, worktreePath, branchName });
    await this.git.exec(repoPath, ['worktree', 'add', worktreePath, branchName]);
  }

  private async removeWorktree(
    repoPath: string,
    worktreePath: string,
    force: boolean
  ): Promise<void> {
    const args = ['worktree', 'remove'];
    if (force) {
      args.push('--force');
    }
    args.push(worktreePath);
    await this.git.exec(repoPath, args);
  }

  private async deleteBranch(repoPath: string, branchName: string, force: boolean): Promise<void> {
    const flag = force ? '-D' : '-d';
    await this.git.exec(repoPath, ['branch', flag, branchName]);
  }

  private rowToWorktreeInfo(row: WorktreeRow): WorktreeInfo {
    return {
      id: row.id,
      repoPath: row.repo_path,
      worktreePath: row.worktree_path,
      branchName: row.branch_name,
      status: row.status,
      provisionedAt: row.provisioned_at,
      lastActivityAt: row.last_activity_at,
      agentId: row.agent_id ?? undefined,
      errorMessage: row.error_message ?? undefined,
    };
  }

  private async recoverOrphanedWorktrees(): Promise<void> {
    const stuckEntries = await this.store.listByStatus(['provisioning', 'releasing']);

    for (const entry of stuckEntries) {
      await this.reconcileWorktreeState(entry);
    }

    await this.cleanOrphanedFilesystemWorktrees();
  }

  private async reconcileWorktreeState(entry: WorktreeRow): Promise<void> {
    const fsExists = await this.fs.exists(entry.worktree_path);

    if (entry.status === 'provisioning') {
      if (fsExists) {
        const isValidWorktree = await this.git.isRepository(entry.worktree_path);
        if (isValidWorktree) {
          await this.store.updateStatus(entry.id, 'active');
          this.logger.info('Recovered provisioning worktree to active', {
            id: entry.id,
          });
        } else {
          await this.forceCleanup(entry);
        }
      } else {
        await this.store.delete(entry.id);
        this.logger.info('Removed incomplete provisioning record', {
          id: entry.id,
        });
      }
    } else if (entry.status === 'releasing') {
      await this.forceCleanup(entry);
    }
  }

  private async forceCleanup(entry: WorktreeRow): Promise<void> {
    try {
      await this.removeWorktree(entry.repo_path, entry.worktree_path, true);
    } catch {
      try {
        await this.fs.rmdir(entry.worktree_path);
      } catch {
        // Ignore - might already be cleaned up
      }
    }

    await this.store.delete(entry.id);
    this.logger.info('Force cleaned worktree', { id: entry.id });
  }

  private async cleanOrphanedFilesystemWorktrees(): Promise<void> {
    const baseExists = await this.fs.exists(this.config.baseWorktreeDirectory);
    if (!baseExists) {
      return;
    }

    const entries = await this.fs.readdir(this.config.baseWorktreeDirectory);

    for (const entry of entries) {
      const fullPath = path.join(this.config.baseWorktreeDirectory, entry);
      const dbEntry = await this.store.getByPath(fullPath);

      if (!dbEntry) {
        this.logger.info('Cleaning orphaned worktree', { path: fullPath });
        try {
          await this.fs.rmdir(fullPath);
        } catch (error) {
          this.logger.error('Failed to clean orphaned worktree', {
            path: fullPath,
            error: (error as Error).message,
          });
        }
      }
    }
  }
}
