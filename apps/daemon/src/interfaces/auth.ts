/**
 * Auth abstractions - no database-specific types exposed
 */

// =============================================================================
// Token & Session Types
// =============================================================================

/**
 * Token information for authenticated sessions
 */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix timestamp in milliseconds
}

/**
 * Complete auth session with user identity
 */
export interface AuthSession {
  userId: string;
  tokens: AuthTokens;
}

/**
 * Device auth session from pending auth table
 * Used during device-based OAuth flow
 */
export interface DeviceAuthSession {
  id: string;
  deviceId: string;
  userId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

// =============================================================================
// Provider Info & Capabilities
// =============================================================================

/**
 * Auth provider capabilities - allows runtime feature detection
 */
export interface AuthProviderCapabilities {
  supportsDeviceAuth: boolean;
  supportsTokenRefresh: boolean;
  supportsTokenValidation: boolean;
  supportsSessionIntrospection: boolean;
}

/**
 * Auth provider metadata
 */
export interface AuthProviderInfo {
  name: string; // e.g., 'supabase', 'firebase', 'auth0'
  version: string;
  capabilities: AuthProviderCapabilities;
}

/**
 * Result of token validation
 */
export interface TokenValidationResult {
  valid: boolean;
  userId?: string;
  expiresAt?: number;
  error?: string;
}

// =============================================================================
// Auth Provider Interface
// =============================================================================

/**
 * Auth provider interface - abstracts authentication operations
 * Implementations can use Supabase, Firebase, custom auth, etc.
 */
export interface IAuthProvider {
  /**
   * Get provider information and capabilities
   */
  getProviderInfo(): AuthProviderInfo;

  /**
   * Get the authentication URL for device-based auth
   * Different providers may have different URL schemes
   * @param deviceId The device identifier to include in the URL
   */
  getAuthUrl(deviceId: string): string;

  /**
   * Refresh expired tokens using a refresh token
   * @returns New tokens or null if refresh fails
   */
  refreshTokens(refreshToken: string): Promise<AuthTokens | null>;

  /**
   * Poll for a completed device auth session
   * Used in device-based OAuth flow where user authenticates via browser
   * @param deviceId Unique device identifier
   * @returns Auth session if found and unconsumed, null otherwise
   */
  pollForDeviceAuth(deviceId: string): Promise<DeviceAuthSession | null>;

  /**
   * Mark a device auth session as consumed
   * Prevents replay attacks on the same session
   * @param sessionId The session ID to mark as consumed
   */
  markDeviceAuthConsumed(sessionId: string): Promise<void>;

  /**
   * Validate an access token without making authenticated requests
   * Optional - not all providers support this
   * @returns Validation result with user info if valid
   */
  validateToken?(accessToken: string): Promise<TokenValidationResult>;
}

/**
 * Clean auth context - replaces AuthenticatedContext
 * No database-specific types exposed
 */
export interface AuthContext {
  userId: string;
  accessToken: string;
  refreshToken: string;
}

/**
 * Factory function type for creating auth contexts
 */
export type CreateAuthContext = (
  accessToken: string,
  refreshToken: string
) => Promise<AuthContext>;
