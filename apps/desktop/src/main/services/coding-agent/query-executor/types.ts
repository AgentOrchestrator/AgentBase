/**
 * QueryExecutor Types
 *
 * Defines our own types for query execution, independent of the SDK.
 * This abstraction layer enables:
 * - Testing without SDK dependency
 * - Isolation of SDK changes from our code
 * - Clear contract for what query execution provides
 */

import type { StreamingChunk } from '@agent-orchestrator/shared';
import type { GenerateResponse } from '../types';

/**
 * Query message types we care about (normalized from SDK)
 */
export type QueryMessageType = 'result' | 'assistant' | 'stream_event';

/**
 * Normalized query message from the executor.
 * This is our internal representation, mapped from SDK messages.
 */
export interface QueryMessage {
  /** Message type identifier */
  type: QueryMessageType;

  /** Raw data payload (varies by type) */
  data: unknown;
}

/**
 * Result message from a completed query
 */
export interface QueryResultMessage extends QueryMessage {
  type: 'result';
  data: {
    /** Whether the query resulted in an error */
    isError: boolean;
    /** Result subtype (success, error, etc.) */
    subtype: string;
    /** Result content (if success) */
    content?: string;
    /** Session ID from the query */
    sessionId?: string;
    /** Message UUID */
    uuid?: string;
    /** Token usage */
    usage?: {
      inputTokens?: number;
      outputTokens?: number;
    };
    /** Error messages (if error) */
    errors?: string[];
  };
}

/**
 * Assistant message with content
 */
export interface QueryAssistantMessage extends QueryMessage {
  type: 'assistant';
  data: {
    /** Text content from the assistant */
    content: string;
  };
}

/**
 * Streaming event for partial messages
 */
export interface QueryStreamEvent extends QueryMessage {
  type: 'stream_event';
  data: {
    /** Plain text chunk (if text delta) */
    textChunk?: string;
    /** Structured streaming chunk (content blocks) */
    structuredChunk?: StreamingChunk;
  };
}

/**
 * Union of all query message types
 */
export type QueryMessageUnion = QueryResultMessage | QueryAssistantMessage | QueryStreamEvent;

/**
 * Options for executing a query
 *
 * This is our internal representation, not SDK options.
 */
export interface QueryOptions {
  /** Working directory for the query */
  cwd?: string;

  /** Controller for aborting the query */
  abortController?: AbortController;

  /** Session ID to resume */
  resume?: string;

  /** Continue from latest session (no specific ID) */
  continue?: boolean;

  /** Fork the session instead of continuing */
  forkSession?: boolean;

  /** Extra arguments passed to the SDK */
  extraArgs?: Record<string, string>;

  /** Whether to include partial messages for streaming */
  includePartialMessages?: boolean;

  /** System prompt configuration */
  systemPrompt?: string;

  /** Context for hook events */
  context?: {
    agentId?: string;
    sessionId?: string;
    workspacePath?: string;
  };
}

/**
 * Result of a query execution
 */
export interface QueryExecutionResult {
  /** All messages received during the query */
  messages: QueryMessageUnion[];

  /** The final result message (if present) */
  resultMessage?: QueryResultMessage;

  /** Mapped generate response */
  response: GenerateResponse;
}

/**
 * QueryExecutor interface - our abstraction over the SDK query function.
 *
 * This interface defines what we need from query execution,
 * allowing us to swap implementations for testing.
 */
export interface QueryExecutor {
  /**
   * Execute a query and yield messages as they arrive.
   *
   * @param prompt - The prompt to send
   * @param options - Query execution options
   * @yields QueryMessageUnion - Messages as they arrive
   */
  execute(prompt: string, options: QueryOptions): AsyncIterable<QueryMessageUnion>;
}
