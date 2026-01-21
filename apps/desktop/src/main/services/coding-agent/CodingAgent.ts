/**
 * CodingAgent - Unified Interface for Coding Agents
 *
 * This module provides:
 * 1. A single `CodingAgent` interface combining all capabilities
 * 2. A `createCodingAgent` factory function for creating agents
 *
 * The interface consolidates 7 previous interfaces:
 * - ICodingAgentProvider (generation)
 * - IProcessLifecycle (lifecycle management)
 * - ISessionResumable (session continuation)
 * - ISessionForkable (session forking)
 * - IChatHistoryProvider (history retrieval)
 * - ISessionValidator (session existence checking)
 * - EventEmitter (event handling)
 *
 * @example
 * ```typescript
 * const result = await createCodingAgent('claude_code');
 * if (result.success) {
 *   const agent = result.data;
 *   await agent.initialize();
 *
 *   // Generate a response
 *   const response = await agent.generate({ prompt: 'Hello!' });
 *
 *   // Continue a session
 *   await agent.continueSession({ type: 'id', value: 'abc123' }, 'Follow up');
 *
 *   await agent.dispose();
 * }
 * ```
 */

import type { EventEmitter } from 'node:events';
import type { EventRegistry } from '@agent-orchestrator/shared';

// Re-export types that are part of the public API
export type {
  AgentCapabilities,
  AgentConfig,
  CodingAgentMessage,
  CodingAgentSessionContent,
  CodingAgentType,
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
  StructuredStreamCallback,
} from './types';

export {
  type AgentError,
  AgentErrorCode,
  agentError,
  err,
  ok,
  type Result,
} from './types';

// Import for internal use
import type {
  AgentCapabilities,
  AgentConfig,
  AgentError,
  CodingAgentSessionContent,
  CodingAgentType,
  ContinueOptions,
  ForkOptions,
  GenerateRequest,
  GenerateResponse,
  MessageFilterOptions,
  Result,
  SessionFilterOptions,
  SessionIdentifier,
  SessionInfo,
  SessionSummary,
  StreamCallback,
  StructuredStreamCallback,
} from './types';
import { AgentErrorCode, agentError, err, ok } from './types';

/**
 * Unified interface for coding agents.
 *
 * All agents implement this interface, providing a consistent API
 * regardless of the underlying implementation (Claude Code, Cursor, etc.)
 *
 * Extends EventEmitter for compatibility with event-based code.
 */
export interface CodingAgent extends EventEmitter {
  /**
   * The type of coding agent (e.g., 'claude_code', 'cursor')
   */
  readonly agentType: CodingAgentType;

  /**
   * Get the agent's capabilities.
   * Use this to check what features the agent supports at runtime.
   */
  getCapabilities(): AgentCapabilities;

  // ============================================
  // Lifecycle Management
  // ============================================

  /**
   * Initialize the agent.
   * Must be called before using generation methods.
   */
  initialize(): Promise<Result<void, AgentError>>;

  /**
   * Check if the agent is available and ready.
   */
  isAvailable(): Promise<boolean>;

  /**
   * Cancel all running operations.
   * The agent can still be used after this.
   */
  cancelAll(): Promise<void>;

  /**
   * Dispose of all resources.
   * The agent should not be used after this.
   */
  dispose(): Promise<void>;

  // ============================================
  // Generation
  // ============================================

  /**
   * Generate a one-off response for a prompt.
   */
  generate(request: GenerateRequest): Promise<Result<GenerateResponse, AgentError>>;

  /**
   * Generate a response with streaming output (plain text chunks).
   */
  generateStreaming(
    request: GenerateRequest,
    onChunk: StreamCallback
  ): Promise<Result<GenerateResponse, AgentError>>;

  /**
   * Generate a response with structured streaming (content blocks).
   */
  generateStreamingStructured(
    request: GenerateRequest,
    onChunk: StructuredStreamCallback
  ): Promise<Result<GenerateResponse, AgentError>>;

  // ============================================
  // Session Continuation
  // ============================================

  /**
   * Continue a previous session with a new prompt.
   */
  continueSession(
    identifier: SessionIdentifier,
    prompt: string,
    options?: ContinueOptions
  ): Promise<Result<GenerateResponse, AgentError>>;

  /**
   * Continue a session with streaming output.
   */
  continueSessionStreaming(
    identifier: SessionIdentifier,
    prompt: string,
    onChunk: StreamCallback,
    options?: ContinueOptions
  ): Promise<Result<GenerateResponse, AgentError>>;

  // ============================================
  // Session Forking
  // ============================================

