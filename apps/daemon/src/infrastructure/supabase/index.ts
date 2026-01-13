/**
 * Supabase infrastructure factory
 * Creates all repositories bound to an authenticated user session
 */

import type { IAuthProvider } from '../../interfaces/auth.js';
import type {
  IRepositoryFactory,
  IProjectRepository,
  IChatHistoryRepository,
  IApiKeyRepository,
  IUserPreferencesRepository,
} from '../../interfaces/repositories.js';

import { createAuthenticatedSupabaseClient } from './client.js';
import { SupabaseAuthProvider } from './auth-provider.js';
import { SupabaseProjectRepository } from './project-repository.js';
import { SupabaseChatHistoryRepository } from './chat-history-repository.js';
import { SupabaseApiKeyRepository } from './api-key-repository.js';
import { SupabaseUserPreferencesRepository } from './user-preferences-repository.js';

/**
 * Supabase implementation of IRepositoryFactory
 */
export class SupabaseRepositoryFactory implements IRepositoryFactory {
  async createRepositories(
    accessToken: string,
    refreshToken: string
  ): Promise<{
    userId: string;
    projects: IProjectRepository;
    chatHistories: IChatHistoryRepository;
    apiKeys: IApiKeyRepository;
    userPreferences: IUserPreferencesRepository;
  }> {
    const { client, userId } = await createAuthenticatedSupabaseClient(accessToken, refreshToken);

    return {
      userId,
      projects: new SupabaseProjectRepository(client, userId),
      chatHistories: new SupabaseChatHistoryRepository(client, userId),
      apiKeys: new SupabaseApiKeyRepository(client, userId),
      userPreferences: new SupabaseUserPreferencesRepository(client, userId),
    };
  }
}

/**
 * Create the Supabase auth provider
 */
export function createSupabaseAuthProvider(): IAuthProvider {
  return new SupabaseAuthProvider();
}

/**
 * Create the Supabase repository factory
 */
export function createSupabaseRepositoryFactory(): IRepositoryFactory {
  return new SupabaseRepositoryFactory();
}

// Re-export for convenience
export { SupabaseAuthProvider } from './auth-provider.js';
export { SupabaseProjectRepository } from './project-repository.js';
export { SupabaseChatHistoryRepository } from './chat-history-repository.js';
export { SupabaseApiKeyRepository } from './api-key-repository.js';
export { SupabaseUserPreferencesRepository } from './user-preferences-repository.js';
