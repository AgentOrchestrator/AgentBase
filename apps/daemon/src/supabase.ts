import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import type { Database } from './database.types.js';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables');
}

// Base unauthenticated client (for auth operations and public data)
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

/**
 * Authenticated context containing the Supabase client and user account ID
 * Use this for dependency injection instead of passing tokens everywhere
 */
export interface AuthenticatedContext {
  client: ReturnType<typeof createClient<Database>>;
  accountId: string;
  accessToken: string;
  refreshToken: string;
}

/**
 * Create an authenticated Supabase client with a user's access token
 * This client will respect RLS policies as the authenticated user
 *
 * We use both global.headers (for database requests) and setSession (for auth state)
 *
 * @returns AuthenticatedContext containing client, accountId, and tokens
 */
export async function createAuthenticatedClient(accessToken: string, refreshToken: string): Promise<AuthenticatedContext> {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables');
  }

  const client = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  // Set the session so auth.uid() works properly in RLS
  const { data, error } = await client.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken
  });

  if (error) {
    console.error('[Supabase] Error setting session:', error.message);
    throw error;
  }

  // Extract account ID from the session
  const authSession = await client.auth.getSession();
  const accountId = authSession.data.session?.user.id;

  if (!accountId) {
    throw new Error('No account ID found in authenticated session');
  }

  return { client, accountId, accessToken, refreshToken };
}
