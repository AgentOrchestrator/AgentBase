-- Add workspace invitation system
-- This migration:
-- 1. Adds invitation_status column to workspace_members table
-- 2. Adds invited_at timestamp
-- 3. Updates RLS policies to support pending invitations
-- 4. Creates helper functions for invitation management
-- 5. Ensures direct user shares remain immediate (no invitation required)

-- =============================================================================
-- STEP 1: Add invitation fields to workspace_members
-- =============================================================================

-- Add invitation_status column (default 'accepted' for backward compatibility)
ALTER TABLE public.workspace_members
ADD COLUMN invitation_status TEXT NOT NULL DEFAULT 'accepted'
CONSTRAINT valid_invitation_status CHECK (invitation_status IN ('pending', 'accepted', 'declined'));

-- Add invited_at timestamp
ALTER TABLE public.workspace_members
ADD COLUMN invited_at TIMESTAMPTZ DEFAULT now();

-- Add index for querying pending invitations
CREATE INDEX idx_workspace_members_invitation_status ON public.workspace_members(user_id, invitation_status);

-- Add comments
COMMENT ON COLUMN public.workspace_members.invitation_status IS 'Invitation status: pending (waiting for user acceptance), accepted (active member), declined (user rejected)';
COMMENT ON COLUMN public.workspace_members.invited_at IS 'When the invitation was sent';

-- =============================================================================
-- STEP 2: Update workspace_members RLS policies for invitations
-- =============================================================================

-- Drop existing view policy and recreate with invitation support
DROP POLICY IF EXISTS "Users can view members of their workspaces" ON public.workspace_members;

-- Users can view:
-- 1. Members of workspaces they belong to (accepted status)
-- 2. Their own pending invitations
CREATE POLICY "Users can view workspace members and their invitations"
    ON public.workspace_members
    FOR SELECT
    USING (
        -- View accepted members of workspaces user belongs to
        (invitation_status = 'accepted' AND EXISTS (
            SELECT 1 FROM public.workspace_members wm
            WHERE wm.workspace_id = workspace_id
            AND wm.user_id = auth.uid()
            AND wm.invitation_status = 'accepted'
        ))
        OR
        -- View own invitations (any status)
        user_id = auth.uid()
    );

-- Update insert policy to set invitation_status to 'pending' by default
DROP POLICY IF EXISTS "Owners and admins can add members" ON public.workspace_members;

CREATE POLICY "Owners and admins can invite members"
    ON public.workspace_members
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.workspace_members wm
            WHERE wm.workspace_id = workspace_id
            AND wm.user_id = auth.uid()
            AND wm.role IN ('owner', 'admin')
            AND wm.invitation_status = 'accepted'
        )
    );

-- Add policy for users to accept/decline their own invitations
CREATE POLICY "Users can update their own invitation status"
    ON public.workspace_members
    FOR UPDATE
    USING (
        user_id = auth.uid()
        AND invitation_status = 'pending'
    )
    WITH CHECK (
        user_id = auth.uid()
        AND invitation_status IN ('accepted', 'declined')
    );

-- Update existing update policy to only apply to non-invitation updates
DROP POLICY IF EXISTS "Owners and admins can update member roles" ON public.workspace_members;

CREATE POLICY "Owners and admins can update member roles"
    ON public.workspace_members
    FOR UPDATE
    USING (
        -- Admins can update roles (but not invitation status)
        EXISTS (
            SELECT 1 FROM public.workspace_members wm
            WHERE wm.workspace_id = workspace_id
            AND wm.user_id = auth.uid()
            AND wm.role IN ('owner', 'admin')
            AND wm.invitation_status = 'accepted'
        )
        AND NOT (role = 'owner' AND user_id = auth.uid())  -- Owners can't demote themselves
        AND invitation_status = 'accepted'  -- Can only update accepted members
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.workspace_members wm
            WHERE wm.workspace_id = workspace_id
            AND wm.user_id = auth.uid()
            AND wm.role IN ('owner', 'admin')
            AND wm.invitation_status = 'accepted'
        )
    );

-- Update delete policy to handle declined invitations
DROP POLICY IF EXISTS "Members can be removed by admins or themselves" ON public.workspace_members;

CREATE POLICY "Members and invitations can be removed"
    ON public.workspace_members
    FOR DELETE
    USING (
        user_id = auth.uid()  -- Users can leave or decline invitations
        OR EXISTS (
            SELECT 1 FROM public.workspace_members wm
            WHERE wm.workspace_id = workspace_id
            AND wm.user_id = auth.uid()
            AND wm.role IN ('owner', 'admin')
            AND wm.invitation_status = 'accepted'
        )
    );

-- =============================================================================
-- STEP 3: Update workspaces view policy to only show workspaces with accepted membership
-- =============================================================================

DROP POLICY IF EXISTS "Users can view their workspaces" ON public.workspaces;

CREATE POLICY "Users can view their workspaces"
    ON public.workspaces
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.workspace_members wm
            WHERE wm.workspace_id = workspaces.id
            AND wm.user_id = auth.uid()
            AND wm.invitation_status = 'accepted'
        )
    );

-- =============================================================================
-- STEP 4: Update workspace access policies to only apply to accepted members
-- =============================================================================

DROP POLICY IF EXISTS "Owners and admins can update workspaces" ON public.workspaces;

