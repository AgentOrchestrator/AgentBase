-- Add is_default column to llm_api_keys table
-- This column determines which provider is used as the default for chat

ALTER TABLE public.llm_api_keys
ADD COLUMN is_default BOOLEAN DEFAULT false;

-- Create a unique partial index to ensure only one default per user
CREATE UNIQUE INDEX idx_llm_api_keys_default_per_user
ON public.llm_api_keys(account_id)
WHERE is_default = true;

-- Create a function to automatically set default provider
-- If user has only one API key, make it default
-- If user adds a second key and no default is set, keep the first one as default
CREATE OR REPLACE FUNCTION auto_set_default_llm_provider()
RETURNS TRIGGER AS $$
DECLARE
  key_count INTEGER;
  has_default BOOLEAN;
BEGIN
  -- Count total keys for this user
  SELECT COUNT(*) INTO key_count
  FROM public.llm_api_keys
  WHERE account_id = NEW.account_id;

  -- Check if there's already a default
  SELECT EXISTS(
    SELECT 1 FROM public.llm_api_keys
    WHERE account_id = NEW.account_id AND is_default = true
  ) INTO has_default;

  -- If this is the only key OR there's no default yet, make it default
  IF key_count = 1 OR NOT has_default THEN
    NEW.is_default = true;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-set default on insert
CREATE TRIGGER trigger_auto_set_default_llm_provider
  BEFORE INSERT ON public.llm_api_keys
  FOR EACH ROW
  EXECUTE FUNCTION auto_set_default_llm_provider();

-- Rollback instructions:
-- DROP TRIGGER IF EXISTS trigger_auto_set_default_llm_provider ON public.llm_api_keys;
-- DROP FUNCTION IF EXISTS auto_set_default_llm_provider();
-- DROP INDEX IF EXISTS idx_llm_api_keys_default_per_user;
-- ALTER TABLE public.llm_api_keys DROP COLUMN IF EXISTS is_default;
