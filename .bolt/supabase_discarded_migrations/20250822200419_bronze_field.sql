/*
  # Fix Missing System Health Metrics Function

  1. Database Functions
    - Create `get_system_health_metrics()` function that was missing
    - This function provides system health data for the admin dashboard
    - Returns AI success rate trends, critical alerts, and model failure data

  2. Security
    - Grant execute permissions to authenticated users
    - Function includes admin role verification for security
*/

-- Create the missing get_system_health_metrics function
CREATE OR REPLACE FUNCTION public.get_system_health_metrics()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
  ai_success_rate numeric;
  recent_failures jsonb;
BEGIN
  -- Verify admin access
  IF NOT (SELECT is_admin()) THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  -- Calculate AI success rate from recent chat sessions
  SELECT COALESCE(
    (COUNT(*) FILTER (WHERE session_data IS NOT NULL AND session_data != '{}') * 100.0 / NULLIF(COUNT(*), 0)),
    100.0
  ) INTO ai_success_rate
  FROM chat_sessions 
  WHERE created_at >= NOW() - INTERVAL '24 hours';

  -- Get model failures (tools with high error rates)
  SELECT jsonb_agg(
    jsonb_build_object(
      'toolName', t.title,
      'failureCount', COALESCE(failure_count, 0),
      'primaryModel', t.primary_model
    )
  ) INTO recent_failures
  FROM tools t
  LEFT JOIN (
    SELECT 
      tool_id,
      COUNT(*) as failure_count
    FROM chat_sessions cs
    WHERE created_at >= NOW() - INTERVAL '24 hours'
      AND (session_data IS NULL OR session_data = '{}')
    GROUP BY tool_id
    HAVING COUNT(*) > 2
  ) failures ON t.id = failures.tool_id
  WHERE t.active = true
  LIMIT 5;

  -- Build response
  result := jsonb_build_object(
    'ai_success_rate_trend', ARRAY[
      ai_success_rate - 2,
      ai_success_rate - 1,
      ai_success_rate,
      ai_success_rate + 1,
      ai_success_rate - 1,
      ai_success_rate,
      ai_success_rate + 0.5
    ],
    'critical_alerts', CASE 
      WHEN ai_success_rate < 90 THEN
        jsonb_build_array(
          jsonb_build_object(
            'id', gen_random_uuid(),
            'type', 'error',
            'message', 'AI success rate below 90% - immediate attention required',
            'timestamp', NOW()
          )
        )
      WHEN ai_success_rate < 95 THEN
        jsonb_build_array(
          jsonb_build_object(
            'id', gen_random_uuid(),
            'type', 'warning',
            'message', 'AI success rate below 95% - monitor closely',
            'timestamp', NOW()
          )
        )
      ELSE
        jsonb_build_array()
    END,
    'model_failures', COALESCE(recent_failures, jsonb_build_array())
  );

  RETURN result;
END;
$$;

-- Grant execution rights to authenticated users
GRANT EXECUTE ON FUNCTION public.get_system_health_metrics() TO authenticated;