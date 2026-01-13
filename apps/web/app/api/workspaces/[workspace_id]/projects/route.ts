/**
 * API endpoint for fetching projects in a workspace
 * GET /api/workspaces/[workspace_id]/projects
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ workspace_id: string }> }
) {
  try {
    const { workspace_id } = await params;

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!workspace_id) {
      return NextResponse.json({ error: 'workspace_id is required' }, { status: 400 });
    }

    // Verify user has access to the workspace
    const { data: membership, error: membershipError } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspace_id)
      .eq('user_id', user.id)
      .single();

    if (membershipError || !membership) {
      return NextResponse.json({ error: 'Access denied to workspace' }, { status: 403 });
    }

    // Get projects shared with this workspace
    const { data: projectShares, error } = await supabase
      .from('project_workspace_shares')
      .select(`
        project_id,
        permission_level,
        created_at,
        projects:project_id (
          id,
          name,
          description,
          project_path,
          user_id,
          created_at
        )
      `)
      .eq('workspace_id', workspace_id);

    if (error) {
      console.error('Error fetching projects:', error);
      return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });
    }

    // Transform the data to a cleaner format
    const transformedProjects = projectShares
      ?.map((item: any) => {
        if (!item.projects) return null;
        return {
          id: item.projects.id,
          name: item.projects.name,
          description: item.projects.description,
          project_path: item.projects.project_path,
          user_id: item.projects.user_id,
          permission_level: item.permission_level,
          shared_at: item.created_at,
          created_at: item.projects.created_at,
        };
      })
      .filter((p: any) => p !== null) || [];

    return NextResponse.json({
      projects: transformedProjects,
      total: transformedProjects.length,
    });
  } catch (error) {
    console.error('Error in projects API:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
