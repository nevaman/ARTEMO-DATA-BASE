-- Filename: 20251011211207_feature_pro_user_rls.sql
-- Feature: Pro User Role & Pro-Only Tool Access (RLS Update)
-- Description: This migration introduces a new security function `is_pro_user()` and
--              updates the Row Level Security policies on the `tools` table to
--              restrict access to pro-only tools.

BEGIN;

-- Section 1: Create the `is_pro_user()` security function

-- This function securely checks if the current user is a 'pro' or 'admin'.
-- It is defined with `SECURITY DEFINER` to bypass RLS on the `user_profiles` table,
-- preventing recursion and ensuring a reliable role check.
CREATE OR REPLACE FUNCTION public.is_pro_user()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
-- Setting the search_path is a security best practice for SECURITY DEFINER functions.
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Check if a user profile exists for the current authenticated user (auth.uid())
  -- with a role of either 'pro' or 'admin'.
  RETURN EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE id = auth.uid() AND role IN ('pro', 'admin')
  );
END;
$$;

-- Add a comment to describe the function's purpose.
COMMENT ON FUNCTION public.is_pro_user() IS 'Securely checks if the current user has ''pro'' or ''admin'' privileges, suitable for use in RLS policies.';


-- Section 2: Update Row Level Security policies for the `tools` table

-- First, drop the existing policy that allows general access to active tools.
-- We will replace it with more granular policies.
DROP POLICY IF EXISTS "Anyone can view active tools" ON public.tools;

-- Policy 1: Allow anyone to view non-pro tools.
-- This policy grants SELECT access to all users for tools that are active and NOT marked as pro.
CREATE POLICY "Users can view non-pro tools"
ON public.tools
FOR SELECT
USING (active = true AND is_pro = false);

-- Policy 2: Allow pro users to view pro tools.
-- This policy grants SELECT access to pro users (checked via `is_pro_user()`)
-- for tools that are active and marked as pro.
CREATE POLICY "Pro users can view pro tools"
ON public.tools
FOR SELECT
USING (active = true AND is_pro = true AND public.is_pro_user() = true);

-- The existing policy "Admins can manage tools" already provides full access for admins,
-- so we don't need to change it. Admins can see all tools, pro or not.

COMMIT;