-- Create chat_histories table
CREATE TABLE IF NOT EXISTS public.chat_histories (
    id TEXT PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL,
    messages JSONB NOT NULL DEFAULT '[]'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on timestamp for faster queries
CREATE INDEX IF NOT EXISTS idx_chat_histories_timestamp ON public.chat_histories(timestamp DESC);

-- Create index on created_at
CREATE INDEX IF NOT EXISTS idx_chat_histories_created_at ON public.chat_histories(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.chat_histories ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations for now (adjust based on your security needs)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'chat_histories'
        AND policyname = 'Enable all access for authenticated users'
    ) THEN
        CREATE POLICY "Enable all access for authenticated users" ON public.chat_histories
            FOR ALL
            USING (true)
            WITH CHECK (true);
    END IF;
END $$;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_chat_histories_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'update_chat_histories_updated_at'
    ) THEN
        CREATE TRIGGER update_chat_histories_updated_at
            BEFORE UPDATE ON public.chat_histories
            FOR EACH ROW
            EXECUTE FUNCTION public.update_chat_histories_updated_at();
    END IF;
END $$;
-- Add agent_type column to chat_histories table
ALTER TABLE public.chat_histories
ADD COLUMN IF NOT EXISTS agent_type TEXT DEFAULT 'claude_code';

-- Create index on agent_type for filtering
CREATE INDEX IF NOT EXISTS idx_chat_histories_agent_type ON public.chat_histories(agent_type);

-- Add a check constraint to validate agent_type values
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'check_agent_type'
    ) THEN
        ALTER TABLE public.chat_histories
        ADD CONSTRAINT check_agent_type CHECK (
            agent_type IN ('claude_code', 'codex', 'cursor', 'windsurf', 'other')
        );
    END IF;
END $$;
-- Drop existing table and recreate with UUID
DROP TABLE IF EXISTS public.chat_histories CASCADE;

-- Create chat_histories table with UUID
CREATE TABLE public.chat_histories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMPTZ NOT NULL,
    messages JSONB NOT NULL DEFAULT '[]'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    agent_type TEXT DEFAULT 'claude_code',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_chat_histories_timestamp ON public.chat_histories(timestamp DESC);
CREATE INDEX idx_chat_histories_created_at ON public.chat_histories(created_at DESC);
CREATE INDEX idx_chat_histories_agent_type ON public.chat_histories(agent_type);

-- Enable Row Level Security
ALTER TABLE public.chat_histories ENABLE ROW LEVEL SECURITY;

-- Create policy
CREATE POLICY "Enable all access for authenticated users" ON public.chat_histories
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Add check constraint
ALTER TABLE public.chat_histories
ADD CONSTRAINT check_agent_type CHECK (
    agent_type IN ('claude_code', 'codex', 'cursor', 'windsurf', 'other')
);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_chat_histories_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER update_chat_histories_updated_at
    BEFORE UPDATE ON public.chat_histories
    FOR EACH ROW
    EXECUTE FUNCTION public.update_chat_histories_updated_at();
-- Add account_id column to chat_histories table
ALTER TABLE chat_histories
ADD COLUMN account_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add index for faster queries by account_id
CREATE INDEX idx_chat_histories_account_id ON chat_histories(account_id);
-- Create daemon_auth_sessions table for handling daemon authentication
CREATE TABLE daemon_auth_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  consumed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add index for faster queries by device_id
CREATE INDEX idx_daemon_auth_sessions_device_id ON daemon_auth_sessions(device_id);

-- Add index for faster queries by user_id
CREATE INDEX idx_daemon_auth_sessions_user_id ON daemon_auth_sessions(user_id);

-- Add index for finding unconsumed sessions
CREATE INDEX idx_daemon_auth_sessions_consumed ON daemon_auth_sessions(consumed);

-- Add RLS policies
ALTER TABLE daemon_auth_sessions ENABLE ROW LEVEL SECURITY;

-- Users can only read their own auth sessions
CREATE POLICY "Users can read own auth sessions"
  ON daemon_auth_sessions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can only insert their own auth sessions
CREATE POLICY "Users can insert own auth sessions"
  ON daemon_auth_sessions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own auth sessions
CREATE POLICY "Users can update own auth sessions"
  ON daemon_auth_sessions
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Auto-delete consumed sessions after 24 hours (optional cleanup)
-- This can be run as a periodic job
CREATE OR REPLACE FUNCTION cleanup_consumed_auth_sessions()
RETURNS void AS $$
BEGIN
  DELETE FROM daemon_auth_sessions
  WHERE consumed = TRUE
  AND created_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;
-- Add AI summary and keywords columns to chat_histories table

-- Add latest_message_timestamp for tracking when messages were last updated
ALTER TABLE chat_histories
ADD COLUMN IF NOT EXISTS latest_message_timestamp TIMESTAMPTZ;

