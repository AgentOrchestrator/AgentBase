-- ============================================================================
-- Consolidated Schema Baseline Migration
-- This migration creates the complete database schema in its final state
-- All incremental patches have been consolidated into this single file
-- ============================================================================

-- ============================================================================
-- BASIC HELPER FUNCTIONS (no table dependencies)
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Cleanup function for consumed auth sessions
CREATE OR REPLACE FUNCTION public.cleanup_consumed_auth_sessions()
RETURNS void AS $$
BEGIN
  DELETE FROM daemon_auth_sessions
  WHERE consumed = TRUE
  AND created_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TABLES
-- ============================================================================

-- Projects Table (must be created before chat_histories references it)
CREATE TABLE IF NOT EXISTS public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    name TEXT NOT NULL,
    project_path TEXT NOT NULL,
    description TEXT,
    workspace_metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, project_path)
);

CREATE INDEX idx_projects_user_id ON public.projects(user_id);
CREATE INDEX idx_projects_project_path ON public.projects(project_path);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_projects_updated_at
    BEFORE UPDATE ON public.projects
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.projects IS 'Stores project information for organizing chat histories';
COMMENT ON COLUMN public.projects.user_id IS 'Owner of the project';
COMMENT ON COLUMN public.projects.name IS 'Display name of the project (extracted from project_path)';
COMMENT ON COLUMN public.projects.project_path IS 'Full filesystem path to the project';
COMMENT ON COLUMN public.projects.workspace_metadata IS 'Additional metadata (e.g., Cursor workspace.json data)';

-- Chat Histories Table
CREATE TABLE IF NOT EXISTS public.chat_histories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMPTZ NOT NULL,
    messages JSONB NOT NULL DEFAULT '[]'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    agent_type TEXT DEFAULT 'claude_code',
    account_id UUID REFERENCES auth.users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    latest_message_timestamp TIMESTAMPTZ,
    ai_summary TEXT,
    ai_summary_generated_at TIMESTAMPTZ,
    ai_summary_message_count INTEGER,
    ai_keywords_type TEXT[],
    ai_keywords_topic TEXT[],
    ai_keywords_generated_at TIMESTAMPTZ,
    ai_keywords_message_count INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT check_agent_type CHECK (agent_type IN ('claude_code', 'codex', 'cursor', 'windsurf', 'other'))
);

CREATE INDEX idx_chat_histories_timestamp ON public.chat_histories(timestamp DESC);
CREATE INDEX idx_chat_histories_created_at ON public.chat_histories(created_at DESC);
CREATE INDEX idx_chat_histories_agent_type ON public.chat_histories(agent_type);
CREATE INDEX idx_chat_histories_account_id ON public.chat_histories(account_id);
CREATE INDEX idx_chat_histories_project_id ON public.chat_histories(project_id);
CREATE INDEX idx_chat_histories_ai_summary_generated_at ON public.chat_histories(ai_summary_generated_at DESC);
CREATE INDEX idx_chat_histories_ai_keywords_generated_at ON public.chat_histories(ai_keywords_generated_at DESC);
CREATE INDEX idx_chat_histories_latest_message_timestamp ON public.chat_histories(latest_message_timestamp DESC);
CREATE INDEX idx_chat_histories_needs_summary ON public.chat_histories(updated_at) WHERE ai_summary IS NULL;
CREATE INDEX idx_chat_histories_needs_keywords ON public.chat_histories(updated_at) WHERE ai_keywords_type IS NULL;

ALTER TABLE public.chat_histories ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_chat_histories_updated_at
    BEFORE UPDATE ON public.chat_histories
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.chat_histories IS 'Stores chat conversation histories with AI metadata';
COMMENT ON COLUMN public.chat_histories.latest_message_timestamp IS 'Timestamp of the most recent message in the conversation';
COMMENT ON COLUMN public.chat_histories.ai_summary IS 'AI-generated summary of the conversation';
COMMENT ON COLUMN public.chat_histories.ai_summary_generated_at IS 'When the AI summary was generated';
COMMENT ON COLUMN public.chat_histories.ai_summary_message_count IS 'Number of messages that were included in the summary';
COMMENT ON COLUMN public.chat_histories.ai_keywords_type IS 'AI-extracted keywords about the type/category of conversation';
COMMENT ON COLUMN public.chat_histories.ai_keywords_topic IS 'AI-extracted keywords about the topics discussed';
COMMENT ON COLUMN public.chat_histories.ai_keywords_generated_at IS 'When the AI keywords were generated';
COMMENT ON COLUMN public.chat_histories.ai_keywords_message_count IS 'Number of messages that were analyzed for keywords';
COMMENT ON COLUMN public.chat_histories.project_id IS 'Foreign key to projects table - groups chat sessions by project';

