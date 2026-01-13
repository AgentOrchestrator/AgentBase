import type { IMinimalCodingAgent } from '../interfaces';
import type { Result, AgentError, CodingAgentType, AgentConfig } from '../types';
import { AgentErrorCode, ok, err, agentError } from '../types';
import { ClaudeCodeAgent } from '../implementations';

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
export class CodingAgentFactory {
  private static instances = new Map<CodingAgentType, IMinimalCodingAgent>();

  /**
   * Get or create a coding agent instance
   *
   * Returns a cached instance if available, otherwise creates and initializes a new one.
   *
   * @param type - The type of agent to create
   * @param config - Optional configuration overrides
   */
  static async getAgent(
    type: CodingAgentType,
    config?: Partial<Omit<AgentConfig, 'type'>>
  ): Promise<Result<IMinimalCodingAgent, AgentError>> {
    // Return cached instance if available
    const existing = this.instances.get(type);
    if (existing) {
      return ok(existing);
    }

    // Create new instance
    const fullConfig: AgentConfig = {
      type,
      ...config,
    };

    let agent: IMinimalCodingAgent;

    switch (type) {
      case 'claude_code':
        agent = new ClaudeCodeAgent(fullConfig);
        break;

      // Future agents would be added here:
      // case 'cursor':
      //   agent = new CursorCliAgent(fullConfig);
      //   break;
      // case 'codex':
      //   agent = new CodexCliAgent(fullConfig);
      //   break;

      default:
        return err(
          agentError(
            AgentErrorCode.AGENT_NOT_AVAILABLE,
            `Unsupported agent type: ${type}`
          )
        );
    }

    // Initialize the agent
    const initResult = await agent.initialize();
    if (initResult.success === false) {
      return { success: false, error: initResult.error };
    }

    // Cache and return
    this.instances.set(type, agent);
    return ok(agent);
  }

  /**
   * Get a list of available agent types
   *
   * Checks which agents have their CLI installed and accessible.
   */
  static async getAvailableAgents(): Promise<CodingAgentType[]> {
    const potentialAgents: CodingAgentType[] = ['claude_code', 'cursor', 'codex'];
    const available: CodingAgentType[] = [];

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
  static async isAgentAvailable(type: CodingAgentType): Promise<boolean> {
    const result = await this.getAgent(type);
    return result.success;
  }

  /**
   * Dispose a specific agent
   */
  static async disposeAgent(type: CodingAgentType): Promise<void> {
    const agent = this.instances.get(type);
    if (agent) {
      await agent.dispose();
      this.instances.delete(type);
    }
  }

  /**
   * Dispose all cached agents
   */
  static async disposeAll(): Promise<void> {
    const disposePromises = Array.from(this.instances.values()).map((agent) =>
      agent.dispose()
    );
    await Promise.all(disposePromises);
    this.instances.clear();
  }

  /**
   * Reset the factory (for testing)
   */
  static async reset(): Promise<void> {
    await this.disposeAll();
  }
}
