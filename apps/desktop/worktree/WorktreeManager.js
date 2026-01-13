"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorktreeManager = void 0;
const path = __importStar(require("path"));
/**
 * Manages git worktrees for agent isolation.
 * All dependencies are injected via constructor for testability.
 */
class WorktreeManager {
    constructor(config, store, git, fs, idGenerator, logger) {
        this.config = config;
        this.store = store;
        this.git = git;
        this.fs = fs;
        this.idGenerator = idGenerator;
        this.logger = logger;
        this.worktreesBeingProvisioned = new Set();
        this.worktreesBeingReleased = new Set();
    }
    async initialize() {
        await this.store.initialize();
        await this.fs.mkdir(this.config.baseWorktreeDirectory);
        await this.recoverOrphanedWorktrees();
    }
    async provision(repoPath, branchName, options) {
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
            const worktreePath = this.generateWorktreePath(branchName, options?.directoryName);
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
        }
        catch (error) {
            await this.store.updateStatus(worktreeId, 'error', error.message);
            this.logger.error('Failed to provision worktree', {
                id: worktreeId,
                error: error.message,
            });
            throw error;
        }
        finally {
            this.worktreesBeingProvisioned.delete(provisionKey);
        }
    }
    async release(worktreeId, options) {
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
            }
            catch (error) {
                if (!force) {
                    throw new Error(`Cannot remove worktree: ${error.message}. Use force: true to override.`);
                }
                await this.fs.rmdir(worktree.worktree_path);
            }
            if (options?.deleteBranch) {
                try {
                    await this.deleteBranch(worktree.repo_path, worktree.branch_name, force);
                }
                catch (error) {
                    this.logger.warn('Failed to delete branch', {
                        branch: worktree.branch_name,
                        error: error.message,
                    });
                }
            }
            await this.store.delete(worktreeId);
            this.logger.info('Released worktree', {
                id: worktreeId,
                path: worktree.worktree_path,
            });
        }
        catch (error) {
            await this.store.updateStatus(worktreeId, 'error', error.message);
            this.logger.error('Failed to release worktree', {
                id: worktreeId,
                error: error.message,
            });
            throw error;
        }
        finally {
            this.worktreesBeingReleased.delete(worktreeId);
        }
    }
    async get(worktreeId) {
        const row = await this.store.getById(worktreeId);
        return row ? this.rowToWorktreeInfo(row) : null;
    }
    async list(repoPath) {
        const rows = await this.store.list(repoPath);
        return rows.map((row) => this.rowToWorktreeInfo(row));
    }
    close() {
        this.store.close();
    }
    // ==================== Private Methods ====================
    async validateRepository(repoPath) {
        const isRepo = await this.git.isRepository(repoPath);
        if (!isRepo) {
            throw new Error(`Invalid git repository: ${repoPath}`);
        }
    }
    async branchExists(repoPath, branchName) {
        try {
            await this.git.exec(repoPath, [
                'rev-parse',
                '--verify',
                `refs/heads/${branchName}`,
            ]);
            return true;
        }
        catch {
            return false;
        }
    }
    async createBranch(repoPath, branchName, baseBranch) {
        const args = ['branch', branchName];
        if (baseBranch) {
            args.push(baseBranch);
        }
        await this.git.exec(repoPath, args);
    }
    async addWorktree(repoPath, worktreePath, branchName) {
        await this.git.exec(repoPath, ['worktree', 'add', worktreePath, branchName]);
    }
    async removeWorktree(repoPath, worktreePath, force) {
        const args = ['worktree', 'remove'];
        if (force) {
            args.push('--force');
        }
        args.push(worktreePath);
        await this.git.exec(repoPath, args);
    }
    async deleteBranch(repoPath, branchName, force) {
        const flag = force ? '-D' : '-d';
        await this.git.exec(repoPath, ['branch', flag, branchName]);
    }
    generateWorktreePath(branchName, directoryName) {
        const safeBranchName = branchName.replace(/[^a-zA-Z0-9-_]/g, '-');
        const dirName = directoryName ?? `${safeBranchName}-${Date.now()}`;
        return path.join(this.config.baseWorktreeDirectory, dirName);
    }
    rowToWorktreeInfo(row) {
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
    async recoverOrphanedWorktrees() {
        const stuckEntries = await this.store.listByStatus([
            'provisioning',
            'releasing',
        ]);
        for (const entry of stuckEntries) {
            await this.reconcileWorktreeState(entry);
        }
        await this.cleanOrphanedFilesystemWorktrees();
    }
    async reconcileWorktreeState(entry) {
        const fsExists = await this.fs.exists(entry.worktree_path);
        if (entry.status === 'provisioning') {
            if (fsExists) {
                const isValidWorktree = await this.git.isRepository(entry.worktree_path);
                if (isValidWorktree) {
                    await this.store.updateStatus(entry.id, 'active');
                    this.logger.info('Recovered provisioning worktree to active', {
                        id: entry.id,
                    });
                }
                else {
                    await this.forceCleanup(entry);
                }
            }
            else {
                await this.store.delete(entry.id);
                this.logger.info('Removed incomplete provisioning record', {
                    id: entry.id,
                });
            }
        }
        else if (entry.status === 'releasing') {
            await this.forceCleanup(entry);
        }
    }
    async forceCleanup(entry) {
        try {
            await this.removeWorktree(entry.repo_path, entry.worktree_path, true);
        }
        catch {
            try {
                await this.fs.rmdir(entry.worktree_path);
            }
            catch {
                // Ignore - might already be cleaned up
            }
        }
        await this.store.delete(entry.id);
        this.logger.info('Force cleaned worktree', { id: entry.id });
    }
    async cleanOrphanedFilesystemWorktrees() {
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
                }
                catch (error) {
                    this.logger.error('Failed to clean orphaned worktree', {
                        path: fullPath,
                        error: error.message,
                    });
                }
            }
        }
    }
}
exports.WorktreeManager = WorktreeManager;
