-- Filename: 20251011211206_feature_pro_user_role.sql
-- Feature: Pro User Role & Pro-Only Tool Access
-- Description: This migration introduces a 'pro' user role and adds a flag to tools
--              to restrict their access to pro users. It ensures backward compatibility
--              and is fully idempotent.

BEGIN;

-- Section 1: Modify user_profiles table for 'pro' role

-- Drop the existing CHECK constraint to redefine it.
-- This is the safe, idempotent way to modify a CHECK constraint.
ALTER TABLE public.user_profiles
DROP CONSTRAINT IF EXISTS user_profiles_role_check;

-- Add the 'pro' role to the CHECK constraint.
-- Now roles can be 'user', 'admin', or 'pro'.
ALTER TABLE public.user_profiles
ADD CONSTRAINT user_profiles_role_check
CHECK (role IN ('user', 'admin', 'pro'));

-- Comment on the updated table for clarity.
COMMENT ON TABLE public.user_profiles IS 'Extended user data, roles (user, pro, admin), and application-specific preferences.';


-- Section 2: Add 'is_pro' column to the tools table

-- Add the 'is_pro' column if it doesn't already exist.
-- This column will mark tools that require a pro subscription.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tools'
      AND column_name = 'is_pro'
  ) THEN
    ALTER TABLE public.tools
    ADD COLUMN is_pro BOOLEAN NOT NULL DEFAULT false;
  END IF;
END;
$$;

-- Add an index on the new 'is_pro' column for faster lookups.
CREATE INDEX IF NOT EXISTS idx_tools_is_pro ON public.tools(is_pro);

-- Comment on the updated table for clarity.
COMMENT ON TABLE public.tools IS 'Core AI tool configurations, prompts, metadata, and pro-user status.';

COMMIT;