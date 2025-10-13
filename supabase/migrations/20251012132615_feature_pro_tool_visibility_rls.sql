-- Filename: 20251012132615_feature_pro_tool_visibility_rls.sql
-- Feature: Pro Tool Visibility Gap (RLS Update)
-- Description: This migration applies Row Level Security policies to the new
--              `tool_catalog` view, ensuring that all authenticated users can
--              see all active tools, regardless of their "pro" status.

BEGIN;

-- Section 1: Enable RLS on the `tool_catalog` view
ALTER VIEW public.tool_catalog OWNER TO postgres;
ALTER TABLE public.tool_catalog ENABLE ROW LEVEL SECURITY;
 
-- Section 2: Define RLS policies for the `tool_catalog` view

-- Policy 1: Allow any authenticated user to view active tools in the catalog.
-- This policy grants SELECT access to all users for tools that are active.
-- It does not check for `is_pro` status, so all tools are visible.
DROP POLICY IF EXISTS "Anyone can view active tools in the catalog" ON public.tool_catalog;
CREATE POLICY "Anyone can view active tools in the catalog"
ON public.tool_catalog
FOR SELECT
TO authenticated
USING (active = true);

-- Policy 2: Allow admins to see everything in the catalog, including inactive tools.
-- This is useful for administrative purposes.
DROP POLICY IF EXISTS "Admins can view all tools in the catalog" ON public.tool_catalog;
CREATE POLICY "Admins can view all tools in the catalog"
ON public.tool_catalog
FOR SELECT
TO authenticated
USING (public.is_admin());


COMMIT;