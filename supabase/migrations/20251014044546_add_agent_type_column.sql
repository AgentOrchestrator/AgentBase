-- Add agent_type column to chat_histories table
ALTER TABLE public.chat_histories
ADD COLUMN agent_type TEXT DEFAULT 'claude_code';

-- Create index on agent_type for filtering
CREATE INDEX IF NOT EXISTS idx_chat_histories_agent_type ON public.chat_histories(agent_type);

-- Add a check constraint to validate agent_type values
ALTER TABLE public.chat_histories
ADD CONSTRAINT check_agent_type CHECK (
    agent_type IN ('claude_code', 'codex', 'cursor', 'windsurf', 'other')
);
