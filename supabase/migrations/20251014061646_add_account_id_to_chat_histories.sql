-- Add account_id column to chat_histories table
ALTER TABLE chat_histories
ADD COLUMN account_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add index for faster queries by account_id
CREATE INDEX idx_chat_histories_account_id ON chat_histories(account_id);
