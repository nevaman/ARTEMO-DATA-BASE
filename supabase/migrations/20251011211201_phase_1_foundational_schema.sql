-- Filename: 20251011211201_phase_1_foundational_schema.sql
-- Phase 1: Foundational Schema & Core Utilities
-- Description: This is the master script that builds the entire database schema from zero.
--              It creates all tables, enables RLS, sets up core helper functions (like is_admin),
--              and grants all necessary initial permissions for both authenticated users and anonymous services.
--              This script is 100% idempotent and can be run safely on new or existing databases.

BEGIN;

-- Section: Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Section: Table Creation
-- Note: All tables are created with "IF NOT EXISTS" to ensure idempotency.

-- User Profiles (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  organization TEXT,
  avatar_url TEXT,
  preferences JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE user_profiles IS 'Extended user data, roles, and application-specific preferences.';

-- Categories for organizing tools
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE categories IS 'Dynamic, sortable categories for AI tools.';

-- Dynamic AI tools
CREATE TABLE IF NOT EXISTS tools (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  featured BOOLEAN NOT NULL DEFAULT false,
  primary_model TEXT NOT NULL DEFAULT 'Claude',
  fallback_models TEXT[] NOT NULL DEFAULT ARRAY['OpenAI'],
  prompt_instructions TEXT NOT NULL,
  usage_count INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE tools IS 'Core AI tool configurations, prompts, and metadata.';

-- Questions for each tool's conversation flow
CREATE TABLE IF NOT EXISTS tool_questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('input', 'textarea', 'select')),
  placeholder TEXT,
  required BOOLEAN NOT NULL DEFAULT false,
  question_order INTEGER NOT NULL,
  options TEXT[], -- For select type questions
  validation_rules JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE tool_questions IS 'Defines the sequence of questions for each AI tool.';

-- User projects for organization
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE projects IS 'User-created projects for organizing chat sessions.';

-- Chat sessions with AI
CREATE TABLE IF NOT EXISTS chat_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  tool_id UUID REFERENCES tools(id) ON DELETE SET NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  session_data JSONB NOT NULL DEFAULT '{}',
  ai_model_used TEXT,
  token_usage INTEGER NOT NULL DEFAULT 0,
  completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE chat_sessions IS 'Stores the history of user interactions with AI tools.';

-- Knowledge base files
CREATE TABLE IF NOT EXISTS knowledge_base_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  file_path TEXT NOT NULL UNIQUE,
  file_size BIGINT NOT NULL,
  mime_type TEXT NOT NULL,
  processed_content TEXT,
  processing_status TEXT NOT NULL DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE knowledge_base_files IS 'Metadata for user-uploaded documents for the knowledge base.';

-- Usage analytics
CREATE TABLE IF NOT EXISTS usage_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  tool_id UUID REFERENCES tools(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE usage_analytics IS 'Tracks user interactions for analytics purposes.';

-- Section: Core Functions & Triggers

-- Function: is_admin() - The secure way to check for admin role, preventing RLS recursion.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- This check runs with elevated privileges, bypassing RLS on user_profiles
  -- to safely determine the user's role.
  RETURN EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$;
COMMENT ON FUNCTION public.is_admin() IS 'Securely checks if the current user has the admin role, avoiding RLS recursion.';

-- Function: handle_new_user() - Trigger to automatically create a user profile on signup.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, full_name, role)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', 'New User'), 'user');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
COMMENT ON FUNCTION public.handle_new_user() IS 'Trigger function to automatically create a user profile upon new user signup in auth.users.';

-- Trigger: on_auth_user_created
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function: update_updated_at_column() - A generic trigger function to update the updated_at timestamp.
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';
COMMENT ON FUNCTION public.update_updated_at_column() IS 'Generic trigger function to set the updated_at column to the current timestamp upon a row update.';

-- Assign the updated_at trigger to all relevant tables
DO $$
DECLARE
  table_name_var TEXT;
BEGIN
  FOR table_name_var IN
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name IN (
      'user_profiles', 'categories', 'tools', 'projects',
      'chat_sessions', 'knowledge_base_files'
    )
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_trigger
      WHERE tgrelid = ('public.' || table_name_var)::regclass
        AND tgname = 'handle_updated_at'
    ) THEN
      EXECUTE format(
        'CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();',
        table_name_var
      );
    END IF;
  END LOOP;
