/**
 * SQLite infrastructure exports
 */

export { SQLiteAuthStateStore, createSQLiteAuthStateStore } from './sqlite-auth-state-store.js';
export { SQLiteRepositoryFactory, createSQLiteRepositoryFactory } from './sqlite-repository-factory.js';
export { LocalAuthProvider, createLocalAuthProvider } from './local-auth-provider.js';

// Repository exports
export { SQLiteUserRepository } from './repositories/sqlite-user-repository.js';
export { SQLiteProjectRepository } from './repositories/sqlite-project-repository.js';
export { SQLiteChatHistoryRepository } from './repositories/sqlite-chat-history-repository.js';
export { SQLiteApiKeyRepository } from './repositories/sqlite-api-key-repository.js';
export { SQLiteUserPreferencesRepository } from './repositories/sqlite-user-preferences-repository.js';
export { SQLiteActiveSessionRepository } from './repositories/sqlite-active-session-repository.js';
export { SQLiteWorkspaceRepository } from './repositories/sqlite-workspace-repository.js';
export { SQLiteProjectSharingRepository } from './repositories/sqlite-project-sharing-repository.js';
export { SQLiteSessionSharingRepository } from './repositories/sqlite-session-sharing-repository.js';
export { SQLiteCanvasLayoutRepository } from './repositories/sqlite-canvas-layout-repository.js';
export { SQLitePinnedConversationRepository } from './repositories/sqlite-pinned-conversation-repository.js';
