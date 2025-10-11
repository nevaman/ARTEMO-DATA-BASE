-- Filename: 20251011211205_phase_5_storage_policies.sql
-- Phase 5: Storage Security & Policies
-- Description: This is the final and crucial migration that secures the application's file storage.
--              It creates the "knowledge-base" bucket and applies Row Level Security policies to it,
--              ensuring users can only upload, view, and delete their own files.
-- Idempotency: SAFE - All operations are fully idempotent.

BEGIN;

-- Section: Create Storage Bucket
-- Create the "knowledge-base" bucket if it doesn't already exist.
-- This bucket will store all user-uploaded documents. It is set to private.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('knowledge-base', 'knowledge-base', false, 26214400, ARRAY['application/pdf', 'text/plain', 'text/markdown', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
ON CONFLICT (id) DO NOTHING;

-- Section: Storage Row Level Security Policies
-- These policies control who can access the actual files within the "knowledge-base" bucket.

-- Policy 1: Allow users to UPLOAD files into their own folder.
-- The path is expected to be "{user_id}/{filename}". This policy checks that the user's UID
-- matches the first folder name in the path.
DROP POLICY IF EXISTS "Allow individual user inserts" ON storage.objects;
CREATE POLICY "Allow individual user inserts"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'knowledge-base' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy 2: Allow users to VIEW/DOWNLOAD their own files.
DROP POLICY IF EXISTS "Allow individual user selects" ON storage.objects;
CREATE POLICY "Allow individual user selects"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'knowledge-base' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy 3: Allow users to UPDATE their own files.
DROP POLICY IF EXISTS "Allow individual user updates" ON storage.objects;
CREATE POLICY "Allow individual user updates"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'knowledge-base' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy 4: Allow users to DELETE their own files.
DROP POLICY IF EXISTS "Allow individual user deletes" ON storage.objects;
CREATE POLICY "Allow individual user deletes"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'knowledge-base' AND
  auth.uid()::text = (storage.foldername(name))[1]
);


COMMIT;

