-- Migration: Backfill Default Workspaces for Existing Users
-- Description: Creates a "Personal Workspace" for all existing users who don't have any workspaces yet
-- This ensures existing users get the same experience as new users

DO $$
DECLARE
  user_record RECORD;
  new_workspace_id UUID;
  workspace_name TEXT;
  workspace_slug TEXT;
  users_processed INTEGER := 0;
  workspaces_created INTEGER := 0;
BEGIN
  -- Loop through all users who don't have any workspace memberships
  FOR user_record IN (
    SELECT
      u.id,
      u.email,
      u.display_name
    FROM public.users u
    LEFT JOIN public.workspace_members wm ON u.id = wm.user_id
    WHERE wm.workspace_id IS NULL
    ORDER BY u.created_at ASC
  )
  LOOP
    BEGIN
      users_processed := users_processed + 1;

      -- Create workspace name
      workspace_name := 'Personal Workspace';

      -- Create unique slug from user ID
      workspace_slug := 'personal-' || REPLACE(CAST(user_record.id AS TEXT), '-', '');

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
        user_record.id,
        jsonb_build_object(
          'is_default', true,
          'created_via', 'backfill_migration',
          'backfilled_at', NOW()
        )
      )
      RETURNING id INTO new_workspace_id;

      -- Add the user as the owner of the workspace
      INSERT INTO public.workspace_members (
        workspace_id,
        user_id,
        role,
        invitation_status,
        invited_by_user_id
      )
      VALUES (
        new_workspace_id,
        user_record.id,
        'owner',
        'accepted',
        user_record.id
      )
      ON CONFLICT (workspace_id, user_id) DO NOTHING;

      workspaces_created := workspaces_created + 1;

      RAISE NOTICE 'Created default workspace for user % (%) - Workspace ID: %',
        user_record.email,
        user_record.id,
        new_workspace_id;

    EXCEPTION
      WHEN OTHERS THEN
        -- Log error but continue processing other users
        RAISE WARNING 'Failed to create workspace for user % (%): %',
          user_record.email,
          user_record.id,
          SQLERRM;
    END;
  END LOOP;

  -- Summary
  RAISE NOTICE 'Backfill complete: Processed % users, created % workspaces',
    users_processed,
    workspaces_created;

END $$;

-- Verify the backfill
DO $$
DECLARE
  users_without_workspace INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO users_without_workspace
  FROM public.users u
  LEFT JOIN public.workspace_members wm ON u.id = wm.user_id
  WHERE wm.workspace_id IS NULL;

  IF users_without_workspace > 0 THEN
    RAISE WARNING 'Warning: % users still have no workspace after backfill', users_without_workspace;
  ELSE
    RAISE NOTICE 'Success: All users now have at least one workspace';
  END IF;
END $$;
