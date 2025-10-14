-- Create chat_histories table
CREATE TABLE IF NOT EXISTS public.chat_histories (
    id TEXT PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL,
    messages JSONB NOT NULL DEFAULT '[]'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on timestamp for faster queries
CREATE INDEX IF NOT EXISTS idx_chat_histories_timestamp ON public.chat_histories(timestamp DESC);

-- Create index on created_at
CREATE INDEX IF NOT EXISTS idx_chat_histories_created_at ON public.chat_histories(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.chat_histories ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations for now (adjust based on your security needs)
CREATE POLICY "Enable all access for authenticated users" ON public.chat_histories
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_chat_histories_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_chat_histories_updated_at
    BEFORE UPDATE ON public.chat_histories
    FOR EACH ROW
    EXECUTE FUNCTION public.update_chat_histories_updated_at();
