-- Add AI summary and keywords columns to chat_histories table

-- Add latest_message_timestamp for tracking when messages were last updated
ALTER TABLE chat_histories
ADD COLUMN IF NOT EXISTS latest_message_timestamp TIMESTAMPTZ;

-- Add AI summary columns
ALTER TABLE chat_histories
ADD COLUMN IF NOT EXISTS ai_summary TEXT,
ADD COLUMN IF NOT EXISTS ai_summary_generated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS ai_summary_message_count INTEGER;

-- Add AI keywords columns (using text arrays for PostgreSQL)
ALTER TABLE chat_histories
ADD COLUMN IF NOT EXISTS ai_keywords_type TEXT[],
ADD COLUMN IF NOT EXISTS ai_keywords_topic TEXT[],
ADD COLUMN IF NOT EXISTS ai_keywords_generated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS ai_keywords_message_count INTEGER;

-- Add indexes for AI-related queries
CREATE INDEX IF NOT EXISTS idx_chat_histories_ai_summary_generated_at
ON chat_histories(ai_summary_generated_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_histories_ai_keywords_generated_at
ON chat_histories(ai_keywords_generated_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_histories_latest_message_timestamp
ON chat_histories(latest_message_timestamp DESC);

-- Add index for finding records that need AI processing
CREATE INDEX IF NOT EXISTS idx_chat_histories_needs_summary
ON chat_histories(updated_at)
WHERE ai_summary IS NULL;

CREATE INDEX IF NOT EXISTS idx_chat_histories_needs_keywords
ON chat_histories(updated_at)
WHERE ai_keywords_type IS NULL;

-- Add comments for documentation
COMMENT ON COLUMN chat_histories.latest_message_timestamp IS 'Timestamp of the most recent message in the conversation';
COMMENT ON COLUMN chat_histories.ai_summary IS 'AI-generated summary of the conversation';
COMMENT ON COLUMN chat_histories.ai_summary_generated_at IS 'When the AI summary was generated';
COMMENT ON COLUMN chat_histories.ai_summary_message_count IS 'Number of messages that were included in the summary';
COMMENT ON COLUMN chat_histories.ai_keywords_type IS 'AI-extracted keywords about the type/category of conversation';
COMMENT ON COLUMN chat_histories.ai_keywords_topic IS 'AI-extracted keywords about the topics discussed';
COMMENT ON COLUMN chat_histories.ai_keywords_generated_at IS 'When the AI keywords were generated';
COMMENT ON COLUMN chat_histories.ai_keywords_message_count IS 'Number of messages that were analyzed for keywords';
