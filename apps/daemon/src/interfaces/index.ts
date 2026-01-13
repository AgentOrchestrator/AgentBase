/**
 * Public interface exports
 * All consumers should import from this file
 */

// Auth interfaces
export type {
  AuthTokens,
  AuthSession,
  DeviceAuthSession,
  IAuthProvider,
  AuthContext,
  CreateAuthContext,
} from './auth.js';

// Repository interfaces and domain types
export type {
  // Domain types
  Project,
  ProjectInput,
  ChatHistoryRecord,
  ChatHistoryInput,
  UserPreferences,
  ApiKeyRecord,
  // Repository interfaces
  IProjectRepository,
  IChatHistoryRepository,
  IApiKeyRepository,
  IUserPreferencesRepository,
  IRepositoryFactory,
} from './repositories.js';
