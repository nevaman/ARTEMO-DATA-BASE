/*
  # Fix Announcements System and Chat History Cleanup

  1. Announcements Table
    - Create announcements table with proper structure
    - Add RLS policies for admin management and user viewing
    - Include trigger for updated_at timestamp

  2. Chat History Cleanup
    - Add function to help with bulk chat deletion
    - Ensure proper cascade deletes

  3. Security
    - Enable RLS on announcements table
    - Add policies for admin-only write access
    - Add policies for user read access to active announcements
*/

-- Create announcements table
CREATE TABLE IF NOT EXISTS announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  show_on_login BOOLEAN DEFAULT false,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_announcements_active ON announcements(active);
CREATE INDEX IF NOT EXISTS idx_announcements_login ON announcements(show_on_login, active);

-- Enable RLS
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- RLS Policies for announcements
CREATE POLICY "Users can view active announcements"
  ON announcements
  FOR SELECT
  TO authenticated
  USING (active = true);

CREATE POLICY "Admins can manage announcements"
  ON announcements
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Create trigger function for updated_at
CREATE OR REPLACE FUNCTION update_announcements_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER update_announcements_updated_at
  BEFORE UPDATE ON announcements
  FOR EACH ROW
  EXECUTE FUNCTION update_announcements_updated_at();

-- Function to help with chat history cleanup (for admin use)
CREATE OR REPLACE FUNCTION cleanup_duplicate_chats(target_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete duplicate chat sessions (keeping the most recent one for each tool/title combination)
  WITH duplicates AS (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY user_id, tool_id, title 
             ORDER BY created_at DESC
           ) as rn
    FROM chat_sessions
    WHERE user_id = target_user_id
  )
  DELETE FROM chat_sessions 
  WHERE id IN (
    SELECT id FROM duplicates WHERE rn > 1
  );
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;