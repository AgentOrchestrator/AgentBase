import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Create a browser client that properly handles SSR cookies
// This ensures auth state is properly synced between client and server
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

export type ChatHistory = {
  id: string;
  timestamp: string;
  messages: Array<{
    display: string;
    pastedContents: Record<string, unknown>;
    role?: 'user' | 'assistant';
    timestamp?: string;
  }>;
  metadata: {
    projectPath?: string;
    allowedTools?: string[];
    conversationName?: string;
    projectName?: string;
  };
  agent_type: string | null;
  account_id: string | null;
  created_at: string;
  updated_at: string;
  latest_message_timestamp: string | null;
  ai_summary: string | null;
  ai_summary_generated_at: string | null;
  ai_summary_message_count: number | null;
  ai_keywords_type: string[] | null;
  ai_keywords_topic: string[] | null;
  ai_keywords_generated_at: string | null;
  ai_keywords_message_count: number | null;
  ai_title: string | null;
  ai_title_generated_at: string | null;
};

export type LLMApiKey = {
  id: string;
  account_id: string;
  provider: string;
  api_key: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};
