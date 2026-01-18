/**
 * Coding Agent Adapter Factory
 *
 * Factory function for creating stateless coding agent adapters.
 * Currently only supports Claude Code, but designed for extensibility.
 */

import type { AgentType } from '../../../../types/coding-agent-status';
import type { ICodingAgentAdapter } from '../../context/node-services/coding-agent-adapter';
import { ClaudeCodeAdapter } from './ClaudeCodeAdapter';

/**
 * Error thrown when adapter creation fails
 */
export class AdapterFactoryError extends Error {
  constructor(
    message: string,
    public readonly agentType: AgentType,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'AdapterFactoryError';
  }
}

/**
 * Check if window.codingAgentAPI is available
 */
function isCodingAgentAPIAvailable(): boolean {
  return typeof window !== 'undefined' && window.codingAgentAPI !== undefined;
}

/**
 * Create a stateless coding agent adapter for the specified agent type.
 *
 * @param agentType - The type of coding agent to create an adapter for
 * @returns An adapter instance implementing ICodingAgentAdapter
 * @throws AdapterFactoryError if the agent type is not supported or API is unavailable
 *
 * @example
 * ```typescript
 * const adapter = createCodingAgentAdapter('claude_code');
 *
 * await adapter.initialize();
 * const result = await adapter.generate({
 *   prompt: 'Hello',
 *   workingDirectory: '/path/to/project',
 *   sessionId: 'session-123',
 *   agentId: 'agent-123'
 * });
 * ```
 */
export function createCodingAgentAdapter(agentType: AgentType): ICodingAgentAdapter {
  // Guard: Check API availability
  if (!isCodingAgentAPIAvailable()) {
    throw new AdapterFactoryError(
      'window.codingAgentAPI is not available. Adapters can only be created in the Electron renderer process.',
      agentType
    );
  }

  // Factory logic for different agent types
  switch (agentType) {
    case 'claude_code':
      return new ClaudeCodeAdapter();

    default:
      throw new AdapterFactoryError(
        `Unsupported agent type: "${agentType}". Currently only "claude_code" is supported.`,
        agentType
      );
  }
}

/**
 * Check if an adapter can be created for the given agent type.
 * This is a synchronous check that doesn't require async initialization.
 *
 * @param agentType - The type of coding agent to check
 * @returns true if an adapter can be created for this type
 */
export function isAdapterSupported(agentType: AgentType): boolean {
  return agentType === 'claude_code';
}

/**
 * Get list of supported agent types for adapter creation.
 *
 * @returns Array of supported agent types
 */
export function getSupportedAdapterTypes(): AgentType[] {
  return ['claude_code'];
}
