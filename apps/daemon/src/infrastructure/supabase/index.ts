/**
 * Supabase infrastructure factory
 * Creates all repositories bound to an authenticated user session
 */

import type { IAuthProvider } from '../../interfaces/auth.js';
import type {
  IRepositoryFactory,
  IUserRepository,
  IProjectRepository,
  IChatHistoryRepository,
  IApiKeyRepository,
  IUserPreferencesRepository,
  IActiveSessionRepository,
  IWorkspaceRepository,
  IProjectSharingRepository,
  ISessionSharingRepository,
  ICanvasLayoutRepository,
  IPinnedConversationRepository,
} from '../../interfaces/repositories.js';

import { createAuthenticatedSupabaseClient } from './client.js';
import { SupabaseAuthProvider } from './auth-provider.js';
import { SupabaseUserRepository } from './user-repository.js';
import { SupabaseProjectRepository } from './project-repository.js';
import { SupabaseChatHistoryRepository } from './chat-history-repository.js';
import { SupabaseApiKeyRepository } from './api-key-repository.js';
import { SupabaseUserPreferencesRepository } from './user-preferences-repository.js';
import { SupabaseActiveSessionRepository } from './active-session-repository.js';
import { SupabaseWorkspaceRepository } from './workspace-repository.js';
import { SupabaseProjectSharingRepository } from './project-sharing-repository.js';
import { SupabaseSessionSharingRepository } from './session-sharing-repository.js';
import { SupabaseCanvasLayoutRepository } from './canvas-layout-repository.js';
import { SupabasePinnedConversationRepository } from './pinned-conversation-repository.js';

/**
 * Supabase implementation of IRepositoryFactory
 */
export class SupabaseRepositoryFactory implements IRepositoryFactory {
  async createRepositories(
    accessToken: string,
    refreshToken: string
  ): Promise<{
    userId: string;
    users: IUserRepository;
    projects: IProjectRepository;
    chatHistories: IChatHistoryRepository;
    apiKeys: IApiKeyRepository;
    userPreferences: IUserPreferencesRepository;
    activeSessions: IActiveSessionRepository;
    workspaces: IWorkspaceRepository;
    projectSharing: IProjectSharingRepository;
    sessionSharing: ISessionSharingRepository;
    canvasLayouts: ICanvasLayoutRepository;
    pinnedConversations: IPinnedConversationRepository;
  }> {
    const { client, userId } = await createAuthenticatedSupabaseClient(accessToken, refreshToken);

    return {
      userId,
      users: new SupabaseUserRepository(client, userId),
      projects: new SupabaseProjectRepository(client, userId),
      chatHistories: new SupabaseChatHistoryRepository(client, userId),
      apiKeys: new SupabaseApiKeyRepository(client, userId),
      userPreferences: new SupabaseUserPreferencesRepository(client, userId),
      activeSessions: new SupabaseActiveSessionRepository(client, userId),
      workspaces: new SupabaseWorkspaceRepository(client, userId),
      projectSharing: new SupabaseProjectSharingRepository(client, userId),
      sessionSharing: new SupabaseSessionSharingRepository(client, userId),
      canvasLayouts: new SupabaseCanvasLayoutRepository(client, userId),
      pinnedConversations: new SupabasePinnedConversationRepository(client, userId),
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
export { SupabaseUserRepository } from './user-repository.js';
export { SupabaseProjectRepository } from './project-repository.js';
export { SupabaseChatHistoryRepository } from './chat-history-repository.js';
export { SupabaseApiKeyRepository } from './api-key-repository.js';
export { SupabaseUserPreferencesRepository } from './user-preferences-repository.js';
export { SupabaseActiveSessionRepository } from './active-session-repository.js';
export { SupabaseWorkspaceRepository } from './workspace-repository.js';
export { SupabaseProjectSharingRepository } from './project-sharing-repository.js';
export { SupabaseSessionSharingRepository } from './session-sharing-repository.js';
export { SupabaseCanvasLayoutRepository } from './canvas-layout-repository.js';
export { SupabasePinnedConversationRepository } from './pinned-conversation-repository.js';
