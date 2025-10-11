/*
  # Add Vector Search for Tool Recommendations

  1. New Tables
    - `tool_embeddings`
      - `id` (uuid, primary key)
      - `tool_id` (uuid, foreign key to tools)
      - `embedding` (vector, 1536 dimensions for OpenAI ada-002)
      - `content_hash` (text, to detect changes)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Extensions
    - Enable pgvector extension for vector operations

  3. Indexes
    - Vector similarity index for fast searches
    - Tool ID index for lookups

  4. Functions
    - Helper function for similarity search
*/

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create tool embeddings table
CREATE TABLE IF NOT EXISTS tool_embeddings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_id uuid REFERENCES tools(id) ON DELETE CASCADE,
  embedding vector(1536), -- OpenAI ada-002 embedding size
  content_hash text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tool_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tool_embeddings_tool_id ON tool_embeddings(tool_id);
CREATE INDEX IF NOT EXISTS idx_tool_embeddings_vector ON tool_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Enable RLS
ALTER TABLE tool_embeddings ENABLE ROW LEVEL SECURITY;

-- RLS policies for tool embeddings
CREATE POLICY "Anyone can view tool embeddings for active tools"
  ON tool_embeddings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tools 
      WHERE tools.id = tool_embeddings.tool_id 
      AND tools.active = true
    )
  );

CREATE POLICY "Admins can manage tool embeddings"
  ON tool_embeddings
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Function to find similar tools using vector search
CREATE OR REPLACE FUNCTION find_similar_tools(
  query_embedding vector(1536),
  similarity_threshold float DEFAULT 0.7,
  max_results int DEFAULT 5
)
RETURNS TABLE (
  tool_id uuid,
  title text,
  description text,
  category_name text,
  similarity_score float
) 
LANGUAGE sql
AS $$
  SELECT 
    t.id as tool_id,
    t.title,
    t.description,
    c.name as category_name,
    1 - (te.embedding <=> query_embedding) as similarity_score
  FROM tool_embeddings te
  JOIN tools t ON te.tool_id = t.id
  JOIN categories c ON t.category_id = c.id
  WHERE t.active = true
    AND (1 - (te.embedding <=> query_embedding)) >= similarity_threshold
  ORDER BY te.embedding <=> query_embedding
  LIMIT max_results;
$$;

-- Function to get content hash for embedding generation
CREATE OR REPLACE FUNCTION get_tool_content_for_embedding(tool_id_param uuid)
RETURNS text
LANGUAGE sql
AS $$
  SELECT CONCAT(
    t.title, ' | ',
    t.description, ' | ',
    c.name, ' | ',
    COALESCE(string_agg(tq.label, ' '), '')
  )
  FROM tools t
  LEFT JOIN categories c ON t.category_id = c.id
  LEFT JOIN tool_questions tq ON t.id = tq.tool_id
  WHERE t.id = tool_id_param
  GROUP BY t.id, t.title, t.description, c.name;
$$;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_tool_embeddings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_tool_embeddings_updated_at
  BEFORE UPDATE ON tool_embeddings
  FOR EACH ROW
  EXECUTE FUNCTION update_tool_embeddings_updated_at();