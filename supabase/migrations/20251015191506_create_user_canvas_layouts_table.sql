-- Create user_canvas_layouts table
CREATE TABLE IF NOT EXISTS user_canvas_layouts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL,
  position_x REAL NOT NULL,
  position_y REAL NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, node_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_canvas_layouts_user_id ON user_canvas_layouts(user_id);
CREATE INDEX IF NOT EXISTS idx_user_canvas_layouts_node_id ON user_canvas_layouts(node_id);

-- Enable RLS
ALTER TABLE user_canvas_layouts ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own canvas layouts" ON user_canvas_layouts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own canvas layouts" ON user_canvas_layouts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own canvas layouts" ON user_canvas_layouts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own canvas layouts" ON user_canvas_layouts
  FOR DELETE USING (auth.uid() = user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_user_canvas_layouts_updated_at
  BEFORE UPDATE ON user_canvas_layouts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
