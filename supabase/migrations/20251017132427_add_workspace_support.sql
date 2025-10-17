-- Add workspace support for team collaboration
-- This migration:
-- 1. Creates workspaces table for team/org grouping
-- 2. Creates workspace_members table for managing membership
-- 3. Creates project_workspace_shares table for sharing projects with entire workspaces
-- 4. Adds RLS policies ensuring projects are only visible to owners and shared users/workspaces

-- =============================================================================
-- STEP 1: Create workspaces table
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    created_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    workspace_metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),

    -- Ensure slug is URL-safe
    CONSTRAINT valid_slug CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

-- Create indexes for faster lookups
CREATE INDEX idx_workspaces_slug ON public.workspaces(slug);
CREATE INDEX idx_workspaces_created_by ON public.workspaces(created_by_user_id);

-- Add updated_at trigger
CREATE TRIGGER update_workspaces_updated_at
    BEFORE UPDATE ON public.workspaces
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add comments
COMMENT ON TABLE public.workspaces IS 'Team/organization workspaces for collaboration';
COMMENT ON COLUMN public.workspaces.slug IS 'URL-safe identifier for the workspace (e.g., "acme-corp")';
COMMENT ON COLUMN public.workspaces.created_by_user_id IS 'User who created the workspace (becomes owner)';
COMMENT ON COLUMN public.workspaces.workspace_metadata IS 'Additional metadata (settings, branding, etc.)';

-- =============================================================================
-- STEP 2: Create workspace_members table
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.workspace_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member',
    invited_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    joined_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),

    -- Ensure role is valid
    CONSTRAINT valid_member_role CHECK (role IN ('owner', 'admin', 'member', 'viewer')),

    -- Prevent duplicate memberships
    UNIQUE(workspace_id, user_id)
);

-- Create indexes for faster lookups
CREATE INDEX idx_workspace_members_workspace_id ON public.workspace_members(workspace_id);
CREATE INDEX idx_workspace_members_user_id ON public.workspace_members(user_id);

-- Add comments
COMMENT ON TABLE public.workspace_members IS 'Manages user membership in workspaces';
COMMENT ON COLUMN public.workspace_members.role IS 'Member role: owner (full control), admin (manage members), member (full access), viewer (read-only)';
COMMENT ON COLUMN public.workspace_members.invited_by_user_id IS 'User who invited this member (null if self-joined or creator)';

-- =============================================================================
-- STEP 3: Create project_workspace_shares table
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.project_workspace_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    shared_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    permission_level TEXT NOT NULL DEFAULT 'view',
    created_at TIMESTAMPTZ DEFAULT now(),

    -- Ensure permission_level is valid
    CONSTRAINT valid_workspace_permission_level CHECK (permission_level IN ('view', 'edit')),

    -- Prevent duplicate workspace shares
    UNIQUE(project_id, workspace_id)
);

-- Create indexes for faster lookups
CREATE INDEX idx_project_workspace_shares_project_id ON public.project_workspace_shares(project_id);
CREATE INDEX idx_project_workspace_shares_workspace_id ON public.project_workspace_shares(workspace_id);

-- Add comments
COMMENT ON TABLE public.project_workspace_shares IS 'Shares projects with entire workspaces (all members get access)';
COMMENT ON COLUMN public.project_workspace_shares.permission_level IS 'Access level: view (read-only) or edit (read-write)';

-- =============================================================================
-- STEP 4: Add RLS policies for workspaces
-- =============================================================================

-- Enable RLS on workspaces table
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

-- Users can view workspaces they are members of
CREATE POLICY "Users can view their workspaces"
    ON public.workspaces
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.workspace_members wm
            WHERE wm.workspace_id = workspaces.id
            AND wm.user_id = auth.uid()
        )
    );

-- Users can create workspaces (they become the owner)
CREATE POLICY "Users can create workspaces"
    ON public.workspaces
    FOR INSERT
    WITH CHECK (auth.uid() = created_by_user_id);

-- Only owners and admins can update workspaces
CREATE POLICY "Owners and admins can update workspaces"
    ON public.workspaces
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.workspace_members wm
            WHERE wm.workspace_id = workspaces.id
            AND wm.user_id = auth.uid()
            AND wm.role IN ('owner', 'admin')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.workspace_members wm
            WHERE wm.workspace_id = workspaces.id
            AND wm.user_id = auth.uid()
            AND wm.role IN ('owner', 'admin')
        )
    );

-- Only owners can delete workspaces
CREATE POLICY "Only owners can delete workspaces"
    ON public.workspaces
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.workspace_members wm
            WHERE wm.workspace_id = workspaces.id
            AND wm.user_id = auth.uid()
            AND wm.role = 'owner'
        )
    );

-- =============================================================================
-- STEP 5: Add RLS policies for workspace_members
-- =============================================================================

-- Enable RLS on workspace_members table
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

-- Users can view members of workspaces they belong to
CREATE POLICY "Users can view members of their workspaces"
    ON public.workspace_members
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.workspace_members wm
            WHERE wm.workspace_id = workspace_id
            AND wm.user_id = auth.uid()
        )
    );

-- Owners and admins can add members
CREATE POLICY "Owners and admins can add members"
    ON public.workspace_members
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.workspace_members wm
            WHERE wm.workspace_id = workspace_id
            AND wm.user_id = auth.uid()
            AND wm.role IN ('owner', 'admin')
        )
    );

-- Owners and admins can update member roles (but owners can't demote themselves)
CREATE POLICY "Owners and admins can update member roles"
    ON public.workspace_members
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.workspace_members wm
            WHERE wm.workspace_id = workspace_id
            AND wm.user_id = auth.uid()
            AND wm.role IN ('owner', 'admin')
        )
        AND NOT (role = 'owner' AND user_id = auth.uid())  -- Owners can't demote themselves
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.workspace_members wm
            WHERE wm.workspace_id = workspace_id
            AND wm.user_id = auth.uid()
            AND wm.role IN ('owner', 'admin')
        )
    );

