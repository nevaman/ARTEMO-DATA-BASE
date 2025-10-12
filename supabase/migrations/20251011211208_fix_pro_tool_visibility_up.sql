/*
  # Fix Pro Tool Visibility

  ## Summary
  Creates a public catalog view so all users can see Pro tools (marked as locked)
  while keeping the underlying tools table secure.

  ## Changes Made
  1. **New View**: `tool_catalog`
     - Exposes: id, title, description, category_id, slug, is_pro, active, featured, usage_count, created_at, updated_at
     - Omits: prompt_instructions (sensitive Pro content)
     - Shows all active tools regardless of Pro status
  
  2. **Security**
     - View is read-only for all authenticated users
     - Base `tools` table RLS policies remain unchanged (execution still restricted)
     - Pro-only prompts stay hidden from non-Pro users
*/

BEGIN;

-- Drop existing view if it exists
DROP VIEW IF EXISTS tool_catalog;

-- Create read-only catalog view exposing safe fields
CREATE VIEW tool_catalog AS
SELECT 
  id,
  title,
  slug,
  description,
  category_id,
  active,
  featured,
  is_pro,
  usage_count,
  created_at,
  updated_at
FROM tools
WHERE active = true;

-- Grant SELECT on the view to all authenticated users
GRANT SELECT ON tool_catalog TO authenticated;

-- Add comment for documentation
COMMENT ON VIEW tool_catalog IS 'Public catalog of all active tools. Exposes metadata without sensitive prompt content. Used for displaying tool cards in the UI, including locked Pro tools for non-Pro users.';

COMMIT;
