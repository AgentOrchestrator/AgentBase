/**
 * Result Type and Error Handling
 *
 * Provides explicit error handling via Result types instead of exceptions.
 * Mirrors main-side contract for consistent error handling across IPC boundary.
 */

// ============================================
// Result Type
// ============================================

/**
 * Result type for explicit error handling.
 * Discriminated union that forces consumers to handle both success and error cases.
 */
export type Result<T, E> = { success: true; data: T } | { success: false; error: E };

/**
 * Helper to create success result
 */
export function ok<T>(data: T): Result<T, never> {
  return { success: true, data };
}

/**
 * Helper to create error result
 */
export function err<E>(error: E): Result<never, E> {
  return { success: false, error };
}

// ============================================
// Agent Error Types
// ============================================

/**
 * Error codes for agent operations
 */
export enum AgentErrorCode {
  AGENT_NOT_INITIALIZED = 'AGENT_NOT_INITIALIZED',
  AGENT_NOT_AVAILABLE = 'AGENT_NOT_AVAILABLE',
  SESSION_NOT_FOUND = 'SESSION_NOT_FOUND',
  SESSION_INVALID = 'SESSION_INVALID',
  GENERATION_FAILED = 'GENERATION_FAILED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  CAPABILITY_NOT_SUPPORTED = 'CAPABILITY_NOT_SUPPORTED',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * Agent error type with structured error information
 */
export interface AgentError {
  code: AgentErrorCode;
  message: string;
  cause?: unknown;
}

/**
 * Helper to create agent error with consistent structure
 */
export function agentError(code: AgentErrorCode, message: string, cause?: unknown): AgentError {
  return { code, message, cause };
}
