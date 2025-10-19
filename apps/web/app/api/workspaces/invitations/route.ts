import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

// GET /api/workspaces/invitations - Get pending invitations for current user
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch pending invitations for current user
    const { data: invitations, error } = await supabase
      .from('workspace_members')
      .select(`
        id,
        workspace_id,
        role,
        invited_at,
        invited_by_user_id,
        workspaces (
          id,
          name,
          slug,
          description
        )
      `)
      .eq('user_id', user.id)
      .eq('invitation_status', 'pending')
      .order('invited_at', { ascending: false });

    if (error) {
      console.error('Error fetching invitations:', error);
      return NextResponse.json({ error: 'Failed to fetch invitations' }, { status: 500 });
    }

    // Fetch user details for invited_by users
    if (invitations && invitations.length > 0) {
      const inviterIds = invitations
        .map(inv => inv.invited_by_user_id)
        .filter((id): id is string => id !== null);

      if (inviterIds.length > 0) {
        const { data: inviters, error: invitersError } = await supabase
          .from('users')
          .select('id, email, display_name')
          .in('id', inviterIds);

        if (!invitersError && inviters) {
          const inviterMap = new Map(inviters.map(u => [u.id, u]));
          const invitationsWithDetails = invitations.map(inv => ({
            ...inv,
            invited_by_email: inviterMap.get(inv.invited_by_user_id || '')?.email || 'Unknown',
            invited_by_display_name: inviterMap.get(inv.invited_by_user_id || '')?.display_name || null,
          }));

          return NextResponse.json({ invitations: invitationsWithDetails });
        }
      }
    }

    return NextResponse.json({ invitations: invitations || [] });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/workspaces/invitations - Accept or decline invitation
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { invitation_id, action } = body;

    // Validate input
    if (!invitation_id || !action) {
      return NextResponse.json({
        error: 'invitation_id and action are required'
      }, { status: 400 });
    }

    if (!['accept', 'decline'].includes(action)) {
      return NextResponse.json({
        error: 'action must be either "accept" or "decline"'
      }, { status: 400 });
    }

    // Verify the invitation belongs to current user and is pending
    const { data: invitation, error: invitationError } = await supabase
      .from('workspace_members')
      .select('id, user_id, invitation_status, workspace_id')
      .eq('id', invitation_id)
      .eq('user_id', user.id)
      .eq('invitation_status', 'pending')
      .single();

    if (invitationError || !invitation) {
      return NextResponse.json({
        error: 'Invitation not found or already processed'
      }, { status: 404 });
    }

    if (action === 'accept') {
      // Update invitation status to accepted
      const { data: updatedMember, error } = await supabase
        .from('workspace_members')
        .update({
          invitation_status: 'accepted',
          joined_at: new Date().toISOString(),
        })
        .eq('id', invitation_id)
        .select()
        .single();

      if (error) {
        console.error('Error accepting invitation:', error);
        return NextResponse.json({ error: 'Failed to accept invitation' }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: 'Invitation accepted',
        member: updatedMember
      });
    } else {
      // Decline invitation - delete the record
      const { error } = await supabase
        .from('workspace_members')
        .delete()
        .eq('id', invitation_id);

      if (error) {
        console.error('Error declining invitation:', error);
        return NextResponse.json({ error: 'Failed to decline invitation' }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: 'Invitation declined'
      });
    }
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
