-- Filename: 20251011211203_phase_3_application_features.sql
-- Phase 3: Application Features & Management
-- Description: This script builds all core application features on top of the foundational schema.
--              It is a consolidation of many smaller migrations, including:
--              - Full User Management System (with soft deletes and audit trail)
--              - Announcements Table
--              - Category & Project Enhancements (icons, colors)
--              - Client Profile Support
--              - Knowledge Base file linking
--              - All Admin Dashboard analytics functions
-- Idempotency: SAFE - All operations are fully idempotent.

BEGIN;

-- Section: Feature - Category & Project Enhancements

-- Add icon columns to categories
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'categories' AND column_name = 'icon_name') THEN
    ALTER TABLE categories ADD COLUMN icon_name TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'categories' AND column_name = 'icon_color') THEN
    ALTER TABLE categories ADD COLUMN icon_color TEXT;
  END IF;
END $$;
-- Update existing categories to have default icons, then enforce NOT NULL.
UPDATE categories SET icon_name = COALESCE(icon_name, 'Settings'), icon_color = COALESCE(icon_color, 'text-blue-600');
ALTER TABLE categories ALTER COLUMN icon_name SET NOT NULL;
ALTER TABLE categories ALTER COLUMN icon_name SET DEFAULT 'Settings';
ALTER TABLE categories ALTER COLUMN icon_color SET NOT NULL;
ALTER TABLE categories ALTER COLUMN icon_color SET DEFAULT 'text-blue-600';
COMMENT ON COLUMN categories.icon_name IS 'Name of the UI icon component for the category.';
COMMENT ON COLUMN categories.icon_color IS 'CSS color class for the category icon.';

-- Add color column to projects and remove old tags column
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'color') THEN
    ALTER TABLE projects ADD COLUMN color TEXT;
  END IF;
END $$;
UPDATE projects SET color = COALESCE(color, '#008F6B');
ALTER TABLE projects ALTER COLUMN color SET NOT NULL;
ALTER TABLE projects ALTER COLUMN color SET DEFAULT '#008F6B';
COMMENT ON COLUMN projects.color IS 'Hex color code for UI organization of the project.';
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'tags') THEN
    ALTER TABLE projects DROP COLUMN tags;
  END IF;
END $$;

-- Section: Feature - Announcements Table
CREATE TABLE IF NOT EXISTS public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  show_on_login boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
COMMENT ON TABLE announcements IS 'Admin-created announcements for application users.';
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.announcements'::regclass AND tgname = 'handle_updated_at') THEN
    CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.announcements FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END;
$$;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view active announcements" ON public.announcements;
CREATE POLICY "Users can view active announcements" ON public.announcements FOR SELECT TO authenticated USING (active = true);
DROP POLICY IF EXISTS "Admins can manage announcements" ON public.announcements;
CREATE POLICY "Admins can manage announcements" ON public.announcements FOR ALL TO authenticated USING (public.is_admin());
CREATE INDEX IF NOT EXISTS idx_announcements_active_login ON public.announcements(active, show_on_login);

-- Section: Feature - User Management System & Audit Trail
-- Enhance user_profiles table for status management
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_profiles' AND column_name='active') THEN ALTER TABLE user_profiles ADD COLUMN active boolean NOT NULL DEFAULT true; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_profiles' AND column_name='deleted_at') THEN ALTER TABLE user_profiles ADD COLUMN deleted_at timestamptz; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_profiles' AND column_name='last_login') THEN ALTER TABLE user_profiles ADD COLUMN last_login timestamptz; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_profiles' AND column_name='status_updated_by') THEN ALTER TABLE user_profiles ADD COLUMN status_updated_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_profiles' AND column_name='status_updated_at') THEN ALTER TABLE user_profiles ADD COLUMN status_updated_at timestamptz; END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_user_profiles_active ON user_profiles(active) WHERE deleted_at IS NULL;

-- Create the audit log table
CREATE TABLE IF NOT EXISTS user_management_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  admin_user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  action_type text NOT NULL CHECK (action_type IN ('status_change', 'role_change', 'soft_delete', 'restore')),
  old_value jsonb,
  new_value jsonb,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE user_management_audit IS 'Logs all administrative actions performed on user profiles.';
ALTER TABLE user_management_audit ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage audit logs" ON user_management_audit;
CREATE POLICY "Admins can manage audit logs" ON user_management_audit FOR ALL TO authenticated USING (public.is_admin());

