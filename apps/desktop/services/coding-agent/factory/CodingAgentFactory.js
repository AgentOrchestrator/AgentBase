"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CodingAgentFactory = void 0;
const types_1 = require("../types");
const implementations_1 = require("../implementations");
/**
 * Factory for creating coding agent instances
 *
 * Follows the DatabaseFactory pattern:
 * - Singleton per agent type
 * - Lazy initialization
 * - Automatic resource cleanup
 *
 * Usage:
 * ```typescript
 * const result = await CodingAgentFactory.getAgent('claude_code');
 * if (result.success) {
 *   const agent = result.data;
 *   const response = await agent.generate({ prompt: 'Hello' });
 * }
 * ```
 */
class CodingAgentFactory {
    /**
     * Get or create a coding agent instance
     *
     * Returns a cached instance if available, otherwise creates and initializes a new one.
     *
     * @param type - The type of agent to create
     * @param config - Optional configuration overrides
     */
    static async getAgent(type, config) {
        // Return cached instance if available
        const existing = this.instances.get(type);
        if (existing) {
            return (0, types_1.ok)(existing);
        }
        // Create new instance
        const fullConfig = {
            type,
            ...config,
        };
        let agent;
        switch (type) {
            case 'claude_code':
                agent = new implementations_1.ClaudeCodeAgent(fullConfig);
                break;
            // Future agents would be added here:
            // case 'cursor':
            //   agent = new CursorCliAgent(fullConfig);
            //   break;
            // case 'codex':
            //   agent = new CodexCliAgent(fullConfig);
            //   break;
            default:
                return (0, types_1.err)((0, types_1.agentError)(types_1.AgentErrorCode.AGENT_NOT_AVAILABLE, `Unsupported agent type: ${type}`));
        }
        // Initialize the agent
        const initResult = await agent.initialize();
        if (initResult.success === false) {
            return { success: false, error: initResult.error };
        }
        // Cache and return
        this.instances.set(type, agent);
        return (0, types_1.ok)(agent);
    }
    /**
     * Get a list of available agent types
     *
     * Checks which agents have their CLI installed and accessible.
     */
    static async getAvailableAgents() {
        const potentialAgents = ['claude_code', 'cursor', 'codex'];
        const available = [];
        for (const type of potentialAgents) {
            const result = await this.getAgent(type);
            if (result.success) {
                available.push(type);
            }
        }
        return available;
    }
    /**
     * Check if a specific agent type is available
     */
    static async isAgentAvailable(type) {
        const result = await this.getAgent(type);
        return result.success;
    }
    /**
     * Dispose a specific agent
     */
    static async disposeAgent(type) {
        const agent = this.instances.get(type);
        if (agent) {
            await agent.dispose();
            this.instances.delete(type);
        }
    }
    /**
     * Dispose all cached agents
     */
    static async disposeAll() {
        const disposePromises = Array.from(this.instances.values()).map((agent) => agent.dispose());
        await Promise.all(disposePromises);
        this.instances.clear();
    }
    /**
     * Reset the factory (for testing)
     */
    static async reset() {
        await this.disposeAll();
    }
}
exports.CodingAgentFactory = CodingAgentFactory;
CodingAgentFactory.instances = new Map();
