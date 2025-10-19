import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

// GET /api/workspaces/members?workspace_id=xxx - List workspace members
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspace_id');

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspace_id is required' }, { status: 400 });
    }

    // Fetch members (RLS will ensure user has access)
    const { data: members, error } = await supabase
      .from('workspace_members')
      .select(`
        id,
        user_id,
        role,
        joined_at,
        invited_by_user_id,
        invitation_status,
        invited_at
      `)
      .eq('workspace_id', workspaceId)
      .eq('invitation_status', 'accepted')
      .order('joined_at', { ascending: true });

    if (error) {
      console.error('Error fetching members:', error);
      return NextResponse.json({ error: 'Failed to fetch members' }, { status: 500 });
    }

    // Fetch user details for members from public.users table
    if (members && members.length > 0) {
      const userIds = members.map(m => m.user_id);
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, email, display_name')
        .in('id', userIds);

      if (!usersError && users) {
        const userMap = new Map(users.map(u => [u.id, u]));
        const membersWithDetails = members.map(m => ({
          ...m,
          email: userMap.get(m.user_id)?.email || 'Unknown',
          display_name: userMap.get(m.user_id)?.display_name || null,
        }));

        return NextResponse.json({ members: membersWithDetails });
      }
    }

    return NextResponse.json({ members: members || [] });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/workspaces/members - Add member to workspace
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { workspace_id, user_email, role } = body;

    // Validate input
    if (!workspace_id || !user_email) {
      return NextResponse.json({
        error: 'workspace_id and user_email are required'
      }, { status: 400 });
    }

    // Validate role
    const validRoles = ['owner', 'admin', 'member', 'viewer'];
    const memberRole = role || 'member';
    if (!validRoles.includes(memberRole)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    // Find user by email from public.users table
    const { data: targetUser, error: userError } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', user_email)
      .single();

    if (userError || !targetUser) {
      console.error('Error finding user:', userError);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if current user is admin/owner of workspace
    const { data: membership, error: membershipError } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspace_id)
      .eq('user_id', user.id)
      .single();

    if (membershipError || !membership) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    if (!['owner', 'admin'].includes(membership.role)) {
      return NextResponse.json({
        error: 'Only owners and admins can add members'
      }, { status: 403 });
    }

    // Add member with pending invitation status
    const { data: newMember, error } = await supabase
      .from('workspace_members')
      .insert({
        workspace_id,
        user_id: targetUser.id,
        role: memberRole,
        invited_by_user_id: user.id,
        invitation_status: 'pending',
        invited_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding member:', error);
      if (error.code === '23505') { // Unique violation
        return NextResponse.json({ error: 'User is already a member' }, { status: 409 });
      }
      return NextResponse.json({ error: 'Failed to add member' }, { status: 500 });
    }

    return NextResponse.json({ member: newMember }, { status: 201 });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/workspaces/members?workspace_id=xxx&user_id=xxx - Remove member
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspace_id');
    const targetUserId = searchParams.get('user_id');

    if (!workspaceId || !targetUserId) {
      return NextResponse.json({
        error: 'workspace_id and user_id are required'
      }, { status: 400 });
    }

    // Delete member (RLS will handle permissions)
    const { error } = await supabase
      .from('workspace_members')
      .delete()
      .eq('workspace_id', workspaceId)
      .eq('user_id', targetUserId);

    if (error) {
      console.error('Error removing member:', error);
      return NextResponse.json({ error: 'Failed to remove member' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
