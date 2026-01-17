/**
 * Result type for explicit error handling
 * Avoids throwing exceptions, making error paths explicit in the type system
 */
export type Result<T, E = LLMError> = { success: true; data: T } | { success: false; error: E };

/**
 * Structured error for LLM operations
 */
export interface LLMError {
  code: LLMErrorCode;
  message: string;
  details?: Record<string, unknown>;
  cause?: Error;
}

/**
 * Enumerated error codes for programmatic error handling
 */
export enum LLMErrorCode {
  // Configuration errors
  API_KEY_NOT_FOUND = 'API_KEY_NOT_FOUND',
  API_KEY_INVALID = 'API_KEY_INVALID',
  KEYCHAIN_ACCESS_DENIED = 'KEYCHAIN_ACCESS_DENIED',
  KEYCHAIN_ERROR = 'KEYCHAIN_ERROR',

  // Provider errors
  PROVIDER_NOT_SUPPORTED = 'PROVIDER_NOT_SUPPORTED',
  MODEL_NOT_AVAILABLE = 'MODEL_NOT_AVAILABLE',

  // Request errors
  RATE_LIMITED = 'RATE_LIMITED',
  CONTEXT_LENGTH_EXCEEDED = 'CONTEXT_LENGTH_EXCEEDED',
  INVALID_REQUEST = 'INVALID_REQUEST',

  // Tool errors
  TOOL_NOT_FOUND = 'TOOL_NOT_FOUND',
  TOOL_ALREADY_REGISTERED = 'TOOL_ALREADY_REGISTERED',
  TOOL_EXECUTION_FAILED = 'TOOL_EXECUTION_FAILED',

  // Network/Runtime errors
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',

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
export function err<E = LLMError>(error: E): Result<never, E> {
  return { success: false, error };
}

/**
 * Helper to create an LLMError
 */
export function llmError(
  code: LLMErrorCode,
  message: string,
  details?: Record<string, unknown>,
  cause?: Error
): LLMError {
  return { code, message, details, cause };
}
