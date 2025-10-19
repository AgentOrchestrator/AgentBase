import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { SettingsContent } from "./settings-content";

export default async function SettingsPage() {
  const supabase = await createClient();

  // Get the current user
  const { data: { user }, error } = await supabase.auth.getUser();

  // Defensive check - redirect to login if no user
  if (error || !user) {
    redirect('/login');
  }

  // Check if GitHub is connected by checking app_metadata.providers
  // This is the source of truth for linked OAuth providers
  const providers = user.app_metadata?.providers || [];
  const githubConnected = providers.includes('github');
  const githubUsername = user.user_metadata?.x_github_username || null;

  return (
    <SettingsContent
      user={user}
      githubConnected={githubConnected}
      githubUsername={githubUsername}
    />
  );
}
