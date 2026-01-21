/**
 * Coding Agent Service
 *
 * A unified service for interacting with CLI coding agents.
 *
 * Usage:
 * ```typescript
 * import { createCodingAgent, sessionById } from './services/coding-agent';
 *
 * // Create an agent
 * const result = await createCodingAgent('claude_code');
 * if (!result.success) {
 *   console.error(result.error);
 *   return;
 * }
 *
 * const agent = result.data;
 *
 * // Generate a response
 * const response = await agent.generate({ prompt: 'Hello, world!' });
 *
 * // Continue a session
 * await agent.continueSession(sessionById('abc123'), 'Follow up prompt');
 *
 * // Clean up
 * await agent.dispose();
 * ```
 */

// ============================================
// Main API (Preferred)
// ============================================

// Implementation (for advanced use cases)
export { ClaudeCodeAgent, type ClaudeCodeAgentConfig } from './ClaudeCodeAgent';
// Unified interface and factory
export type { CodingAgent, CreateCodingAgentOptions } from './CodingAgent';
export {
  createCodingAgent,
  disposeAllCodingAgents,
  disposeCodingAgent,
  resetCodingAgentFactory,
} from './CodingAgent';

// Types
export type {
  AgentCapabilities,
  AgentConfig,
  AgentError,
  CodingAgentAPI,
  CodingAgentMessage,
  CodingAgentSessionContent,
  CodingAgentType,
  ContinueOptions,
  ForkOptions,
  GenerateRequest,
  GenerateResponse,
  MessageFilterOptions,
  Result,
  SessionContent,
  SessionFilter,
  SessionFilterOptions,
  SessionIdentifier,
  SessionInfo,
  SessionSummary,
  StreamCallback,
  StreamingBlockType,
  StreamingChunk,
  StreamingContentBlock,
  StructuredStreamCallback,
} from './types';

// Error codes and helpers
export {
  AgentErrorCode,
  agentError,
  DEFAULT_AGENT_CONFIG,
  err,
  latestSession,
  ok,
  sessionById,
  sessionByName,
} from './types';

// ============================================
// Backward Compatibility (Deprecated)
// ============================================

// Re-export CodingAgent as deprecated interface names
import type { CodingAgent } from './CodingAgent';
import { createCodingAgent } from './CodingAgent';
import type { AgentConfig, AgentError, CodingAgentType, Result } from './types';

/**
 * @deprecated Use CodingAgent instead
 */
export type ICodingAgentProvider = CodingAgent;

/**
 * @deprecated Use CodingAgent instead
 */
export type IFullCodingAgent = CodingAgent;

/**
 * @deprecated Use CodingAgent instead
 */
export type IMinimalCodingAgent = CodingAgent;

/**
 * @deprecated Use CodingAgent instead
 */
export type IProcessLifecycle = Pick<
  CodingAgent,
  'initialize' | 'isAvailable' | 'cancelAll' | 'dispose'
>;

/**
 * @deprecated Use CodingAgent instead
 */
export type ISessionForkable = Pick<CodingAgent, 'forkSession'>;

/**
 * @deprecated Use CodingAgent instead - all agents support session management
 */
export type ISessionManager = CodingAgent;

/**
 * @deprecated Use CodingAgent instead
 */
export type ISessionResumable = Pick<CodingAgent, 'continueSession' | 'continueSessionStreaming'>;

/**
 * @deprecated Use CodingAgent instead
 */
export type ISessionValidator = Pick<CodingAgent, 'checkSessionActive'>;

/**
 * @deprecated Use createCodingAgent instead
 *
 * Legacy factory class for backward compatibility.
 * Wraps the new createCodingAgent function.
 */
export class CodingAgentFactory {
  private static instances = new Map<CodingAgentType, CodingAgent>();

  /**
   * @deprecated Use createCodingAgent instead
   */
  static async getAgent(
    type: CodingAgentType,
    options?:
      | { config?: Partial<Omit<AgentConfig, 'type'>>; skipCliVerification?: boolean }
      | Partial<Omit<AgentConfig, 'type'>>
  ): Promise<Result<CodingAgent, AgentError>> {
    // Normalize options
    const normalizedOptions =
      options && 'skipCliVerification' in options
        ? options
        : { config: options as Partial<Omit<AgentConfig, 'type'>> | undefined };

    const result = await createCodingAgent(type, normalizedOptions);

    // Cache for backward compatibility
    if (result.success && !normalizedOptions.skipCliVerification) {
      CodingAgentFactory.instances.set(type, result.data);
    }

    return result;
  }

  /**
   * @deprecated
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
   * @deprecated
   */
  static async isAgentAvailable(type: CodingAgentType): Promise<boolean> {
    const result = await CodingAgentFactory.getAgent(type);
    return result.success;
  }

  /**
   * @deprecated
   */
  static async disposeAgent(type: CodingAgentType): Promise<void> {
    const agent = CodingAgentFactory.instances.get(type);
    if (agent) {
      await agent.dispose();
      CodingAgentFactory.instances.delete(type);
    }
  }

  /**
   * @deprecated
   */
  static async disposeAll(): Promise<void> {
    const disposePromises = Array.from(CodingAgentFactory.instances.values()).map((agent) =>
      agent.dispose()
    );
    await Promise.all(disposePromises);
    CodingAgentFactory.instances.clear();
  }

  /**
   * @deprecated
   */
  static async reset(): Promise<void> {
    await CodingAgentFactory.disposeAll();
  }
}

/**
 * @deprecated No longer needed - all CodingAgent instances support session resumption
 * @returns Always true for CodingAgent instances
 */
export function isSessionResumable(_agent: unknown): _agent is CodingAgent {
  return true;
}

/**
 * @deprecated No longer needed - all CodingAgent instances support session forking
 * @returns Always true for CodingAgent instances
 */
export function isSessionForkable(_agent: unknown): _agent is CodingAgent {
  return true;
}

/**
 * @deprecated No longer needed - all CodingAgent instances support chat history
 * @returns Always true for CodingAgent instances
 */
export function isChatHistoryProvider(_agent: unknown): _agent is CodingAgent {
  return true;
}

/**
 * @deprecated No longer needed - all CodingAgent instances support session validation
 * @returns Always true for CodingAgent instances
 */
export function isSessionValidator(_agent: unknown): _agent is CodingAgent {
  return true;
}

/**
 * @deprecated No longer needed - use agent.getCapabilities().canListSessions
 * @returns Always false (SDK-based agents don't support session management)
 */
export function hasSessionManager(_agent: unknown): boolean {
  return false;
}

/**
 * @deprecated No longer needed - use agent.getCapabilities().supportsStreaming
 * @returns Always true for CodingAgent instances
 */
export function supportsStreaming(_agent: unknown): boolean {
  return true;
}

/**
 * @deprecated Use agent.getCapabilities() instead
 */
export function getMissingCapabilities(_agent: unknown, _required: string[]): string[] {
  return []; // All capabilities are present in unified interface
}
