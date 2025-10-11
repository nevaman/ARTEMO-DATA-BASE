/*
  # User Status Management System

  1. Database Schema Updates
    - Add `active` column to `user_profiles` table with default true
    - Add `deleted_at` column for soft delete functionality
    - Add indexes for performance optimization
    - Add audit trail columns for tracking changes

  2. Security Enhancements
    - Create RLS policies for admin-only user management
    - Ensure proper access control for user status updates
    - Add audit logging for user management actions

  3. Performance Optimizations
    - Add indexes on frequently queried columns
    - Optimize queries for user listing and filtering
*/

-- Add new columns to user_profiles table
DO $$
BEGIN
  -- Add active column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'active'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN active boolean DEFAULT true NOT NULL;
  END IF;

  -- Add deleted_at column for soft delete if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN deleted_at timestamptz DEFAULT NULL;
  END IF;

  -- Add last_login column for tracking user activity
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'last_login'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN last_login timestamptz DEFAULT NULL;
  END IF;

  -- Add status_updated_by column for audit trail
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'status_updated_by'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN status_updated_by uuid REFERENCES user_profiles(id);
  END IF;

  -- Add status_updated_at column for audit trail
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'status_updated_at'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN status_updated_at timestamptz DEFAULT now();
  END IF;
END $$;

-- Create indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_user_profiles_active ON user_profiles(active) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_user_profiles_deleted_at ON user_profiles(deleted_at);
CREATE INDEX IF NOT EXISTS idx_user_profiles_last_login ON user_profiles(last_login);

-- Create audit log table for user management actions
CREATE TABLE IF NOT EXISTS user_management_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id uuid NOT NULL REFERENCES user_profiles(id),
  admin_user_id uuid NOT NULL REFERENCES user_profiles(id),
  action_type text NOT NULL CHECK (action_type IN ('status_change', 'role_change', 'soft_delete', 'restore')),
  old_value jsonb,
  new_value jsonb,
  reason text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on audit table
ALTER TABLE user_management_audit ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for user management

-- Policy for admins to manage user status and roles
CREATE POLICY "Admins can update user profiles and status"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING ((SELECT is_admin()))
  WITH CHECK ((SELECT is_admin()));

-- Policy for admins to view all user profiles (including inactive)
CREATE POLICY "Admins can view all user profiles including inactive"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING ((SELECT is_admin()) OR (auth.uid() = id AND deleted_at IS NULL));

-- Policy for admins to manage audit logs
CREATE POLICY "Admins can view audit logs"
  ON user_management_audit
  FOR SELECT
  TO authenticated
  USING ((SELECT is_admin()));

CREATE POLICY "Admins can insert audit logs"
  ON user_management_audit
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT is_admin()));

-- Create function to update user status with audit trail
CREATE OR REPLACE FUNCTION update_user_status(
  target_user_id uuid,
  new_active_status boolean,
  admin_user_id uuid,
  reason text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  old_status boolean;
  result json;
BEGIN
  -- Check if the calling user is an admin
  IF NOT (SELECT is_admin()) THEN
    RAISE EXCEPTION 'Access denied: Admin privileges required';
  END IF;

  -- Get current status
  SELECT active INTO old_status
  FROM user_profiles
  WHERE id = target_user_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found or already deleted';
  END IF;

  -- Update user status
  UPDATE user_profiles
  SET 
    active = new_active_status,
    status_updated_by = admin_user_id,
    status_updated_at = now(),
    updated_at = now()
  WHERE id = target_user_id;

  -- Log the action in audit table
  INSERT INTO user_management_audit (
    target_user_id,
    admin_user_id,
    action_type,
    old_value,
    new_value,
    reason
  ) VALUES (
    target_user_id,
    admin_user_id,
    'status_change',
    json_build_object('active', old_status),
    json_build_object('active', new_active_status),
    reason
  );

  -- Return success result
  result := json_build_object(
    'success', true,
    'old_status', old_status,
    'new_status', new_active_status,
    'updated_at', now()
  );

  RETURN result;
END;
$$;

-- Create function to soft delete user with audit trail
CREATE OR REPLACE FUNCTION soft_delete_user(
  target_user_id uuid,
  admin_user_id uuid,
  reason text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_data json;
  result json;
BEGIN
  -- Check if the calling user is an admin
  IF NOT (SELECT is_admin()) THEN
    RAISE EXCEPTION 'Access denied: Admin privileges required';
  END IF;

  -- Get current user data
  SELECT json_build_object(
    'id', id,
    'full_name', full_name,
    'role', role,
    'active', active
  ) INTO user_data
  FROM user_profiles
  WHERE id = target_user_id AND deleted_at IS NULL;

  IF user_data IS NULL THEN
    RAISE EXCEPTION 'User not found or already deleted';
  END IF;

  -- Soft delete the user
  UPDATE user_profiles
  SET 
    deleted_at = now(),
    active = false,
    status_updated_by = admin_user_id,
    status_updated_at = now(),
    updated_at = now()
  WHERE id = target_user_id;

  -- Log the action in audit table
  INSERT INTO user_management_audit (
    target_user_id,
    admin_user_id,
    action_type,
    old_value,
    new_value,
    reason
  ) VALUES (
    target_user_id,
    admin_user_id,
    'soft_delete',
    user_data,
    json_build_object('deleted_at', now()),
    reason
  );

  -- Return success result
  result := json_build_object(
    'success', true,
    'deleted_user', user_data,
    'deleted_at', now()
  );

  RETURN result;
END;
$$;

-- Create function to update user role with audit trail
CREATE OR REPLACE FUNCTION update_user_role(
  target_user_id uuid,
  new_role text,
  admin_user_id uuid,
  reason text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  old_role text;
  result json;
BEGIN
  -- Check if the calling user is an admin
  IF NOT (SELECT is_admin()) THEN
    RAISE EXCEPTION 'Access denied: Admin privileges required';
  END IF;

  -- Validate role
  IF new_role NOT IN ('user', 'admin') THEN
    RAISE EXCEPTION 'Invalid role: must be either "user" or "admin"';
  END IF;

  -- Get current role
  SELECT role INTO old_role
  FROM user_profiles
  WHERE id = target_user_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found or already deleted';
  END IF;

  -- Update user role
  UPDATE user_profiles
  SET 
    role = new_role,
    status_updated_by = admin_user_id,
    status_updated_at = now(),
    updated_at = now()
  WHERE id = target_user_id;

  -- Log the action in audit table
  INSERT INTO user_management_audit (
    target_user_id,
    admin_user_id,
    action_type,
    old_value,
    new_value,
    reason
  ) VALUES (
    target_user_id,
    admin_user_id,
    'role_change',
    json_build_object('role', old_role),
    json_build_object('role', new_role),
    reason
  );

  -- Return success result
  result := json_build_object(
    'success', true,
    'old_role', old_role,
    'new_role', new_role,
    'updated_at', now()
  );

  RETURN result;
END;
$$;

-- Update the users query to exclude soft-deleted users by default
CREATE OR REPLACE VIEW active_users AS
SELECT 
  id,
  full_name,
  role,
  organization,
  active,
  created_at,
  updated_at,
  last_login,
  status_updated_by,
  status_updated_at
FROM user_profiles
WHERE deleted_at IS NULL;

-- Grant necessary permissions
GRANT SELECT ON active_users TO authenticated;
GRANT EXECUTE ON FUNCTION update_user_status TO authenticated;
GRANT EXECUTE ON FUNCTION soft_delete_user TO authenticated;
GRANT EXECUTE ON FUNCTION update_user_role TO authenticated;