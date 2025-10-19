/**
 * @deprecated This file is deprecated. DO NOT USE.
 *
 * Migration guide:
 *
 * 1. For user data (RECOMMENDED):
 *    Query the public.users table directly:
 *    ```typescript
 *    const { data: user } = await supabase
 *      .from('users')
 *      .select('*')
 *      .eq('id', userId)
 *      .single();
 *    ```
 *
 * 2. For admin database operations:
 *    Use `withAdminClient()` from '@/lib/supabase-admin-client'
 *    ```typescript
 *    const data = await withAdminClient(async (client) => {
 *      return await client.from('chat_histories').select('*');
 *    });
 *    ```
 *
 * 3. For password changes (rare):
 *    Use service_role_key in CLI tools only
 *
 * The new approach:
 * - ✅ No service_role_key needed in app code
 * - ✅ All operations respect RLS policies
 * - ✅ User data accessible via public.users table
 */

import { createClient } from '@supabase/supabase-js';

// Temporary backward compatibility - will throw error in production
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!serviceRoleKey) {
  console.warn(
    '⚠️  supabase-admin.ts is deprecated. ' +
    'Migrate to public.users table or withAdminClient(). ' +
    'See ADMIN_SYSTEM_MIGRATION.md'
  );
}

/**
 * @deprecated DO NOT USE - Query public.users table instead
 */
export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});
