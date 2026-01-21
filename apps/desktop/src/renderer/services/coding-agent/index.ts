/**
 * Coding Agent Module
 *
 * Consolidated module for coding agent functionality in the renderer.
 * Provides adapters, status management, and event handling for AI coding agents.
 *
 * @example
 * ```typescript
 * import {
 *   createCodingAgentAdapter,
 *   sharedEventDispatcher,
 *   ok, err, agentError,
 *   type ICodingAgentAdapter,
 *   type GenerateRequest,
 * } from './services/coding-agent';
 *
 * const adapter = createCodingAgentAdapter('claude_code');
 * await adapter.initialize();
 * ```
 */

// ============================================
// Result Types and Helpers
// ============================================

export {
  type AgentError,
  AgentErrorCode,
  agentError,
  err,
  ok,
  type Result,
} from './result';

// ============================================
// Event Types
// ============================================

export type {
  AgentAdapterEvent,
  AgentAdapterEventType,
  AgentEventHandler,
  PermissionRequestPayload,
  PermissionResponsePayload,
  SessionPayload,
  StatusPayload,
} from './events';

// ============================================
// Request/Response and Session Types
// ============================================

export type {
  CodingAgentMessage,
  CodingAgentSessionContent,
  ContinueOptions,
  ForkOptions,
  GenerateRequest,
  GenerateResponse,
  MessageFilterOptions,
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

// ============================================
// Interface
// ============================================

export type { ICodingAgentAdapter } from './ICodingAgentAdapter';

// ============================================
// Adapters
// ============================================

export {
  AdapterFactoryError,
  ClaudeCodeAdapter,
  createCodingAgentAdapter,
  getSupportedAdapterTypes,
  isAdapterSupported,
} from './adapters';

// ============================================
// Status Management
// ============================================

export { CodingAgentStatusManager } from './status';

// ============================================
// Event Dispatcher
// ============================================

export { sharedEventDispatcher } from './events/SharedEventDispatcher';
