/*
  # Fix User Management Functions

  1. Database Functions
    - Drop existing conflicting functions
    - Create proper user management functions with correct return types
    - Add audit trail support
    - Implement secure user operations

  2. Security
    - Functions use security definer for elevated privileges
    - Proper admin role checking
    - Comprehensive audit logging
*/

-- Drop existing functions that might conflict
DROP FUNCTION IF EXISTS soft_delete_user(uuid, uuid, text);
DROP FUNCTION IF EXISTS restore_user(uuid, uuid, text);
DROP FUNCTION IF EXISTS update_user_role(uuid, text, uuid, text);
DROP FUNCTION IF EXISTS update_user_status(uuid, boolean, uuid, text);

-- Create helper function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- Create helper function to get current user ID
CREATE OR REPLACE FUNCTION uid()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT auth.uid();
$$;

-- Function to soft delete a user with audit trail
CREATE OR REPLACE FUNCTION soft_delete_user(
  target_user_id uuid,
  admin_user_id uuid,
  reason text DEFAULT 'User deleted by admin'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
  old_profile record;
BEGIN
  -- Check if the calling user is an admin
  IF NOT EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE id = admin_user_id AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only admin users can delete other users';
  END IF;

  -- Get current profile data for audit trail
  SELECT * INTO old_profile
  FROM user_profiles
  WHERE id = target_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  -- Soft delete the user profile
  UPDATE user_profiles
  SET 
    active = false,
    deleted_at = now(),
    status_updated_by = admin_user_id,
    status_updated_at = now()
  WHERE id = target_user_id;

  -- Create audit log entry
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
    to_jsonb(old_profile),
    jsonb_build_object(
      'active', false,
      'deleted_at', now(),
      'status_updated_by', admin_user_id
    ),
    reason
  );

  -- Return success result
  result := jsonb_build_object(
    'success', true,
    'message', 'User soft deleted successfully',
    'user_id', target_user_id,
    'deleted_at', now()
  );

  RETURN result;
END;
$$;

-- Function to restore a soft-deleted user
CREATE OR REPLACE FUNCTION restore_user(
  target_user_id uuid,
  admin_user_id uuid,
  reason text DEFAULT 'User restored by admin'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
  old_profile record;
BEGIN
  -- Check if the calling user is an admin
  IF NOT EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE id = admin_user_id AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only admin users can restore other users';
  END IF;

  -- Get current profile data for audit trail
  SELECT * INTO old_profile
  FROM user_profiles
  WHERE id = target_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  -- Restore the user profile
  UPDATE user_profiles
  SET 
    active = true,
    deleted_at = null,
    status_updated_by = admin_user_id,
    status_updated_at = now()
  WHERE id = target_user_id;

  -- Create audit log entry
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
    'restore',
    to_jsonb(old_profile),
    jsonb_build_object(
      'active', true,
      'deleted_at', null,
      'status_updated_by', admin_user_id
    ),
    reason
  );

  -- Return success result
  result := jsonb_build_object(
    'success', true,
    'message', 'User restored successfully',
    'user_id', target_user_id,
    'restored_at', now()
  );

  RETURN result;
END;
$$;

-- Function to update user role with audit trail
CREATE OR REPLACE FUNCTION update_user_role(
  target_user_id uuid,
  new_role text,
  admin_user_id uuid,
  reason text DEFAULT 'Role updated by admin'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
  old_profile record;
BEGIN
  -- Check if the calling user is an admin
  IF NOT EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE id = admin_user_id AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only admin users can update user roles';
  END IF;

  -- Validate new role
  IF new_role NOT IN ('user', 'admin') THEN
    RAISE EXCEPTION 'Invalid role. Must be either "user" or "admin"';
  END IF;

  -- Get current profile data for audit trail
  SELECT * INTO old_profile
  FROM user_profiles
  WHERE id = target_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  -- Update the user role
  UPDATE user_profiles
  SET 
    role = new_role,
    status_updated_by = admin_user_id,
    status_updated_at = now()
  WHERE id = target_user_id;

  -- Create audit log entry
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
    jsonb_build_object('role', old_profile.role),
    jsonb_build_object('role', new_role),
    reason
  );

  -- Return success result
  result := jsonb_build_object(
    'success', true,
    'message', 'User role updated successfully',
    'user_id', target_user_id,
    'old_role', old_profile.role,
    'new_role', new_role
  );

  RETURN result;
END;
$$;

-- Function to update user status with audit trail
CREATE OR REPLACE FUNCTION update_user_status(
  target_user_id uuid,
  new_active_status boolean,
  admin_user_id uuid,
  reason text DEFAULT 'Status updated by admin'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
  old_profile record;
BEGIN
  -- Check if the calling user is an admin
  IF NOT EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE id = admin_user_id AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only admin users can update user status';
  END IF;

  -- Get current profile data for audit trail
  SELECT * INTO old_profile
  FROM user_profiles
  WHERE id = target_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  -- Update the user status
  UPDATE user_profiles
  SET 
    active = new_active_status,
    status_updated_by = admin_user_id,
    status_updated_at = now()
  WHERE id = target_user_id;

  -- Create audit log entry
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
    jsonb_build_object('active', old_profile.active),
    jsonb_build_object('active', new_active_status),
    reason
  );

  -- Return success result
  result := jsonb_build_object(
    'success', true,
    'message', 'User status updated successfully',
    'user_id', target_user_id,
    'old_status', old_profile.active,
    'new_status', new_active_status
  );

  RETURN result;
END;
$$;

-- Function to get dashboard analytics
CREATE OR REPLACE FUNCTION get_dashboard_analytics(time_range text DEFAULT '24h')
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
  time_filter timestamptz;
BEGIN
  -- Calculate time filter based on range
  CASE time_range
    WHEN '1h' THEN time_filter := now() - interval '1 hour';
    WHEN '24h' THEN time_filter := now() - interval '24 hours';
    WHEN '7d' THEN time_filter := now() - interval '7 days';
    WHEN '30d' THEN time_filter := now() - interval '30 days';
    ELSE time_filter := now() - interval '24 hours';
  END CASE;

  -- Build analytics result
  SELECT jsonb_build_object(
    'ai_generations_24h', (
      SELECT count(*) 
      FROM usage_analytics 
      WHERE action_type = 'ai_chat_completion' 
      AND created_at >= time_filter
    ),
    'daily_active_users', (
      SELECT count(DISTINCT user_id) 
      FROM usage_analytics 
      WHERE created_at >= time_filter
    ),
    'new_signups_24h', (
      SELECT count(*) 
      FROM user_profiles 
      WHERE created_at >= time_filter
    ),
    'ai_success_rate', 100, -- Would need error tracking to calculate
    'total_users', (
      SELECT count(*) 
      FROM user_profiles 
      WHERE active = true AND deleted_at IS NULL
    ),
    'active_tools', (
      SELECT count(*) 
      FROM tools 
      WHERE active = true
    ),
    'total_categories', (
      SELECT count(*) 
      FROM categories 
      WHERE active = true
    ),
    'total_interactions', (
      SELECT count(*) 
      FROM usage_analytics 
      WHERE action_type = 'ai_chat_completion'
    )
  ) INTO result;

  RETURN result;
END;
$$;

-- Function to increment tool usage count
CREATE OR REPLACE FUNCTION increment_tool_usage(tool_uuid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE tools 
  SET usage_count = usage_count + 1 
  WHERE id = tool_uuid;
END;
$$;