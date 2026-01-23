/**
 * Coding Agent Service
 *
 * A unified service for interacting with CLI coding agents.
 *
 * Usage:
 * ```typescript
 * import { getCodingAgent } from './services/coding-agent';
 *
 * // Get an agent (returns cached singleton)
 * const result = await getCodingAgent('claude_code');
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
 * // Continue a session by ID
 * await agent.continueSession({ type: 'id', value: 'abc123' }, 'Follow up prompt');
 *
 * // Clean up
 * await agent.dispose();
 * ```
 */

// Implementation (for advanced use cases)
export { ClaudeCodeAgent, type ClaudeCodeAgentConfig } from './ClaudeCodeAgent';

// Unified interface and factory
export type { CodingAgent, GetCodingAgentOptions } from './CodingAgent';
export {
  disposeAllCodingAgents,
  disposeCodingAgent,
  getCodingAgent,
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
export { AgentErrorCode, agentError, DEFAULT_AGENT_CONFIG, err, ok } from './types';
