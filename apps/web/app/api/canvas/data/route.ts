import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { ChatHistory } from '@/lib/supabase';

interface UserWithMessages {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  x_github_name: string | null;
  x_github_avatar_url: string | null;
  recentMessages: ChatHistory[];
}

/**
 * Gets users and their accessible chat histories respecting RLS policies.
 * Users will only see:
 * - Their own chat histories
 * - Chat histories from projects shared with them individually
 * - Chat histories from projects shared with their workspaces
 *
 * Only shows sessions with activity in the last 24 hours, but still displays
 * all users (even if they have no recent sessions).
 */
async function getUsersWithAccessibleMessages(currentUserId: string): Promise<UserWithMessages[]> {
  try {
    // Use authenticated client to respect RLS
    const supabase = await createClient();

    // Calculate timestamp for 24 hours ago
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);
    const twentyFourHoursAgoISO = twentyFourHoursAgo.toISOString();

    // Get ALL accessible chat histories to find all unique users (RLS will filter automatically)
    const { data: allAccessibleChats, error: allChatsError } = await supabase
      .from('chat_histories')
      .select('account_id, project_id')
      .order('latest_message_timestamp', { ascending: false })
      .limit(500);

    if (allChatsError) {
      console.error("Error fetching all accessible chat histories:", allChatsError);
      return [];
    }

    // Get unique user IDs from all accessible chats
    const allUserIds = Array.from(new Set(
      (allAccessibleChats || [])
        .map(chat => chat.account_id)
        .filter(id => id != null)
    ));

    // Now get recent chat histories (last 24 hours only)
    const { data: accessibleChats, error: chatsError } = await supabase
      .from('chat_histories')
      .select('*, project_id')
      .gte('latest_message_timestamp', twentyFourHoursAgoISO)
      .order('latest_message_timestamp', { ascending: false })
      .limit(200);

    if (chatsError) {
      console.error("Error fetching accessible chat histories:", chatsError);
      return [];
    }

    console.log(`Found ${accessibleChats?.length || 0} accessible chat histories from last 24h for user ${currentUserId}`);

    // Enrich chats with share counts using batched queries
    const chatIds = (accessibleChats || []).map(chat => chat.id);

    let chatsWithShares: ChatHistory[] = [];

    if (chatIds.length > 0) {
      // Fetch all user shares in one query
      const { data: userShares } = await supabase
        .from('session_shares')
        .select('session_id')
        .in('session_id', chatIds);

      // Fetch all workspace shares in one query
      const { data: workspaceShares } = await supabase
        .from('session_workspace_shares')
        .select('session_id')
        .in('session_id', chatIds);

      // Count shares per session
      const shareCountMap = new Map<string, number>();
      userShares?.forEach(share => {
        shareCountMap.set(share.session_id, (shareCountMap.get(share.session_id) || 0) + 1);
      });
      workspaceShares?.forEach(share => {
        shareCountMap.set(share.session_id, (shareCountMap.get(share.session_id) || 0) + 1);
      });

      // Add share counts to chats
      chatsWithShares = accessibleChats.map(chat => ({
        ...chat,
        share_count: shareCountMap.get(chat.id) || 0,
      })) as ChatHistory[];
    }

    // Group chats by user (account_id)
    const chatsByUser = new Map<string, ChatHistory[]>();

    chatsWithShares.forEach((chat) => {
      if (chat.account_id) {
        if (!chatsByUser.has(chat.account_id)) {
          chatsByUser.set(chat.account_id, []);
        }
        // Limit to 10 most recent per user
        const userChats = chatsByUser.get(chat.account_id)!;
        if (userChats.length < 10) {
          userChats.push(chat);
        }
      }
    });

    // Use allUserIds to ensure we show ALL users with accessible chats, even if no recent activity
    const usersWithMessages: UserWithMessages[] = [];

    // Fetch all users at once from public.users table
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email, display_name, avatar_url, github_username, github_avatar_url')
      .in('id', allUserIds);

    if (usersError) {
      console.error("Error fetching users:", usersError);
      return [];
    }

    if (!users || users.length === 0) {
      console.log('No users found');
      return [];
    }

    // Map users to UserWithMessages (include all users, even those with no recent chats)
    for (const user of users) {
      usersWithMessages.push({
        id: user.id,
        email: user.email,
        display_name: user.display_name,
        avatar_url: user.avatar_url,
        x_github_name: user.github_username,
        x_github_avatar_url: user.github_avatar_url,
        recentMessages: chatsByUser.get(user.id) || [], // Empty array if no recent sessions
      });
    }

    console.log(`Returning ${usersWithMessages.length} users with accessible messages`);
    return usersWithMessages;
  } catch (error) {
    console.error("Error fetching users with accessible messages:", error);
    return [];
  }
}

export async function GET() {
  try {
    // Get authenticated user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized',
          timestamp: new Date().toISOString()
        },
        { status: 401 }
      );
    }

    // Get users with accessible messages (respects RLS)
    const usersWithMessages = await getUsersWithAccessibleMessages(user.id);

    // Fetch pinned conversations for the user
    const { data: pinnedConversations } = await supabase
      .from('pinned_conversations')
      .select('conversation_id')
      .eq('user_id', user.id);

    const pinnedIds = pinnedConversations?.map(pc => pc.conversation_id) || [];

    // Debug logging
    console.log('Canvas API - users with accessible messages:', usersWithMessages.length);
    console.log('Canvas API - pinned conversations:', pinnedIds.length);

    return NextResponse.json({
      success: true,
      data: usersWithMessages,
      pinnedConversationIds: pinnedIds,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error in canvas data API:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch canvas data',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
