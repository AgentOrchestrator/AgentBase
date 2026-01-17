/**
 * SQLite implementation of IRepositoryFactory
 * Creates SQLite repositories bound to a local user
 */

import type { IRepositoryFactory } from '../../interfaces/repositories.js';
import type { AppDatabase } from '../../database.js';

import { SQLiteUserRepository } from './repositories/sqlite-user-repository.js';
import { SQLiteProjectRepository } from './repositories/sqlite-project-repository.js';
import { SQLiteChatHistoryRepository } from './repositories/sqlite-chat-history-repository.js';
import { SQLiteApiKeyRepository } from './repositories/sqlite-api-key-repository.js';
import { SQLiteUserPreferencesRepository } from './repositories/sqlite-user-preferences-repository.js';
import { SQLiteActiveSessionRepository } from './repositories/sqlite-active-session-repository.js';
import { SQLiteWorkspaceRepository } from './repositories/sqlite-workspace-repository.js';
import { SQLiteProjectSharingRepository } from './repositories/sqlite-project-sharing-repository.js';
import { SQLiteSessionSharingRepository } from './repositories/sqlite-session-sharing-repository.js';
import { SQLiteCanvasLayoutRepository } from './repositories/sqlite-canvas-layout-repository.js';
import { SQLitePinnedConversationRepository } from './repositories/sqlite-pinned-conversation-repository.js';
import { LocalAuthProvider } from './local-auth-provider.js';

export class SQLiteRepositoryFactory implements IRepositoryFactory {
  private localAuthProvider: LocalAuthProvider;

  constructor(private appDb: AppDatabase) {
    this.localAuthProvider = new LocalAuthProvider(appDb);
  }

  async createRepositories(
    _accessToken: string,
    _refreshToken: string
  ) {
    const db = this.appDb.getRawDb();
    const userId = this.localAuthProvider.getLocalUserId();

    // Ensure the local user exists in the database
    const userRepo = new SQLiteUserRepository(db);
    await userRepo.getOrCreateLocalUser(userId);

    return {
      userId,
      users: userRepo,
      projects: new SQLiteProjectRepository(db, userId),
      chatHistories: new SQLiteChatHistoryRepository(db, userId),
      apiKeys: new SQLiteApiKeyRepository(db, userId),
      userPreferences: new SQLiteUserPreferencesRepository(db, userId),
      activeSessions: new SQLiteActiveSessionRepository(db, userId),
      workspaces: new SQLiteWorkspaceRepository(),
      projectSharing: new SQLiteProjectSharingRepository(),
      sessionSharing: new SQLiteSessionSharingRepository(),
      canvasLayouts: new SQLiteCanvasLayoutRepository(db, userId),
      pinnedConversations: new SQLitePinnedConversationRepository(db, userId),
    };
  }

  /**
   * Get the local user ID without creating repositories
   * Useful for quick auth checks
   */
  getLocalUserId(): string {
    return this.localAuthProvider.getLocalUserId();
  }
}

/**
 * Factory function to create a SQLiteRepositoryFactory
 */
export function createSQLiteRepositoryFactory(db: AppDatabase): SQLiteRepositoryFactory {
  return new SQLiteRepositoryFactory(db);
}
