/*
  # Add missing foreign key constraints

  1. Foreign Key Constraints
    - Add `chat_sessions_user_id_fkey` constraint linking chat_sessions.user_id to user_profiles.id
    - Add `chat_sessions_tool_id_fkey` constraint linking chat_sessions.tool_id to tools.id
  
  2. Schema Cache Refresh
    - Refresh Supabase schema cache to recognize new relationships
  
  3. Security
    - Ensure RLS policies work with new constraints
*/

-- Add foreign key constraint for user_id -> user_profiles.id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'chat_sessions_user_id_fkey'
    AND table_name = 'chat_sessions'
  ) THEN
    ALTER TABLE chat_sessions 
    ADD CONSTRAINT chat_sessions_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add foreign key constraint for tool_id -> tools.id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'chat_sessions_tool_id_fkey'
    AND table_name = 'chat_sessions'
  ) THEN
    ALTER TABLE chat_sessions 
    ADD CONSTRAINT chat_sessions_tool_id_fkey 
    FOREIGN KEY (tool_id) REFERENCES tools(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add foreign key constraint for projects.user_id -> user_profiles.id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'projects_user_id_fkey'
    AND table_name = 'projects'
  ) THEN
    ALTER TABLE projects 
    ADD CONSTRAINT projects_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add foreign key constraint for usage_analytics.user_id -> user_profiles.id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'usage_analytics_user_id_fkey'
    AND table_name = 'usage_analytics'
  ) THEN
    ALTER TABLE usage_analytics 
    ADD CONSTRAINT usage_analytics_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add foreign key constraint for usage_analytics.tool_id -> tools.id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'usage_analytics_tool_id_fkey'
    AND table_name = 'usage_analytics'
  ) THEN
    ALTER TABLE usage_analytics 
    ADD CONSTRAINT usage_analytics_tool_id_fkey 
    FOREIGN KEY (tool_id) REFERENCES tools(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Refresh schema cache by updating table comments (forces Supabase to refresh)
COMMENT ON TABLE chat_sessions IS 'User chat sessions with AI tools';
COMMENT ON TABLE user_profiles IS 'Extended user profile information';
COMMENT ON TABLE tools IS 'Dynamic AI tools created by administrators';
COMMENT ON TABLE projects IS 'User-created projects for organizing work';
COMMENT ON TABLE usage_analytics IS 'Platform usage tracking and analytics';

-- Notify that schema cache should be refreshed
SELECT 'Foreign key constraints added successfully. Schema cache will be refreshed automatically.' as status;