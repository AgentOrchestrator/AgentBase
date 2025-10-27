import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

interface WorkspaceMember {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  x_github_name: string | null;
  x_github_avatar_url: string | null;
  latest_message_timestamp: string | null;
  role: string;
  recentConversations: Array<{
    id: string;
    title: string;
    latest_message_timestamp: string;
  }>;
}

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

    // Fetch workspace members (RLS will ensure user has access)
    const { data: members, error: membersError } = await supabase
      .from('workspace_members')
      .select(`
        id,
        user_id,
        role,
        joined_at
      `)
      .eq('workspace_id', workspaceId)
      .eq('invitation_status', 'accepted')
      .order('joined_at', { ascending: true });

    if (membersError) {
      console.error('Error fetching workspace members:', membersError);
      return NextResponse.json(
        { error: 'Failed to fetch workspace members' },
        { status: 500 }
      );
    }

    if (!members || members.length === 0) {
      return NextResponse.json({ workspaceMembers: [] });
    }

    // Get user IDs
    const userIds = members.map(m => m.user_id);

    // Fetch user details
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email, display_name, avatar_url, github_username, github_avatar_url')
      .in('id', userIds);

    if (usersError) {
      console.error('Error fetching users:', usersError);
      return NextResponse.json(
        { error: 'Failed to fetch user details' },
        { status: 500 }
      );
    }

    // Transform members to workspace member format with recent conversations
    const workspaceMembers: WorkspaceMember[] = await Promise.all(
      members.map(async (member) => {
        const userDetails = users?.find(u => u.id === member.user_id);

        if (!userDetails) {
          return null;
        }

        const displayName = userDetails.github_username ||
                           userDetails.display_name ||
                           null;

        // Fetch top 3 recent conversations for this user
        const { data: recentConversations, error: conversationsError } = await supabase
          .from('chat_histories')
          .select('id, metadata, latest_message_timestamp, ai_title')
          .eq('account_id', userDetails.id)
          .order('latest_message_timestamp', { ascending: false })
          .limit(3);

        if (conversationsError) {
          console.error(`Error fetching conversations for user ${userDetails.id}:`, conversationsError);
        }

        // Extract conversation titles from metadata
        const conversations = (recentConversations || []).map(conv => ({
          id: conv.id,
          title: conv.ai_title ||
                 conv.metadata?.conversationName ||
                 conv.metadata?.projectName ||
                 'Untitled Conversation',
          latest_message_timestamp: conv.latest_message_timestamp,
        }));

        // Get the latest message timestamp from the most recent conversation
        const latestMessageTimestamp = conversations.length > 0
          ? conversations[0].latest_message_timestamp
          : null;

        return {
          id: userDetails.id,
          email: userDetails.email || '',
          display_name: displayName,
          avatar_url: userDetails.avatar_url || null,
          x_github_name: userDetails.github_username || null,
          x_github_avatar_url: userDetails.github_avatar_url || null,
          latest_message_timestamp: latestMessageTimestamp,
          role: member.role,
          recentConversations: conversations,
        };
      })
    );

    // Filter out null values (users that weren't found)
    const filteredMembers = workspaceMembers.filter(m => m !== null) as WorkspaceMember[];

    return NextResponse.json({ workspaceMembers: filteredMembers });
  } catch (error) {
    console.error("Error fetching workspace team members:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
