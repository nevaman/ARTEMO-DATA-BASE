/*
  # Fix User Profile Creation and Admin Access

  1. User Profile Creation
    - Create automatic trigger for user profile creation
    - Remove manual profile creation dependency
    - Ensure seamless signup process

  2. Admin Dashboard Access
    - Add admin policies for viewing all chat sessions
    - Add admin policies for viewing all user profiles
    - Enable admin analytics and recent activity

  3. Security
    - Maintain RLS for regular users
    - Grant admin access to aggregate data
    - Secure trigger-based profile creation
*/

-- Create function to handle new user profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'New User'),
    'user'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users for automatic profile creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Add admin policies for chat_sessions (admins can view all sessions)
CREATE POLICY "Admins can view all chat sessions"
  ON chat_sessions
  FOR SELECT
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Add admin policies for user_profiles (admins can view all profiles)
CREATE POLICY "Admins can view all user profiles"
  ON user_profiles
  FOR SELECT
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Add admin policies for usage_analytics (admins can view all analytics)
CREATE POLICY "Admins can view all usage analytics"
  ON usage_analytics
  FOR SELECT
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Create function to increment tool usage safely
CREATE OR REPLACE FUNCTION increment_tool_usage(tool_uuid UUID)
RETURNS void AS $$
BEGIN
  UPDATE tools 
  SET usage_count = usage_count + 1 
  WHERE id = tool_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;