/**
 * SDK Error Mapper
 *
 * Maps errors from @anthropic-ai/claude-agent-sdk to internal AgentError type
 */

import type { SDKResultMessage } from '@anthropic-ai/claude-agent-sdk';
import { AbortError } from '@anthropic-ai/claude-agent-sdk';
import type { QueryResultMessage } from '../query-executor';
import type { AgentError } from '../types';
import { AgentErrorCode, agentError } from '../types';

/**
 * Map any SDK error to AgentError
 */
export function mapSdkError(error: unknown): AgentError {
  // Handle AbortError (cancellation)
  if (error instanceof AbortError) {
    return agentError(
      AgentErrorCode.PROCESS_KILLED,
      'Operation was cancelled',
      undefined,
      error instanceof Error ? error : undefined
    );
  }

  // Handle standard Error instances
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Map common error patterns to appropriate codes
    if (message.includes('timeout')) {
      return agentError(AgentErrorCode.PROCESS_TIMEOUT, error.message, undefined, error);
    }

    if (message.includes('not found') || message.includes('not available')) {
      return agentError(AgentErrorCode.AGENT_NOT_AVAILABLE, error.message, undefined, error);
    }

    if (message.includes('session')) {
      return agentError(AgentErrorCode.SESSION_NOT_FOUND, error.message, undefined, error);
    }

    if (message.includes('invalid')) {
      return agentError(AgentErrorCode.SESSION_INVALID, error.message, undefined, error);
    }

    if (message.includes('busy') || message.includes('concurrent')) {
      return agentError(AgentErrorCode.AGENT_BUSY, error.message, undefined, error);
    }

    // Default to unknown error
    return agentError(AgentErrorCode.UNKNOWN_ERROR, error.message, undefined, error);
  }

  // Handle non-Error values
  return agentError(AgentErrorCode.UNKNOWN_ERROR, String(error));
}

/**
 * Map SDK result message error subtypes to AgentError
 *
 * Called when SDKResultMessage.is_error is true or subtype !== 'success'
 */
export function mapSdkResultError(result: SDKResultMessage): AgentError {
  // Type assertion for error result properties
  const errorResult = result as {
    subtype: string;
    errors?: string[];
    uuid: string;
    session_id: string;
  };

  const errorMessages = errorResult.errors?.join(', ') ?? 'Unknown error';
  const details = {
    subtype: errorResult.subtype,
    errors: errorResult.errors,
    sessionId: errorResult.session_id,
    uuid: errorResult.uuid,
  };

  switch (errorResult.subtype) {
    case 'error_max_turns':
      return agentError(
        AgentErrorCode.PROCESS_TIMEOUT,
        `Maximum conversation turns exceeded: ${errorMessages}`,
        details
      );

    case 'error_max_budget_usd':
      return agentError(
        AgentErrorCode.PROCESS_TIMEOUT,
        `Budget limit exceeded: ${errorMessages}`,
        details
      );

    case 'error_during_execution':
      return agentError(
        AgentErrorCode.PROCESS_SPAWN_FAILED,
        `Execution error: ${errorMessages}`,
        details
      );

    case 'error_max_structured_output_retries':
      return agentError(
        AgentErrorCode.PROCESS_OUTPUT_PARSE_ERROR,
        `Structured output failed: ${errorMessages}`,
        details
      );

    default:
      return agentError(AgentErrorCode.UNKNOWN_ERROR, errorMessages, details);
  }
}

/**
 * Map normalized QueryResultMessage error to AgentError
 *
 * Called when QueryResultMessage.data.isError is true
 */
export function mapQueryResultError(result: QueryResultMessage): AgentError {
  const { subtype, errors, sessionId, uuid } = result.data;

  const errorMessages = errors?.join(', ') ?? 'Unknown error';
  const details = {
    subtype,
    errors,
    sessionId,
    uuid,
  };

  switch (subtype) {
    case 'error_max_turns':
      return agentError(
        AgentErrorCode.PROCESS_TIMEOUT,
        `Maximum conversation turns exceeded: ${errorMessages}`,
        details
      );

    case 'error_max_budget_usd':
      return agentError(
        AgentErrorCode.PROCESS_TIMEOUT,
        `Budget limit exceeded: ${errorMessages}`,
        details
      );

    case 'error_during_execution':
      return agentError(
        AgentErrorCode.PROCESS_SPAWN_FAILED,
        `Execution error: ${errorMessages}`,
        details
      );

    case 'error_max_structured_output_retries':
      return agentError(
        AgentErrorCode.PROCESS_OUTPUT_PARSE_ERROR,
        `Structured output failed: ${errorMessages}`,
        details
      );

    default:
      return agentError(AgentErrorCode.UNKNOWN_ERROR, errorMessages, details);
  }
}

/**
 * Create an error for when no result message is received
 */
export function noResultError(): AgentError {
  return agentError(AgentErrorCode.UNKNOWN_ERROR, 'No result message received from SDK query');
}

/**
 * Create an error for initialization failure
 */
export function initializationError(cause?: Error): AgentError {
  return agentError(
    AgentErrorCode.AGENT_NOT_AVAILABLE,
    'Claude Code SDK not available or not configured',
    undefined,
    cause
  );
}
