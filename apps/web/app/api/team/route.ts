import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

interface TeamMember {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  x_github_name: string | null;
  x_github_avatar_url: string | null;
  latest_message_timestamp: string | null;
  recentConversations: Array<{
    id: string;
    title: string;
    latest_message_timestamp: string;
  }>;
}

export async function GET(request: NextRequest) {
  try {
    // Get all users from public.users table
    const supabase = await createClient();
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email, display_name, avatar_url, github_username, github_avatar_url')
      .order('created_at', { ascending: false});

    if (usersError) {
      console.error("Error fetching users:", usersError);
      return NextResponse.json(
        { error: "Failed to fetch team members" },
        { status: 500 }
      );
    }

    if (!users) {
      return NextResponse.json({ teamMembers: [] });
    }

    // Transform users to team member format with recent conversations
    const teamMembers: TeamMember[] = await Promise.all(
      users.map(async (user) => {
        const displayName = user.github_username ||
                           user.display_name ||
                           null;

        // Fetch top 3 recent conversations for this user
        const { data: recentConversations, error: conversationsError } = await supabase
          .from('chat_histories')
          .select('id, metadata, latest_message_timestamp, ai_title')
          .eq('account_id', user.id)
          .order('latest_message_timestamp', { ascending: false })
          .limit(3);

        if (conversationsError) {
          console.error(`Error fetching conversations for user ${user.id}:`, conversationsError);
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
          id: user.id,
          email: user.email || '',
          display_name: displayName,
          avatar_url: user.avatar_url || null,
          x_github_name: user.github_username || null,
          x_github_avatar_url: user.github_avatar_url || null,
          latest_message_timestamp: latestMessageTimestamp,
          recentConversations: conversations,
        };
      })
    );

    return NextResponse.json({ teamMembers });
  } catch (error) {
    console.error("Error fetching team members:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
