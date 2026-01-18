/**
 * LoaderRegistry - manages and coordinates multiple chat history loaders
 *
 * Provides a centralized way to:
 * - Register loaders
 * - Query available loaders
 * - Read histories from all loaders at once
 * - Extract projects across all sources
 */

import type { IChatHistoryLoader, ILoaderRegistry } from './interfaces.js';
import type { AgentType, ChatHistory, LoaderOptions, ProjectInfo } from './types.js';

/**
 * Default implementation of ILoaderRegistry
 *
 * Usage:
 * ```typescript
 * const registry = new LoaderRegistry();
 * registry.register(claudeCodeLoader);
 * registry.register(cursorLoader);
 * registry.register(vscodeLoader);
 *
 * // Get all available loaders
 * const available = await registry.getAvailable();
 *
 * // Read from all loaders
 * const histories = await registry.readAllHistories({ lookbackDays: 7 });
 * ```
 */
export class LoaderRegistry implements ILoaderRegistry {
  private loaders: Map<AgentType, IChatHistoryLoader> = new Map();

  /**
   * Register a loader
   * Replaces any existing loader for the same agent type
   */
  register(loader: IChatHistoryLoader): void {
    this.loaders.set(loader.agentType, loader);
  }

  /**
   * Unregister a loader by agent type
   */
  unregister(agentType: AgentType): boolean {
    return this.loaders.delete(agentType);
  }

  /**
   * Get all registered loaders
   */
  getAll(): IChatHistoryLoader[] {
    return Array.from(this.loaders.values());
  }

  /**
   * Get loaders that are available on this system
   * Checks each loader's isAvailable() method
   */
  async getAvailable(): Promise<IChatHistoryLoader[]> {
    const available: IChatHistoryLoader[] = [];

    for (const loader of this.loaders.values()) {
      try {
        const isAvailable = await Promise.resolve(loader.isAvailable());
        if (isAvailable) {
          available.push(loader);
        }
      } catch (error) {
        console.warn(`[LoaderRegistry] Error checking availability for ${loader.name}:`, error);
      }
    }

    return available;
  }

  /**
   * Get a specific loader by agent type
   */
  getByType(agentType: AgentType): IChatHistoryLoader | undefined {
    return this.loaders.get(agentType);
  }

  /**
   * Check if a loader is registered for the given agent type
   */
  has(agentType: AgentType): boolean {
    return this.loaders.has(agentType);
  }

  /**
   * Get the count of registered loaders
   */
  get size(): number {
    return this.loaders.size;
  }

  /**
   * Read histories from all available loaders
   *
   * @param options - Options passed to each loader
   * @returns Combined histories from all loaders, sorted by timestamp (newest first)
   */
  async readAllHistories(options?: LoaderOptions): Promise<ChatHistory[]> {
    const availableLoaders = await this.getAvailable();
    const allHistories: ChatHistory[] = [];

    const results = await Promise.allSettled(
      availableLoaders.map(async (loader) => {
        try {
          const histories = await Promise.resolve(loader.readHistories(options));
          return { loader, histories };
        } catch (error) {
          console.error(`[LoaderRegistry] Error reading from ${loader.name}:`, error);
          throw error;
        }
      })
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        allHistories.push(...result.value.histories);
      }
    }

    // Sort by timestamp, newest first
    allHistories.sort((a, b) => {
      const dateA = new Date(a.timestamp).getTime();
      const dateB = new Date(b.timestamp).getTime();
      return dateB - dateA;
    });

    return allHistories;
  }

  /**
   * Read histories from a specific loader by agent type
   */
  async readHistoriesFrom(agentType: AgentType, options?: LoaderOptions): Promise<ChatHistory[]> {
    const loader = this.loaders.get(agentType);

    if (!loader) {
      throw new Error(`No loader registered for agent type: ${agentType}`);
    }

    const isAvailable = await Promise.resolve(loader.isAvailable());
    if (!isAvailable) {
      console.warn(`[LoaderRegistry] Loader ${loader.name} is not available`);
      return [];
    }

    return Promise.resolve(loader.readHistories(options));
  }

  /**
   * Extract projects from all available loaders
   *
   * @param options - Options passed to each loader for reading histories
   * @returns Combined project info from all loaders
   */
  async extractAllProjects(options?: LoaderOptions): Promise<ProjectInfo[]> {
    const availableLoaders = await this.getAvailable();
    const projectsMap = new Map<string, ProjectInfo>();

    for (const loader of availableLoaders) {
      try {
        const histories = await Promise.resolve(loader.readHistories(options));
        const projects = loader.extractProjects(histories);

        for (const project of projects) {
          const existing = projectsMap.get(project.path);

          if (existing) {
            // Merge project info
            mergeProjectInfo(existing, project);
          } else {
            projectsMap.set(project.path, { ...project });
          }
        }
      } catch (error) {
        console.error(`[LoaderRegistry] Error extracting projects from ${loader.name}:`, error);
      }
    }

    return Array.from(projectsMap.values());
  }

  /**
   * Get a summary of the registry status
   */
  async getStatus(): Promise<{
    registered: number;
    available: number;
    loaders: Array<{
      name: string;
      agentType: AgentType;
      available: boolean;
    }>;
  }> {
    const loaderStatuses = await Promise.all(
      Array.from(this.loaders.values()).map(async (loader) => ({
        name: loader.name,
        agentType: loader.agentType,
        available: await Promise.resolve(loader.isAvailable()).catch(() => false),
      }))
    );

    return {
      registered: this.loaders.size,
      available: loaderStatuses.filter((l) => l.available).length,
      loaders: loaderStatuses,
    };
  }
}

/**
 * Merge project info from source into target
 * Updates counts and last activity
 */
function mergeProjectInfo(target: ProjectInfo, source: ProjectInfo): void {
  // Merge workspace IDs
  for (const wsId of source.workspaceIds) {
    if (!target.workspaceIds.includes(wsId)) {
      target.workspaceIds.push(wsId);
    }
  }

  // Merge counts (add source counts to target)
  if (source.composerCount) {
    target.composerCount = (target.composerCount || 0) + source.composerCount;
  }
  if (source.copilotSessionCount) {
    target.copilotSessionCount = (target.copilotSessionCount || 0) + source.copilotSessionCount;
  }
  if (source.claudeCodeSessionCount) {
    target.claudeCodeSessionCount =
      (target.claudeCodeSessionCount || 0) + source.claudeCodeSessionCount;
  }
  if (source.vscodeSessionCount) {
    target.vscodeSessionCount = (target.vscodeSessionCount || 0) + source.vscodeSessionCount;
  }
  if (source.codexSessionCount) {
    target.codexSessionCount = (target.codexSessionCount || 0) + source.codexSessionCount;
  }
  if (source.factorySessionCount) {
    target.factorySessionCount = (target.factorySessionCount || 0) + source.factorySessionCount;
  }

  // Update last activity if source is more recent
  if (source.lastActivity > target.lastActivity) {
    target.lastActivity = source.lastActivity;
  }
}

/**
 * Create a pre-configured registry with common loaders
 * Note: Loaders must be imported and registered by the consuming app
 */
export function createLoaderRegistry(): LoaderRegistry {
  return new LoaderRegistry();
}
