-- Create daemon_auth_sessions table for handling daemon authentication
CREATE TABLE daemon_auth_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  consumed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add index for faster queries by device_id
CREATE INDEX idx_daemon_auth_sessions_device_id ON daemon_auth_sessions(device_id);

-- Add index for faster queries by user_id
CREATE INDEX idx_daemon_auth_sessions_user_id ON daemon_auth_sessions(user_id);

-- Add index for finding unconsumed sessions
CREATE INDEX idx_daemon_auth_sessions_consumed ON daemon_auth_sessions(consumed);

-- Add RLS policies
ALTER TABLE daemon_auth_sessions ENABLE ROW LEVEL SECURITY;

-- Users can only read their own auth sessions
CREATE POLICY "Users can read own auth sessions"
  ON daemon_auth_sessions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can only insert their own auth sessions
CREATE POLICY "Users can insert own auth sessions"
  ON daemon_auth_sessions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own auth sessions
CREATE POLICY "Users can update own auth sessions"
  ON daemon_auth_sessions
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Auto-delete consumed sessions after 24 hours (optional cleanup)
-- This can be run as a periodic job
CREATE OR REPLACE FUNCTION cleanup_consumed_auth_sessions()
RETURNS void AS $$
BEGIN
  DELETE FROM daemon_auth_sessions
  WHERE consumed = TRUE
  AND created_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;
