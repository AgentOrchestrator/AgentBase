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
