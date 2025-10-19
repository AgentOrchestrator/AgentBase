-- Enable Realtime for canvas-related tables
-- This allows the web frontend to receive instant updates when data changes

-- Add tables to the realtime publication
-- This broadcasts INSERT, UPDATE, DELETE events to subscribed clients
ALTER PUBLICATION supabase_realtime ADD TABLE chat_histories;
ALTER PUBLICATION supabase_realtime ADD TABLE pinned_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE session_shares;
ALTER PUBLICATION supabase_realtime ADD TABLE session_workspace_shares;

-- Note: RLS policies still apply - users will only receive events for rows they have access to
-- The existing RLS policies on these tables will filter what each user can see via Realtime
