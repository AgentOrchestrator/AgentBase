import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { SharingContent } from "./sharing-content";

export default async function SharingPage() {
  const supabase = await createClient();

  // Get the current user
  const { data: { user }, error } = await supabase.auth.getUser();

  // Defensive check - redirect to login if no user
  if (error || !user) {
    redirect('/login');
  }

  return <SharingContent user={user} />;
}
