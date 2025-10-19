import { ChatHistory } from "@/lib/supabase";
import { createClient } from "@/lib/supabase-server";
import { ChatHistoriesList } from "@/components/chat-histories-list";
import { redirect } from "next/navigation";

interface UserInfo {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  x_github_name: string | null;
  x_github_avatar_url: string | null;
}

async function getUserInfo(userId: string | null): Promise<UserInfo | null> {
  if (!userId) return null;

  try {
    const supabase = await createClient();
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, display_name, avatar_url, github_username, github_avatar_url')
      .eq('id', userId)
      .single();

    if (error || !user) {
      console.error("Error fetching user:", error);
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      display_name: user.display_name,
      avatar_url: user.avatar_url,
      x_github_name: user.github_username,
      x_github_avatar_url: user.github_avatar_url,
    };
  } catch (error) {
    console.error("Error getting user info:", error);
    return null;
  }
}

async function getAllUsers(): Promise<Map<string, UserInfo>> {
  try {
    const supabase = await createClient();
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email, display_name, avatar_url, github_username, github_avatar_url')
      .order('created_at', { ascending: false });

    if (usersError) {
      console.error("Error fetching users:", usersError);
      return new Map();
    }

    if (!users) {
      console.log('No users found');
      return new Map();
    }

    // Transform users to UserInfo format
    const userInfoMap = new Map<string, UserInfo>();

    users.forEach((user) => {
      const userInfo: UserInfo = {
        id: user.id,
        email: user.email,
        display_name: user.display_name,
        avatar_url: user.avatar_url,
        x_github_name: user.github_username,
        x_github_avatar_url: user.github_avatar_url,
      };

      userInfoMap.set(user.id, userInfo);
    });

    return userInfoMap;
  } catch (error) {
    console.error("Error fetching all users:", error);
    return new Map();
  }
}

async function getChatHistories(): Promise<{ histories: ChatHistory[], userInfoMap: Map<string, UserInfo> }> {
  const supabase = await createClient();

  // Only load the most recent 25 sessions for the current user
  // RLS policies will automatically filter to only show user's own data
  const { data, error } = await supabase
    .from("chat_histories")
    .select("*")
    .order("latest_message_timestamp", { ascending: false })
    .limit(25);

  if (error) {
    console.error("Error fetching chat histories:", error);
    return { histories: [], userInfoMap: new Map() };
  }

  if (!data || data.length === 0) return { histories: [], userInfoMap: new Map() };

  // Get unique account IDs from all sessions
  const accountIds = [...new Set(data.map(h => h.account_id).filter(Boolean))] as string[];

  // Fetch user information for all unique account IDs
  const userInfoMap = new Map<string, UserInfo>();

  // Batch user lookups with better error handling
  if (accountIds.length > 0) {
    const userPromises = accountIds.map(async (accountId) => {
      try {
        const userInfo = await getUserInfo(accountId);
        if (userInfo) {
          return { accountId, userInfo };
        }
      } catch (err) {
        console.error(`Error fetching user ${accountId}:`, err);
      }
      return null;
    });

    const userResults = await Promise.allSettled(userPromises);

    userResults.forEach((result) => {
      if (result.status === 'fulfilled' && result.value) {
        userInfoMap.set(result.value.accountId, result.value.userInfo);
      }
    });
  }

  return { histories: data, userInfoMap };
}

async function getTotalCount(): Promise<number> {
  const supabase = await createClient();

  // RLS policies will automatically filter to only count user's own data
  const { count, error } = await supabase
    .from("chat_histories")
    .select("*", { count: "exact", head: true });

  if (error) {
    console.error("Error fetching total count:", error);
    return 0;
  }

  return count || 0;
}

export default async function Home() {
  const supabase = await createClient();

  // Get the current user - middleware ensures they're authenticated
  const { data: { user }, error } = await supabase.auth.getUser();

  // Defensive check - redirect to login if no user (should not happen with middleware)
  if (error || !user) {
    redirect('/login');
  }

  // Make all database calls in parallel
  const [{ histories, userInfoMap }, totalCount, allUsers] = await Promise.all([
    getChatHistories(),
    getTotalCount(),
    getAllUsers()
  ]);

  return <ChatHistoriesList initialHistories={histories} totalCount={totalCount} userInfoMap={userInfoMap} allUsers={allUsers} />;
}
