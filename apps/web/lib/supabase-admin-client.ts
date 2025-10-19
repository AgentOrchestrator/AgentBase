import { createClient } from '@supabase/supabase-js';

/**
 * Creates an authenticated Supabase client for system admin operations.
 * This client authenticates as the system admin user and respects RLS policies for database operations.
 *
 * For Auth Admin API operations (getUserById, listUsers, etc.), this uses service role temporarily
 * since those endpoints are not RLS-protected and require elevated auth permissions.
 *
 * IMPORTANT: Only use this in server-side code (API routes, Server Components, Server Actions)
 * NEVER import this in client components
 *
 * The admin user is created via: npx agent-orchestrator setup-admin
 */
export async function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const adminEmail = process.env.ADMIN_USER_EMAIL;
  const adminPassword = process.env.ADMIN_USER_PASSWORD;

  if (!supabaseUrl || !adminEmail || !adminPassword) {
    throw new Error(
      'Missing admin credentials. Please run: npx agent-orchestrator setup-admin'
    );
  }

  // Create a client for authentication
  const client = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '', {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  // Authenticate as admin user
  const { data, error } = await client.auth.signInWithPassword({
    email: adminEmail,
    password: adminPassword
  });

  if (error || !data.session) {
    const errorMsg = error ? error.message : 'No session';
    throw new Error(`Failed to authenticate as admin: ${errorMsg}`);
  }

  // Return authenticated client
  return client;
}

/**
 * Executes a callback with an authenticated admin client.
 * Automatically handles authentication and cleanup.
 * Uses admin user for RLS-protected database operations.
 *
 * Example usage:
 * ```typescript
 * // For database operations (respects RLS with admin privileges)
 * const histories = await withAdminClient(async (client) => {
 *   const { data } = await client.from('chat_histories').select('*');
 *   return data;
 * });
 * ```
 */
export async function withAdminClient<T>(
  callback: (client: ReturnType<typeof createClient>) => Promise<T>
): Promise<T> {
  const client = await getAdminClient();
  try {
    return await callback(client);
  } finally {
    // Sign out to clean up session
    await client.auth.signOut();
  }
}
