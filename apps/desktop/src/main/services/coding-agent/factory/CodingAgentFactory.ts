import { ClaudeCodeAgent } from '../implementations';
import type { IMinimalCodingAgent } from '../interfaces';
import type { AgentConfig, AgentError, CodingAgentType, Result } from '../types';
import { AgentErrorCode, agentError, err, ok } from '../types';

/**
 * Options for getAgent
 */
interface GetAgentOptions {
  /** Configuration overrides */
  config?: Partial<Omit<AgentConfig, 'type'>>;
  /**
   * Skip CLI verification during initialization.
   * Use this for read-only operations (like chat history retrieval)
   * that don't require the CLI to be installed.
   */
  skipCliVerification?: boolean;
}

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
   * @param options - Optional options including config and skipCliVerification
   */
  static async getAgent(
    type: CodingAgentType,
    options?: GetAgentOptions | Partial<Omit<AgentConfig, 'type'>>
  ): Promise<Result<IMinimalCodingAgent, AgentError>> {
    // Normalize options - support both old config-only signature and new options object
    const normalizedOptions: GetAgentOptions =
      options && 'skipCliVerification' in options
        ? (options as GetAgentOptions)
        : { config: options as Partial<Omit<AgentConfig, 'type'>> | undefined };

    const { config, skipCliVerification } = normalizedOptions;

    // For skipCliVerification requests, don't use the cached instance
    // (it might have failed initialization)
    // Instead, create an uninitialized instance
    if (skipCliVerification) {
      const fullConfig: AgentConfig = {
        type,
        ...config,
      };

      switch (type) {
        case 'claude_code':
          return ok(new ClaudeCodeAgent(fullConfig));

        default:
          return err(
            agentError(AgentErrorCode.AGENT_NOT_AVAILABLE, `Unsupported agent type: ${type}`)
          );
      }
    }

    // Return cached instance if available
    const existing = CodingAgentFactory.instances.get(type);
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
          agentError(AgentErrorCode.AGENT_NOT_AVAILABLE, `Unsupported agent type: ${type}`)
        );
    }

    // Initialize the agent
    const initResult = await agent.initialize();
    if (initResult.success === false) {
      return { success: false, error: initResult.error };
    }

    // Cache and return
    CodingAgentFactory.instances.set(type, agent);
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
      const result = await CodingAgentFactory.getAgent(type);
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
    const result = await CodingAgentFactory.getAgent(type);
    return result.success;
  }

  /**
   * Dispose a specific agent
   */
  static async disposeAgent(type: CodingAgentType): Promise<void> {
    const agent = CodingAgentFactory.instances.get(type);
    if (agent) {
      await agent.dispose();
      CodingAgentFactory.instances.delete(type);
    }
  }

  /**
   * Dispose all cached agents
   */
  static async disposeAll(): Promise<void> {
    const disposePromises = Array.from(CodingAgentFactory.instances.values()).map((agent) =>
      agent.dispose()
    );
    await Promise.all(disposePromises);
    CodingAgentFactory.instances.clear();
  }

  /**
   * Reset the factory (for testing)
   */
  static async reset(): Promise<void> {
    await CodingAgentFactory.disposeAll();
  }
}
