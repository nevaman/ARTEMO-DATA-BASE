/*
  # Add icon columns to categories table

  1. New Columns
    - `icon_name` (text) - Name of the icon component to use
    - `icon_color` (text) - CSS color class for the icon

  2. Default Values
    - Set default icon_name to 'Settings'
    - Set default icon_color to 'text-blue-600'

  3. Update existing categories
    - Apply default values to existing categories
*/

-- Add icon columns to categories table
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

-- Update existing categories with default values
UPDATE categories 
SET 
  icon_name = COALESCE(icon_name, 'Settings'),
  icon_color = COALESCE(icon_color, 'text-blue-600')
WHERE icon_name IS NULL OR icon_color IS NULL;