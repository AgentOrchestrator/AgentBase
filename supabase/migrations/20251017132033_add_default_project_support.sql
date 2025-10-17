-- Add support for default "Uncategorized" project per user
-- This migration:
-- 1. Deduplicates existing projects with same name
-- 2. Adds is_default flag to projects table
-- 3. Ensures only one default project per user
-- 4. Creates default projects for existing users
-- 5. Changes unique constraint to use name instead of project_path

-- Step 0: Deduplicate projects with same (user_id, name) by renaming them
-- For duplicates, we'll append a counter to make names unique
WITH duplicates AS (
    SELECT
        id,
        user_id,
        name,
        project_path,
        ROW_NUMBER() OVER (PARTITION BY user_id, name ORDER BY created_at) as rn,
        COUNT(*) OVER (PARTITION BY user_id, name) as total
    FROM public.projects
)
UPDATE public.projects
SET name = CASE
    WHEN d.total > 1 AND d.rn > 1
    THEN d.name || ' (' || d.rn || ')'
    ELSE d.name
END
FROM duplicates d
WHERE projects.id = d.id
AND d.total > 1;

-- Step 1: Add is_default column
ALTER TABLE public.projects
ADD COLUMN is_default BOOLEAN DEFAULT false NOT NULL;

-- Step 2: Drop old unique constraint on (user_id, project_path)
-- This was too brittle - users can have multiple projects with similar paths
ALTER TABLE public.projects
DROP CONSTRAINT IF EXISTS projects_user_id_project_path_key;

-- Step 3: Add new unique constraint on (user_id, name)
-- This allows project linking by name, which is more flexible
ALTER TABLE public.projects
ADD CONSTRAINT projects_user_id_name_key UNIQUE(user_id, name);

-- Step 4: Create unique constraint ensuring only one default project per user
CREATE UNIQUE INDEX idx_one_default_per_user
ON public.projects (user_id)
WHERE is_default = true;

-- Step 5: Make project_path nullable since default projects don't have a path
ALTER TABLE public.projects
ALTER COLUMN project_path DROP NOT NULL;

-- Step 6: Add index for faster lookups by name
CREATE INDEX idx_projects_name ON public.projects(user_id, name);

-- Step 7: Create default "Uncategorized" project for all existing users
-- This ensures every user has a fallback project for sessions without metadata
INSERT INTO public.projects (user_id, name, project_path, description, is_default)
SELECT
    u.id as user_id,
    'Uncategorized' as name,
    NULL as project_path,
    'Default project for sessions without project information' as description,
    true as is_default
FROM auth.users u
WHERE NOT EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.user_id = u.id AND p.is_default = true
)
ON CONFLICT (user_id, name) DO NOTHING;

-- Step 8: Create function to auto-create default project for new users
CREATE OR REPLACE FUNCTION create_default_project_for_user()
RETURNS TRIGGER AS $$
BEGIN
    -- Create default "Uncategorized" project for new user
    INSERT INTO public.projects (user_id, name, project_path, description, is_default)
    VALUES (
        NEW.id,
        'Uncategorized',
        NULL,
        'Default project for sessions without project information',
        true
    )
    ON CONFLICT (user_id, name) DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 9: Create trigger to auto-create default project when user signs up
CREATE TRIGGER create_default_project_on_user_creation
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION create_default_project_for_user();

-- Step 10: Update existing chat_histories without project_id to link to default project
-- This handles any orphaned sessions
UPDATE public.chat_histories ch
SET project_id = (
    SELECT p.id
    FROM public.projects p
    WHERE p.user_id = ch.account_id
    AND p.is_default = true
    LIMIT 1
)
WHERE ch.project_id IS NULL
AND ch.account_id IS NOT NULL;

-- Add comments
COMMENT ON COLUMN public.projects.is_default IS 'Whether this is the default "Uncategorized" project for the user';
COMMENT ON COLUMN public.projects.project_path IS 'Full path to project (nullable for default project)';
COMMENT ON INDEX idx_one_default_per_user IS 'Ensures each user has exactly one default project';
COMMENT ON FUNCTION create_default_project_for_user() IS 'Auto-creates default project when user signs up';

-- Rollback instructions:
-- DROP TRIGGER IF EXISTS create_default_project_on_user_creation ON auth.users;
-- DROP FUNCTION IF EXISTS create_default_project_for_user();
-- DROP INDEX IF EXISTS idx_one_default_per_user;
-- DROP INDEX IF EXISTS idx_projects_name;
-- ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_user_id_name_key;
-- ALTER TABLE public.projects ADD CONSTRAINT projects_user_id_project_path_key UNIQUE(user_id, project_path);
-- ALTER TABLE public.projects ALTER COLUMN project_path SET NOT NULL;
-- ALTER TABLE public.projects DROP COLUMN IF EXISTS is_default;
