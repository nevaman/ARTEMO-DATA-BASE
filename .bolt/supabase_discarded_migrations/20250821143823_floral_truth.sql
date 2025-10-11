/*
  # Create announcements table for admin management

  1. New Tables
    - `announcements`
      - `id` (uuid, primary key)
      - `title` (text, required)
      - `content` (text, required)
      - `active` (boolean, default true)
      - `show_on_login` (boolean, default false)
      - `created_by` (uuid, references user_profiles)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `announcements` table
    - Add policy for admins to manage announcements
    - Add policy for users to view active announcements

  3. Indexes
    - Index on active status for performance
    - Index on show_on_login for login queries
*/

CREATE TABLE IF NOT EXISTS announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  active boolean DEFAULT true,
  show_on_login boolean DEFAULT false,
  created_by uuid REFERENCES user_profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- Create policies
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

CREATE POLICY "Users can view active announcements"
  ON announcements
  FOR SELECT
  TO authenticated
  USING (active = true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_announcements_active 
  ON announcements(active);

CREATE INDEX IF NOT EXISTS idx_announcements_login 
  ON announcements(show_on_login, active);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_announcements_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_announcements_updated_at
  BEFORE UPDATE ON announcements
  FOR EACH ROW
  EXECUTE FUNCTION update_announcements_updated_at();