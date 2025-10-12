-- Filename: 20251011211208_create_public_tool_catalog.down.sql
-- Reverts: The creation of the public.tool_catalog view.
-- Description: This "down" migration safely removes the tool_catalog view
--              and its associated permissions, reverting the schema to the
--              state before the pro tool visibility fix was applied.

BEGIN;

-- The only action required is to drop the view.
-- PostgreSQL will automatically handle the removal of associated permissions (GRANTs)
-- and comments when the view is dropped.
-- Using "IF EXISTS" makes this script 100% re-runnable and error-proof.
DROP VIEW IF EXISTS public.tool_catalog;

COMMIT;
