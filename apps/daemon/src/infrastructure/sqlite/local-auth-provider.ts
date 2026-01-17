/**
 * Local auth provider for offline/local-only mode
 * Always returns authenticated state using a deterministic local user ID
 */

import type {
  IAuthProvider,
  AuthTokens,
  DeviceAuthSession,
  AuthProviderInfo,
  TokenValidationResult,
} from '../../interfaces/auth.js';
import type { AppDatabase } from '../../database.js';
import { randomUUID } from 'crypto';

export class LocalAuthProvider implements IAuthProvider {
  private db: AppDatabase;
  private localUserId: string | null = null;

  constructor(db: AppDatabase) {
    this.db = db;
  }

  /**
   * Get or create a deterministic local user ID based on device ID
   */
  getLocalUserId(): string {
    if (this.localUserId) {
      return this.localUserId;
    }

    // Try to get existing device ID
    let deviceId = this.db.getDeviceId();

    if (!deviceId) {
      // Generate a new device ID
      deviceId = randomUUID();
      this.db.setDeviceId(deviceId);
    }

    // Use device ID as the local user ID for consistency
    this.localUserId = `local-${deviceId}`;
    return this.localUserId;
  }

  getProviderInfo(): AuthProviderInfo {
    return {
      name: 'local',
      version: '1.0.0',
      capabilities: {
        supportsDeviceAuth: false,
        supportsTokenRefresh: false,
        supportsTokenValidation: true,
        supportsSessionIntrospection: false,
      },
    };
  }

  getAuthUrl(_deviceId: string): string {
    // Not needed for local auth
    return '';
  }

  async refreshTokens(_refreshToken: string): Promise<AuthTokens | null> {
    // Local auth doesn't need token refresh - return current "tokens"
    const userId = this.getLocalUserId();
    return {
      accessToken: `local-access-${userId}`,
      refreshToken: `local-refresh-${userId}`,
      expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000, // 1 year from now
    };
  }

  async pollForDeviceAuth(_deviceId: string): Promise<DeviceAuthSession | null> {
    // Local auth doesn't use device auth flow
    // Return a session immediately
    const userId = this.getLocalUserId();
    return {
      id: `local-session-${userId}`,
      deviceId: this.db.getDeviceId() || '',
      userId,
      accessToken: `local-access-${userId}`,
      refreshToken: `local-refresh-${userId}`,
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    };
  }

  async markDeviceAuthConsumed(_sessionId: string): Promise<void> {
    // No-op for local auth
  }

  async validateToken(_accessToken: string): Promise<TokenValidationResult> {
    // Local tokens are always valid
    const userId = this.getLocalUserId();
    return {
      valid: true,
      userId,
      expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000,
    };
  }
}

/**
 * Factory function to create a LocalAuthProvider
 */
export function createLocalAuthProvider(db: AppDatabase): LocalAuthProvider {
  return new LocalAuthProvider(db);
}
