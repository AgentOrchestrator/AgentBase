-- Migration: Session Sharing
-- Description: Add support for sharing individual sessions (chat_histories)
-- Note: By default, sharing a project shares all its sessions, but users can exclude specific sessions
-- IMPORTANT: Uses security definer functions to avoid recursive RLS issues

-- Helper function to check if user owns a session (bypasses RLS to avoid recursion)
CREATE OR REPLACE FUNCTION public.user_owns_session(session_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_histories
    WHERE id = session_uuid
    AND account_id = user_uuid
  );
$$;

-- Helper function to check if user is workspace member (bypasses RLS to avoid recursion)
CREATE OR REPLACE FUNCTION public.user_in_workspace(user_uuid UUID, workspace_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE user_id = user_uuid
    AND workspace_id = workspace_uuid
  );
$$;

-- Session Shares (Individual User Shares)
CREATE TABLE IF NOT EXISTS public.session_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.chat_histories(id) ON DELETE CASCADE,
  shared_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shared_with_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission_level TEXT NOT NULL DEFAULT 'view' CHECK (permission_level IN ('view', 'edit')),
  created_at TIMESTAMPTZ DEFAULT now(),

  -- Ensure a session can only be shared once per user pair
  UNIQUE(session_id, shared_by_user_id, shared_with_user_id)
);

-- Session Workspace Shares
CREATE TABLE IF NOT EXISTS public.session_workspace_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.chat_histories(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  shared_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission_level TEXT NOT NULL DEFAULT 'view' CHECK (permission_level IN ('view', 'edit')),
  created_at TIMESTAMPTZ DEFAULT now(),

  -- Ensure a session can only be shared once per workspace
  UNIQUE(session_id, workspace_id)
);

-- Session Share Exclusions
-- When a project is shared, all sessions are included by default
-- This table tracks sessions that are explicitly excluded from project shares
CREATE TABLE IF NOT EXISTS public.session_share_exclusions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.chat_histories(id) ON DELETE CASCADE,
  project_share_id UUID REFERENCES public.project_shares(id) ON DELETE CASCADE,
  project_workspace_share_id UUID REFERENCES public.project_workspace_shares(id) ON DELETE CASCADE,
  excluded_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),

  -- Must reference either a project_share or project_workspace_share
  CHECK (
    (project_share_id IS NOT NULL AND project_workspace_share_id IS NULL) OR
    (project_share_id IS NULL AND project_workspace_share_id IS NOT NULL)
  ),

  -- Ensure a session can only be excluded once per project share
  UNIQUE(session_id, project_share_id),
  UNIQUE(session_id, project_workspace_share_id)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_session_shares_session_id ON public.session_shares(session_id);
CREATE INDEX IF NOT EXISTS idx_session_shares_shared_with_user_id ON public.session_shares(shared_with_user_id);
CREATE INDEX IF NOT EXISTS idx_session_shares_shared_by_user_id ON public.session_shares(shared_by_user_id);
CREATE INDEX IF NOT EXISTS idx_session_workspace_shares_session_id ON public.session_workspace_shares(session_id);
CREATE INDEX IF NOT EXISTS idx_session_workspace_shares_workspace_id ON public.session_workspace_shares(workspace_id);
CREATE INDEX IF NOT EXISTS idx_session_share_exclusions_session_id ON public.session_share_exclusions(session_id);

-- Enable RLS on all tables
ALTER TABLE public.session_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_workspace_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_share_exclusions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for session_shares
-- Separate SELECT, INSERT, DELETE policies to avoid conflicts

-- SELECT: Users can view shares where they are involved
CREATE POLICY "session_shares_select"
  ON public.session_shares FOR SELECT
  USING (
    shared_by_user_id = auth.uid() OR
    shared_with_user_id = auth.uid() OR
    public.user_owns_session(session_id, auth.uid())
  );

-- INSERT: Users can create shares for sessions they own
CREATE POLICY "session_shares_insert"
  ON public.session_shares FOR INSERT
  WITH CHECK (
    shared_by_user_id = auth.uid() AND
    public.user_owns_session(session_id, auth.uid())
  );

-- DELETE: Users can delete shares they created
CREATE POLICY "session_shares_delete"
  ON public.session_shares FOR DELETE
  USING (shared_by_user_id = auth.uid());

-- RLS Policies for session_workspace_shares
-- Separate SELECT, INSERT, DELETE policies to avoid conflicts

-- SELECT: Users can view workspace shares they're involved in
CREATE POLICY "session_workspace_shares_select"
  ON public.session_workspace_shares FOR SELECT
  USING (
    shared_by_user_id = auth.uid() OR
    public.user_owns_session(session_id, auth.uid()) OR
    public.user_in_workspace(auth.uid(), workspace_id)
  );

-- INSERT: Users can create workspace shares for sessions they own
CREATE POLICY "session_workspace_shares_insert"
  ON public.session_workspace_shares FOR INSERT
  WITH CHECK (
    shared_by_user_id = auth.uid() AND
    public.user_owns_session(session_id, auth.uid())
  );

-- DELETE: Users can delete workspace shares they created
CREATE POLICY "session_workspace_shares_delete"
  ON public.session_workspace_shares FOR DELETE
  USING (shared_by_user_id = auth.uid());

-- RLS Policies for session_share_exclusions
-- Separate SELECT, INSERT, DELETE policies to avoid conflicts

-- SELECT: Users can view exclusions they created or for sessions they own
CREATE POLICY "session_exclusions_select"
  ON public.session_share_exclusions FOR SELECT
  USING (
    excluded_by_user_id = auth.uid() OR
    public.user_owns_session(session_id, auth.uid())
  );

-- INSERT: Users can create exclusions for sessions they own
CREATE POLICY "session_exclusions_insert"
  ON public.session_share_exclusions FOR INSERT
  WITH CHECK (
    excluded_by_user_id = auth.uid() AND
    public.user_owns_session(session_id, auth.uid())
  );

-- DELETE: Users can delete exclusions they created
CREATE POLICY "session_exclusions_delete"
  ON public.session_share_exclusions FOR DELETE
  USING (excluded_by_user_id = auth.uid());

-- Add comments for documentation
COMMENT ON TABLE public.session_shares IS 'Stores individual session sharing permissions between users';
COMMENT ON TABLE public.session_workspace_shares IS 'Shares sessions with entire workspaces (all members get access)';
COMMENT ON TABLE public.session_share_exclusions IS 'Tracks sessions excluded from project-level shares. By default, sharing a project shares all sessions.';
COMMENT ON COLUMN public.session_share_exclusions.project_share_id IS 'Reference to project_shares if excluding from user share';
COMMENT ON COLUMN public.session_share_exclusions.project_workspace_share_id IS 'Reference to project_workspace_shares if excluding from workspace share';
