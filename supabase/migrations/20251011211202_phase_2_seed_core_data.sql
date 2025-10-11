-- Filename: 20251011211202_phase_2_seed_core_data.sql
-- Phase 2: Seed Core Data
-- Description: Inserts the initial data required for the application to be usable,
--              including categories, tools, and their associated questions.
-- Idempotency: SAFE - Uses ON CONFLICT (id) DO NOTHING to prevent duplicate entries.

BEGIN;

-- Insert initial categories
-- Using hardcoded UUIDs ensures consistency across all database environments.
INSERT INTO categories (id, name, slug, description, display_order, active) VALUES
  ('550e8400-e29b-41d4-a716-446655440001', 'Ad Copy', 'ad-copy', 'Tools for creating compelling advertisements', 1, true),
  ('550e8400-e29b-41d4-a716-446655440002', 'Email Copy', 'email-copy', 'Tools for email marketing and sequences', 2, true),
  ('550e8400-e29b-41d4-a716-446655440003', 'Long Form Content', 'long-form', 'Tools for blog posts, articles, and guides', 3, true),
  ('550e8400-e29b-41d4-a716-446655440004', 'Client Management', 'client-management', 'Tools for managing client relationships', 4, true),
  ('550e8400-e29b-41d4-a716-446655440005', 'Copy Improvement', 'copy-improvement', 'Tools for enhancing existing content', 5, true),
  ('550e8400-e29b-41d4-a716-446655440006', 'Sales & Funnel Copy', 'sales-funnel', 'Tools for sales pages and funnels', 6, true),
  ('550e8400-e29b-41d4-a716-446655440007', 'Podcast Tools', 'podcast-tools', 'Tools for podcast content creation', 7, true),
  ('550e8400-e29b-41d4-a716-446655440008', 'Other', 'other', 'Miscellaneous copywriting tools', 8, true)
ON CONFLICT (id) DO NOTHING;

-- Insert initial tools
INSERT INTO tools (id, title, slug, description, category_id, active, featured, primary_model, fallback_models, prompt_instructions) VALUES
  (
    '550e8400-e29b-41d4-a716-446655440101', 'Ad Writer (HAO)', 'ad-writer-hao', 'Uses the Hook, Angle, Outcome framework to generate compelling ad copy.', '550e8400-e29b-41d4-a716-446655440001', true, true, 'Claude', ARRAY['OpenAI'], 'You are an expert ad copywriter specializing in the Hook-Angle-Outcome (HAO) framework...'
  ),
  (
    '550e8400-e29b-41d4-a716-446655440102', 'Money Tales Emails', 'money-tales-emails', 'Turns everyday events into engaging emails that nurture your audience and lead to a sales pitch.', '550e8400-e29b-41d4-a716-446655440002', true, true, 'Claude', ARRAY['OpenAI'], 'You are an expert email copywriter who specializes in storytelling through the "Money Tales" framework...'
  ),
  (
    '550e8400-e29b-41d4-a716-446655440103', 'Freestyle Long Form', 'freestyle-long-form', 'A flexible, open-ended tool for generating long-form content on any topic.', '550e8400-e29b-41d4-a716-446655440003', true, true, 'Claude', ARRAY['OpenAI'], 'You are a versatile content writer capable of creating high-quality long-form content...'
  )
ON CONFLICT (id) DO NOTHING;

-- Insert questions for Ad Writer (HAO)
INSERT INTO tool_questions (id, tool_id, label, type, placeholder, required, question_order, options) VALUES
  ('550e8400-e29b-41d4-a716-446655440201', '550e8400-e29b-41d4-a716-446655440101', 'What product or service are you advertising?', 'textarea', 'Describe your product or service in detail...', true, 1, NULL),
  ('550e8400-e29b-41d4-a716-446655440202', '550e8400-e29b-41d4-a716-446655440101', 'Who is your target audience?', 'textarea', 'Describe your ideal customer...', true, 2, NULL),
  ('550e8400-e29b-41d4-a716-446655440203', '550e8400-e29b-41d4-a716-446655440101', 'What platform will you advertise on?', 'select', NULL, true, 3, ARRAY['Facebook', 'Instagram', 'Google Ads', 'LinkedIn', 'Twitter', 'TikTok', 'YouTube']),
  ('550e8400-e29b-41d4-a716-446655440204', '550e8400-e29b-41d4-a716-446655440101', 'What is your main advertising goal?', 'select', NULL, true, 4, ARRAY['Brand Awareness', 'Lead Generation', 'Direct Sales', 'App Downloads', 'Event Registration'])
ON CONFLICT (id) DO NOTHING;

-- Insert questions for Money Tales Emails
INSERT INTO tool_questions (id, tool_id, label, type, placeholder, required, question_order, options) VALUES
  ('550e8400-e29b-41d4-a716-446655440301', '550e8400-e29b-41d4-a716-446655440102', 'What story or experience do you want to share?', 'textarea', 'Tell me about a personal experience, observation, or story...', true, 1, NULL),
  ('550e8400-e29b-41d4-a716-446655440302', '550e8400-e29b-41d4-a716-446655440102', 'What product or service are you promoting?', 'input', 'Your product or service name...', true, 2, NULL),
  ('550e8400-e29b-41d4-a716-446655440303', '550e8400-e29b-41d4-a716-446655440102', 'Who is your email audience?', 'textarea', 'Describe your email subscribers...', true, 3, NULL),
  ('550e8400-e29b-41d4-a716-446655440304', '550e8400-e29b-41d4-a716-446655440102', 'What is your call-to-action?', 'input', 'What action do you want readers to take?', true, 4, NULL)
ON CONFLICT (id) DO NOTHING;

-- Insert questions for Freestyle Long Form
INSERT INTO tool_questions (id, tool_id, label, type, placeholder, required, question_order, options) VALUES
  ('550e8400-e29b-41d4-a716-446655440401', '550e8400-e29b-41d4-a716-446655440103', 'What topic do you want to write about?', 'input', 'Enter your topic or subject...', true, 1, NULL),
  ('550e8400-e29b-41d4-a716-446655440402', '550e8400-e29b-41d4-a716-446655440103', 'What type of content? (blog post, article, guide, etc.)', 'input', 'Specify the content format...', true, 2, NULL),
  ('550e8400-e29b-41d4-a716-446655440403', '550e8400-e29b-41d4-a716-446655440103', 'Who is your target audience?', 'textarea', 'Describe who will be reading this content...', true, 3, NULL),
  ('550e8400-e29b-41d4-a716-446655440404', '550e8400-e29b-41d4-a716-446655440103', 'What tone should the content have?', 'select', NULL, true, 4, ARRAY['Professional', 'Casual', 'Academic', 'Conversational', 'Authoritative', 'Friendly', 'Technical']),
  ('550e8400-e29b-41d4-a716-446655440405', '550e8400-e29b-41d4-a716-446655440103', 'Approximate word count?', 'select', NULL, false, 5, ARRAY['500-1000', '1000-2000', '2000-3000', '3000+'])
ON CONFLICT (id) DO NOTHING;

COMMIT;
