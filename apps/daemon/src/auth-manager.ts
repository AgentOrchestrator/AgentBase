import { v4 as uuidv4 } from 'uuid';
import { supabase } from './supabase.js';
import { getDatabase } from './database.js';

interface AuthState {
  accessToken: string;
  refreshToken: string;
  userId: string;
  expiresAt: number;
}

export class AuthManager {
  private authState: AuthState | null = null;
  private deviceId: string;
  private db = getDatabase();

  constructor() {
    this.deviceId = this.getOrCreateDeviceId();
    this.loadAuthState();
  }

  private getOrCreateDeviceId(): string {
    let deviceId = this.db.getDeviceId();

    if (!deviceId) {
      deviceId = uuidv4();
      this.db.setDeviceId(deviceId);
      console.log('[Auth] Created new device ID:', deviceId);
    }

    return deviceId;
  }

  private loadAuthState(): void {
    try {
      const auth = this.db.getAuth();
      if (auth) {
        this.authState = {
          accessToken: auth.access_token,
          refreshToken: auth.refresh_token,
          userId: auth.user_id,
          expiresAt: auth.expires_at,
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
        this.db.saveAuth({
          access_token: this.authState.accessToken,
          refresh_token: this.authState.refreshToken,
          user_id: this.authState.userId,
          expires_at: this.authState.expiresAt,
        });
      } else {
        this.db.clearAuth();
      }
    } catch (error) {
      console.error('Error saving auth state:', error);
    }
  }

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
      const { data, error } = await supabase.auth.refreshSession({
        refresh_token: this.authState.refreshToken,
      });

      if (error || !data.session) {
        console.error('Error refreshing token:', error);
        this.authState = null;
        this.saveAuthState();
        return false;
      }

      this.authState = {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        userId: data.session.user.id,
        expiresAt: data.session.expires_at! * 1000,
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
    const webUrl = process.env.WEB_URL || 'http://localhost:3000';
    return `${webUrl}/daemon-auth?device_id=${this.deviceId}`;
  }

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
      // Check if a session was created for this device
      const { data, error } = await supabase
        .from('daemon_auth_sessions')
        .select('*')
        .eq('device_id', this.deviceId)
        .eq('consumed', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        // Only log if it's not a "no rows" error
        if (error.code !== 'PGRST116') {
          console.log('[Auth Check] Error:', error.message);
        }
        return false;
      }

      if (!data) {
        return false;
      }

      console.log('[Auth Check] Found auth session!');

      // Mark session as consumed
      await supabase
        .from('daemon_auth_sessions')
        .update({ consumed: true })
        .eq('id', data.id);

      // Store the auth state
      this.authState = {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        userId: data.user_id,
        expiresAt: new Date(data.expires_at).getTime(),
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
