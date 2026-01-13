// Public API
export { IWorktreeManager } from './IWorktreeManager';
export { WorktreeManager } from './WorktreeManager';
export { WorktreeManagerFactory } from './WorktreeManagerFactory';
export { registerWorktreeIpcHandlers } from './ipc';

// Types (re-export from types folder)
export type {
  WorktreeStatus,
  WorktreeInfo,
  WorktreeProvisionOptions,
  WorktreeReleaseOptions,
  WorktreeManagerConfig,
  WorktreeRow,
} from '../types/worktree';

// Dependency interfaces (for testing/mocking)
export type { IGitExecutor } from './dependencies/IGitExecutor';
export type { IFilesystem } from './dependencies/IFilesystem';
export type { IWorktreeStore } from './dependencies/IWorktreeStore';
export type { IIdGenerator } from './dependencies/IIdGenerator';
export type { ILogger } from './dependencies/ILogger';
