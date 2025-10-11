/*
  # Fix RLS infinite recursion error

  1. Security Function
    - Create `is_admin()` function with SECURITY DEFINER to bypass RLS
    - This prevents infinite recursion when checking admin status

  2. Policy Updates
    - Update categories and tools policies to use the new function
    - Remove circular dependencies in RLS policy checks

  3. Grant Permissions
    - Grant execute permission to authenticated users
*/

-- Create a function to check if the current user is an admin
-- This function needs to be SECURITY DEFINER to bypass RLS on user_profiles
-- when checking the role, preventing infinite recursion.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$;

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- Update RLS policies to use the new is_admin() function
-- Categories
DROP POLICY IF EXISTS "Admins can manage categories" ON public.categories;
CREATE POLICY "Admins can manage categories" ON public.categories
FOR ALL USING (public.is_admin());

-- Tools
DROP POLICY IF EXISTS "Admins can manage tools" ON public.tools;
CREATE POLICY "Admins can manage tools" ON public.tools
FOR ALL USING (public.is_admin());

-- Chat Sessions - fix the admin policy
DROP POLICY IF EXISTS "Admins can view all chat sessions" ON public.chat_sessions;
CREATE POLICY "Admins can view all chat sessions" ON public.chat_sessions
FOR SELECT USING (public.is_admin());

-- Tool Questions
DROP POLICY IF EXISTS "Admins can manage tool questions" ON public.tool_questions;
CREATE POLICY "Admins can manage tool questions" ON public.tool_questions
FOR ALL USING (public.is_admin());

-- Usage Analytics
DROP POLICY IF EXISTS "Admins can view all analytics" ON public.usage_analytics;
DROP POLICY IF EXISTS "Admins can view all usage analytics" ON public.usage_analytics;
CREATE POLICY "Admins can view all usage analytics" ON public.usage_analytics
FOR SELECT USING (public.is_admin());

-- User Profiles - fix the admin policy
DROP POLICY IF EXISTS "Admins can view all user profiles" ON public.user_profiles;
CREATE POLICY "Admins can view all user profiles" ON public.user_profiles
FOR SELECT USING (public.is_admin());