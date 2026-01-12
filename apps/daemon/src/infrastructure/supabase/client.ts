/**
 * Internal Supabase client - NOT exported to consumers
 * All Supabase-specific code should be contained in this directory
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../database.types.js';

// Environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables');
}

/**
 * Base unauthenticated Supabase client
 * Used for auth operations and public data access
 */
export const supabaseClient = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

/**
 * Create an authenticated Supabase client with user tokens
 * The client respects RLS policies as the authenticated user
 */
export async function createAuthenticatedSupabaseClient(
  accessToken: string,
  refreshToken: string
): Promise<{ client: SupabaseClient<Database>; userId: string }> {
  const client = createClient<Database>(supabaseUrl!, supabaseAnonKey!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // Set the session for RLS policies
  const { error } = await client.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  if (error) {
    throw new Error(`Failed to set Supabase session: ${error.message}`);
  }

  // Extract user ID from session
  const { data: sessionData } = await client.auth.getSession();
  const userId = sessionData.session?.user.id;

  if (!userId) {
    throw new Error('No user ID found in authenticated session');
  }

  return { client, userId };
}

export type { SupabaseClient, Database };
