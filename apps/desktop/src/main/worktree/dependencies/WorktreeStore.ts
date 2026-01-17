import sqlite3 from 'sqlite3';
import type { WorktreeRow, WorktreeStatus } from '../../types/worktree';
import type { IWorktreeStore } from './IWorktreeStore';

/**
 * Production implementation of IWorktreeStore using SQLite
 */
export class WorktreeStore implements IWorktreeStore {
  private db: sqlite3.Database;

  constructor(databasePath: string) {
    this.db = new sqlite3.Database(databasePath);
  }

  async initialize(): Promise<void> {
    await this.run('PRAGMA foreign_keys = ON');

    await this.run(`
      CREATE TABLE IF NOT EXISTS worktrees (
        id TEXT PRIMARY KEY,
        repo_path TEXT NOT NULL,
        worktree_path TEXT NOT NULL UNIQUE,
        branch_name TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'provisioning',
        provisioned_at TEXT NOT NULL,
        last_activity_at TEXT NOT NULL,
        agent_id TEXT,
        error_message TEXT,
        UNIQUE(repo_path, branch_name)
      )
    `);

    await this.run('CREATE INDEX IF NOT EXISTS idx_worktrees_repo_path ON worktrees(repo_path)');
    await this.run('CREATE INDEX IF NOT EXISTS idx_worktrees_status ON worktrees(status)');
  }

  async insert(worktree: WorktreeRow): Promise<void> {
    await this.run(
      `INSERT INTO worktrees
       (id, repo_path, worktree_path, branch_name, status, provisioned_at, last_activity_at, agent_id, error_message)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        worktree.id,
        worktree.repo_path,
        worktree.worktree_path,
        worktree.branch_name,
        worktree.status,
        worktree.provisioned_at,
        worktree.last_activity_at,
        worktree.agent_id,
        worktree.error_message,
      ]
    );
  }

  async updateStatus(id: string, status: WorktreeStatus, errorMessage?: string): Promise<void> {
    const now = new Date().toISOString();
    await this.run(
      `UPDATE worktrees SET status = ?, error_message = ?, last_activity_at = ? WHERE id = ?`,
      [status, errorMessage ?? null, now, id]
    );
  }

  async getById(id: string): Promise<WorktreeRow | null> {
    const row = await this.get<WorktreeRow>('SELECT * FROM worktrees WHERE id = ?', [id]);
    return row ?? null;
  }

  async getByPath(path: string): Promise<WorktreeRow | null> {
    const row = await this.get<WorktreeRow>('SELECT * FROM worktrees WHERE worktree_path = ?', [
      path,
    ]);
    return row ?? null;
  }

  async getByRepoBranch(repoPath: string, branchName: string): Promise<WorktreeRow | null> {
    const row = await this.get<WorktreeRow>(
      'SELECT * FROM worktrees WHERE repo_path = ? AND branch_name = ?',
      [repoPath, branchName]
    );
    return row ?? null;
  }

  async list(repoPath?: string): Promise<WorktreeRow[]> {
    if (repoPath) {
      return this.all<WorktreeRow>(
        'SELECT * FROM worktrees WHERE repo_path = ? ORDER BY provisioned_at DESC',
        [repoPath]
      );
    }
    return this.all<WorktreeRow>('SELECT * FROM worktrees ORDER BY provisioned_at DESC');
  }

  async listByStatus(statuses: WorktreeStatus[]): Promise<WorktreeRow[]> {
    const placeholders = statuses.map(() => '?').join(', ');
    return this.all<WorktreeRow>(
      `SELECT * FROM worktrees WHERE status IN (${placeholders})`,
      statuses
    );
  }

  async delete(id: string): Promise<void> {
    await this.run('DELETE FROM worktrees WHERE id = ?', [id]);
  }

  close(): void {
    this.db.close();
  }

  private run(sql: string, params: unknown[] = []): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  private get<T>(sql: string, params: unknown[] = []): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row as T | undefined);
      });
    });
  }

  private all<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows as T[]);
      });
    });
  }
}
