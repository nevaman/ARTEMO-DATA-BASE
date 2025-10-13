-- Filename: 20251012132530_feature_pro_tool_visibility.sql
-- Feature: Pro Tool Visibility Gap
-- Description: This migration creates a read-only view `tool_catalog` to safely
--              expose a subset of tool data to all users. This allows non-pro
--              users to see that Pro tools exist without accessing sensitive
--              prompt data.

BEGIN;

-- Section 1: Create the `tool_catalog` view
-- This view joins tools with categories to provide category names and exposes only
-- fields that are safe for all users to see.
CREATE OR REPLACE VIEW public.tool_catalog AS
SELECT
    t.id,
    t.title,
    t.slug,
    t.description,
    c.name AS category,
    t.active,
    t.featured,
    t.is_pro,
    t.usage_count,
    t.created_at,
    t.updated_at
FROM
    public.tools t
LEFT JOIN
    public.categories c ON t.category_id = c.id;

-- Add a comment to describe the view's purpose.
COMMENT ON VIEW public.tool_catalog IS 'A publicly-readable view of tools that exposes only non-sensitive information for catalog display purposes.';


-- Section 2: Grant permissions on the new view
-- Grant SELECT access on this view to both anonymous and authenticated users.
-- This allows the frontend to fetch the list of all tools for display.
GRANT SELECT ON public.tool_catalog TO anon;
GRANT SELECT ON public.tool_catalog TO authenticated;


COMMIT;