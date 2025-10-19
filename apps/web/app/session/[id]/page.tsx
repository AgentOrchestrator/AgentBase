import { ChatHistory } from "@/lib/supabase";
import { createClient } from "@/lib/supabase-server";
import { SessionPageContent } from "./session-page-content";
import { notFound } from "next/navigation";

async function getSessionById(id: string): Promise<ChatHistory | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("chat_histories")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error fetching session:", error);
    return null;
  }

  return data;
}

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

export default async function SessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSessionById(id);

  if (!session) {
    notFound();
  }

  const userInfo = await getUserInfo(session.account_id);
  
  return <SessionPageContent session={session} userInfo={userInfo} />;
}
