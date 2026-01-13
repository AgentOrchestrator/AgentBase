"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorktreeStore = void 0;
const sqlite3_1 = __importDefault(require("sqlite3"));
/**
 * Production implementation of IWorktreeStore using SQLite
 */
class WorktreeStore {
    constructor(databasePath) {
        this.db = new sqlite3_1.default.Database(databasePath);
    }
    async initialize() {
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
    async insert(worktree) {
        await this.run(`INSERT INTO worktrees
       (id, repo_path, worktree_path, branch_name, status, provisioned_at, last_activity_at, agent_id, error_message)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
            worktree.id,
            worktree.repo_path,
            worktree.worktree_path,
            worktree.branch_name,
            worktree.status,
            worktree.provisioned_at,
            worktree.last_activity_at,
            worktree.agent_id,
            worktree.error_message,
        ]);
    }
    async updateStatus(id, status, errorMessage) {
        const now = new Date().toISOString();
        await this.run(`UPDATE worktrees SET status = ?, error_message = ?, last_activity_at = ? WHERE id = ?`, [status, errorMessage ?? null, now, id]);
    }
    async getById(id) {
        const row = await this.get('SELECT * FROM worktrees WHERE id = ?', [id]);
        return row ?? null;
    }
    async getByPath(path) {
        const row = await this.get('SELECT * FROM worktrees WHERE worktree_path = ?', [path]);
        return row ?? null;
    }
    async getByRepoBranch(repoPath, branchName) {
        const row = await this.get('SELECT * FROM worktrees WHERE repo_path = ? AND branch_name = ?', [repoPath, branchName]);
        return row ?? null;
    }
    async list(repoPath) {
        if (repoPath) {
            return this.all('SELECT * FROM worktrees WHERE repo_path = ? ORDER BY provisioned_at DESC', [repoPath]);
        }
        return this.all('SELECT * FROM worktrees ORDER BY provisioned_at DESC');
    }
    async listByStatus(statuses) {
        const placeholders = statuses.map(() => '?').join(', ');
        return this.all(`SELECT * FROM worktrees WHERE status IN (${placeholders})`, statuses);
    }
    async delete(id) {
        await this.run('DELETE FROM worktrees WHERE id = ?', [id]);
    }
    close() {
        this.db.close();
    }
    run(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, (err) => {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
    }
    get(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err)
                    reject(err);
                else
                    resolve(row);
            });
        });
    }
    all(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err)
                    reject(err);
                else
                    resolve(rows);
            });
        });
    }
}
exports.WorktreeStore = WorktreeStore;
