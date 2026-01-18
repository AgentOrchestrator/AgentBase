/**
 * Result type for explicit error handling
 * Avoids throwing exceptions, making error paths explicit in the type system
 */
export type Result<T, E = AgentError> = { success: true; data: T } | { success: false; error: E };

/**
 * Structured error for coding agent operations
 */
export interface AgentError {
  code: AgentErrorCode;
  message: string;
  details?: Record<string, unknown>;
  cause?: Error;
}

/**
 * Enumerated error codes for programmatic error handling
 */
export enum AgentErrorCode {
  // Process errors
  PROCESS_SPAWN_FAILED = 'PROCESS_SPAWN_FAILED',
  PROCESS_TIMEOUT = 'PROCESS_TIMEOUT',
  PROCESS_KILLED = 'PROCESS_KILLED',
  PROCESS_OUTPUT_PARSE_ERROR = 'PROCESS_OUTPUT_PARSE_ERROR',

  // Session errors
  SESSION_NOT_FOUND = 'SESSION_NOT_FOUND',
  SESSION_INVALID = 'SESSION_INVALID',

  // Capability errors
  CAPABILITY_NOT_SUPPORTED = 'CAPABILITY_NOT_SUPPORTED',

  // Agent errors
  AGENT_NOT_AVAILABLE = 'AGENT_NOT_AVAILABLE',
  AGENT_BUSY = 'AGENT_BUSY',
  AGENT_NOT_INITIALIZED = 'AGENT_NOT_INITIALIZED',

  // General
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * Helper to create a success result
 */
export function ok<T>(data: T): Result<T, never> {
  return { success: true, data };
}

/**
 * Helper to create an error result
 */
export function err<E = AgentError>(error: E): Result<never, E> {
  return { success: false, error };
}

/**
 * Helper to create an AgentError
 */
export function agentError(
  code: AgentErrorCode,
  message: string,
  details?: Record<string, unknown>,
  cause?: Error
): AgentError {
  return { code, message, details, cause };
}