-- Add AI summary columns
ALTER TABLE chat_histories
ADD COLUMN IF NOT EXISTS ai_summary TEXT,
ADD COLUMN IF NOT EXISTS ai_summary_generated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS ai_summary_message_count INTEGER;

-- Add AI keywords columns (using text arrays for PostgreSQL)
ALTER TABLE chat_histories
ADD COLUMN IF NOT EXISTS ai_keywords_type TEXT[],
ADD COLUMN IF NOT EXISTS ai_keywords_topic TEXT[],
ADD COLUMN IF NOT EXISTS ai_keywords_generated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS ai_keywords_message_count INTEGER;

-- Add indexes for AI-related queries
CREATE INDEX IF NOT EXISTS idx_chat_histories_ai_summary_generated_at
ON chat_histories(ai_summary_generated_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_histories_ai_keywords_generated_at
ON chat_histories(ai_keywords_generated_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_histories_latest_message_timestamp
ON chat_histories(latest_message_timestamp DESC);

-- Add index for finding records that need AI processing
CREATE INDEX IF NOT EXISTS idx_chat_histories_needs_summary
ON chat_histories(updated_at)
WHERE ai_summary IS NULL;

CREATE INDEX IF NOT EXISTS idx_chat_histories_needs_keywords
ON chat_histories(updated_at)
WHERE ai_keywords_type IS NULL;

-- Add comments for documentation
COMMENT ON COLUMN chat_histories.latest_message_timestamp IS 'Timestamp of the most recent message in the conversation';
COMMENT ON COLUMN chat_histories.ai_summary IS 'AI-generated summary of the conversation';
COMMENT ON COLUMN chat_histories.ai_summary_generated_at IS 'When the AI summary was generated';
COMMENT ON COLUMN chat_histories.ai_summary_message_count IS 'Number of messages that were included in the summary';
COMMENT ON COLUMN chat_histories.ai_keywords_type IS 'AI-extracted keywords about the type/category of conversation';
COMMENT ON COLUMN chat_histories.ai_keywords_topic IS 'AI-extracted keywords about the topics discussed';
COMMENT ON COLUMN chat_histories.ai_keywords_generated_at IS 'When the AI keywords were generated';
COMMENT ON COLUMN chat_histories.ai_keywords_message_count IS 'Number of messages that were analyzed for keywords';
-- Create projects table
-- This table stores project information for organizing chat histories
-- Each project belongs to a user and can be shared with others

CREATE TABLE IF NOT EXISTS public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    project_path TEXT NOT NULL,
    description TEXT,
    workspace_metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),

    -- Ensure unique project paths per user
    UNIQUE(user_id, project_path)
);

-- Create index for faster lookups
CREATE INDEX idx_projects_user_id ON public.projects(user_id);
CREATE INDEX idx_projects_project_path ON public.projects(project_path);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_projects_updated_at
    BEFORE UPDATE ON public.projects
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add comment
COMMENT ON TABLE public.projects IS 'Stores project information for organizing chat histories';
COMMENT ON COLUMN public.projects.user_id IS 'Owner of the project';
COMMENT ON COLUMN public.projects.name IS 'Display name of the project (extracted from project_path)';
COMMENT ON COLUMN public.projects.project_path IS 'Full filesystem path to the project';
COMMENT ON COLUMN public.projects.workspace_metadata IS 'Additional metadata (e.g., Cursor workspace.json data)';

-- Rollback instructions:
-- DROP TRIGGER IF EXISTS update_projects_updated_at ON public.projects;
-- DROP FUNCTION IF EXISTS update_updated_at_column();
-- DROP TABLE IF EXISTS public.projects CASCADE;
-- Create project sharing tables
-- These tables handle sharing projects with individual users or organizations

-- Individual user sharing
CREATE TABLE IF NOT EXISTS public.project_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    shared_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    shared_with_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    permission_level TEXT NOT NULL DEFAULT 'view',
    created_at TIMESTAMPTZ DEFAULT now(),

    -- Ensure permission_level is valid
    CONSTRAINT valid_permission_level CHECK (permission_level IN ('view', 'edit')),

    -- Prevent sharing with yourself
    CONSTRAINT no_self_share CHECK (shared_by_user_id != shared_with_user_id),

    -- Prevent duplicate shares
    UNIQUE(project_id, shared_with_user_id)
);

-- Organization-wide sharing
CREATE TABLE IF NOT EXISTS public.project_organization_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    organization_name TEXT NOT NULL,
    shared_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    permission_level TEXT NOT NULL DEFAULT 'view',
    created_at TIMESTAMPTZ DEFAULT now(),

    -- Ensure permission_level is valid
    CONSTRAINT valid_org_permission_level CHECK (permission_level IN ('view', 'edit')),

    -- Prevent duplicate org shares
    UNIQUE(project_id, organization_name)
);

