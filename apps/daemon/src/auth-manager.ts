/**
 * AuthManager - Orchestrates authentication flow
 *
 * Uses dependency injection for:
 * - IAuthProvider: vendor-agnostic auth operations (Supabase, Firebase, etc.)
 * - IAuthStateStore: vendor-agnostic local persistence (SQLite, file, etc.)
 */

import { v4 as uuidv4 } from 'uuid';
import type { IAuthProvider } from './interfaces/auth.js';
import type { IAuthStateStore } from './interfaces/auth-state-store.js';

interface AuthState {
  accessToken: string;
  refreshToken: string;
  userId: string;
  expiresAt: number;
}

export class AuthManager {
  private authState: AuthState | null = null;
  private deviceId: string;

  constructor(
    private authProvider: IAuthProvider,
    private stateStore: IAuthStateStore
  ) {
    this.deviceId = this.getOrCreateDeviceId();
    this.loadAuthState();
  }

  // ===========================================================================
  // Device Identity
  // ===========================================================================

  private getOrCreateDeviceId(): string {
    const identity = this.stateStore.getDeviceIdentity();

    if (identity) {
      return identity.deviceId;
    }

    const deviceId = uuidv4();
    this.stateStore.setDeviceIdentity({ deviceId, createdAt: Date.now() });
    console.log('[Auth] Created new device ID:', deviceId);
    return deviceId;
  }

  // ===========================================================================
  // Auth State Persistence
  // ===========================================================================

  private loadAuthState(): void {
    try {
      const persisted = this.stateStore.getAuthState();
      if (persisted) {
        this.authState = {
          accessToken: persisted.accessToken,
          refreshToken: persisted.refreshToken,
          userId: persisted.userId,
          expiresAt: persisted.expiresAt,
        };
      }
    } catch (error) {
      console.error('Error loading auth state:', error);
      this.authState = null;
    }
  }

  private saveAuthState(): void {
    try {
      if (this.authState) {
        this.stateStore.saveAuthState({
          accessToken: this.authState.accessToken,
          refreshToken: this.authState.refreshToken,
          userId: this.authState.userId,
          expiresAt: this.authState.expiresAt,
        });
      } else {
        this.stateStore.clearAuthState();
      }
    } catch (error) {
      console.error('Error saving auth state:', error);
    }
  }

  // ===========================================================================
  // Authentication Status
  // ===========================================================================

  async isAuthenticated(): Promise<boolean> {
    if (!this.authState) {
      return false;
    }

    // Check if token is expired (with 5 minute buffer)
    const now = Date.now();
    const expiresAt = this.authState.expiresAt;

    if (now >= expiresAt - 5 * 60 * 1000) {
      // Try to refresh the token
      return await this.refreshAuthToken();
    }

    return true;
  }

  private async refreshAuthToken(): Promise<boolean> {
    if (!this.authState?.refreshToken) {
      return false;
    }

    try {
      const tokens = await this.authProvider.refreshTokens(this.authState.refreshToken);

      if (!tokens) {
        console.error('Error refreshing token: no tokens returned');
        this.authState = null;
        this.saveAuthState();
        return false;
      }

      this.authState = {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        userId: this.authState.userId, // Keep existing user ID
        expiresAt: tokens.expiresAt,
      };

      this.saveAuthState();
      return true;
    } catch (error) {
      console.error('Error refreshing auth token:', error);
      this.authState = null;
      this.saveAuthState();
      return false;
    }
  }

  // ===========================================================================
  // Getters
  // ===========================================================================

  getUserId(): string | null {
    return this.authState?.userId || null;
  }

  getAccessToken(): string | null {
    return this.authState?.accessToken || null;
  }

  getRefreshToken(): string | null {
    return this.authState?.refreshToken || null;
  }

  getDeviceId(): string {
    return this.deviceId;
  }

  getAuthUrl(): string {
    // Delegate to auth provider for vendor-specific URL
    return this.authProvider.getAuthUrl(this.deviceId);
  }

  // ===========================================================================
  // Device Auth Flow
  // ===========================================================================

  async waitForAuth(timeoutMs: number = 300000): Promise<boolean> {
    const startTime = Date.now();
    const pollInterval = 2000; // Poll every 2 seconds
    const authUrl = this.getAuthUrl();

    console.log('\n🔐 Authentication Required');
    console.log('─'.repeat(50));
    console.log('Please click the link below to authenticate:');
    console.log(`\n\x1b]8;;${authUrl}\x1b\\🔗 Open Authentication Page\x1b]8;;\x1b\\\n`);
    console.log(`Or copy this URL: ${authUrl}\n`);
    console.log('Waiting for authentication...');
    console.log('─'.repeat(50));

    while (Date.now() - startTime < timeoutMs) {
      // Check if auth has been completed
      const authCompleted = await this.checkAuthCompletion();

      if (authCompleted) {
        console.log('✓ Authentication successful!');
        return true;
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    console.log('✗ Authentication timeout');
    return false;
  }

  private async checkAuthCompletion(): Promise<boolean> {
    try {
      // Poll for device auth session
      const session = await this.authProvider.pollForDeviceAuth(this.deviceId);

      if (!session) {
        return false;
      }

      console.log('[Auth Check] Found auth session!');

      // Mark session as consumed
      await this.authProvider.markDeviceAuthConsumed(session.id);

      // Store the auth state
      this.authState = {
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
        userId: session.userId,
        expiresAt: new Date(session.expiresAt).getTime(),
      };

      this.saveAuthState();
      return true;
    } catch (error) {
      console.error('Error checking auth completion:', error);
      return false;
    }
  }

  async ensureAuthenticated(): Promise<boolean> {
    const authenticated = await this.isAuthenticated();

    if (authenticated) {
      return true;
    }

    // Prompt user to authenticate
    return await this.waitForAuth();
  }

  logout(): void {
    this.authState = null;
    this.saveAuthState();
    console.log('Logged out successfully');
  }
}