-- Daemon Auth Sessions Table
CREATE TABLE IF NOT EXISTS public.daemon_auth_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  consumed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_daemon_auth_sessions_device_id ON public.daemon_auth_sessions(device_id);
CREATE INDEX idx_daemon_auth_sessions_user_id ON public.daemon_auth_sessions(user_id);
CREATE INDEX idx_daemon_auth_sessions_consumed ON public.daemon_auth_sessions(consumed);

ALTER TABLE public.daemon_auth_sessions ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.daemon_auth_sessions IS 'Handles daemon authentication sessions for desktop clients';

-- Project Shares Table (Individual Users)
CREATE TABLE IF NOT EXISTS public.project_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    shared_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    shared_with_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    permission_level TEXT NOT NULL DEFAULT 'view',
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT valid_permission_level CHECK (permission_level IN ('view', 'edit')),
    CONSTRAINT no_self_share CHECK (shared_by_user_id != shared_with_user_id),
    UNIQUE(project_id, shared_with_user_id)
);

CREATE INDEX idx_project_shares_project_id ON public.project_shares(project_id);
CREATE INDEX idx_project_shares_shared_with ON public.project_shares(shared_with_user_id);

ALTER TABLE public.project_shares ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.project_shares IS 'Stores project sharing permissions between individual users';
COMMENT ON COLUMN public.project_shares.permission_level IS 'Access level: view (read-only) or edit (read-write)';

-- Project Organization Shares Table
CREATE TABLE IF NOT EXISTS public.project_organization_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    organization_name TEXT NOT NULL,
    shared_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    permission_level TEXT NOT NULL DEFAULT 'view',
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT valid_org_permission_level CHECK (permission_level IN ('view', 'edit')),
    UNIQUE(project_id, organization_name)
);

CREATE INDEX idx_project_org_shares_project_id ON public.project_organization_shares(project_id);
CREATE INDEX idx_project_org_shares_org_name ON public.project_organization_shares(organization_name);

ALTER TABLE public.project_organization_shares ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.project_organization_shares IS 'Stores project sharing permissions for entire organizations';
COMMENT ON COLUMN public.project_organization_shares.permission_level IS 'Access level: view (read-only) or edit (read-write)';
COMMENT ON COLUMN public.project_organization_shares.organization_name IS 'Name of the organization (simple text field for now, can be upgraded to formal org table later)';

-- Active Sessions Table
CREATE TABLE IF NOT EXISTS public.active_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    editor_type TEXT NOT NULL CHECK (editor_type IN ('cursor', 'windsurf', 'claude_code', 'vscode', 'other')),
    last_activity_at TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN DEFAULT true,
    recent_files JSONB DEFAULT '[]'::jsonb,
    workspace_path TEXT,
    session_metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, editor_type)
);

CREATE INDEX idx_active_sessions_user_id ON public.active_sessions(user_id);
CREATE INDEX idx_active_sessions_project_id ON public.active_sessions(project_id);
CREATE INDEX idx_active_sessions_is_active ON public.active_sessions(is_active);
CREATE INDEX idx_active_sessions_last_activity ON public.active_sessions(last_activity_at DESC);
CREATE INDEX idx_active_sessions_recent_files ON public.active_sessions USING GIN(recent_files);