-- Owners and admins can remove members, or users can remove themselves
CREATE POLICY "Members can be removed by admins or themselves"
    ON public.workspace_members
    FOR DELETE
    USING (
        user_id = auth.uid()  -- Users can leave
        OR EXISTS (
            SELECT 1 FROM public.workspace_members wm
            WHERE wm.workspace_id = workspace_id
            AND wm.user_id = auth.uid()
            AND wm.role IN ('owner', 'admin')
        )
    );

-- =============================================================================
-- STEP 6: Add RLS policies for project_workspace_shares
-- =============================================================================

-- Enable RLS on project_workspace_shares table
ALTER TABLE public.project_workspace_shares ENABLE ROW LEVEL SECURITY;

-- Users can view workspace shares for projects they can access
CREATE POLICY "Users can view workspace shares for accessible projects"
    ON public.project_workspace_shares
    FOR SELECT
    USING (
        -- Project owner can see all shares
        EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = project_id
            AND p.user_id = auth.uid()
        )
        OR
        -- Workspace members can see shares for their workspace
        EXISTS (
            SELECT 1 FROM public.workspace_members wm
            WHERE wm.workspace_id = workspace_id
            AND wm.user_id = auth.uid()
        )
    );

-- Project owners can share with workspaces
CREATE POLICY "Project owners can share with workspaces"
    ON public.project_workspace_shares
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = project_id
            AND p.user_id = auth.uid()
        )
        AND auth.uid() = shared_by_user_id
    );

-- Project owners can update workspace shares
CREATE POLICY "Project owners can update workspace shares"
    ON public.project_workspace_shares
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = project_id
            AND p.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = project_id
            AND p.user_id = auth.uid()
        )
    );

-- Project owners can remove workspace shares
CREATE POLICY "Project owners can remove workspace shares"
    ON public.project_workspace_shares
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = project_id
            AND p.user_id = auth.uid()
        )
    );

-- =============================================================================
-- STEP 7: Update projects RLS policies to include workspace access
-- =============================================================================

-- Drop existing policies that need updating
DROP POLICY IF EXISTS "Users can view their own projects and shared projects" ON public.projects;
DROP POLICY IF EXISTS "Users can view projects shared with them or their organization" ON public.projects;

-- Recreate the view policy with workspace support
CREATE POLICY "Users can view their projects and shared projects"
    ON public.projects
    FOR SELECT
    USING (
        -- User owns the project
        user_id = auth.uid()
        OR
        -- Project is shared with user individually
        EXISTS (
            SELECT 1 FROM public.project_shares ps
            WHERE ps.project_id = id
            AND ps.shared_with_user_id = auth.uid()
        )
        OR
        -- Project is shared with user's organization (legacy)
        EXISTS (
            SELECT 1 FROM public.project_organization_shares pos
            WHERE pos.project_id = id
        )
        OR
        -- Project is shared with a workspace the user is a member of
        EXISTS (
            SELECT 1 FROM public.project_workspace_shares pws
            JOIN public.workspace_members wm ON wm.workspace_id = pws.workspace_id
            WHERE pws.project_id = id
            AND wm.user_id = auth.uid()
        )
    );

-- =============================================================================
-- STEP 8: Create function to auto-add creator as workspace owner
-- =============================================================================

CREATE OR REPLACE FUNCTION add_creator_as_workspace_owner()
RETURNS TRIGGER AS $$
BEGIN
    -- Add the creator as the workspace owner
    INSERT INTO public.workspace_members (workspace_id, user_id, role, joined_at)
    VALUES (NEW.id, NEW.created_by_user_id, 'owner', now());

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to auto-add creator as owner
CREATE TRIGGER add_creator_as_owner_on_workspace_creation
    AFTER INSERT ON public.workspaces
    FOR EACH ROW
    EXECUTE FUNCTION add_creator_as_workspace_owner();

COMMENT ON FUNCTION add_creator_as_workspace_owner() IS 'Automatically adds workspace creator as owner member';

-- =============================================================================
-- STEP 9: Add helper function to check workspace membership
-- =============================================================================

CREATE OR REPLACE FUNCTION is_workspace_member(workspace_id_param UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.workspace_members
        WHERE workspace_id = workspace_id_param
        AND user_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION is_workspace_member(UUID) IS 'Helper function to check if current user is member of workspace';

-- =============================================================================
-- STEP 10: Add helper function to check workspace admin status
-- =============================================================================

CREATE OR REPLACE FUNCTION is_workspace_admin(workspace_id_param UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.workspace_members
        WHERE workspace_id = workspace_id_param
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION is_workspace_admin(UUID) IS 'Helper function to check if current user is admin/owner of workspace';

-- =============================================================================
-- Rollback instructions:
-- =============================================================================
-- DROP FUNCTION IF EXISTS is_workspace_admin(UUID);
-- DROP FUNCTION IF EXISTS is_workspace_member(UUID);
-- DROP TRIGGER IF EXISTS add_creator_as_owner_on_workspace_creation ON public.workspaces;
-- DROP FUNCTION IF EXISTS add_creator_as_workspace_owner();
-- DROP POLICY IF EXISTS "Users can view their projects and shared projects" ON public.projects;
-- -- Recreate old policy if needed
-- DROP TABLE IF EXISTS public.project_workspace_shares CASCADE;
-- DROP TABLE IF EXISTS public.workspace_members CASCADE;
-- DROP TABLE IF EXISTS public.workspaces CASCADE;
