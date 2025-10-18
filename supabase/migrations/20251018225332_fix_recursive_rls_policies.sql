-- Fix recursive RLS policies causing query failures
--
-- PROBLEM:
-- The is_system_admin() function queries public.users table to check admin status.
-- However, public.users has RLS policies that themselves query public.users to check admin status.
-- This creates infinite recursion: chat_histories RLS � is_system_admin() � users RLS � users RLS � ...
--
-- SOLUTION:
-- 1. Make is_system_admin() bypass RLS by selecting directly from auth.users metadata (if available)
--    OR use a simpler approach by checking users table without triggering RLS
-- 2. Remove the recursive RLS policy on users table for admin updates
--    (admins can use is_system_admin() checks in other policies instead)

-- Step 1: Drop the recursive admin policy on users table
DROP POLICY IF EXISTS "Admins can update any profile" ON public.users;

-- Step 2: Recreate it using is_system_admin() function (which we'll fix below)
-- This way, the users table doesn't query itself
CREATE POLICY "Admins can update any profile"
  ON public.users
  FOR UPDATE
  TO public
  USING (is_system_admin())
  WITH CHECK (is_system_admin());

-- Step 3: Fix the is_system_admin() function to avoid querying users table
-- Instead, we'll check the auth.users table from the auth schema, which doesn't have RLS
-- Use CREATE OR REPLACE instead of DROP to avoid dependency errors
CREATE OR REPLACE FUNCTION public.is_system_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
DECLARE
  is_admin_user BOOLEAN;
BEGIN
  -- Query public.users but bypass RLS by using SECURITY DEFINER
  -- This function runs with elevated privileges and can see the users table
  SELECT is_admin INTO is_admin_user
  FROM public.users
  WHERE id = auth.uid()
  LIMIT 1;

  RETURN COALESCE(is_admin_user, false);
END;
$$;

-- Add comment explaining the fix
COMMENT ON FUNCTION public.is_system_admin() IS
  'Checks if the current user is a system admin. Uses SECURITY DEFINER to bypass RLS and prevent recursive policy checks.';

-- Rollback instructions:
-- To rollback, restore the original policies:
-- DROP POLICY IF EXISTS "Admins can update any profile" ON public.users;
-- CREATE POLICY "Admins can update any profile"
--   ON public.users FOR UPDATE TO public
--   USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true))
--   WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true));
