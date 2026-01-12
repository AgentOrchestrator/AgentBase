import * as path from 'path';
import { app } from 'electron';
import { IWorktreeManager } from './IWorktreeManager';
import { WorktreeManager } from './WorktreeManager';
import { WorktreeManagerConfig } from '../types/worktree';
import {
  GitExecutor,
  Filesystem,
  WorktreeStore,
  UuidGenerator,
  ConsoleLogger,
} from './dependencies';

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
    if (this.instance) {
      throw new Error('Cannot configure after manager has been initialized');
    }
    this.config = config;
  }

  /**
   * Get the singleton WorktreeManager instance.
   * Must call configure() before first call to getManager().
   */
  static async getManager(): Promise<IWorktreeManager> {
    if (this.instance) {
      return this.instance;
    }

    if (!this.config) {
      throw new Error(
        'WorktreeManagerFactory not configured. Call configure() first.'
      );
    }

    const dbPath = path.join(app.getPath('userData'), 'worktrees.db');

    const store = new WorktreeStore(dbPath);
    const git = new GitExecutor();
    const fs = new Filesystem();
    const idGenerator = new UuidGenerator();
    const logger = new ConsoleLogger('[WorktreeManager]');

    this.instance = new WorktreeManager(
      this.config,
      store,
      git,
      fs,
      idGenerator,
      logger
    );

    await this.instance.initialize();
    return this.instance;
  }

  /**
   * Close the manager and reset singleton
   */
  static closeManager(): void {
    if (this.instance) {
      this.instance.close();
      this.instance = null;
    }
  }

  /**
   * Reset factory state (for testing)
   */
  static reset(): void {
    this.closeManager();
    this.config = null;
  }
}
