import * as path from 'node:path';
import { app } from 'electron';
import type { WorktreeManagerConfig } from '../types/worktree';
import {
  ConsoleLogger,
  Filesystem,
  GitExecutor,
  UuidGenerator,
  WorktreeStore,
} from './dependencies';
import type { IWorktreeManager } from './IWorktreeManager';
import { WorktreeManager } from './WorktreeManager';

/**
 * Factory for creating and managing the WorktreeManager singleton.
 * Wires up all production dependencies.
 */
export class WorktreeManagerFactory {
  private static instance: IWorktreeManager | null = null;
  private static config: WorktreeManagerConfig | null = null;

  /**
   * Configure the factory before use
   * @param config - WorktreeManager configuration
   */
  static configure(config: WorktreeManagerConfig): void {
    if (WorktreeManagerFactory.instance) {
      throw new Error('Cannot configure after manager has been initialized');
    }
    WorktreeManagerFactory.config = config;
  }

  /**
   * Get the singleton WorktreeManager instance.
   * Must call configure() before first call to getManager().
   */
  static async getManager(): Promise<IWorktreeManager> {
    if (WorktreeManagerFactory.instance) {
      return WorktreeManagerFactory.instance;
    }

    if (!WorktreeManagerFactory.config) {
      throw new Error('WorktreeManagerFactory not configured. Call configure() first.');
    }

    const dbPath = path.join(app.getPath('userData'), 'worktrees.db');

    const store = new WorktreeStore(dbPath);
    const git = new GitExecutor();
    const fs = new Filesystem();
    const idGenerator = new UuidGenerator();
    const logger = new ConsoleLogger('[WorktreeManager]');

    WorktreeManagerFactory.instance = new WorktreeManager(
      WorktreeManagerFactory.config,
      store,
      git,
      fs,
      idGenerator,
      logger
    );

    await WorktreeManagerFactory.instance.initialize();
    return WorktreeManagerFactory.instance;
  }

  /**
   * Close the manager and reset singleton
   */
  static closeManager(): void {
    if (WorktreeManagerFactory.instance) {
      WorktreeManagerFactory.instance.close();
      WorktreeManagerFactory.instance = null;
    }
  }

  /**
   * Reset factory state (for testing)
   */
  static reset(): void {
    WorktreeManagerFactory.closeManager();
    WorktreeManagerFactory.config = null;
  }
}
