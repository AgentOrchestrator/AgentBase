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
// Concrete implementations - exported for advanced use cases
// Prefer using CodingAgentFactory.getAgent() instead of direct instantiation
export { ClaudeCodeAgent } from './implementations';
// Interfaces - for type annotations
export type {
  ICodingAgentProvider,
  IFullCodingAgent,
  IMinimalCodingAgent,
  IProcessLifecycle,
  ISessionForkable,
  ISessionManager,
  ISessionResumable,
  ISessionValidator,
} from './interfaces';
// Types - for working with requests/responses
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
  SessionContent, // Backward compatibility alias
  SessionFilter,
  SessionFilterOptions,
  SessionIdentifier,
  SessionInfo,
  SessionSummary,
  StreamCallback,
  StreamingBlockType,
  // Streaming types
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
// Capability checking utilities
export {
  getMissingCapabilities,
  hasSessionManager,
  isChatHistoryProvider,
  isSessionForkable,
  isSessionResumable,
  isSessionValidator,
  supportsStreaming,
} from './utils/capability-checker';