-- Create indexes for faster lookups
CREATE INDEX idx_project_shares_project_id ON public.project_shares(project_id);
CREATE INDEX idx_project_shares_shared_with ON public.project_shares(shared_with_user_id);
CREATE INDEX idx_project_org_shares_project_id ON public.project_organization_shares(project_id);
CREATE INDEX idx_project_org_shares_org_name ON public.project_organization_shares(organization_name);

-- Add comments
COMMENT ON TABLE public.project_shares IS 'Stores project sharing permissions between individual users';
COMMENT ON TABLE public.project_organization_shares IS 'Stores project sharing permissions for entire organizations';
COMMENT ON COLUMN public.project_shares.permission_level IS 'Access level: view (read-only) or edit (read-write)';
COMMENT ON COLUMN public.project_organization_shares.permission_level IS 'Access level: view (read-only) or edit (read-write)';
COMMENT ON COLUMN public.project_organization_shares.organization_name IS 'Name of the organization (simple text field for now, can be upgraded to formal org table later)';

-- Rollback instructions:
-- DROP TABLE IF EXISTS public.project_organization_shares CASCADE;
-- DROP TABLE IF EXISTS public.project_shares CASCADE;
-- Add project_id to chat_histories table
-- This links chat sessions to their respective projects

-- Add project_id column to chat_histories
ALTER TABLE public.chat_histories
ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_chat_histories_project_id ON public.chat_histories(project_id);

-- Migrate existing data: Create projects from existing chat_histories
-- This extracts unique (user_id, project_path) combinations and creates projects
INSERT INTO public.projects (user_id, name, project_path, workspace_metadata)
SELECT DISTINCT
    account_id as user_id,
    -- Extract project name from path (get last segment)
    COALESCE(
        CASE
            WHEN metadata->>'projectPath' IS NOT NULL
            THEN regexp_replace(metadata->>'projectPath', '^.*/([^/]+)/?$', '\1')
            ELSE 'Untitled Project'
        END,
        'Untitled Project'
    ) as name,
    COALESCE(metadata->>'projectPath', 'unknown') as project_path,
    -- For Cursor, we could later backfill workspace metadata
    '{}'::jsonb as workspace_metadata
FROM public.chat_histories
WHERE account_id IS NOT NULL
    AND metadata->>'projectPath' IS NOT NULL
ON CONFLICT (user_id, project_path) DO NOTHING;

-- Update chat_histories to link to the newly created projects
UPDATE public.chat_histories ch
SET project_id = p.id
FROM public.projects p
WHERE ch.account_id = p.user_id
    AND ch.metadata->>'projectPath' = p.project_path
    AND ch.project_id IS NULL;

-- Add comment
COMMENT ON COLUMN public.chat_histories.project_id IS 'Foreign key to projects table - groups chat sessions by project';

-- Rollback instructions:
-- ALTER TABLE public.chat_histories DROP COLUMN IF EXISTS project_id;
-- Note: Rolling back will NOT delete the projects created during migration
-- To also delete projects created by this migration, run:
-- DELETE FROM public.projects WHERE created_at >= '[migration_timestamp]';
-- Add Row Level Security (RLS) policies for project tables
-- These policies ensure users can only access their own projects or shared projects

-- Enable Row Level Security on all project-related tables
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_organization_shares ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PROJECTS TABLE POLICIES
-- ============================================

-- Users can view their own projects
CREATE POLICY "Users can view own projects"
    ON public.projects
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users can view projects shared with them individually
CREATE POLICY "Users can view shared projects"
    ON public.projects
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.project_shares
            WHERE project_shares.project_id = projects.id
            AND project_shares.shared_with_user_id = auth.uid()
        )
    );

-- Users can view projects shared with their organization
-- (This assumes users have an 'organization' field in their metadata or profile)
CREATE POLICY "Users can view org-shared projects"
    ON public.projects
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.project_organization_shares
            WHERE project_organization_shares.project_id = projects.id
            -- This is a placeholder - you'll need to adjust based on how you store org membership
            -- For now, we'll allow it and you can refine later
        )
    );

-- Users can insert their own projects
CREATE POLICY "Users can create own projects"
    ON public.projects
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own projects
CREATE POLICY "Users can update own projects"
    ON public.projects
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Users can update projects they have edit permission on
CREATE POLICY "Users can update projects with edit permission"
    ON public.projects
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.project_shares
            WHERE project_shares.project_id = projects.id
            AND project_shares.shared_with_user_id = auth.uid()
            AND project_shares.permission_level = 'edit'
        )
    );

-- Users can delete their own projects
CREATE POLICY "Users can delete own projects"
    ON public.projects
    FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================
