// Public API

// Types (re-export from types folder)
export type {
  WorktreeInfo,
  WorktreeManagerConfig,
  WorktreeProvisionOptions,
  WorktreeReleaseOptions,
  WorktreeRow,
  WorktreeStatus,
} from '../types/worktree';
export type { IFilesystem } from './dependencies/IFilesystem';
// Dependency interfaces (for testing/mocking)
export type { IGitExecutor } from './dependencies/IGitExecutor';
export type { IIdGenerator } from './dependencies/IIdGenerator';
export type { ILogger } from './dependencies/ILogger';
export type { IWorktreeStore } from './dependencies/IWorktreeStore';
export { IWorktreeManager } from './IWorktreeManager';
export { registerWorktreeIpcHandlers } from './ipc';
export { WorktreeManager } from './WorktreeManager';
export { WorktreeManagerFactory } from './WorktreeManagerFactory';
