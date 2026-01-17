/**
 * Auth State Store Interface - Local Persistence Abstraction
 *
 * Abstracts local storage of authentication state, enabling different
 * implementations (SQLite, file-based, encrypted storage).
 *
 * Follows the IStatusPersistence pattern from desktop app.
 */

/**
 * Persisted auth state - what gets stored locally
 */
export interface PersistedAuthState {
  accessToken: string;
  refreshToken: string;
  userId: string;
  expiresAt: number; // Unix timestamp in milliseconds
  createdAt?: number;
  updatedAt?: number;
}

/**
 * Device identity for daemon instance
 */
export interface DeviceIdentity {
  deviceId: string;
  createdAt?: number;
}

/**
 * Local persistence interface for auth state.
 *
 * Implementations:
 * - SQLiteAuthStateStore (default) - wraps existing AppDatabase
 * - FileAuthStateStore (future) - JSON file storage
 * - EncryptedAuthStateStore (future) - encrypted storage
 */
export interface IAuthStateStore {
  // =========================================================================
  // Device Identity
  // =========================================================================

  /**
   * Get the stored device identity
   * @returns Device identity or null if not set
   */
  getDeviceIdentity(): DeviceIdentity | null;

  /**
   * Store the device identity
   * @param identity Device identity to persist
   */
  setDeviceIdentity(identity: DeviceIdentity): void;

  // =========================================================================
  // Auth State CRUD
  // =========================================================================

  /**
   * Get the current auth state
   * @returns Auth state or null if not authenticated
   */
  getAuthState(): PersistedAuthState | null;

  /**
   * Save auth state (replaces any existing state)
   * @param state Auth state to persist
   */
  saveAuthState(state: PersistedAuthState): void;

  /**
   * Update tokens without changing user identity
   * Used for token refresh operations
   * @param tokens Updated token information
   */
  updateTokens(tokens: {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
  }): void;

  /**
   * Clear all auth state (logout)
   */
  clearAuthState(): void;

  // =========================================================================
  // Utility
  // =========================================================================

  /**
   * Check if auth state exists
   */
  hasAuthState(): boolean;
}
