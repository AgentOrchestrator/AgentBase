-- Drop existing table and recreate with UUID
DROP TABLE IF EXISTS public.chat_histories CASCADE;

-- Create chat_histories table with UUID
CREATE TABLE public.chat_histories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMPTZ NOT NULL,
    messages JSONB NOT NULL DEFAULT '[]'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    agent_type TEXT DEFAULT 'claude_code',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_chat_histories_timestamp ON public.chat_histories(timestamp DESC);
CREATE INDEX idx_chat_histories_created_at ON public.chat_histories(created_at DESC);
CREATE INDEX idx_chat_histories_agent_type ON public.chat_histories(agent_type);

-- Enable Row Level Security
ALTER TABLE public.chat_histories ENABLE ROW LEVEL SECURITY;

-- Create policy
CREATE POLICY "Enable all access for authenticated users" ON public.chat_histories
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Add check constraint
ALTER TABLE public.chat_histories
ADD CONSTRAINT check_agent_type CHECK (
    agent_type IN ('claude_code', 'codex', 'cursor', 'windsurf', 'other')
);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_chat_histories_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER update_chat_histories_updated_at
    BEFORE UPDATE ON public.chat_histories
    FOR EACH ROW
    EXECUTE FUNCTION public.update_chat_histories_updated_at();