ALTER TABLE public.active_sessions ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.active_sessions IS 'Tracks recently active editor sessions and files per user (updated periodically)';
COMMENT ON COLUMN public.active_sessions.user_id IS 'User who owns this active session';
COMMENT ON COLUMN public.active_sessions.editor_type IS 'Type of editor: cursor, windsurf, claude_code, vscode, other';
COMMENT ON COLUMN public.active_sessions.last_activity_at IS 'Timestamp of last detected activity in this editor';
COMMENT ON COLUMN public.active_sessions.is_active IS 'True if activity detected within past hour';
COMMENT ON COLUMN public.active_sessions.recent_files IS 'Array of recently accessed files: [{path: string, lastAccessed: timestamp}]';
COMMENT ON COLUMN public.active_sessions.workspace_path IS 'Current workspace/project path being worked on';
COMMENT ON COLUMN public.active_sessions.session_metadata IS 'Additional session data (workspace info, etc.)';

-- User Canvas Layouts Table
CREATE TABLE IF NOT EXISTS public.user_canvas_layouts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  node_id TEXT NOT NULL,
  position_x REAL NOT NULL,
  position_y REAL NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, node_id)
);

CREATE INDEX idx_user_canvas_layouts_user_id ON public.user_canvas_layouts(user_id);
CREATE INDEX idx_user_canvas_layouts_node_id ON public.user_canvas_layouts(node_id);

ALTER TABLE public.user_canvas_layouts ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_user_canvas_layouts_updated_at
  BEFORE UPDATE ON public.user_canvas_layouts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.user_canvas_layouts IS 'Stores user-specific canvas node positions for UI persistence';

-- Workspaces Table
CREATE TABLE IF NOT EXISTS public.workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    created_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    workspace_metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_workspaces_created_by ON public.workspaces(created_by_user_id);
CREATE INDEX idx_workspaces_slug ON public.workspaces(slug);

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.workspaces IS 'Workspaces for grouping projects and team collaboration';
COMMENT ON COLUMN public.workspaces.slug IS 'URL-friendly unique identifier for the workspace';
COMMENT ON COLUMN public.workspaces.created_by_user_id IS 'User who created the workspace';
COMMENT ON COLUMN public.workspaces.workspace_metadata IS 'Additional workspace metadata (settings, preferences, etc.)';

-- Workspace Members Table
CREATE TABLE IF NOT EXISTS public.workspace_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    invited_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL ON UPDATE CASCADE,
    joined_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    invitation_status TEXT NOT NULL DEFAULT 'accepted' CHECK (invitation_status IN ('pending', 'accepted', 'declined')),
    invited_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(workspace_id, user_id)
);

CREATE INDEX idx_workspace_members_workspace_id ON public.workspace_members(workspace_id);
CREATE INDEX idx_workspace_members_user_id ON public.workspace_members(user_id);
CREATE INDEX idx_workspace_members_invitation_status ON public.workspace_members(user_id, invitation_status);

ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.workspace_members IS 'Manages workspace memberships and pending invitations';
COMMENT ON COLUMN public.workspace_members.role IS 'Member role: owner, admin, or member';
COMMENT ON COLUMN public.workspace_members.invitation_status IS 'Status: pending, accepted, or declined';
COMMENT ON COLUMN public.workspace_members.invited_by_user_id IS 'User who sent the invitation';

-- Project Workspace Shares Table
CREATE TABLE IF NOT EXISTS public.project_workspace_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    shared_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    permission_level TEXT NOT NULL DEFAULT 'view' CHECK (permission_level IN ('view', 'edit')),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(project_id, workspace_id)
);

CREATE INDEX idx_project_workspace_shares_project_id ON public.project_workspace_shares(project_id);
CREATE INDEX idx_project_workspace_shares_workspace_id ON public.project_workspace_shares(workspace_id);

ALTER TABLE public.project_workspace_shares ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.project_workspace_shares IS 'Links projects to workspaces for team collaboration';
COMMENT ON COLUMN public.project_workspace_shares.permission_level IS 'Access level: view (read-only) or edit (read-write)';

-- ============================================================================
-- HELPER FUNCTIONS (depend on tables above)
-- ============================================================================

