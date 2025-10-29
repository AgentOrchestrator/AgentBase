import { createServerClient } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

/**
 * Creates a Supabase client for use in Server Components and Server Actions.
 * This client properly handles authentication cookies and SSR.
 *
 * IMPORTANT: This should only be used in Server Components, not Client Components.
 *
 * Uses NEXT_PUBLIC_SUPABASE_URL for cookie names (must match client-side)
 * But uses SUPABASE_SERVER_URL for actual API calls (for Docker networking)
 */
export async function createClient() {
  const cookieStore = await cookies();

  // For cookie storage: use NEXT_PUBLIC_SUPABASE_URL (must match client-side)
  // For API calls: use SUPABASE_SERVER_URL if available (for Docker networking)
  const cookieUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const apiUrl = process.env.SUPABASE_SERVER_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;

  return createServerClient(
    cookieUrl, // This determines cookie names (must match client)
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
      global: {
        // Override fetch to use SUPABASE_SERVER_URL for actual API calls
        fetch: (url, options) => {
          // Convert Request object to string URL if needed
          const urlString = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;
          const urlObj = new URL(urlString);

          // Replace the URL origin with the server URL for API calls
          if (apiUrl !== cookieUrl) {
            const apiUrlObj = new URL(apiUrl);
            urlObj.protocol = apiUrlObj.protocol;
            urlObj.host = apiUrlObj.host;
            urlObj.port = apiUrlObj.port;
          }
          return fetch(urlObj.toString(), options);
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
  // Use server-specific URL if available (for Docker), otherwise use public URL
  const supabaseUrl = process.env.SUPABASE_SERVER_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;

  const client = createSupabaseClient(
    supabaseUrl,
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
