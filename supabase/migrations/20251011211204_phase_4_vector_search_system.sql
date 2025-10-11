-- Filename: 20251011211204_phase_4_vector_search_system.sql
-- Phase 4: Vector Search System
-- Description: This script sets up the complete vector search functionality. It enables the pgvector
--              extension, creates the tool_embeddings table with a high-performance index,
--              and provides all necessary functions for creating embeddings and finding similar tools.
-- Idempotency: SAFE - All operations are fully idempotent.

BEGIN;

-- Section: Enable Vector Extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Section: Create tool_embeddings Table
CREATE TABLE IF NOT EXISTS public.tool_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tool_id UUID NOT NULL REFERENCES public.tools(id) ON DELETE CASCADE,
    embedding VECTOR(1536) NOT NULL,
    content_hash TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE public.tool_embeddings IS 'Stores vector embeddings for semantic search of tools.';
COMMENT ON COLUMN public.tool_embeddings.content_hash IS 'SHA-256 hash of tool content to detect changes for re-embedding.';

-- Ensure a tool can only have one embedding.
-- This block first deletes any duplicates, keeping the newest, then adds the constraint.
WITH duplicates_to_delete AS (
  SELECT id, ROW_NUMBER() OVER(PARTITION BY tool_id ORDER BY created_at DESC) as rn
  FROM public.tool_embeddings
)
DELETE FROM public.tool_embeddings
WHERE id IN (SELECT id FROM duplicates_to_delete WHERE rn > 1);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tool_embeddings_tool_id_key') THEN
    ALTER TABLE public.tool_embeddings ADD CONSTRAINT tool_embeddings_tool_id_key UNIQUE (tool_id);
  END IF;
END;
$$;

-- Section: RLS for tool_embeddings
ALTER TABLE public.tool_embeddings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated read access to tool embeddings" ON public.tool_embeddings;
CREATE POLICY "Allow authenticated read access to tool embeddings" ON public.tool_embeddings FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins can manage tool embeddings" ON public.tool_embeddings;
CREATE POLICY "Admins can manage tool embeddings" ON public.tool_embeddings FOR ALL TO authenticated USING (public.is_admin());

-- Section: High-Performance Index
-- Using an IVFFlat index is crucial for fast similarity searches on large datasets.
CREATE INDEX IF NOT EXISTS idx_tool_embeddings_ivfflat ON public.tool_embeddings
USING ivfflat (embedding vector_l2_ops) WITH (lists = 100);

-- Section: Vector Helper Functions

-- This function aggregates all relevant text for a tool into a single string,
-- which is then used by an AI model to generate a vector embedding.
CREATE OR REPLACE FUNCTION public.get_tool_content_for_embedding(tool_id_param UUID)
RETURNS TEXT
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  tool_record RECORD;
  category_name_text TEXT;
  questions_text TEXT;
BEGIN
  SELECT t.title, t.description, c.name as category_name
  INTO tool_record
  FROM public.tools t LEFT JOIN public.categories c ON t.category_id = c.id
  WHERE t.id = tool_id_param;

  SELECT STRING_AGG(label, ' ' ORDER BY question_order) INTO questions_text
  FROM public.tool_questions
  WHERE tool_id = tool_id_param;

  RETURN COALESCE(tool_record.title, '') || ' | ' ||
         COALESCE(tool_record.description, '') || ' | ' ||
         COALESCE(tool_record.category_name, '') || ' | ' ||
         COALESCE(questions_text, '');
END;
$$;
COMMENT ON FUNCTION public.get_tool_content_for_embedding(UUID) IS 'Generates a unified text block from a tool and its questions for vector embedding.';

-- This function performs the vector search.
-- It must be dropped first to handle changes to its return table structure.
DROP FUNCTION IF EXISTS public.find_similar_tools(vector, float, integer);
CREATE OR REPLACE FUNCTION public.find_similar_tools(
  query_embedding vector(1536),
  similarity_threshold float,
  max_results integer
)
RETURNS TABLE (
  tool_id uuid,
  title text,
  description text,
  category_name text,
  similarity_score float
)
LANGUAGE plpgsql STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    t.title,
    t.description,
    c.name,
    1 - (te.embedding <=> query_embedding) -- Cosine similarity
  FROM
    public.tool_embeddings AS te
  JOIN
    public.tools AS t ON te.tool_id = t.id
  JOIN
    public.categories AS c ON t.category_id = c.id
  WHERE
    t.active = true AND
    1 - (te.embedding <=> query_embedding) > similarity_threshold
  ORDER BY
    similarity_score DESC
  LIMIT
    max_results;
END;
$$;
COMMENT ON FUNCTION public.find_similar_tools(vector, float, integer) IS 'Finds similar tools using vector cosine similarity search.';

COMMIT;
