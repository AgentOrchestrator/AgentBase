-- Add AI title columns to chat_histories table
ALTER TABLE chat_histories
ADD COLUMN IF NOT EXISTS ai_title TEXT,
ADD COLUMN IF NOT EXISTS ai_title_generated_at TIMESTAMPTZ;

-- Add comments for documentation
COMMENT ON COLUMN chat_histories.ai_title IS 'AI-generated title for the conversation';
COMMENT ON COLUMN chat_histories.ai_title_generated_at IS 'When the AI title was generated';

-- Add index for AI title queries
CREATE INDEX IF NOT EXISTS idx_chat_histories_ai_title_generated_at
ON chat_histories(ai_title_generated_at DESC);

-- Add index for finding records that need AI title processing
CREATE INDEX IF NOT EXISTS idx_chat_histories_needs_title
ON chat_histories(updated_at)
WHERE ai_title IS NULL;

-- Add AI title preference to user_preferences table
ALTER TABLE user_preferences
ADD COLUMN IF NOT EXISTS ai_title_enabled BOOLEAN NOT NULL DEFAULT true;

-- Add comment for documentation
COMMENT ON COLUMN user_preferences.ai_title_enabled IS 'Whether AI titles should be generated for this user''s sessions';
