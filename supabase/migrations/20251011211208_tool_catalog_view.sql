-- Filename: 20251011211208_tool_catalog_view.sql
-- Description: Creates/updates the tool_catalog view to expose active tools to all
--              authenticated users, including aggregated question data. This version
--              safely handles structural changes by dropping and recreating the view.

BEGIN;

-- To safely handle changes in the view's columns (names, order, or types),
-- the most robust method is to drop the view if it exists and then create it fresh.
-- This is more reliable than attempting complex ALTER VIEW commands.
DROP VIEW IF EXISTS public.tool_catalog;

-- Create the new, comprehensive view.
-- This acts as a "one-stop-shop" query for the application, combining data from
-- tools, categories, and tool_questions into a single, efficient source.
CREATE VIEW public.tool_catalog AS
SELECT
    t.id,
    t.title,
    t.slug,
    t.description,
    t.active,
    t.featured,
    t.is_pro,
    t.primary_model,
    COALESCE(t.fallback_models, ARRAY[]::text[]) AS fallback_models,
    t.category_id,
    c.name AS category_name,
    c.icon_name AS category_icon_name,
    c.icon_color AS category_icon_color,
    t.created_at,
    -- This subquery aggregates all questions for a tool into a single JSON array.
    -- This is highly efficient as it prevents the N+1 query problem on the client-side.
    COALESCE(
        (
            SELECT jsonb_agg(
                jsonb_build_object(
                    'id', q.id,
                    'label', q.label,
                    'type', q.type,
                    'placeholder', q.placeholder,
                    'required', q.required,
                    'question_order', q.question_order,
                    'options', q.options
                ) ORDER BY q.question_order
            )
            FROM public.tool_questions q
            WHERE q.tool_id = t.id
        ),
        '[]'::jsonb
    ) AS questions
FROM
    public.tools t
JOIN
    public.categories c ON c.id = t.category_id
WHERE
    t.active = true;

-- Grant necessary permissions on the new view.
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON public.tool_catalog TO authenticated;

COMMIT;
