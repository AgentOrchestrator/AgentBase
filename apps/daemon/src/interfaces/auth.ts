/**
 * Auth abstractions - no database-specific types exposed
 */

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

/**
 * Auth provider interface - abstracts authentication operations
 * Implementations can use Supabase, Firebase, custom auth, etc.
 */
export interface IAuthProvider {
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
