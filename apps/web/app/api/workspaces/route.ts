import { NextRequest, NextResponse } from 'next/server';
import { createClient, createClientWithAuth } from '@/lib/supabase-server';

// GET /api/workspaces - List user's workspaces
export async function GET() {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch workspaces where user is a member
    const { data: memberships, error } = await supabase
      .from('workspace_members')
      .select(`
        workspace_id,
        role,
        joined_at,
        workspaces (
          id,
          name,
          slug,
          description,
          created_by_user_id,
          created_at
        )
      `)
      .eq('user_id', user.id)
      .order('joined_at', { ascending: false });

    if (error) {
      console.error('Error fetching workspaces:', error);
      return NextResponse.json({ error: 'Failed to fetch workspaces' }, { status: 500 });
    }

    // Transform the data
    const workspaces = memberships?.map((m: any) => ({
      ...m.workspaces,
      role: m.role,
      joined_at: m.joined_at,
    })) || [];

    return NextResponse.json({ workspaces });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/workspaces - Create a new workspace
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get authenticated user (secure method)
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('Auth error:', authError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get session for access token
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      console.error('Session error:', sessionError);
      return NextResponse.json({ error: 'Unauthorized - no session' }, { status: 401 });
    }

    console.log('Creating workspace for user:', user.id);
    console.log('Access token present:', !!session.access_token);

    const body = await request.json();
    const { name, slug, description } = body;

    // Validate input
    if (!name || !slug) {
      return NextResponse.json({ error: 'Name and slug are required' }, { status: 400 });
    }

    // Validate slug format (lowercase, alphanumeric, hyphens only)
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      return NextResponse.json({
        error: 'Slug must be lowercase alphanumeric with hyphens only'
      }, { status: 400 });
    }

    // Create workspace - RLS will have access to auth.uid() via the session
    const { data: workspace, error } = await supabase
      .from('workspaces')
      .insert({
        name,
        slug,
        description: description || null,
        created_by_user_id: user.id,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating workspace:', error);
      if (error.code === '23505') { // Unique violation
        return NextResponse.json({ error: 'Workspace slug already exists' }, { status: 409 });
      }
      return NextResponse.json({ error: 'Failed to create workspace' }, { status: 500 });
    }

    return NextResponse.json({ workspace }, { status: 201 });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/workspaces?workspace_id=xxx - Delete a workspace
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const workspace_id = searchParams.get('workspace_id');

    if (!workspace_id) {
      return NextResponse.json({ error: 'workspace_id is required' }, { status: 400 });
    }

    // Check if user is owner of the workspace
    const { data: membership, error: membershipError } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspace_id)
      .eq('user_id', user.id)
      .single();

    if (membershipError || !membership) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    if (membership.role !== 'owner') {
      return NextResponse.json({ error: 'Only workspace owners can delete workspaces' }, { status: 403 });
    }

    // Delete the workspace (cascade will handle members, invitations, etc.)
    const { error: deleteError } = await supabase
      .from('workspaces')
      .delete()
      .eq('id', workspace_id);

    if (deleteError) {
      console.error('Error deleting workspace:', deleteError);
      return NextResponse.json({ error: 'Failed to delete workspace' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Workspace deleted successfully' });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
