import { app } from 'electron';
import type {
  IToolCapableLLMService,
  IApiKeyRepository,
  IToolRegistry,
} from '../interfaces';
import type { LLMConfig } from '../types';
import { VercelAILLMService } from '../implementations';
import { KeychainApiKeyRepository } from '../dependencies';
import { ToolRegistry } from '../registry/ToolRegistry';
import { ConsoleLogger } from '../../../worktree/dependencies/ConsoleLogger';

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
    if (this.instance) {
      throw new Error(
        'Cannot configure after service has been initialized. Call dispose() first.'
      );
    }
    this.config = config;
  }

  /**
   * Get the singleton LLM service instance.
   * Lazily initializes the service on first call.
   */
  static async getService(): Promise<IToolCapableLLMService> {
    if (this.instance) {
      return this.instance;
    }

    if (!this.config) {
      throw new Error(
        'LLMServiceFactory not configured. Call configure() first.'
      );
    }

    // Wire up dependencies
    const logger = new ConsoleLogger('[LLMService]');
    const apiKeyRepo = this.getApiKeyRepository();
    const toolRegistry = this.getToolRegistry();

    this.instance = new VercelAILLMService(
      this.config,
      apiKeyRepo,
      toolRegistry,
      logger
    );

    logger.info('LLM Service initialized', {
      defaultVendor: this.config.defaultVendor,
    });

    return this.instance;
  }

  /**
   * Get the API key repository (shared singleton).
   * Can be used directly for API key management.
   */
  static getApiKeyRepository(): IApiKeyRepository {
    if (!this.apiKeyRepository) {
      const serviceName = app?.getName?.() || 'AgentBase';
      this.apiKeyRepository = new KeychainApiKeyRepository(serviceName);
    }
    return this.apiKeyRepository;
  }

  /**
   * Get the tool registry (shared singleton).
   * Use this to register tools before making chat requests.
   */
  static getToolRegistry(): IToolRegistry {
    if (!this.toolRegistry) {
      this.toolRegistry = new ToolRegistry();
    }
    return this.toolRegistry;
  }

  /**
   * Check if the factory has been configured.
   */
  static isConfigured(): boolean {
    return this.config !== null;
  }

  /**
   * Dispose the service and release resources.
   */
  static async dispose(): Promise<void> {
    if (this.instance) {
      await this.instance.dispose();
      this.instance = null;
    }
    this.toolRegistry?.clear();
  }

  /**
   * Reset the factory to initial state.
   * Disposes the service and clears configuration.
   */
  static async reset(): Promise<void> {
    await this.dispose();
    this.config = null;
    this.apiKeyRepository = null;
    this.toolRegistry = null;
  }
}