  /**
   * Fork an existing session to create a branch.
   */
  forkSession(options: ForkOptions): Promise<Result<SessionInfo, AgentError>>;

  // ============================================
  // Chat History
  // ============================================

  /**
   * List sessions with summaries (without full messages).
   * Efficient for listing views.
   */
  listSessionSummaries(
    filter?: SessionFilterOptions
  ): Promise<Result<SessionSummary[], AgentError>>;

  /**
   * Get full session content with optional message filtering.
   */
  getFilteredSession(
    sessionId: string,
    filter?: MessageFilterOptions
  ): Promise<Result<CodingAgentSessionContent | null, AgentError>>;

  /**
   * Get modification times for incremental sync detection.
   */
  getSessionModificationTimes(
    filter?: SessionFilterOptions
  ): Promise<Result<Map<string, number>, AgentError>>;

  /**
   * Get data source paths (for debugging).
   */
  getDataPaths(): string[];

  // ============================================
  // Session Validation
  // ============================================

  /**
   * Check if a session file exists (session is "active").
   */
  checkSessionActive(sessionId: string, workspacePath: string): Promise<boolean>;

  // ============================================
  // Events
  // ============================================

  /**
   * Get the event registry for custom hook handlers.
   */
  getEventRegistry(): EventRegistry;
}

/**
 * Options for creating a coding agent.
 */
export interface CreateCodingAgentOptions {
  /** Configuration overrides */
  config?: Partial<Omit<AgentConfig, 'type'>>;
  /**
   * Skip CLI verification during initialization.
   * Use for read-only operations that don't require the CLI.
   */
  skipCliVerification?: boolean;
}

// Singleton instances cache
const agentInstances = new Map<CodingAgentType, CodingAgent>();

/**
 * Create a coding agent instance.
 *
 * Returns a singleton instance for each agent type (unless skipCliVerification is true).
 * The agent is automatically initialized unless skipCliVerification is set.
 *
 * @param type - The type of agent to create ('claude_code', etc.)
 * @param options - Optional configuration
 * @returns Result with the agent or an error
 *
 * @example
 * ```typescript
 * const result = await createCodingAgent('claude_code');
 * if (result.success) {
 *   const agent = result.data;
 *   // Use agent...
 * }
 * ```
 */
export async function createCodingAgent(
  type: CodingAgentType,
  options?: CreateCodingAgentOptions
): Promise<Result<CodingAgent, AgentError>> {
  const { config, skipCliVerification } = options ?? {};

  // For skipCliVerification, create a fresh uninitialized instance
  if (skipCliVerification) {
    return await createAgentInstance(type, config);
  }

  // Return cached instance if available
  const existing = agentInstances.get(type);
  if (existing) {
    return ok(existing);
  }

  // Create and initialize new instance
  const createResult = await createAgentInstance(type, config);
  if (!createResult.success) {
    return createResult;
  }

  const agent = createResult.data;

  // Initialize the agent
  const initResult = await agent.initialize();
  if (!initResult.success) {
    return { success: false, error: initResult.error };
  }

  // Cache and return
  agentInstances.set(type, agent);
  return ok(agent);
}

/**
 * Create an agent instance without initialization.
 * Uses dynamic import() for ESM compatibility with test runners like Vitest.
 */
async function createAgentInstance(
  type: CodingAgentType,
  config?: Partial<Omit<AgentConfig, 'type'>>
): Promise<Result<CodingAgent, AgentError>> {
  const fullConfig: AgentConfig = {
    type,
    ...config,
  };

  switch (type) {
    case 'claude_code': {
      // Use dynamic import for ESM compatibility (required for Vitest)
      const { ClaudeCodeAgent } = await import('./ClaudeCodeAgent');
      return ok(new ClaudeCodeAgent(fullConfig) as CodingAgent);
    }

    default:
      return err(agentError(AgentErrorCode.AGENT_NOT_AVAILABLE, `Unsupported agent type: ${type}`));
  }
}

/**
 * Dispose a specific agent type and remove from cache.
 */
export async function disposeCodingAgent(type: CodingAgentType): Promise<void> {
  const agent = agentInstances.get(type);
  if (agent) {
    await agent.dispose();
    agentInstances.delete(type);
  }
}

/**
 * Dispose all cached agents.
 */
export async function disposeAllCodingAgents(): Promise<void> {
  const disposePromises = Array.from(agentInstances.values()).map((agent) => agent.dispose());
  await Promise.all(disposePromises);
  agentInstances.clear();
}

/**
 * Reset the factory (for testing).
 */
export async function resetCodingAgentFactory(): Promise<void> {
  await disposeAllCodingAgents();
}
