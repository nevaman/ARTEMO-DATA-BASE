/*
  # Create Dashboard Analytics Function

  1. New Functions
    - `get_dashboard_analytics(time_range)` - Returns core dashboard metrics
    - Calculates AI generations, active users, new signups, success rate
    - Provides total counts for users, tools, and categories

  2. Security
    - Admin-only access with role verification
    - Proper error handling for unauthorized access

  3. Performance
    - Optimized queries with appropriate time filtering
    - Efficient aggregation for large datasets
*/

-- Create the main dashboard analytics function
CREATE OR REPLACE FUNCTION public.get_dashboard_analytics(time_range text DEFAULT '24h')
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result json;
    start_time timestamptz;
    ai_generations_count integer := 0;
    daily_active_users_count integer := 0;
    new_signups_count integer := 0;
    ai_success_rate numeric := 100.0;
    total_users_count integer := 0;
    active_tools_count integer := 0;
    total_categories_count integer := 0;
BEGIN
    -- Check if user is admin
    IF NOT (SELECT public.is_admin()) THEN
        RAISE EXCEPTION 'Access denied. Admin role required.';
    END IF;

    -- Calculate start time based on time_range parameter
    CASE time_range
        WHEN '1h' THEN start_time := NOW() - INTERVAL '1 hour';
        WHEN '24h' THEN start_time := NOW() - INTERVAL '24 hours';
        WHEN '7d' THEN start_time := NOW() - INTERVAL '7 days';
        WHEN '30d' THEN start_time := NOW() - INTERVAL '30 days';
        ELSE start_time := NOW() - INTERVAL '24 hours';
    END CASE;

    -- Get AI generations count (chat sessions in time range)
    SELECT COUNT(*)
    INTO ai_generations_count
    FROM public.chat_sessions
    WHERE created_at >= start_time;

    -- Get daily active users (users who created chat sessions in time range)
    SELECT COUNT(DISTINCT user_id)
    INTO daily_active_users_count
    FROM public.chat_sessions
    WHERE created_at >= start_time;

    -- Get new signups count (user profiles created in time range)
    SELECT COUNT(*)
    INTO new_signups_count
    FROM public.user_profiles
    WHERE created_at >= start_time;

    -- Calculate AI success rate (assume 100% if no data, or calculate based on completed sessions)
    SELECT COALESCE(
        (COUNT(CASE WHEN completed = true THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0)),
        100.0
    )
    INTO ai_success_rate
    FROM public.chat_sessions
    WHERE created_at >= start_time;

    -- Get total users count
    SELECT COUNT(*)
    INTO total_users_count
    FROM public.user_profiles;

    -- Get active tools count
    SELECT COUNT(*)
    INTO active_tools_count
    FROM public.tools
    WHERE active = true;

    -- Get total categories count
    SELECT COUNT(*)
    INTO total_categories_count
    FROM public.categories
    WHERE active = true;

    -- Build result JSON
    result := json_build_object(
        'ai_generations_24h', ai_generations_count,
        'daily_active_users', daily_active_users_count,
        'new_signups_24h', new_signups_count,
        'ai_success_rate', ROUND(ai_success_rate, 1),
        'total_users', total_users_count,
        'active_tools', active_tools_count,
        'total_categories', total_categories_count,
        'time_range', time_range,
        'calculated_at', NOW()
    );

    RETURN result;
EXCEPTION
    WHEN OTHERS THEN
        -- Return default values on error
        RETURN json_build_object(
            'ai_generations_24h', 0,
            'daily_active_users', 0,
            'new_signups_24h', 0,
            'ai_success_rate', 100.0,
            'total_users', 0,
            'active_tools', 0,
            'total_categories', 0,
            'time_range', time_range,
            'calculated_at', NOW(),
            'error', SQLERRM
        );
END;
$$;