/**
 * Service Container for Dependency Injection
 *
 * Centralizes creation and management of all repositories and services.
 * Repositories are created once at authentication and reused throughout the app lifecycle.
 */

import type {
  IActiveSessionRepository,
  IApiKeyRepository,
  ICanvasLayoutRepository,
  IChatHistoryRepository,
  IPinnedConversationRepository,
  IProjectRepository,
  IProjectSharingRepository,
  IRepositoryFactory,
  ISessionSharingRepository,
  IUserPreferencesRepository,
  IUserRepository,
  IWorkspaceRepository,
} from './interfaces/repositories.js';

/**
 * All repositories managed by the container
 */
export interface Repositories {
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
}

/**
 * Service container state
 */
interface ContainerState {
  userId: string;
  repositories: Repositories;
  accessToken: string;
  refreshToken: string;
  initializedAt: number;
}

/**
 * ServiceContainer manages the lifecycle of repositories and provides
 * centralized dependency injection for the daemon application.
 *
 * Usage:
 * ```typescript
 * const container = new ServiceContainer(repositoryFactory);
 *
 * // Initialize after authentication
 * await container.initialize(accessToken, refreshToken);
 *
 * // Access repositories
 * const { chatHistories, projects } = container.getRepositories();
 *
 * // Re-initialize after token refresh
 * await container.reinitialize(newAccessToken, newRefreshToken);
 * ```
 */
export class ServiceContainer {
  private state: ContainerState | null = null;
  private readonly factory: IRepositoryFactory;

  constructor(repositoryFactory: IRepositoryFactory) {
    this.factory = repositoryFactory;
  }

  /**
   * Initialize the container with authentication tokens.
   * Creates all repositories and caches them for reuse.
   *
   * @param accessToken - User's access token
   * @param refreshToken - User's refresh token
   * @throws Error if initialization fails
   */
  async initialize(accessToken: string, refreshToken: string): Promise<void> {
    console.log('[ServiceContainer] Initializing repositories...');

    const result = await this.factory.createRepositories(accessToken, refreshToken);

    this.state = {
      userId: result.userId,
      repositories: {
        users: result.users,
        projects: result.projects,
        chatHistories: result.chatHistories,
        apiKeys: result.apiKeys,
        userPreferences: result.userPreferences,
        activeSessions: result.activeSessions,
        workspaces: result.workspaces,
        projectSharing: result.projectSharing,
        sessionSharing: result.sessionSharing,
        canvasLayouts: result.canvasLayouts,
        pinnedConversations: result.pinnedConversations,
      },
      accessToken,
      refreshToken,
      initializedAt: Date.now(),
    };

    console.log(`[ServiceContainer] Initialized for user: ${result.userId}`);
  }

  /**
   * Reinitialize the container with new tokens.
   * Used after token refresh to update the authenticated context.
   *
   * @param accessToken - New access token
   * @param refreshToken - New refresh token
   */
  async reinitialize(accessToken: string, refreshToken: string): Promise<void> {
    console.log('[ServiceContainer] Reinitializing with new tokens...');
    await this.initialize(accessToken, refreshToken);
  }

  /**
   * Check if the container has been initialized
   */
  isInitialized(): boolean {
    return this.state !== null;
  }

  /**
   * Get the authenticated user's ID
   * @throws Error if not initialized
   */
  getUserId(): string {
    const state = this.getInitializedState();
    return state.userId;
  }

  /**
   * Get all repositories
   * @throws Error if not initialized
   */
  getRepositories(): Repositories {
    const state = this.getInitializedState();
    return state.repositories;
  }

  /**
   * Get a specific repository by name
   * @throws Error if not initialized
   */
  getRepository<K extends keyof Repositories>(name: K): Repositories[K] {
    const state = this.getInitializedState();
    return state.repositories[name];
  }

  /**
   * Get current tokens (for operations that still need them)
   * @throws Error if not initialized
   */
  getTokens(): { accessToken: string; refreshToken: string } {
    const state = this.getInitializedState();
    return {
      accessToken: state.accessToken,
      refreshToken: state.refreshToken,
    };
  }

  /**
   * Get initialization timestamp
   * @throws Error if not initialized
   */
  getInitializedAt(): number {
    const state = this.getInitializedState();
    return state.initializedAt;
  }

  /**
   * Dispose of the container and clear all cached repositories
   */
  dispose(): void {
    console.log('[ServiceContainer] Disposing...');
    this.state = null;
  }

  /**
   * Get the initialized state, throwing if not initialized
   * @throws Error if not initialized
   */
  private getInitializedState(): ContainerState {
    if (!this.state) {
      throw new Error(
        'ServiceContainer not initialized. Call initialize() with valid tokens first.'
      );
    }
    return this.state;
  }
}

// ============================================================================
// Singleton instance for global access (optional pattern)
// ============================================================================

let globalContainer: ServiceContainer | null = null;

/**
 * Get the global service container instance.
 * Must be created first using createServiceContainer().
 *
 * @throws Error if container hasn't been created
 */
export function getServiceContainer(): ServiceContainer {
  if (!globalContainer) {
    throw new Error('Global ServiceContainer not created. Call createServiceContainer() first.');
  }
  return globalContainer;
}

/**
 * Create the global service container instance.
 * Should be called once at application startup.
 *
 * @param repositoryFactory - The repository factory to use
 * @returns The created ServiceContainer
 */
export function createServiceContainer(repositoryFactory: IRepositoryFactory): ServiceContainer {
  if (globalContainer) {
    console.warn('[ServiceContainer] Overwriting existing global container');
  }
  globalContainer = new ServiceContainer(repositoryFactory);
  return globalContainer;
}

/**
 * Check if a global service container exists
 */
export function hasServiceContainer(): boolean {
  return globalContainer !== null;
}

/**
 * Dispose of the global service container
 */
export function disposeServiceContainer(): void {
  if (globalContainer) {
    globalContainer.dispose();
    globalContainer = null;
  }
}
