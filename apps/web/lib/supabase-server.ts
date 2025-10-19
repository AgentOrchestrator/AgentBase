import { createServerClient } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

/**
 * Creates a Supabase client for use in Server Components and Server Actions.
 * This client properly handles authentication cookies and SSR.
 *
 * IMPORTANT: This should only be used in Server Components, not Client Components.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing user sessions.
          }
        },
      },
    }
  );
}

/**
 * Creates a Supabase client with a specific session for RLS policies.
 * Use this in API routes when you need RLS to work with the authenticated user.
 *
 * @param accessToken - The user's access token from their session
 * @param refreshToken - The user's refresh token from their session
 */
export async function createClientWithAuth(accessToken: string, refreshToken: string) {
  const client = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );

  // Set the session to ensure auth context is available for RLS policies
  // This is the correct way to authenticate - not via headers
  const { data, error } = await client.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  if (error) {
    console.error('Error setting session:', error);
    throw error;
  }

  console.log('Session set successfully', data)

  return client;
}
