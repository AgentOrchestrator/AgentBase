/**
 * Factory for creating database instances
 * Implements singleton pattern to ensure only one database instance exists
 */

import * as path from 'node:path';
import { app } from 'electron';
import type { IDatabase } from './IDatabase';
import { SQLiteDatabase } from './SQLiteDatabase';

export type DatabaseType = 'sqlite';

export class DatabaseFactory {
  private static instance: IDatabase | null = null;

  /**
   * Get the singleton database instance
   * @param type - The type of database to create (defaults to 'sqlite')
   * @param customPath - Optional custom path for the database file
   * @returns The database instance
   */
  static async getDatabase(type: DatabaseType = 'sqlite', customPath?: string): Promise<IDatabase> {
    if (DatabaseFactory.instance) {
      return DatabaseFactory.instance;
    }

    const dbPath = customPath || DatabaseFactory.getDefaultDatabasePath();

    switch (type) {
      case 'sqlite':
        DatabaseFactory.instance = new SQLiteDatabase(dbPath);
        break;
      default:
        throw new Error(`Unsupported database type: ${type}`);
    }

    // Initialize the database (create tables, etc.)
    await DatabaseFactory.instance.initialize();

    return DatabaseFactory.instance;
  }

  /**
   * Get the default database file path
   * Stores in the user's app data directory
   */
  private static getDefaultDatabasePath(): string {
    const userDataPath = app.getPath('userData');
    return path.join(userDataPath, 'canvas-state.db');
  }

  /**
   * Close the database connection
   * Resets the singleton instance
   */
  static closeDatabase(): void {
    if (DatabaseFactory.instance) {
      DatabaseFactory.instance.close();
      DatabaseFactory.instance = null;
    }
  }

  /**
   * Reset the singleton instance (useful for testing)
   */
  static reset(): void {
    DatabaseFactory.closeDatabase();
  }
}
