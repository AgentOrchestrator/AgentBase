/**
 * Supabase implementation of IAuthProvider
 */

import type {
  IAuthProvider,
  AuthTokens,
  DeviceAuthSession,
  AuthProviderInfo,
  TokenValidationResult,
} from '../../interfaces/auth.js';
import { supabaseClient } from './client.js';

export class SupabaseAuthProvider implements IAuthProvider {
  // ===========================================================================
  // Provider Info
  // ===========================================================================

  getProviderInfo(): AuthProviderInfo {
    return {
      name: 'supabase',
      version: '1.0.0',
      capabilities: {
        supportsDeviceAuth: true,
        supportsTokenRefresh: true,
        supportsTokenValidation: true,
        supportsSessionIntrospection: true,
      },
    };
  }

  getAuthUrl(deviceId: string): string {
    // Default URL scheme for Agent Base app
    // Can be made configurable via environment variable if needed
    return `agent-base://auth?device_id=${deviceId}`;
  }

  // ===========================================================================
  // Token Operations
  // ===========================================================================

  async refreshTokens(refreshToken: string): Promise<AuthTokens | null> {
    try {
      const { data, error } = await supabaseClient.auth.refreshSession({
        refresh_token: refreshToken,
      });

      if (error || !data.session) {
        console.error('[SupabaseAuthProvider] Error refreshing token:', error?.message);
        return null;
      }

      return {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        expiresAt: data.session.expires_at! * 1000, // Convert seconds to ms
      };
    } catch (error) {
      console.error('[SupabaseAuthProvider] Unexpected error refreshing token:', error);
      return null;
    }
  }

  async pollForDeviceAuth(deviceId: string): Promise<DeviceAuthSession | null> {
    try {
      const { data, error } = await supabaseClient
        .from('daemon_auth_sessions')
        .select('*')
        .eq('device_id', deviceId)
        .eq('consumed', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        // PGRST116 = no rows found, not an error
        if (error.code !== 'PGRST116') {
          console.error('[SupabaseAuthProvider] Error polling for device auth:', error.message);
        }
        return null;
      }

      if (!data) {
        return null;
      }

      return {
        id: data.id,
        deviceId: data.device_id,
        userId: data.user_id,
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: data.expires_at,
      };
    } catch (error) {
      console.error('[SupabaseAuthProvider] Unexpected error polling for device auth:', error);
      return null;
    }
  }

  async markDeviceAuthConsumed(sessionId: string): Promise<void> {
    try {
      const { error } = await supabaseClient
        .from('daemon_auth_sessions')
        .update({ consumed: true })
        .eq('id', sessionId);

      if (error) {
        console.error('[SupabaseAuthProvider] Error marking session consumed:', error.message);
      }
    } catch (error) {
      console.error('[SupabaseAuthProvider] Unexpected error marking session consumed:', error);
    }
  }

  // ===========================================================================
  // Optional: Token Validation
  // ===========================================================================

  async validateToken(accessToken: string): Promise<TokenValidationResult> {
    try {
      const { data, error } = await supabaseClient.auth.getUser(accessToken);

      if (error || !data.user) {
        return {
          valid: false,
          error: error?.message ?? 'No user found',
        };
      }

      return {
        valid: true,
        userId: data.user.id,
      };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
