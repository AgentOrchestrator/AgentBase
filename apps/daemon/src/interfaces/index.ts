/**
 * Public interface exports
 * All consumers should import from this file
 */

// Auth interfaces
export type {
  AuthContext,
  AuthProviderCapabilities,
  AuthProviderInfo,
  AuthSession,
  AuthTokens,
  CreateAuthContext,
  DeviceAuthSession,
  IAuthProvider,
  TokenValidationResult,
} from './auth.js';

// Auth state store interfaces (local persistence)
export type {
  DeviceIdentity,
  IAuthStateStore,
  PersistedAuthState,
} from './auth-state-store.js';

// Authenticated client factory interfaces
export type {
  AuthenticatedClientResult,
  IAuthenticatedClientFactory,
} from './authenticated-client-factory.js';

// Repository interfaces and domain types
export type {
  ApiKeyRecord,
  ChatHistoryInput,
  ChatHistoryRecord,
  IApiKeyRepository,
  IChatHistoryRepository,
  // Repository interfaces
  IProjectRepository,
  IRepositoryFactory,
  IUserPreferencesRepository,
  // Domain types
  Project,
  ProjectInput,
  UserPreferences,
} from './repositories.js';
