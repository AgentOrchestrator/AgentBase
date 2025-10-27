-- Migration: Create Default Workspace on User Signup
-- Description: Automatically creates a "Personal Workspace" for new users when they sign up
-- This mirrors the behavior of the default project creation

-- Function to create a default workspace for new users
CREATE OR REPLACE FUNCTION public.create_default_workspace_for_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  new_workspace_id UUID;
  user_email TEXT;
  workspace_name TEXT;
  workspace_slug TEXT;
BEGIN
  -- Get user's email from auth.users
  SELECT email INTO user_email
  FROM auth.users
  WHERE id = NEW.id;

  -- Create workspace name (fallback if email is null)
  workspace_name := COALESCE(
    'Personal Workspace',
    'Personal Workspace'
  );

  -- Create slug from user ID (guaranteed unique)
  workspace_slug := 'personal-' || REPLACE(CAST(NEW.id AS TEXT), '-', '');

  -- Insert the default workspace
  INSERT INTO public.workspaces (
    name,
    slug,
    description,
    created_by_user_id,
    workspace_metadata
  )
  VALUES (
    workspace_name,
    workspace_slug,
    'Your personal workspace for managing coding rules and projects.',
    NEW.id,
    jsonb_build_object('is_default', true, 'created_via', 'auto_signup')
  )
  RETURNING id INTO new_workspace_id;

  -- Add the user as the owner of the workspace
  -- Note: The existing trigger 'add_creator_as_owner_on_workspace_creation'
  -- should handle this automatically, but we'll add it explicitly here
  -- in case of race conditions
  INSERT INTO public.workspace_members (
    workspace_id,
    user_id,
    role,
    invitation_status,
    invited_by_user_id
  )
  VALUES (
    new_workspace_id,
    NEW.id,
    'owner',
    'accepted',
    NEW.id
  )
  ON CONFLICT (workspace_id, user_id) DO NOTHING;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail user creation
    RAISE WARNING 'Failed to create default workspace for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- Create trigger on public.users table (after the user is synced from auth.users)
-- We trigger on INSERT to public.users, not auth.users, because:
-- 1. The handle_new_user() trigger already syncs auth.users -> public.users
-- 2. We want to ensure the user exists in public.users before creating workspace
DROP TRIGGER IF EXISTS create_default_workspace_on_user_creation ON public.users;

CREATE TRIGGER create_default_workspace_on_user_creation
  AFTER INSERT ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.create_default_workspace_for_user();

-- Add helpful comment
COMMENT ON FUNCTION public.create_default_workspace_for_user() IS
  'Automatically creates a default "Personal Workspace" for new users upon signup. Similar to how projects get a default "Uncategorized" project.';

COMMENT ON TRIGGER create_default_workspace_on_user_creation ON public.users IS
  'Triggers the creation of a default personal workspace when a new user record is inserted into public.users.';