-- Function to check if user is a member of a workspace (bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_workspace_member(workspace_id_param UUID, user_id_param UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM workspace_members
    WHERE workspace_id = workspace_id_param
      AND user_id = user_id_param
      AND invitation_status = 'accepted'
  );
END;
$$;

COMMENT ON FUNCTION public.is_workspace_member(UUID, UUID) IS
  'SECURITY DEFINER function to check workspace membership without triggering RLS recursion';

-- Function to check if user is owner/admin of a workspace (bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_workspace_admin(workspace_id_param UUID, user_id_param UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM workspace_members
    WHERE workspace_id = workspace_id_param
      AND user_id = user_id_param
      AND role IN ('owner', 'admin')
      AND invitation_status = 'accepted'
  );
END;
$$;

COMMENT ON FUNCTION public.is_workspace_admin(UUID, UUID) IS
  'SECURITY DEFINER function to check workspace admin/owner role without triggering RLS recursion';

-- Function to get all workspace IDs where user is an accepted member (bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_user_workspace_ids(user_id_param UUID)
RETURNS TABLE(workspace_id UUID)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT wm.workspace_id
  FROM workspace_members wm
  WHERE wm.user_id = user_id_param
    AND wm.invitation_status = 'accepted';
END;
$$;

COMMENT ON FUNCTION public.get_user_workspace_ids(UUID) IS
  'SECURITY DEFINER function to get user workspace IDs without triggering RLS recursion';

-- Function to check if user has workspace access to a project (bypasses RLS)
CREATE OR REPLACE FUNCTION public.has_workspace_access_to_project(
  project_id_param UUID,
  user_id_param UUID,
  required_permission TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM project_workspace_shares pws
    JOIN workspace_members wm ON wm.workspace_id = pws.workspace_id
    WHERE pws.project_id = project_id_param
      AND wm.user_id = user_id_param
      AND wm.invitation_status = 'accepted'
      AND (required_permission IS NULL OR pws.permission_level = required_permission)
  );
END;
$$;

COMMENT ON FUNCTION public.has_workspace_access_to_project(UUID, UUID, TEXT) IS
  'SECURITY DEFINER function to check workspace access to projects without triggering RLS recursion';

-- Function to check if user can view a project (via ownership or shares)
CREATE OR REPLACE FUNCTION public.user_can_view_project(
  project_id_param UUID,
  user_id_param UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = project_id_param
      AND p.user_id = user_id_param
  )
  OR EXISTS (
    SELECT 1 FROM project_shares ps
    WHERE ps.project_id = project_id_param
      AND ps.shared_with_user_id = user_id_param
  )
  OR EXISTS (
    SELECT 1 FROM project_organization_shares pos
    WHERE pos.project_id = project_id_param
  )
  OR EXISTS (
    SELECT 1
    FROM project_workspace_shares pws
    JOIN workspace_members wm ON wm.workspace_id = pws.workspace_id
    WHERE pws.project_id = project_id_param
      AND wm.user_id = user_id_param
      AND wm.invitation_status = 'accepted'
  );
END;
$$;

COMMENT ON FUNCTION public.user_can_view_project(UUID, UUID) IS
  'SECURITY DEFINER function to check if user can view a project without triggering RLS recursion';

-- ============================================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- Chat Histories Policies
CREATE POLICY "Enable all access for authenticated users"
  ON public.chat_histories FOR ALL
  USING (true) WITH CHECK (true);

CREATE POLICY "Users can view workspace-shared project chat histories non-recursive"
  ON public.chat_histories FOR SELECT
  USING (has_workspace_access_to_project(project_id, auth.uid()));

CREATE POLICY "Users can update workspace-shared project chat histories with edit non-recursive"
  ON public.chat_histories FOR UPDATE
  USING (has_workspace_access_to_project(project_id, auth.uid(), 'edit'))
  WITH CHECK (has_workspace_access_to_project(project_id, auth.uid(), 'edit'));

CREATE POLICY "Users can delete workspace-shared project chat histories with edit non-recursive"
  ON public.chat_histories FOR DELETE
  USING (has_workspace_access_to_project(project_id, auth.uid(), 'edit'));

-- Daemon Auth Sessions Policies
CREATE POLICY "Users can read own auth sessions"
  ON public.daemon_auth_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own auth sessions"
  ON public.daemon_auth_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own auth sessions"
  ON public.daemon_auth_sessions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Daemons can poll for their own auth sessions"
  ON public.daemon_auth_sessions FOR SELECT
  USING (device_id IS NOT NULL);

CREATE POLICY "Daemons can mark their auth sessions as consumed"
  ON public.daemon_auth_sessions FOR UPDATE
  USING (device_id IS NOT NULL)
  WITH CHECK (device_id IS NOT NULL);

-- Projects Policies
CREATE POLICY "Users can view own projects"
  ON public.projects FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view shared projects"
  ON public.projects FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.project_shares
      WHERE project_shares.project_id = projects.id
      AND project_shares.shared_with_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view org-shared projects"
  ON public.projects FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.project_organization_shares
      WHERE project_organization_shares.project_id = projects.id
    )
  );

CREATE POLICY "Users can view their projects and shared projects non-recursive"
  ON public.projects FOR SELECT
  USING (user_can_view_project(id, auth.uid()));

CREATE POLICY "Users can create own projects"
  ON public.projects FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own projects"
  ON public.projects FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update projects with edit permission"
  ON public.projects FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.project_shares
      WHERE project_shares.project_id = projects.id
      AND project_shares.shared_with_user_id = auth.uid()
      AND project_shares.permission_level = 'edit'
    )
  );