-- Create RPC functions for user management
CREATE OR REPLACE FUNCTION public.update_user_status(target_user_id uuid, new_active_status boolean, reason text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE old_status boolean;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Access denied: Admin privileges required'; END IF;
  SELECT active INTO old_status FROM user_profiles WHERE id = target_user_id;
  UPDATE user_profiles SET active = new_active_status, status_updated_by = auth.uid(), status_updated_at = now() WHERE id = target_user_id;
  INSERT INTO user_management_audit (target_user_id, admin_user_id, action_type, old_value, new_value, reason)
  VALUES (target_user_id, auth.uid(), 'status_change', jsonb_build_object('active', old_status), jsonb_build_object('active', new_active_status), reason);
  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.soft_delete_user(target_user_id uuid, reason text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Access denied: Admin privileges required'; END IF;
  UPDATE user_profiles SET active = false, deleted_at = now(), status_updated_by = auth.uid(), status_updated_at = now() WHERE id = target_user_id;
  INSERT INTO user_management_audit (target_user_id, admin_user_id, action_type, new_value, reason)
  VALUES (target_user_id, auth.uid(), 'soft_delete', jsonb_build_object('deleted_at', now()), reason);
  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.update_user_role(target_user_id uuid, new_role text, reason text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE old_role_val text;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Access denied: Admin privileges required'; END IF;
  IF new_role NOT IN ('user', 'admin') THEN RAISE EXCEPTION 'Invalid role specified'; END IF;
  SELECT role INTO old_role_val FROM user_profiles WHERE id = target_user_id;
  UPDATE user_profiles SET role = new_role, status_updated_by = auth.uid(), status_updated_at = now() WHERE id = target_user_id;
  INSERT INTO user_management_audit (target_user_id, admin_user_id, action_type, old_value, new_value, reason)
  VALUES (target_user_id, auth.uid(), 'role_change', jsonb_build_object('role', old_role_val), jsonb_build_object('role', new_role), reason);
  RETURN jsonb_build_object('success', true);
END;
$$;

-- Section: Feature - Client Profile Support
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'default_client_profile_id') THEN
    ALTER TABLE user_profiles ADD COLUMN default_client_profile_id UUID;
    COMMENT ON COLUMN user_profiles.default_client_profile_id IS 'FK (soft) to the client profile stored in the preferences JSONB.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'client_profile_snapshot') THEN
    ALTER TABLE projects ADD COLUMN client_profile_snapshot JSONB;
    COMMENT ON COLUMN projects.client_profile_snapshot IS 'A JSONB snapshot of the client profile used for this project.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chat_sessions' AND column_name = 'client_profile_id') THEN
    ALTER TABLE chat_sessions ADD COLUMN client_profile_id UUID;
    COMMENT ON COLUMN chat_sessions.client_profile_id IS 'Identifier for the client profile used in this session.';
  END IF;
END $$;

-- Section: Feature - Knowledge Base Linking
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tools' AND column_name = 'knowledge_base_file_id') THEN
    ALTER TABLE tools ADD COLUMN knowledge_base_file_id UUID REFERENCES public.knowledge_base_files(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_tools_knowledge_base_file ON tools(knowledge_base_file_id);
    COMMENT ON COLUMN tools.knowledge_base_file_id IS 'Links a tool to a specific file in the knowledge base.';
  END IF;
END $$;


-- Section: Feature - Admin Dashboard Analytics Functions
CREATE OR REPLACE FUNCTION public.get_dashboard_analytics(time_range text DEFAULT '24h') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE start_time timestamptz;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin role required'; END IF;
  CASE time_range WHEN '1h' THEN start_time := NOW() - INTERVAL '1 hour'; WHEN '7d' THEN start_time := NOW() - INTERVAL '7 days'; WHEN '30d' THEN start_time := NOW() - INTERVAL '30 days'; ELSE start_time := NOW() - INTERVAL '24 hours'; END CASE;
  RETURN jsonb_build_object(
    'ai_generations_24h', (SELECT COUNT(*) FROM public.chat_sessions WHERE created_at >= start_time),
    'daily_active_users', (SELECT COUNT(DISTINCT user_id) FROM public.chat_sessions WHERE created_at >= start_time),
    'new_signups_24h', (SELECT COUNT(*) FROM public.user_profiles WHERE created_at >= start_time),
    'ai_success_rate', (SELECT ROUND(COALESCE( (COUNT(*) FILTER (WHERE completed = true) * 100.0 / NULLIF(COUNT(*), 0)), 100.0), 1) FROM public.chat_sessions WHERE created_at >= start_time),
    'total_users', (SELECT COUNT(*) FROM public.user_profiles WHERE deleted_at IS NULL),
    'active_tools', (SELECT COUNT(*) FROM public.tools WHERE active = true),
    'total_categories', (SELECT COUNT(*) FROM public.categories WHERE active = true)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_system_health_metrics() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE ai_success_rate numeric;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin role required'; END IF;
  SELECT COALESCE((COUNT(*) FILTER (WHERE session_data IS NOT NULL AND session_data != '{}') * 100.0 / NULLIF(COUNT(*), 0)), 100.0)
  INTO ai_success_rate FROM chat_sessions WHERE created_at >= NOW() - INTERVAL '24 hours';
  RETURN jsonb_build_object('ai_success_rate', ai_success_rate);
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_tool_usage(tool_uuid UUID) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE tools SET usage_count = usage_count + 1 WHERE id = tool_uuid;
END;
$$;

COMMIT;
