/**
 * Public interface exports
 * All consumers should import from this file
 */

// Auth interfaces
export type {
  AuthTokens,
  AuthSession,
  DeviceAuthSession,
  AuthProviderCapabilities,
  AuthProviderInfo,
  TokenValidationResult,
  IAuthProvider,
  AuthContext,
  CreateAuthContext,
} from './auth.js';

// Auth state store interfaces (local persistence)
export type {
  PersistedAuthState,
  DeviceIdentity,
  IAuthStateStore,
} from './auth-state-store.js';

// Authenticated client factory interfaces
export type {
  AuthenticatedClientResult,
  IAuthenticatedClientFactory,
} from './authenticated-client-factory.js';

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
