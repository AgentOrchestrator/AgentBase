import { supabase, ChatHistory } from "@/lib/supabase";
import { ChatHistoriesList } from "@/components/chat-histories-list";

async function getChatHistories(): Promise<ChatHistory[]> {
  const { data, error } = await supabase
    .from("chat_histories")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("Error fetching chat histories:", error);
    return [];
  }

  return data || [];
}

export default async function Home() {
  const histories = await getChatHistories();

  return <ChatHistoriesList initialHistories={histories} />;
}
