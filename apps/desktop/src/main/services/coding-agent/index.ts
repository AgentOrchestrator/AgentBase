/**
 * Coding Agent Service
 *
 * A protocol-based service for interacting with CLI coding agents.
 * Designed with Interface Segregation to prevent god objects.
 *
 * Usage:
 * ```typescript
 * import {
 *   CodingAgentFactory,
 *   isSessionResumable,
 *   sessionById,
 * } from './services/coding-agent';
 *
 * // Get an agent
 * const result = await CodingAgentFactory.getAgent('claude_code');
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
 * // Resume a session (if supported)
 * if (isSessionResumable(agent)) {
 *   await agent.continueSession(sessionById('abc123'), 'Follow up prompt');
 * }
 * ```
 */

// Factory - main entry point
export { CodingAgentFactory } from './factory/CodingAgentFactory';

// Interfaces - for type annotations
export type {
  ICodingAgentProvider,
  ISessionManager,
  ISessionResumable,
  ISessionForkable,
  IProcessLifecycle,
  IFullCodingAgent,
  IMinimalCodingAgent,
} from './interfaces';

// Types - for working with requests/responses
export type {
  Result,
  AgentError,
  CodingAgentType,
  AgentCapabilities,
  AgentConfig,
  CodingAgentAPI,
  SessionIdentifier,
  SessionInfo,
  SessionContent,
  SessionSummary,
  SessionFilter,
  SessionFilterOptions,
  MessageFilterOptions,
  ContinueOptions,
  ForkOptions,
  ChatMessage,
  GenerateRequest,
  GenerateResponse,
  StreamCallback,
} from './types';

// Error codes and helpers
export {
  AgentErrorCode,
  ok,
  err,
  agentError,
  DEFAULT_AGENT_CONFIG,
  sessionById,
  sessionByName,
  latestSession,
} from './types';

// Capability checking utilities
export {
  isSessionResumable,
  isSessionForkable,
  hasSessionManager,
  supportsStreaming,
  isChatHistoryProvider,
  getMissingCapabilities,
} from './utils/capability-checker';

// Concrete implementations - exported for advanced use cases
// Prefer using CodingAgentFactory.getAgent() instead of direct instantiation
export { ClaudeCodeAgent } from './implementations';
