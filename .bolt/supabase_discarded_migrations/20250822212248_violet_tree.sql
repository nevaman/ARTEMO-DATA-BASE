/*
  # Add icon fields to categories table

  1. New Columns
    - `icon_name` (text) - Name of the icon to use for the category
    - `icon_color` (text) - Color class for the icon

  2. Changes
    - Add icon_name column with default value
    - Add icon_color column with default value
    - Update existing categories with default icon settings
*/

-- Add icon fields to categories table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'categories' AND column_name = 'icon_name'
  ) THEN
    ALTER TABLE categories ADD COLUMN icon_name TEXT DEFAULT 'Settings';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'categories' AND column_name = 'icon_color'
  ) THEN
    ALTER TABLE categories ADD COLUMN icon_color TEXT DEFAULT 'text-blue-600';
  END IF;
END $$;

-- Update existing categories with default icon settings if they don't have them
UPDATE categories 
SET 
  icon_name = COALESCE(icon_name, 'Settings'),
  icon_color = COALESCE(icon_color, 'text-blue-600')
WHERE icon_name IS NULL OR icon_color IS NULL;