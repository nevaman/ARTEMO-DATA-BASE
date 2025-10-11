/*
  # Add knowledge base file path to tools table

  1. Schema Changes
    - Add `knowledge_base_file_path` column to `tools` table
    - Column stores the Supabase Storage path for uploaded knowledge base files
    - Optional field (nullable) since not all tools require knowledge base files

  2. Migration Details
    - Safe addition using IF NOT EXISTS pattern
    - No data migration required (new column, existing tools will have NULL)
    - Maintains backward compatibility
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tools' AND column_name = 'knowledge_base_file_path'
  ) THEN
    ALTER TABLE tools ADD COLUMN knowledge_base_file_path TEXT;
  END IF;
END $$;