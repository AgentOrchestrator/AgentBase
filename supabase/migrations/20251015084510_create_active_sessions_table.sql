-- Create active_sessions table
-- This table tracks the most recently active editor sessions and files per user
-- Updated periodically by the daemon to show "currently working on" status
-- Note: All paths stored relative to $HOME (e.g., "Developer/agent-orchestrator" instead of "/Users/foo/Developer/agent-orchestrator")

CREATE TABLE IF NOT EXISTS public.active_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,

    -- Editor information
    editor_type TEXT NOT NULL CHECK (editor_type IN ('cursor', 'windsurf', 'claude_code', 'vscode', 'other')),

    -- Activity tracking
    last_activity_at TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN DEFAULT true, -- false if no activity in past hour

    -- Recently accessed files (within past hour)
    -- Paths are relative to $HOME (e.g., "Developer/project/src/file.ts")
    recent_files JSONB DEFAULT '[]'::jsonb, -- Array of {path: string, lastAccessed: timestamp}

    -- Session metadata
    workspace_path TEXT, -- Relative to $HOME (e.g., "Developer/agent-orchestrator")
    session_metadata JSONB DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),

    -- One active session per user per editor type
    UNIQUE(user_id, editor_type)
);

-- Create indexes for faster lookups
CREATE INDEX idx_active_sessions_user_id ON public.active_sessions(user_id);
CREATE INDEX idx_active_sessions_project_id ON public.active_sessions(project_id);
CREATE INDEX idx_active_sessions_is_active ON public.active_sessions(is_active);
CREATE INDEX idx_active_sessions_last_activity ON public.active_sessions(last_activity_at DESC);

-- Create GIN index for JSONB recent_files queries
CREATE INDEX idx_active_sessions_recent_files ON public.active_sessions USING GIN(recent_files);

-- Create updated_at trigger
CREATE TRIGGER update_active_sessions_updated_at
    BEFORE UPDATE ON public.active_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add RLS policies
ALTER TABLE public.active_sessions ENABLE ROW LEVEL SECURITY;

-- Users can view their own active sessions
CREATE POLICY "Users can view own active sessions"
    ON public.active_sessions
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users can view active sessions of projects shared with them
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

-- Service role can insert/update/delete (for daemon)
CREATE POLICY "Service role can manage active sessions"
    ON public.active_sessions
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Add comments
COMMENT ON TABLE public.active_sessions IS 'Tracks recently active editor sessions and files per user (updated periodically)';
COMMENT ON COLUMN public.active_sessions.user_id IS 'User who owns this active session';
COMMENT ON COLUMN public.active_sessions.editor_type IS 'Type of editor: cursor, windsurf, claude_code, vscode, other';
COMMENT ON COLUMN public.active_sessions.last_activity_at IS 'Timestamp of last detected activity in this editor';
COMMENT ON COLUMN public.active_sessions.is_active IS 'True if activity detected within past hour';
COMMENT ON COLUMN public.active_sessions.recent_files IS 'Array of recently accessed files (paths relative to $HOME): [{path: string, lastAccessed: timestamp}]';
COMMENT ON COLUMN public.active_sessions.workspace_path IS 'Current workspace/project path being worked on (relative to $HOME)';
COMMENT ON COLUMN public.active_sessions.session_metadata IS 'Additional session data (workspace info, etc.)';

-- Rollback instructions:
-- DROP POLICY IF EXISTS "Service role can manage active sessions" ON public.active_sessions;
-- DROP POLICY IF EXISTS "Users can view active sessions of shared projects" ON public.active_sessions;
-- DROP POLICY IF EXISTS "Users can view own active sessions" ON public.active_sessions;
-- DROP TRIGGER IF EXISTS update_active_sessions_updated_at ON public.active_sessions;
-- DROP INDEX IF EXISTS idx_active_sessions_recent_files;
-- DROP INDEX IF EXISTS idx_active_sessions_last_activity;
-- DROP INDEX IF EXISTS idx_active_sessions_is_active;
-- DROP INDEX IF EXISTS idx_active_sessions_project_id;
-- DROP INDEX IF EXISTS idx_active_sessions_user_id;
-- DROP TABLE IF EXISTS public.active_sessions CASCADE;
