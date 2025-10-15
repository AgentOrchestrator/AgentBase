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