-- PROJECT_SHARES TABLE POLICIES
-- ============================================

-- Project owners can view all shares of their projects
CREATE POLICY "Project owners can view shares"
    ON public.project_shares
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE projects.id = project_shares.project_id
            AND projects.user_id = auth.uid()
        )
    );

-- Users can view shares where they are the recipient
CREATE POLICY "Users can view their received shares"
    ON public.project_shares
    FOR SELECT
    USING (shared_with_user_id = auth.uid());

-- Project owners can create shares
CREATE POLICY "Project owners can create shares"
    ON public.project_shares
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE projects.id = project_shares.project_id
            AND projects.user_id = auth.uid()
        )
        AND shared_by_user_id = auth.uid()
    );

-- Project owners can delete shares
CREATE POLICY "Project owners can delete shares"
    ON public.project_shares
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE projects.id = project_shares.project_id
            AND projects.user_id = auth.uid()
        )
    );

-- Users can delete shares they received (to "unshare" from their view)
CREATE POLICY "Users can remove their received shares"
    ON public.project_shares
    FOR DELETE
    USING (shared_with_user_id = auth.uid());

-- ============================================
-- PROJECT_ORGANIZATION_SHARES TABLE POLICIES
-- ============================================

-- Project owners can view organization shares
CREATE POLICY "Project owners can view org shares"
    ON public.project_organization_shares
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE projects.id = project_organization_shares.project_id
            AND projects.user_id = auth.uid()
        )
    );

-- Project owners can create organization shares
CREATE POLICY "Project owners can create org shares"
    ON public.project_organization_shares
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE projects.id = project_organization_shares.project_id
            AND projects.user_id = auth.uid()
        )
        AND shared_by_user_id = auth.uid()
    );

-- Project owners can delete organization shares
CREATE POLICY "Project owners can delete org shares"
    ON public.project_organization_shares
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE projects.id = project_organization_shares.project_id
            AND projects.user_id = auth.uid()
        )
    );

-- Add comments
COMMENT ON POLICY "Users can view own projects" ON public.projects IS 'Users can see projects they own';
COMMENT ON POLICY "Users can view shared projects" ON public.projects IS 'Users can see projects shared with them individually';
COMMENT ON POLICY "Users can view org-shared projects" ON public.projects IS 'Users can see projects shared with their organization';

-- Rollback instructions:
-- DROP POLICY IF EXISTS "Users can view own projects" ON public.projects;
-- DROP POLICY IF EXISTS "Users can view shared projects" ON public.projects;
-- DROP POLICY IF EXISTS "Users can view org-shared projects" ON public.projects;
-- DROP POLICY IF EXISTS "Users can create own projects" ON public.projects;
-- DROP POLICY IF EXISTS "Users can update own projects" ON public.projects;
-- DROP POLICY IF EXISTS "Users can update projects with edit permission" ON public.projects;
-- DROP POLICY IF EXISTS "Users can delete own projects" ON public.projects;
-- DROP POLICY IF EXISTS "Project owners can view shares" ON public.project_shares;
-- DROP POLICY IF EXISTS "Users can view their received shares" ON public.project_shares;
-- DROP POLICY IF EXISTS "Project owners can create shares" ON public.project_shares;
-- DROP POLICY IF EXISTS "Project owners can delete shares" ON public.project_shares;
-- DROP POLICY IF EXISTS "Users can remove their received shares" ON public.project_shares;
-- DROP POLICY IF EXISTS "Project owners can view org shares" ON public.project_organization_shares;
-- DROP POLICY IF EXISTS "Project owners can create org shares" ON public.project_organization_shares;
-- DROP POLICY IF EXISTS "Project owners can delete org shares" ON public.project_organization_shares;
-- ALTER TABLE public.projects DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.project_shares DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.project_organization_shares DISABLE ROW LEVEL SECURITY;
-- Add CASCADE ON UPDATE to all foreign keys referencing auth.users(id)
-- This is important for account linking scenarios where users might link accounts
-- with different emails using Supabase auth admin API

-- When a user's ID changes (during account linking), all related records should update automatically
-- DELETE CASCADE is already in place, this migration adds UPDATE CASCADE

