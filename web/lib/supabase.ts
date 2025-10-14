import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type ChatHistory = {
  id: string;
  timestamp: string;
  messages: Array<{
    display: string;
    pastedContents: Record<string, any>;
  }>;
  metadata: {
    projectPath?: string;
    allowedTools?: string[];
  };
  agent_type: string | null;
  account_id: string | null;
  created_at: string;
  updated_at: string;
  ai_summary: string | null;
  ai_summary_generated_at: string | null;
  ai_summary_message_count: number | null;
};
