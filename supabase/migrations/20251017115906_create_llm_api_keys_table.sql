-- Create table for storing LLM API keys
-- This table stores encrypted API keys for different LLM providers per user
CREATE TABLE IF NOT EXISTS public.llm_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  provider TEXT NOT NULL, -- e.g., 'openai', 'anthropic', 'google', 'groq', 'ollama'
  api_key TEXT NOT NULL, -- Encrypted API key
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,

  -- Ensure one active key per provider per user
  UNIQUE(account_id, provider)
);

-- Add RLS policies
ALTER TABLE public.llm_api_keys ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own API keys
CREATE POLICY "Users can view their own API keys"
  ON public.llm_api_keys
  FOR SELECT
  USING (auth.uid() = account_id);

-- Policy: Users can insert their own API keys
CREATE POLICY "Users can insert their own API keys"
  ON public.llm_api_keys
  FOR INSERT
  WITH CHECK (auth.uid() = account_id);

-- Policy: Users can update their own API keys
CREATE POLICY "Users can update their own API keys"
  ON public.llm_api_keys
  FOR UPDATE
  USING (auth.uid() = account_id)
  WITH CHECK (auth.uid() = account_id);

-- Policy: Users can delete their own API keys
CREATE POLICY "Users can delete their own API keys"
  ON public.llm_api_keys
  FOR DELETE
  USING (auth.uid() = account_id);

-- Create index for faster lookups
CREATE INDEX idx_llm_api_keys_account_id ON public.llm_api_keys(account_id);
CREATE INDEX idx_llm_api_keys_provider ON public.llm_api_keys(provider);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_llm_api_keys_updated_at
  BEFORE UPDATE ON public.llm_api_keys
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Rollback instructions:
-- DROP TRIGGER IF EXISTS update_llm_api_keys_updated_at ON public.llm_api_keys;
-- DROP FUNCTION IF EXISTS update_updated_at_column();
-- DROP TABLE IF EXISTS public.llm_api_keys CASCADE;
