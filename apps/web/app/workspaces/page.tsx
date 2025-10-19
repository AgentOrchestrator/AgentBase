import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { WorkspacesContent } from "./workspaces-content";

export default async function WorkspacesPage() {
  const supabase = await createClient();

  // Get the current user
  const { data: { user }, error } = await supabase.auth.getUser();

  // Defensive check - redirect to login if no user
  if (error || !user) {
    redirect('/login');
  }

  return <WorkspacesContent user={user} />;
}
