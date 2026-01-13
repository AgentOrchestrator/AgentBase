/**
 * Result type for explicit error handling in representation operations
 */
export type RepresentationResult<T, E = RepresentationError> =
  | { success: true; data: T }
  | { success: false; error: E };

/**
 * Structured error for representation operations
 */
export interface RepresentationError {
  code: RepresentationErrorCode;
  message: string;
  details?: Record<string, unknown>;
  cause?: Error;
}

/**
 * Enumerated error codes for representation operations
 */
export enum RepresentationErrorCode {
  // Provider errors
  PROVIDER_NOT_FOUND = 'PROVIDER_NOT_FOUND',
  PROVIDER_NOT_AVAILABLE = 'PROVIDER_NOT_AVAILABLE',
  PROVIDER_ALREADY_REGISTERED = 'PROVIDER_ALREADY_REGISTERED',

  // Transformation errors
  TRANSFORMATION_FAILED = 'TRANSFORMATION_FAILED',
  TRANSFORMATION_TIMEOUT = 'TRANSFORMATION_TIMEOUT',
  INVALID_INPUT = 'INVALID_INPUT',
  UNSUPPORTED_FORMAT = 'UNSUPPORTED_FORMAT',

  // Capability errors
  CAPABILITY_NOT_SUPPORTED = 'CAPABILITY_NOT_SUPPORTED',

  // Service errors
  SERVICE_NOT_INITIALIZED = 'SERVICE_NOT_INITIALIZED',

  // General
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * Helper to create a success result
 */
export function ok<T>(data: T): RepresentationResult<T, never> {
  return { success: true, data };
}

/**
 * Helper to create an error result
 */
export function err<E = RepresentationError>(error: E): RepresentationResult<never, E> {
  return { success: false, error };
}

/**
 * Helper to create a RepresentationError
 */
export function representationError(
  code: RepresentationErrorCode,
  message: string,
  details?: Record<string, unknown>,
  cause?: Error
): RepresentationError {
  return { code, message, details, cause };
}
