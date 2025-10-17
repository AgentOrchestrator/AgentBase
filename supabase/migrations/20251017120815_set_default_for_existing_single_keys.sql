-- Update existing API keys to set as default if user only has one key
-- This migration ensures users with a single API key have it automatically set as default

-- Set is_default = true for users who have exactly one API key
UPDATE public.llm_api_keys
SET is_default = true
WHERE account_id IN (
  SELECT account_id
  FROM public.llm_api_keys
  GROUP BY account_id
  HAVING COUNT(*) = 1
);

-- For users with multiple keys but no default, set the oldest key as default
WITH first_keys AS (
  SELECT DISTINCT ON (account_id) id
  FROM public.llm_api_keys
  WHERE account_id IN (
    -- Find accounts with multiple keys
    SELECT account_id
    FROM public.llm_api_keys
    GROUP BY account_id
    HAVING COUNT(*) > 1
  )
  AND account_id NOT IN (
    -- Exclude accounts that already have a default
    SELECT account_id
    FROM public.llm_api_keys
    WHERE is_default = true
  )
  ORDER BY account_id, created_at ASC
)
UPDATE public.llm_api_keys
SET is_default = true
WHERE id IN (SELECT id FROM first_keys);

-- Rollback instructions:
-- UPDATE public.llm_api_keys SET is_default = false WHERE is_default = true;