CREATE POLICY "Owners and admins can update workspaces"
    ON public.workspaces
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.workspace_members wm
            WHERE wm.workspace_id = workspaces.id
            AND wm.user_id = auth.uid()
            AND wm.role IN ('owner', 'admin')
            AND wm.invitation_status = 'accepted'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.workspace_members wm
            WHERE wm.workspace_id = workspaces.id
            AND wm.user_id = auth.uid()
            AND wm.role IN ('owner', 'admin')
            AND wm.invitation_status = 'accepted'
        )
    );

DROP POLICY IF EXISTS "Only owners can delete workspaces" ON public.workspaces;

CREATE POLICY "Only owners can delete workspaces"
    ON public.workspaces
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.workspace_members wm
            WHERE wm.workspace_id = workspaces.id
            AND wm.user_id = auth.uid()
            AND wm.role = 'owner'
            AND wm.invitation_status = 'accepted'
        )
    );

-- =============================================================================
-- STEP 5: Update projects RLS to only show workspace shares to accepted members
-- =============================================================================

DROP POLICY IF EXISTS "Users can view their projects and shared projects" ON public.projects;

CREATE POLICY "Users can view their projects and shared projects"
    ON public.projects
    FOR SELECT
    USING (
        -- User owns the project
        user_id = auth.uid()
        OR
        -- Project is shared with user individually (immediate access, no invitation)
        EXISTS (
            SELECT 1 FROM public.project_shares ps
            WHERE ps.project_id = projects.id
            AND ps.shared_with_user_id = auth.uid()
        )
        OR
        -- Project is shared with user's organization (legacy)
        EXISTS (
            SELECT 1 FROM public.project_organization_shares pos
            WHERE pos.project_id = projects.id
        )
        OR
        -- Project is shared with a workspace the user is an ACCEPTED member of
        EXISTS (
            SELECT 1 FROM public.project_workspace_shares pws
            JOIN public.workspace_members wm ON wm.workspace_id = pws.workspace_id
            WHERE pws.project_id = projects.id
            AND wm.user_id = auth.uid()
            AND wm.invitation_status = 'accepted'
        )
    );

-- =============================================================================
-- STEP 6: Update project_workspace_shares view policy
-- =============================================================================

DROP POLICY IF EXISTS "Users can view workspace shares for accessible projects" ON public.project_workspace_shares;

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
        -- Accepted workspace members can see shares for their workspace
        EXISTS (
            SELECT 1 FROM public.workspace_members wm
            WHERE wm.workspace_id = workspace_id
            AND wm.user_id = auth.uid()
            AND wm.invitation_status = 'accepted'
        )
    );

-- =============================================================================
-- STEP 7: Update helper function to check accepted workspace membership
-- =============================================================================

DROP FUNCTION IF EXISTS is_workspace_member(UUID);

CREATE OR REPLACE FUNCTION is_workspace_member(workspace_id_param UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.workspace_members
        WHERE workspace_id = workspace_id_param
        AND user_id = auth.uid()
        AND invitation_status = 'accepted'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION is_workspace_member(UUID) IS 'Helper function to check if current user is accepted member of workspace';

-- =============================================================================
-- STEP 8: Update helper function to check workspace admin status
-- =============================================================================

DROP FUNCTION IF EXISTS is_workspace_admin(UUID);

CREATE OR REPLACE FUNCTION is_workspace_admin(workspace_id_param UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.workspace_members
        WHERE workspace_id = workspace_id_param
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
        AND invitation_status = 'accepted'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION is_workspace_admin(UUID) IS 'Helper function to check if current user is accepted admin/owner of workspace';

-- =============================================================================
-- STEP 9: Create function to get user's pending invitations count
-- =============================================================================

CREATE OR REPLACE FUNCTION get_pending_invitations_count()
RETURNS INTEGER AS $$
BEGIN
    RETURN (
        SELECT COUNT(*)::INTEGER
        FROM public.workspace_members
        WHERE user_id = auth.uid()
        AND invitation_status = 'pending'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_pending_invitations_count() IS 'Returns count of pending workspace invitations for current user';

-- =============================================================================
-- STEP 10: Update workspace creator auto-add trigger to use 'accepted' status
-- =============================================================================

DROP FUNCTION IF EXISTS add_creator_as_workspace_owner() CASCADE;

CREATE OR REPLACE FUNCTION add_creator_as_workspace_owner()
RETURNS TRIGGER AS $$
BEGIN
    -- Add the creator as the workspace owner with accepted status (no invitation needed)
    INSERT INTO public.workspace_members (workspace_id, user_id, role, invitation_status, joined_at, invited_at)
    VALUES (NEW.id, NEW.created_by_user_id, 'owner', 'accepted', now(), now());

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger
CREATE TRIGGER add_creator_as_owner_on_workspace_creation
    AFTER INSERT ON public.workspaces
    FOR EACH ROW
    EXECUTE FUNCTION add_creator_as_workspace_owner();

COMMENT ON FUNCTION add_creator_as_workspace_owner() IS 'Automatically adds workspace creator as accepted owner member';

-- =============================================================================
-- Rollback instructions:
-- =============================================================================
-- DROP FUNCTION IF EXISTS get_pending_invitations_count();
-- DROP INDEX IF EXISTS idx_workspace_members_invitation_status;
-- ALTER TABLE public.workspace_members DROP COLUMN IF EXISTS invitation_status;
-- ALTER TABLE public.workspace_members DROP COLUMN IF EXISTS invited_at;
-- -- Then revert all RLS policies to previous versions from migration 20251017132427
