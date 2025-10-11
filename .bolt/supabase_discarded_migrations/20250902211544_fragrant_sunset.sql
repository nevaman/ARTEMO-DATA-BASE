/*
  # Create knowledge_base_files table

  1. New Tables
    - `knowledge_base_files`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `filename` (text, generated filename)
      - `original_filename` (text, user's original filename)
      - `file_path` (text, storage path)
      - `file_size` (bigint, file size in bytes)
      - `mime_type` (text, file MIME type)
      - `processed_content` (text, extracted text content)
      - `processing_status` (text, processing status)
      - `created_at` (timestamptz, creation timestamp)

  2. Security
    - Enable RLS on `knowledge_base_files` table
    - Add policy for users to insert their own files
    - Add policy for users to view their own files
    - Add policy for users to delete their own files

  3. Constraints
    - Foreign key constraint to auth.users
    - Check constraint for processing_status values
    - Unique constraint on file_path
*/

-- Create the knowledge_base_files table
CREATE TABLE IF NOT EXISTS public.knowledge_base_files (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    filename text NOT NULL,
    original_filename text NOT NULL,
    file_path text NOT NULL UNIQUE,
    file_size bigint NOT NULL,
    mime_type text NOT NULL,
    processed_content text,
    processing_status text DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
    created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.knowledge_base_files ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for user file management
CREATE POLICY "Allow users to insert their own files"
ON public.knowledge_base_files FOR INSERT
TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow users to view their own files"
ON public.knowledge_base_files FOR SELECT
TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Allow users to delete their own files"
ON public.knowledge_base_files FOR DELETE
TO authenticated USING (auth.uid() = user_id);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_knowledge_files_user ON public.knowledge_base_files(user_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_files_status ON public.knowledge_base_files(processing_status);