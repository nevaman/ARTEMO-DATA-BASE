/*
  # Add Client Profiles Support

  1. Database Changes
    - Add `default_client_profile_id` column to `user_profiles` table
    - Add `client_profile_snapshot` column to `projects` table
    - Ensure `preferences` column exists and has proper default

  2. Security
    - No new RLS policies needed (using existing user data protection)
    - Client profiles stored in user's preferences (already protected)
    - Project snapshots protected by existing project RLS policies
*/

-- Add default client profile ID to user_profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'default_client_profile_id'
  ) THEN
    ALTER TABLE public.user_profiles 
    ADD COLUMN default_client_profile_id UUID;
  END IF;
END $$;

-- Add client profile snapshot to projects
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'client_profile_snapshot'
  ) THEN
    ALTER TABLE public.projects 
    ADD COLUMN client_profile_snapshot JSONB;
  END IF;
END $$;

-- Ensure preferences column has proper default (should already exist)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'preferences'
  ) THEN
    -- Update any NULL preferences to empty object
    UPDATE public.user_profiles 
    SET preferences = '{}'::jsonb 
    WHERE preferences IS NULL;
  END IF;
END $$;