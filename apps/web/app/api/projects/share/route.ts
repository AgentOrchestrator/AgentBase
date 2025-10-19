import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

// GET /api/projects/share?project_id=xxx - Get project sharing info
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('project_id');

    if (!projectId) {
      return NextResponse.json({ error: 'project_id is required' }, { status: 400 });
    }

    // Check if user owns the project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, name, user_id')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found or access denied' }, { status: 404 });
    }

    // Fetch individual shares
    const { data: userShares } = await supabase
      .from('project_shares')
      .select('id, shared_with_user_id, permission_level, created_at')
      .eq('project_id', projectId);

    // Enrich user shares with user information from public.users
    let enrichedUserShares = userShares || [];

    if (userShares && userShares.length > 0) {
      const userIds = userShares.map(share => share.shared_with_user_id);
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, email, display_name')
        .in('id', userIds);

      if (!usersError && users) {
        const userMap = new Map(users.map(u => [u.id, u]));
        enrichedUserShares = userShares.map(share => ({
          ...share,
          user_email: userMap.get(share.shared_with_user_id)?.email || null,
          user_display_name: userMap.get(share.shared_with_user_id)?.display_name || null,
        }));
      } else {
        console.error('Error fetching users:', usersError);
      }
    }

    // Fetch workspace shares
    const { data: workspaceShares } = await supabase
      .from('project_workspace_shares')
      .select(`
        id,
        workspace_id,
        permission_level,
        created_at,
        workspaces (
          id,
          name,
          slug
        )
      `)
      .eq('project_id', projectId);

    return NextResponse.json({
      project,
      user_shares: enrichedUserShares,
      workspace_shares: workspaceShares || [],
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/projects/share - Share project with user or workspace
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { project_id, share_type, target_id, permission_level } = body;

    // Validate input
    if (!project_id || !share_type || !target_id) {
      return NextResponse.json({
        error: 'project_id, share_type, and target_id are required'
      }, { status: 400 });
    }

    // Validate share_type
    if (!['user', 'workspace'].includes(share_type)) {
      return NextResponse.json({ error: 'Invalid share_type' }, { status: 400 });
    }

    // Validate permission_level
    const validPermissions = ['view', 'edit'];
    const permission = permission_level || 'view';
    if (!validPermissions.includes(permission)) {
      return NextResponse.json({ error: 'Invalid permission_level' }, { status: 400 });
    }

    // Check if user owns the project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, user_id')
      .eq('id', project_id)
      .eq('user_id', user.id)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found or access denied' }, { status: 404 });
    }

    if (share_type === 'user') {
      // Share with individual user
      const { data: share, error } = await supabase
        .from('project_shares')
        .insert({
          project_id,
          shared_by_user_id: user.id,
          shared_with_user_id: target_id,
          permission_level: permission,
        })
        .select()
        .single();

      if (error) {
        console.error('Error sharing project:', error);
        if (error.code === '23505') { // Unique violation
          return NextResponse.json({ error: 'Already shared with this user' }, { status: 409 });
        }
        return NextResponse.json({ error: 'Failed to share project' }, { status: 500 });
      }

      return NextResponse.json({ share }, { status: 201 });
    } else {
      // Share with workspace
      const { data: share, error } = await supabase
        .from('project_workspace_shares')
        .insert({
          project_id,
          shared_by_user_id: user.id,
          workspace_id: target_id,
          permission_level: permission,
        })
        .select()
        .single();

      if (error) {
        console.error('Error sharing project with workspace:', error);
        if (error.code === '23505') { // Unique violation
          return NextResponse.json({ error: 'Already shared with this workspace' }, { status: 409 });
        }
        return NextResponse.json({ error: 'Failed to share project' }, { status: 500 });
      }

      return NextResponse.json({ share }, { status: 201 });
    }
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/projects/share?project_id=xxx&share_type=xxx&share_id=xxx
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('project_id');
    const shareType = searchParams.get('share_type');
    const shareId = searchParams.get('share_id');

    if (!projectId || !shareType || !shareId) {
      return NextResponse.json({
        error: 'project_id, share_type, and share_id are required'
      }, { status: 400 });
    }

    // Check if user owns the project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, user_id')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found or access denied' }, { status: 404 });
    }

    if (shareType === 'user') {
      const { error } = await supabase
        .from('project_shares')
        .delete()
        .eq('id', shareId)
        .eq('project_id', projectId);

      if (error) {
        console.error('Error removing share:', error);
        return NextResponse.json({ error: 'Failed to remove share' }, { status: 500 });
      }
    } else if (shareType === 'workspace') {
      const { error } = await supabase
        .from('project_workspace_shares')
        .delete()
        .eq('id', shareId)
        .eq('project_id', projectId);

      if (error) {
        console.error('Error removing workspace share:', error);
        return NextResponse.json({ error: 'Failed to remove share' }, { status: 500 });
      }
    } else {
      return NextResponse.json({ error: 'Invalid share_type' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
