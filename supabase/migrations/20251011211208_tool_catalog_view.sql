-- Filename: 20251011211208_tool_catalog_view.sql
-- Description: Introduce tool_catalog view to expose active tools to all authenticated users
--              while preserving admin control of the base tools table.

BEGIN;

CREATE OR REPLACE VIEW public.tool_catalog
WITH (security_invoker = false) AS
SELECT
    t.id,
    t.title,
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
FROM public.tools t
JOIN public.categories c ON c.id = t.category_id
WHERE t.active = true;

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON public.tool_catalog TO authenticated;

COMMIT;
