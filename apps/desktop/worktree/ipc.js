"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerWorktreeIpcHandlers = registerWorktreeIpcHandlers;
const electron_1 = require("electron");
const WorktreeManagerFactory_1 = require("./WorktreeManagerFactory");
/**
 * Register IPC handlers for worktree operations.
 * Must be called after WorktreeManagerFactory.configure().
 */
function registerWorktreeIpcHandlers() {
    electron_1.ipcMain.handle('worktree:provision', async (_event, repoPath, branchName, options) => {
        try {
            const manager = await WorktreeManagerFactory_1.WorktreeManagerFactory.getManager();
            const worktree = await manager.provision(repoPath, branchName, options);
            console.log('[Main] Worktree provisioned', {
                id: worktree.id,
                path: worktree.worktreePath,
            });
            return { success: true, data: worktree };
        }
        catch (error) {
            console.error('[Main] Error provisioning worktree', {
                repoPath,
                branchName,
                error,
            });
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('worktree:release', async (_event, worktreeId, options) => {
        try {
            const manager = await WorktreeManagerFactory_1.WorktreeManagerFactory.getManager();
            await manager.release(worktreeId, options);
            console.log('[Main] Worktree released', { worktreeId });
            return { success: true };
        }
        catch (error) {
            console.error('[Main] Error releasing worktree', { worktreeId, error });
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('worktree:get', async (_event, worktreeId) => {
        try {
            const manager = await WorktreeManagerFactory_1.WorktreeManagerFactory.getManager();
            const worktree = await manager.get(worktreeId);
            return { success: true, data: worktree };
        }
        catch (error) {
            console.error('[Main] Error getting worktree', { worktreeId, error });
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('worktree:list', async (_event, repoPath) => {
        try {
            const manager = await WorktreeManagerFactory_1.WorktreeManagerFactory.getManager();
            const worktrees = await manager.list(repoPath);
            console.log('[Main] Listed worktrees', { count: worktrees.length });
            return { success: true, data: worktrees };
        }
        catch (error) {
            console.error('[Main] Error listing worktrees', { error });
            return { success: false, error: error.message };
        }
    });
}
