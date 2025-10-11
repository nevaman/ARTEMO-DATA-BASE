/*
  # Fix Foreign Key Relationships

  1. Foreign Key Updates
    - Update `usage_analytics.user_id` to reference `user_profiles.id` instead of `users.id`
    - Update `tools.created_by` to reference `user_profiles.id` instead of `users.id`
  
  2. Data Integrity
    - Safely drop and recreate constraints
    - Ensure all existing data remains valid
  
  3. PostgREST Compatibility
    - Enable proper JOIN queries for admin activity log
    - Fix relationship inference for nested selects
*/

-- Fix usage_analytics.user_id foreign key to reference user_profiles
DO $$
BEGIN
  -- Drop existing foreign key constraint if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'usage_analytics_user_id_fkey' 
    AND table_name = 'usage_analytics'
  ) THEN
    ALTER TABLE public.usage_analytics DROP CONSTRAINT usage_analytics_user_id_fkey;
  END IF;
  
  -- Add new foreign key constraint to user_profiles
  ALTER TABLE public.usage_analytics 
  ADD CONSTRAINT usage_analytics_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;
END $$;

-- Fix tools.created_by foreign key to reference user_profiles
DO $$
BEGIN
  -- Drop existing foreign key constraint if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'tools_created_by_fkey' 
    AND table_name = 'tools'
  ) THEN
    ALTER TABLE public.tools DROP CONSTRAINT tools_created_by_fkey;
  END IF;
  
  -- Add new foreign key constraint to user_profiles
  ALTER TABLE public.tools 
  ADD CONSTRAINT tools_created_by_fkey 
  FOREIGN KEY (created_by) REFERENCES public.user_profiles(id) ON DELETE SET NULL;
END $$;

-- Update RLS policy for user_profiles to allow viewing in JOINs
DROP POLICY IF EXISTS "Enable users to view profiles in joins" ON public.user_profiles;
CREATE POLICY "Enable users to view profiles in joins" 
ON public.user_profiles FOR SELECT 
TO public 
USING (true);

-- Ensure proper permissions for the analytics queries
GRANT SELECT ON public.usage_analytics TO authenticated;
GRANT SELECT ON public.user_profiles TO authenticated;
GRANT SELECT ON public.tools TO authenticated;