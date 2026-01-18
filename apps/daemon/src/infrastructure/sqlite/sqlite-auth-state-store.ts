/**
 * SQLite implementation of IAuthStateStore
 *
 * Wraps the existing AppDatabase auth methods to provide
 * a vendor-agnostic interface for local auth state persistence.
 */

import type { AppDatabase } from '../../database.js';
import type {
  DeviceIdentity,
  IAuthStateStore,
  PersistedAuthState,
} from '../../interfaces/auth-state-store.js';

export class SQLiteAuthStateStore implements IAuthStateStore {
  constructor(private db: AppDatabase) {}

  // ===========================================================================
  // Device Identity
  // ===========================================================================

  getDeviceIdentity(): DeviceIdentity | null {
    const deviceId = this.db.getDeviceId();
    if (!deviceId) {
      return null;
    }
    return {
      deviceId,
      // Note: AppDatabase doesn't store createdAt for device, could be added later
    };
  }

  setDeviceIdentity(identity: DeviceIdentity): void {
    this.db.setDeviceId(identity.deviceId);
  }

  // ===========================================================================
  // Auth State CRUD
  // ===========================================================================

  getAuthState(): PersistedAuthState | null {
    const auth = this.db.getAuth();
    if (!auth) {
      return null;
    }
    return {
      accessToken: auth.access_token,
      refreshToken: auth.refresh_token,
      userId: auth.user_id,
      expiresAt: auth.expires_at,
      createdAt: auth.created_at,
      updatedAt: auth.updated_at,
    };
  }

  saveAuthState(state: PersistedAuthState): void {
    this.db.saveAuth({
      access_token: state.accessToken,
      refresh_token: state.refreshToken,
      user_id: state.userId,
      expires_at: state.expiresAt,
    });
  }

  updateTokens(tokens: { accessToken: string; refreshToken: string; expiresAt: number }): void {
    this.db.updateAuth({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      expires_at: tokens.expiresAt,
    });
  }

  clearAuthState(): void {
    this.db.clearAuth();
  }

  // ===========================================================================
  // Utility
  // ===========================================================================

  hasAuthState(): boolean {
    return this.db.getAuth() !== null;
  }
}

/**
 * Factory function to create SQLiteAuthStateStore
 */
export function createSQLiteAuthStateStore(db: AppDatabase): IAuthStateStore {
  return new SQLiteAuthStateStore(db);
}
