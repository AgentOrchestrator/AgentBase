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
