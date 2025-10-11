/*
  # Update Projects Table for Color System

  1. Schema Changes
    - Remove `tags` column from `projects` table
    - Add `color` column to `projects` table with default value
  
  2. Data Migration
    - Set default color for existing projects
    - Ensure all projects have a valid color value

  3. Security
    - No RLS changes needed (existing policies remain)
*/

-- Add color column to projects table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'color'
  ) THEN
    ALTER TABLE projects ADD COLUMN color TEXT DEFAULT '#008F6B';
  END IF;
END $$;

-- Update existing projects to have the default color if they don't have one
UPDATE projects 
SET color = '#008F6B' 
WHERE color IS NULL;

-- Make color column NOT NULL now that all rows have values
ALTER TABLE projects ALTER COLUMN color SET NOT NULL;

-- Remove tags column if it exists (since we're replacing it with color)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'tags'
  ) THEN
    ALTER TABLE projects DROP COLUMN tags;
  END IF;
END $$;