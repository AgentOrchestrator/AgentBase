-- Add 'factory' agent type to chat_histories table
-- This allows the daemon to track conversations from Factory AI

ALTER TABLE public.chat_histories
  DROP CONSTRAINT IF EXISTS check_agent_type;

ALTER TABLE public.chat_histories
  ADD CONSTRAINT check_agent_type
  CHECK (agent_type IN ('claude_code', 'codex', 'cursor', 'vscode', 'windsurf', 'factory', 'other'));

COMMENT ON CONSTRAINT check_agent_type ON public.chat_histories IS 'Validates agent_type values including Factory AI';

