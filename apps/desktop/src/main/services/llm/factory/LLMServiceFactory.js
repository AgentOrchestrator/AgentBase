"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LLMServiceFactory = void 0;
const electron_1 = require("electron");
const implementations_1 = require("../implementations");
const dependencies_1 = require("../dependencies");
const ToolRegistry_1 = require("../registry/ToolRegistry");
const ConsoleLogger_1 = require("../../../worktree/dependencies/ConsoleLogger");
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
class LLMServiceFactory {
    /**
     * Configure the factory before first use.
     * Must be called before getService().
     */
    static configure(config) {
        if (this.instance) {
            throw new Error('Cannot configure after service has been initialized. Call dispose() first.');
        }
        this.config = config;
    }
    /**
     * Get the singleton LLM service instance.
     * Lazily initializes the service on first call.
     */
    static async getService() {
        if (this.instance) {
            return this.instance;
        }
        if (!this.config) {
            throw new Error('LLMServiceFactory not configured. Call configure() first.');
        }
        // Wire up dependencies
        const logger = new ConsoleLogger_1.ConsoleLogger('[LLMService]');
        const apiKeyRepo = this.getApiKeyRepository();
        const toolRegistry = this.getToolRegistry();
        this.instance = new implementations_1.VercelAILLMService(this.config, apiKeyRepo, toolRegistry, logger);
        logger.info('LLM Service initialized', {
            defaultVendor: this.config.defaultVendor,
        });
        return this.instance;
    }
    /**
     * Get the API key repository (shared singleton).
     * Can be used directly for API key management.
     */
    static getApiKeyRepository() {
        if (!this.apiKeyRepository) {
            const serviceName = electron_1.app?.getName?.() || 'AgentBase';
            this.apiKeyRepository = new dependencies_1.KeychainApiKeyRepository(serviceName);
        }
        return this.apiKeyRepository;
    }
    /**
     * Get the tool registry (shared singleton).
     * Use this to register tools before making chat requests.
     */
    static getToolRegistry() {
        if (!this.toolRegistry) {
            this.toolRegistry = new ToolRegistry_1.ToolRegistry();
        }
        return this.toolRegistry;
    }
    /**
     * Check if the factory has been configured.
     */
    static isConfigured() {
        return this.config !== null;
    }
    /**
     * Dispose the service and release resources.
     */
    static async dispose() {
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
    static async reset() {
        await this.dispose();
        this.config = null;
        this.apiKeyRepository = null;
        this.toolRegistry = null;
    }
}
exports.LLMServiceFactory = LLMServiceFactory;
LLMServiceFactory.instance = null;
LLMServiceFactory.config = null;
LLMServiceFactory.apiKeyRepository = null;
LLMServiceFactory.toolRegistry = null;
