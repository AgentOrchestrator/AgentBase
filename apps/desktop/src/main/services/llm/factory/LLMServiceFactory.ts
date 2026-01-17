import { app } from 'electron';
import { ConsoleLogger } from '../../../worktree/dependencies/ConsoleLogger';
import { KeychainApiKeyRepository } from '../dependencies';
import { VercelAILLMService } from '../implementations';
import type { IApiKeyRepository, IToolCapableLLMService, IToolRegistry } from '../interfaces';
import { ToolRegistry } from '../registry/ToolRegistry';
import type { LLMConfig } from '../types';

/**
 * Factory for creating LLM service instances.
 * Wires up all production dependencies.
 *
 * Pattern: Singleton with lazy initialization (like CodingAgentFactory)
 *
 * Usage:
 * ```typescript
 * // Configure once at startup
 * LLMServiceFactory.configure(DEFAULT_LLM_CONFIG);
 *
 * // Get service (lazy initialization)
 * const service = await LLMServiceFactory.getService();
 *
 * // Use service
 * const result = await service.chat({ messages: [...] });
 *
 * // Cleanup on shutdown
 * await LLMServiceFactory.dispose();
 * ```
 */
export class LLMServiceFactory {
  private static instance: IToolCapableLLMService | null = null;
  private static config: LLMConfig | null = null;
  private static apiKeyRepository: IApiKeyRepository | null = null;
  private static toolRegistry: IToolRegistry | null = null;

  /**
   * Configure the factory before first use.
   * Must be called before getService().
   */
  static configure(config: LLMConfig): void {
    if (LLMServiceFactory.instance) {
      throw new Error('Cannot configure after service has been initialized. Call dispose() first.');
    }
    LLMServiceFactory.config = config;
  }

  /**
   * Get the singleton LLM service instance.
   * Lazily initializes the service on first call.
   */
  static async getService(): Promise<IToolCapableLLMService> {
    if (LLMServiceFactory.instance) {
      return LLMServiceFactory.instance;
    }

    if (!LLMServiceFactory.config) {
      throw new Error('LLMServiceFactory not configured. Call configure() first.');
    }

    // Wire up dependencies
    const logger = new ConsoleLogger('[LLMService]');
    const apiKeyRepo = LLMServiceFactory.getApiKeyRepository();
    const toolRegistry = LLMServiceFactory.getToolRegistry();

    LLMServiceFactory.instance = new VercelAILLMService(
      LLMServiceFactory.config,
      apiKeyRepo,
      toolRegistry,
      logger
    );

    logger.info('LLM Service initialized', {
      defaultVendor: LLMServiceFactory.config.defaultVendor,
    });

    return LLMServiceFactory.instance;
  }

  /**
   * Get the API key repository (shared singleton).
   * Can be used directly for API key management.
   */
  static getApiKeyRepository(): IApiKeyRepository {
    if (!LLMServiceFactory.apiKeyRepository) {
      const serviceName = app?.getName?.() || 'AgentBase';
      LLMServiceFactory.apiKeyRepository = new KeychainApiKeyRepository(serviceName);
    }
    return LLMServiceFactory.apiKeyRepository;
  }

  /**
   * Get the tool registry (shared singleton).
   * Use this to register tools before making chat requests.
   */
  static getToolRegistry(): IToolRegistry {
    if (!LLMServiceFactory.toolRegistry) {
      LLMServiceFactory.toolRegistry = new ToolRegistry();
    }
    return LLMServiceFactory.toolRegistry;
  }

  /**
   * Check if the factory has been configured.
   */
  static isConfigured(): boolean {
    return LLMServiceFactory.config !== null;
  }

  /**
   * Dispose the service and release resources.
   */
  static async dispose(): Promise<void> {
    if (LLMServiceFactory.instance) {
      await LLMServiceFactory.instance.dispose();
      LLMServiceFactory.instance = null;
    }
    LLMServiceFactory.toolRegistry?.clear();
  }

  /**
   * Reset the factory to initial state.
   * Disposes the service and clears configuration.
   */
  static async reset(): Promise<void> {
    await LLMServiceFactory.dispose();
    LLMServiceFactory.config = null;
    LLMServiceFactory.apiKeyRepository = null;
    LLMServiceFactory.toolRegistry = null;
  }
}
