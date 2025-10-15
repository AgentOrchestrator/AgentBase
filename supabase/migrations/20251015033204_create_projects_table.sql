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