END;
$$;

-- Section: Permissions
-- Note: Grant basic permissions first, then apply Row Level Security.

-- Grant basic USAGE on the schema
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;

-- Grant basic permissions for authenticated users on all tables
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;

-- Grant limited, read-only permissions for anonymous access (e.g., for Edge Functions)
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO anon;

-- Section: Row Level Security (RLS)
-- Note: Enable RLS on all tables and define policies.

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own profile" ON user_profiles;
CREATE POLICY "Users can manage own profile" ON user_profiles FOR ALL USING (auth.uid() = id);
DROP POLICY IF EXISTS "Admins can access all user profiles" ON user_profiles;
CREATE POLICY "Admins can access all user profiles" ON user_profiles FOR ALL USING (public.is_admin());

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view active categories" ON categories;
CREATE POLICY "Anyone can view active categories" ON categories FOR SELECT USING (active = true);
DROP POLICY IF EXISTS "Admins can manage categories" ON categories;
CREATE POLICY "Admins can manage categories" ON categories FOR ALL USING (public.is_admin());

ALTER TABLE tools ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view active tools" ON tools;
CREATE POLICY "Anyone can view active tools" ON tools FOR SELECT USING (active = true);
DROP POLICY IF EXISTS "Admins can manage tools" ON tools;
CREATE POLICY "Admins can manage tools" ON tools FOR ALL USING (public.is_admin());

ALTER TABLE tool_questions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view questions for active tools" ON tool_questions;
CREATE POLICY "Anyone can view questions for active tools" ON tool_questions FOR SELECT USING (EXISTS (SELECT 1 FROM tools WHERE id = tool_questions.tool_id AND active = true));
DROP POLICY IF EXISTS "Admins can manage tool questions" ON tool_questions;
CREATE POLICY "Admins can manage tool questions" ON tool_questions FOR ALL USING (public.is_admin());

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own projects" ON projects;
CREATE POLICY "Users can manage own projects" ON projects FOR ALL USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admins can view all projects" ON projects;
CREATE POLICY "Admins can view all projects" ON projects FOR SELECT USING (public.is_admin());

ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own chat sessions" ON chat_sessions;
CREATE POLICY "Users can manage own chat sessions" ON chat_sessions FOR ALL USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admins can view all chat sessions" ON chat_sessions;
CREATE POLICY "Admins can view all chat sessions" ON chat_sessions FOR SELECT USING (public.is_admin());

ALTER TABLE knowledge_base_files ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own files" ON knowledge_base_files;
CREATE POLICY "Users can manage own files" ON knowledge_base_files FOR ALL USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admins can view all files" ON knowledge_base_files;
CREATE POLICY "Admins can view all files" ON knowledge_base_files FOR SELECT USING (public.is_admin());

ALTER TABLE usage_analytics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can insert own analytics" ON usage_analytics;
CREATE POLICY "Users can insert own analytics" ON usage_analytics FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can view own analytics" ON usage_analytics;
CREATE POLICY "Users can view own analytics" ON usage_analytics FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admins can view all analytics" ON usage_analytics;
CREATE POLICY "Admins can view all analytics" ON usage_analytics FOR SELECT USING (public.is_admin());

-- Section: Indexes
-- Note: Create indexes on frequently queried columns for performance.

CREATE INDEX IF NOT EXISTS idx_categories_active_order ON categories(active, display_order);
CREATE INDEX IF NOT EXISTS idx_tools_active_featured ON tools(active, featured);
CREATE INDEX IF NOT EXISTS idx_tools_category ON tools(category_id);
CREATE INDEX IF NOT EXISTS idx_tool_questions_tool_order ON tool_questions(tool_id, question_order);
CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_tool ON chat_sessions(tool_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_files_user ON knowledge_base_files(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_analytics_user_tool ON usage_analytics(user_id, tool_id);

COMMIT;
