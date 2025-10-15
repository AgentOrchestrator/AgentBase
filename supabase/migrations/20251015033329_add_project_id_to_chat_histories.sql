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