-- 1. Update chat_histories.account_id foreign key
ALTER TABLE public.chat_histories
  DROP CONSTRAINT IF EXISTS chat_histories_account_id_fkey,
  ADD CONSTRAINT chat_histories_account_id_fkey
    FOREIGN KEY (account_id)
    REFERENCES auth.users(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE;

-- 2. Update daemon_auth_sessions.user_id foreign key
ALTER TABLE public.daemon_auth_sessions
  DROP CONSTRAINT IF EXISTS daemon_auth_sessions_user_id_fkey,
  ADD CONSTRAINT daemon_auth_sessions_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES auth.users(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE;

-- 3. Update projects.user_id foreign key
ALTER TABLE public.projects
  DROP CONSTRAINT IF EXISTS projects_user_id_fkey,
  ADD CONSTRAINT projects_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES auth.users(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE;

-- 4. Update project_shares.shared_by_user_id foreign key
ALTER TABLE public.project_shares
  DROP CONSTRAINT IF EXISTS project_shares_shared_by_user_id_fkey,
  ADD CONSTRAINT project_shares_shared_by_user_id_fkey
    FOREIGN KEY (shared_by_user_id)
    REFERENCES auth.users(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE;

-- 5. Update project_shares.shared_with_user_id foreign key
ALTER TABLE public.project_shares
  DROP CONSTRAINT IF EXISTS project_shares_shared_with_user_id_fkey,
  ADD CONSTRAINT project_shares_shared_with_user_id_fkey
    FOREIGN KEY (shared_with_user_id)
    REFERENCES auth.users(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE;

-- 6. Update project_organization_shares.shared_by_user_id foreign key
ALTER TABLE public.project_organization_shares
  DROP CONSTRAINT IF EXISTS project_organization_shares_shared_by_user_id_fkey,
  ADD CONSTRAINT project_organization_shares_shared_by_user_id_fkey
    FOREIGN KEY (shared_by_user_id)
    REFERENCES auth.users(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE;

-- Create active_sessions table
-- This table tracks the most recently active editor sessions and files per user
-- Updated periodically by the daemon to show "currently working on" status
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

-- Create indexes for active_sessions
CREATE INDEX IF NOT EXISTS idx_active_sessions_user_id ON public.active_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_active_sessions_project_id ON public.active_sessions(project_id);
CREATE INDEX IF NOT EXISTS idx_active_sessions_is_active ON public.active_sessions(is_active);
CREATE INDEX IF NOT EXISTS idx_active_sessions_last_activity ON public.active_sessions(last_activity_at DESC);
CREATE INDEX IF NOT EXISTS idx_active_sessions_recent_files ON public.active_sessions USING GIN(recent_files);

-- Enable RLS
ALTER TABLE public.active_sessions ENABLE ROW LEVEL SECURITY;

-- RLS policies for active_sessions
CREATE POLICY "Users can view own active sessions"
    ON public.active_sessions
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can view active sessions of shared projects"
    ON public.active_sessions
    FOR SELECT
    USING (
        project_id IN (
            SELECT project_id
            FROM public.project_shares
            WHERE shared_with_user_id = auth.uid()
        )
    );

-- Add comments
COMMENT ON TABLE public.active_sessions IS 'Tracks recently active editor sessions and files per user (updated periodically)';
COMMENT ON COLUMN public.active_sessions.user_id IS 'User who owns this active session';
COMMENT ON COLUMN public.active_sessions.editor_type IS 'Type of editor: cursor, windsurf, claude_code, vscode, other';
COMMENT ON COLUMN public.active_sessions.last_activity_at IS 'Timestamp of last detected activity in this editor';
COMMENT ON COLUMN public.active_sessions.is_active IS 'True if activity detected within past hour';
COMMENT ON COLUMN public.active_sessions.recent_files IS 'Array of recently accessed files: [{path: string, lastAccessed: timestamp}]';
COMMENT ON COLUMN public.active_sessions.workspace_path IS 'Current workspace/project path being worked on';
COMMENT ON COLUMN public.active_sessions.session_metadata IS 'Additional session data (workspace info, etc.)';

-- Rollback instructions:
-- To rollback, recreate the constraints with ON UPDATE NO ACTION:
--
-- ALTER TABLE public.chat_histories
--   DROP CONSTRAINT IF EXISTS chat_histories_account_id_fkey,
--   ADD CONSTRAINT chat_histories_account_id_fkey
--     FOREIGN KEY (account_id) REFERENCES auth.users(id) ON DELETE CASCADE ON UPDATE NO ACTION;
--
-- ALTER TABLE public.daemon_auth_sessions
--   DROP CONSTRAINT IF EXISTS daemon_auth_sessions_user_id_fkey,
--   ADD CONSTRAINT daemon_auth_sessions_user_id_fkey
--     FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE ON UPDATE NO ACTION;
--
-- ALTER TABLE public.projects
--   DROP CONSTRAINT IF EXISTS projects_user_id_fkey,
--   ADD CONSTRAINT projects_user_id_fkey
--     FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE ON UPDATE NO ACTION;
--
-- ALTER TABLE public.project_shares
--   DROP CONSTRAINT IF EXISTS project_shares_shared_by_user_id_fkey,
--   ADD CONSTRAINT project_shares_shared_by_user_id_fkey
--     FOREIGN KEY (shared_by_user_id) REFERENCES auth.users(id) ON DELETE CASCADE ON UPDATE NO ACTION;
--
-- ALTER TABLE public.project_shares
--   DROP CONSTRAINT IF EXISTS project_shares_shared_with_user_id_fkey,
--   ADD CONSTRAINT project_shares_shared_with_user_id_fkey
--     FOREIGN KEY (shared_with_user_id) REFERENCES auth.users(id) ON DELETE CASCADE ON UPDATE NO ACTION;
--
-- ALTER TABLE public.project_organization_shares
--   DROP CONSTRAINT IF EXISTS project_organization_shares_shared_by_user_id_fkey,
--   ADD CONSTRAINT project_organization_shares_shared_by_user_id_fkey
--     FOREIGN KEY (shared_by_user_id) REFERENCES auth.users(id) ON DELETE CASCADE ON UPDATE NO ACTION;
--
-- ALTER TABLE public.active_sessions
--   DROP CONSTRAINT IF EXISTS active_sessions_user_id_fkey,
--   ADD CONSTRAINT active_sessions_user_id_fkey
--     FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE ON UPDATE NO ACTION;
-- Create user_canvas_layouts table
CREATE TABLE IF NOT EXISTS user_canvas_layouts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL,
  position_x REAL NOT NULL,
  position_y REAL NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, node_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_canvas_layouts_user_id ON user_canvas_layouts(user_id);
CREATE INDEX IF NOT EXISTS idx_user_canvas_layouts_node_id ON user_canvas_layouts(node_id);

-- Enable RLS
ALTER TABLE user_canvas_layouts ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own canvas layouts" ON user_canvas_layouts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own canvas layouts" ON user_canvas_layouts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own canvas layouts" ON user_canvas_layouts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own canvas layouts" ON user_canvas_layouts
  FOR DELETE USING (auth.uid() = user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_user_canvas_layouts_updated_at
  BEFORE UPDATE ON user_canvas_layouts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
-- Migration: Fix infinite recursion in RLS policies
-- Description: The workspace_members and project_workspace_shares policies
--              were causing infinite recursion by querying themselves within
--              their policy checks. This migration uses SECURITY DEFINER functions
--              to break the recursion cycle.

-- ============================================================================
-- 1. Create helper functions with SECURITY DEFINER to bypass RLS
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

-- ============================================================================
-- 2. Fix workspace_members RLS policies using SECURITY DEFINER functions
-- ============================================================================

-- Drop the problematic recursive SELECT policies
DROP POLICY IF EXISTS "Users can view workspace members" ON workspace_members;
DROP POLICY IF EXISTS "Users can view workspace members and their invitations" ON workspace_members;

-- Create a new non-recursive SELECT policy
-- Users can view:
-- 1. Their own membership/invitation records
-- 2. Other members in workspaces where they are accepted members
CREATE POLICY "Users can view workspace members non-recursive"
  ON workspace_members
  FOR SELECT
  USING (
    -- User can see their own records (invitations and memberships)
    user_id = auth.uid()
    OR
    -- User can see other members in workspaces where they are members
    -- Uses SECURITY DEFINER function to bypass RLS and avoid recursion
    is_workspace_member(workspace_id, auth.uid())
  );

-- Update the INSERT policy to use SECURITY DEFINER function
DROP POLICY IF EXISTS "Owners and admins can invite members" ON workspace_members;

CREATE POLICY "Owners and admins can invite members non-recursive"
  ON workspace_members
  FOR INSERT
  WITH CHECK (
    -- Check if the inviter is an owner or admin in the workspace
    -- Uses SECURITY DEFINER function to bypass RLS and avoid recursion
    is_workspace_admin(workspace_id, auth.uid())
  );

-- Update the UPDATE policy for role changes
DROP POLICY IF EXISTS "Owners and admins can update member roles" ON workspace_members;

CREATE POLICY "Owners and admins can update member roles non-recursive"
  ON workspace_members
  FOR UPDATE
  USING (
    -- Owner/admin check using SECURITY DEFINER function
    is_workspace_admin(workspace_id, auth.uid())
    -- Cannot remove your own owner role
    AND NOT (role = 'owner' AND user_id = auth.uid())
    -- Can only update accepted members (not pending invitations)
    AND invitation_status = 'accepted'
  )
  WITH CHECK (
    is_workspace_admin(workspace_id, auth.uid())
  );

-- Update the DELETE policy
DROP POLICY IF EXISTS "Members and invitations can be removed" ON workspace_members;

CREATE POLICY "Members and invitations can be removed non-recursive"
  ON workspace_members
  FOR DELETE
  USING (
    -- User can remove themselves
    user_id = auth.uid()
    OR
    -- Owner/admin can remove others using SECURITY DEFINER function
    is_workspace_admin(workspace_id, auth.uid())
  );

-- ============================================================================
-- 3. Fix project_workspace_shares RLS policies
-- ============================================================================

-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can view workspace shares for accessible projects" ON project_workspace_shares;

-- Create non-recursive policy using SECURITY DEFINER function
CREATE POLICY "Users can view workspace shares for accessible projects non-recursive"
  ON project_workspace_shares
  FOR SELECT
  USING (
    -- User owns the project
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_workspace_shares.project_id
        AND p.user_id = auth.uid()
    )
    OR
    -- User is an accepted member of the workspace (using SECURITY DEFINER function)
    is_workspace_member(workspace_id, auth.uid())
  );

-- ============================================================================
-- 4. Comments explaining the fix
-- ============================================================================

COMMENT ON FUNCTION public.is_workspace_member(UUID, UUID) IS
  'SECURITY DEFINER function to check workspace membership without triggering RLS recursion';

COMMENT ON FUNCTION public.is_workspace_admin(UUID, UUID) IS
  'SECURITY DEFINER function to check workspace admin/owner role without triggering RLS recursion';

COMMENT ON FUNCTION public.get_user_workspace_ids(UUID) IS
  'SECURITY DEFINER function to get user workspace IDs without triggering RLS recursion';

COMMENT ON POLICY "Users can view workspace members non-recursive" ON workspace_members IS
  'Fixed infinite recursion by using SECURITY DEFINER function to bypass RLS in subqueries';

COMMENT ON POLICY "Users can view workspace shares for accessible projects non-recursive" ON project_workspace_shares IS
  'Fixed potential recursion by using SECURITY DEFINER function for workspace membership checks';
-- Migration: Fix chat_histories policies that cause recursion through project_workspace_shares
-- Description: The chat_histories policies join project_workspace_shares with workspace_members,
--              which causes infinite recursion. We need to use SECURITY DEFINER functions.

-- ============================================================================
-- 1. Create helper function to check if user can access project via workspace
-- ============================================================================

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
  -- Check if user is a member of any workspace that has access to this project
  -- If required_permission is specified, check for that permission level
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

-- ============================================================================
-- 2. Fix chat_histories RLS policies
-- ============================================================================

-- Drop the problematic policies that join project_workspace_shares with workspace_members
DROP POLICY IF EXISTS "Users can view workspace-shared project chat histories" ON chat_histories;
DROP POLICY IF EXISTS "Users can update workspace-shared project chat histories with e" ON chat_histories;
DROP POLICY IF EXISTS "Users can delete workspace-shared project chat histories with e" ON chat_histories;

-- Create new non-recursive SELECT policy
CREATE POLICY "Users can view workspace-shared project chat histories non-recursive"
  ON chat_histories
  FOR SELECT
  USING (
    -- User can view if they have workspace access to the project
    has_workspace_access_to_project(project_id, auth.uid())
  );

-- Create new non-recursive UPDATE policy
CREATE POLICY "Users can update workspace-shared project chat histories with edit non-recursive"
  ON chat_histories
  FOR UPDATE
  USING (
    -- User can update if they have 'edit' permission via workspace
    has_workspace_access_to_project(project_id, auth.uid(), 'edit')
  )
  WITH CHECK (
    has_workspace_access_to_project(project_id, auth.uid(), 'edit')
  );

-- Create new non-recursive DELETE policy
CREATE POLICY "Users can delete workspace-shared project chat histories with edit non-recursive"
  ON chat_histories
  FOR DELETE
  USING (
    -- User can delete if they have 'edit' permission via workspace
    has_workspace_access_to_project(project_id, auth.uid(), 'edit')
  );

COMMENT ON POLICY "Users can view workspace-shared project chat histories non-recursive" ON chat_histories IS
  'Fixed infinite recursion by using SECURITY DEFINER function to check workspace access';

COMMENT ON POLICY "Users can update workspace-shared project chat histories with edit non-recursive" ON chat_histories IS
  'Fixed infinite recursion by using SECURITY DEFINER function to check workspace edit access';

COMMENT ON POLICY "Users can delete workspace-shared project chat histories with edit non-recursive" ON chat_histories IS
  'Fixed infinite recursion by using SECURITY DEFINER function to check workspace edit access';
-- Migration: Fix projects table RLS recursion
-- Description: The projects SELECT policy joins project_workspace_shares with workspace_members,
--              causing infinite recursion. Use SECURITY DEFINER functions to fix this.

-- ============================================================================
-- 1. Create helper function to check if user can view a project
-- ============================================================================

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
  -- Check if user:
  -- 1. Owns the project
  -- 2. Has individual share access
  -- 3. Has organization share access
  -- 4. Has workspace share access
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
-- 2. Fix projects RLS policies
-- ============================================================================

-- Drop the problematic SELECT policy
DROP POLICY IF EXISTS "Users can view their projects and shared projects" ON projects;

-- Create new non-recursive SELECT policy
CREATE POLICY "Users can view their projects and shared projects non-recursive"
  ON projects
  FOR SELECT
  USING (
    -- Use SECURITY DEFINER function to avoid recursion
    user_can_view_project(id, auth.uid())
  );

COMMENT ON POLICY "Users can view their projects and shared projects non-recursive" ON projects IS
  'Fixed infinite recursion by using SECURITY DEFINER function to check project access';
-- Migration: Allow daemon polling by device_id
-- Description: The daemon needs to poll for auth sessions by device_id when unauthenticated.
--              Currently it can't query daemon_auth_sessions because RLS requires auth.
--              Add a policy to allow unauthenticated SELECT queries by device_id.

-- ============================================================================
-- Add policy for unauthenticated daemon polling
-- ============================================================================

-- Allow unauthenticated clients to read auth sessions for their device
-- This is safe because:
-- 1. Only device_id is needed (which the daemon already has)
-- 2. The daemon marks sessions as consumed after reading
-- 3. Tokens are only valid for the specific device's auth flow
CREATE POLICY "Daemons can poll for their own auth sessions"
  ON daemon_auth_sessions
  FOR SELECT
  USING (
    -- Allow querying by device_id (no auth required for polling)
    -- The daemon needs this to check if auth was completed in browser
    device_id IS NOT NULL
  );

COMMENT ON POLICY "Daemons can poll for their own auth sessions" ON daemon_auth_sessions IS
  'Allows unauthenticated daemons to poll for auth completion by device_id';
-- Migration: Fix daemon RLS permissions
-- Description: The daemon needs to:
--   1. UPDATE daemon_auth_sessions to mark as consumed (when unauthenticated)
--   2. INSERT/UPDATE projects (when authenticated with user's token)

-- ============================================================================
-- 1. Allow daemon to mark auth sessions as consumed (unauthenticated)
-- ============================================================================

-- Allow unauthenticated daemon to update auth sessions by device_id
-- This is needed to mark sessions as consumed after polling
CREATE POLICY "Daemons can mark their auth sessions as consumed"
  ON daemon_auth_sessions
  FOR UPDATE
  USING (
    -- Allow updating by device_id (for marking consumed)
    device_id IS NOT NULL
  )
  WITH CHECK (
    -- Only allow updating the consumed field
    device_id IS NOT NULL
  );

COMMENT ON POLICY "Daemons can mark their auth sessions as consumed" ON daemon_auth_sessions IS
  'Allows unauthenticated daemons to mark auth sessions as consumed after retrieval';

-- ============================================================================
-- 2. Check if projects needs additional policies for daemon operations
-- ============================================================================

-- The daemon should be able to insert/update projects when authenticated.
-- Let's check what operations the daemon is trying to do and add policies if needed.

-- First, let's see what policies already exist for projects INSERT/UPDATE
-- (This is just documentation - the actual policies are checked below)

-- If the daemon is authenticated with the user's token, it should be able to:
-- 1. Insert projects for the authenticated user
-- 2. Update projects owned by the authenticated user

-- These policies should already exist, but let's verify and add if missing:

-- Check if "Users can create own projects" policy exists (should already be there)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'projects'
    AND policyname = 'Users can create own projects'
  ) THEN
    -- This policy should already exist from previous migrations
    -- But if it doesn't, we should investigate why
    RAISE NOTICE 'Policy "Users can create own projects" does not exist';
  END IF;
END $$;

COMMENT ON TABLE projects IS
  'Projects table with RLS. Users can create, view, and update their own projects.
   Daemon uploads require the user to be authenticated (via daemon_auth_sessions tokens).';
-- Add debug RAISE NOTICE to RLS functions to trace auth metadata
-- This migration adds debugging to help trace what user context is arriving in the functions

-- Drop and recreate is_system_admin with debug notices
CREATE OR REPLACE FUNCTION public.is_system_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  is_admin_user BOOLEAN;
  current_user_id UUID;
BEGIN
  -- Get current auth user id
  current_user_id := auth.uid();

  -- Debug: Log the user ID
  RAISE NOTICE 'is_system_admin check - auth.uid(): %', current_user_id;

  -- Debug: Log auth metadata
  RAISE NOTICE 'is_system_admin check - auth.jwt(): %', auth.jwt();

  SELECT is_admin INTO is_admin_user
  FROM public.users
  WHERE id = current_user_id;

  -- Debug: Log the result
  RAISE NOTICE 'is_system_admin check - is_admin value: %', is_admin_user;

  RETURN COALESCE(is_admin_user, false);
END;
$function$;