CREATE POLICY "Users can delete own projects"
  ON public.projects FOR DELETE
  USING (auth.uid() = user_id);

-- Project Shares Policies
CREATE POLICY "Project owners can view shares"
  ON public.project_shares FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = project_shares.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view their received shares"
  ON public.project_shares FOR SELECT
  USING (shared_with_user_id = auth.uid());

CREATE POLICY "Project owners can create shares"
  ON public.project_shares FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = project_shares.project_id
      AND projects.user_id = auth.uid()
    )
    AND shared_by_user_id = auth.uid()
  );

CREATE POLICY "Project owners can delete shares"
  ON public.project_shares FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = project_shares.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can remove their received shares"
  ON public.project_shares FOR DELETE
  USING (shared_with_user_id = auth.uid());

-- Project Organization Shares Policies
CREATE POLICY "Project owners can view org shares"
  ON public.project_organization_shares FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = project_organization_shares.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Project owners can create org shares"
  ON public.project_organization_shares FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = project_organization_shares.project_id
      AND projects.user_id = auth.uid()
    )
    AND shared_by_user_id = auth.uid()
  );

CREATE POLICY "Project owners can delete org shares"
  ON public.project_organization_shares FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = project_organization_shares.project_id
      AND projects.user_id = auth.uid()
    )
  );

-- Active Sessions Policies
CREATE POLICY "Users can view own active sessions"
  ON public.active_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view active sessions of shared projects"
  ON public.active_sessions FOR SELECT
  USING (
    project_id IN (
      SELECT project_id
      FROM public.project_shares
      WHERE shared_with_user_id = auth.uid()
    )
  );

-- User Canvas Layouts Policies
CREATE POLICY "Users can view their own canvas layouts"
  ON public.user_canvas_layouts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own canvas layouts"
  ON public.user_canvas_layouts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own canvas layouts"
  ON public.user_canvas_layouts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own canvas layouts"
  ON public.user_canvas_layouts FOR DELETE
  USING (auth.uid() = user_id);

-- Workspace Members Policies
CREATE POLICY "Users can view workspace members non-recursive"
  ON public.workspace_members FOR SELECT
  USING (
    user_id = auth.uid()
    OR is_workspace_member(workspace_id, auth.uid())
  );

CREATE POLICY "Owners and admins can invite members non-recursive"
  ON public.workspace_members FOR INSERT
  WITH CHECK (is_workspace_admin(workspace_id, auth.uid()));

CREATE POLICY "Owners and admins can update member roles non-recursive"
  ON public.workspace_members FOR UPDATE
  USING (
    is_workspace_admin(workspace_id, auth.uid())
    AND NOT (role = 'owner' AND user_id = auth.uid())
    AND invitation_status = 'accepted'
  )
  WITH CHECK (is_workspace_admin(workspace_id, auth.uid()));

CREATE POLICY "Members and invitations can be removed non-recursive"
  ON public.workspace_members FOR DELETE
  USING (
    user_id = auth.uid()
    OR is_workspace_admin(workspace_id, auth.uid())
  );

-- Project Workspace Shares Policies
CREATE POLICY "Users can view workspace shares for accessible projects non-recursive"
  ON public.project_workspace_shares FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_workspace_shares.project_id
        AND p.user_id = auth.uid()
    )
    OR is_workspace_member(workspace_id, auth.uid())
  );
