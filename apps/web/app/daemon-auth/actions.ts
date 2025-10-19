'use server';

import { createClient } from '@/lib/supabase-server';

export async function createAuthSession(
  deviceId: string,
  accessToken: string,
  refreshToken: string,
  userId: string,
  expiresAt: number
) {
  // This runs on the server only
  // Use user's own session - RLS policy allows users to insert their own auth sessions
  try {
    const supabase = await createClient();

    // Verify the user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('[Server Action] User not authenticated:', authError);
      return {
        success: false,
        error: 'User not authenticated',
        needsAuth: true
      };
    }

    // Verify the userId matches the authenticated user
    if (user.id !== userId) {
      console.error('[Server Action] User ID mismatch');
      return {
        success: false,
        error: 'User ID mismatch',
        needsAuth: false
      };
    }

    // Insert auth session using user's own credentials (RLS policy allows this)
    const { error: insertError } = await supabase
      .from('daemon_auth_sessions')
      .insert({
        device_id: deviceId,
        user_id: userId,
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_at: new Date(expiresAt * 1000).toISOString(),
        consumed: false,
      });

    if (insertError) {
      console.error('[Server Action] Insert error:', insertError);
      return {
        success: false,
        error: insertError.message,
        needsAuth: false
      };
    }

    console.log('[Server Action] Auth session created successfully for device:', deviceId);
    return { success: true, needsAuth: false };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error: errorMessage,
      needsAuth: false
    };
  }
}
