import { ipcMain } from 'electron';
import type {
  OpenExistingBranchOptions,
  WorktreeProvisionOptions,
  WorktreeReleaseOptions,
} from '../types/worktree';
import { WorktreeManagerFactory } from './WorktreeManagerFactory';

/**
 * Register IPC handlers for worktree operations.
 * Must be called after WorktreeManagerFactory.configure().
 */
export function registerWorktreeIpcHandlers(): void {
  ipcMain.handle(
    'worktree:provision',
    async (_event, repoPath: string, branchName: string, options?: WorktreeProvisionOptions) => {
      try {
        const manager = await WorktreeManagerFactory.getManager();
        const worktree = await manager.provision(repoPath, branchName, options);
        console.log('[Main] Worktree provisioned', {
          id: worktree.id,
          path: worktree.worktreePath,
        });
        return { success: true, data: worktree };
      } catch (error) {
        console.error('[Main] Error provisioning worktree', {
          repoPath,
          branchName,
          error,
        });
        return { success: false, error: (error as Error).message };
      }
    }
  );

  ipcMain.handle(
    'worktree:release',
    async (_event, worktreeId: string, options?: WorktreeReleaseOptions) => {
      try {
        const manager = await WorktreeManagerFactory.getManager();
        await manager.release(worktreeId, options);
        console.log('[Main] Worktree released', { worktreeId });
        return { success: true };
      } catch (error) {
        console.error('[Main] Error releasing worktree', { worktreeId, error });
        return { success: false, error: (error as Error).message };
      }
    }
  );

  ipcMain.handle('worktree:get', async (_event, worktreeId: string) => {
    try {
      const manager = await WorktreeManagerFactory.getManager();
      const worktree = await manager.get(worktreeId);
      return { success: true, data: worktree };
    } catch (error) {
      console.error('[Main] Error getting worktree', { worktreeId, error });
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('worktree:list', async (_event, repoPath?: string) => {
    try {
      const manager = await WorktreeManagerFactory.getManager();
      const worktrees = await manager.list(repoPath);
      console.log('[Main] Listed worktrees', { count: worktrees.length });
      return { success: true, data: worktrees };
    } catch (error) {
      console.error('[Main] Error listing worktrees', { error });
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('worktree:list-branches', async (_event, repoPath: string) => {
    try {
      const manager = await WorktreeManagerFactory.getManager();
      const branches = await manager.listBranches(repoPath);
      console.log('[Main] Listed branches', { count: branches.length });
      return { success: true, data: branches };
    } catch (error) {
      console.error('[Main] Error listing branches', { repoPath, error });
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle(
    'worktree:open-existing-branch',
    async (_event, repoPath: string, branchName: string, options: OpenExistingBranchOptions) => {
      try {
        const manager = await WorktreeManagerFactory.getManager();
        const result = await manager.openExistingBranch(repoPath, branchName, options);
        console.log('[Main] Opened existing branch in worktree', {
          id: result.worktree.id,
          path: result.worktree.worktreePath,
          reusedExisting: result.reusedExisting,
        });
        return { success: true, data: result };
      } catch (error) {
        console.error('[Main] Error opening existing branch', {
          repoPath,
          branchName,
          error,
        });
        return { success: false, error: (error as Error).message };
      }
    }
  );
}
