-- Fix infinite recursion in projects RLS policies
--
-- Problem: Circular dependency between projects and project_shares/project_organization_shares
-- - projects table policies query project_shares table
-- - project_shares table policies query projects table
-- This causes infinite recursion when Postgres tries to evaluate the policies
--
-- Solution: Use SECURITY DEFINER functions to bypass RLS checks when needed

-- Step 1: Drop the problematic policies that cause circular dependencies
DROP POLICY IF EXISTS "Users can view shared projects" ON public.projects;
DROP POLICY IF EXISTS "Users can update projects with edit permission" ON public.projects;
DROP POLICY IF EXISTS "Users can view org-shared projects" ON public.projects;
DROP POLICY IF EXISTS "Project owners can view shares" ON public.project_shares;
DROP POLICY IF EXISTS "Project owners can create shares" ON public.project_shares;
DROP POLICY IF EXISTS "Project owners can delete shares" ON public.project_shares;
DROP POLICY IF EXISTS "Project owners can view org shares" ON public.project_organization_shares;
DROP POLICY IF EXISTS "Project owners can create org shares" ON public.project_organization_shares;
DROP POLICY IF EXISTS "Project owners can delete org shares" ON public.project_organization_shares;

-- Step 2: Create SECURITY DEFINER helper functions that bypass RLS
-- These functions run with the privileges of the function owner, not the caller

-- Check if user owns a project (bypasses RLS)
CREATE OR REPLACE FUNCTION public.user_owns_project(project_id_param UUID, user_id_param UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.projects
    WHERE id = project_id_param AND user_id = user_id_param
  );
END;
$$;

-- Check if user has a share for a project (bypasses RLS)
CREATE OR REPLACE FUNCTION public.user_has_project_share(project_id_param UUID, user_id_param UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.project_shares
    WHERE project_id = project_id_param AND shared_with_user_id = user_id_param
  );
END;
$$;

-- Check if user has edit permission for a project (bypasses RLS)
CREATE OR REPLACE FUNCTION public.user_has_project_edit_permission(project_id_param UUID, user_id_param UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.project_shares
    WHERE project_id = project_id_param
      AND shared_with_user_id = user_id_param
      AND permission_level = 'edit'
  );
END;
$$;

-- Check if project is shared with user's organization (bypasses RLS)
CREATE OR REPLACE FUNCTION public.project_shared_with_org(project_id_param UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.project_organization_shares
    WHERE project_id = project_id_param
  );
END;
$$;

-- Step 3: Recreate policies using the SECURITY DEFINER functions

-- PROJECTS TABLE POLICIES
-- Users can view projects shared with them individually
CREATE POLICY "Users can view shared projects"
    ON public.projects
    FOR SELECT
    USING (user_has_project_share(id, auth.uid()));

-- Users can view projects shared with their organization
CREATE POLICY "Users can view org-shared projects"
    ON public.projects
    FOR SELECT
    USING (project_shared_with_org(id));

-- Users can update projects they have edit permission on
CREATE POLICY "Users can update projects with edit permission"
    ON public.projects
    FOR UPDATE
    USING (user_has_project_edit_permission(id, auth.uid()))
    WITH CHECK (user_has_project_edit_permission(id, auth.uid()));

-- PROJECT_SHARES TABLE POLICIES
-- Project owners can view all shares of their projects
CREATE POLICY "Project owners can view shares"
    ON public.project_shares
    FOR SELECT
    USING (user_owns_project(project_id, auth.uid()));

-- Project owners can create shares
CREATE POLICY "Project owners can create shares"
    ON public.project_shares
    FOR INSERT
    WITH CHECK (
        user_owns_project(project_id, auth.uid())
        AND shared_by_user_id = auth.uid()
    );

-- Project owners can delete shares
CREATE POLICY "Project owners can delete shares"
    ON public.project_shares
    FOR DELETE
    USING (user_owns_project(project_id, auth.uid()));

-- PROJECT_ORGANIZATION_SHARES TABLE POLICIES
-- Project owners can view organization shares
CREATE POLICY "Project owners can view org shares"
    ON public.project_organization_shares
    FOR SELECT
    USING (user_owns_project(project_id, auth.uid()));

-- Project owners can create organization shares
CREATE POLICY "Project owners can create org shares"
    ON public.project_organization_shares
    FOR INSERT
    WITH CHECK (
        user_owns_project(project_id, auth.uid())
        AND shared_by_user_id = auth.uid()
    );

-- Project owners can delete organization shares
CREATE POLICY "Project owners can delete org shares"
    ON public.project_organization_shares
    FOR DELETE
    USING (user_owns_project(project_id, auth.uid()));

-- Add helpful comments
COMMENT ON FUNCTION public.user_owns_project IS 'Security definer function to check project ownership without RLS recursion';
COMMENT ON FUNCTION public.user_has_project_share IS 'Security definer function to check project share without RLS recursion';
COMMENT ON FUNCTION public.user_has_project_edit_permission IS 'Security definer function to check edit permission without RLS recursion';
COMMENT ON FUNCTION public.project_shared_with_org IS 'Security definer function to check org share without RLS recursion';

-- Rollback instructions:
-- DROP POLICY IF EXISTS "Users can view shared projects" ON public.projects;
-- DROP POLICY IF EXISTS "Users can update projects with edit permission" ON public.projects;
-- DROP POLICY IF EXISTS "Users can view org-shared projects" ON public.projects;
-- DROP POLICY IF EXISTS "Project owners can view shares" ON public.project_shares;
-- DROP POLICY IF EXISTS "Project owners can create shares" ON public.project_shares;
-- DROP POLICY IF EXISTS "Project owners can delete shares" ON public.project_shares;
-- DROP POLICY IF EXISTS "Project owners can view org shares" ON public.project_organization_shares;
-- DROP POLICY IF EXISTS "Project owners can create org shares" ON public.project_organization_shares;
-- DROP POLICY IF EXISTS "Project owners can delete org shares" ON public.project_organization_shares;
-- DROP FUNCTION IF EXISTS public.user_owns_project;
-- DROP FUNCTION IF EXISTS public.user_has_project_share;
-- DROP FUNCTION IF EXISTS public.user_has_project_edit_permission;
-- DROP FUNCTION IF EXISTS public.project_shared_with_org;
-- -- Then restore original policies from 20251015033355_add_rls_policies_for_projects.sql
