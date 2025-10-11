/*
  # Seed Initial Data for Artemo AI Dashboard

  1. Categories
    - Create initial tool categories with proper ordering
    
  2. Sample Tools
    - Create initial tools to replace hardcoded data
    - Include proper question sequences
    
  3. Admin User
    - Create initial admin user profile
*/

-- Insert initial categories
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
    '550e8400-e29b-41d4-a716-446655440101',
    'Ad Writer (HAO)',
    'ad-writer-hao',
    'Uses the Hook, Angle, Outcome framework to generate compelling ad copy designed to grab attention and drive conversions.',
    '550e8400-e29b-41d4-a716-446655440001',
    true,
    true,
    'Claude',
    ARRAY['OpenAI'],
    'You are an expert ad copywriter specializing in the Hook-Angle-Outcome (HAO) framework. Your task is to create compelling advertisements that:

1. HOOK: Grab immediate attention with a powerful opening
2. ANGLE: Present a unique perspective or approach
3. OUTCOME: Promise a clear, specific result

Guidelines:
- Write for the specified target audience
- Match the requested tone and platform
- Focus on benefits over features
- Include a strong call-to-action
- Keep copy concise and impactful

Always structure your response with clear HAO sections and explain your strategic choices.'
  ),
  (
    '550e8400-e29b-41d4-a716-446655440102',
    'Money Tales Emails',
    'money-tales-emails',
    'Turns everyday events or simple stories into engaging emails that nurture your audience and seamlessly lead to a sales pitch.',
    '550e8400-e29b-41d4-a716-446655440002',
    true,
    true,
    'Claude',
    ARRAY['OpenAI'],
    'You are an expert email copywriter who specializes in storytelling through the "Money Tales" framework. Your task is to transform simple stories or experiences into engaging emails that:

1. Start with a relatable story or experience
2. Build emotional connection with the reader
3. Extract a valuable lesson or insight
4. Naturally transition to a product/service pitch
5. End with a compelling call-to-action

Guidelines:
- Keep stories authentic and relatable
- Focus on emotional resonance
- Make the transition to sales feel natural
- Include specific benefits and outcomes
- Write in a conversational, personal tone

Structure your response with clear story sections and sales integration.'
  ),
  (
    '550e8400-e29b-41d4-a716-446655440103',
    'Freestyle Long Form',
    'freestyle-long-form',
    'A flexible, open-ended tool for generating long-form content on any topic. Provide a prompt and let the AI write.',
    '550e8400-e29b-41d4-a716-446655440003',
    true,
    true,
    'Claude',
    ARRAY['OpenAI'],
    'You are a versatile content writer capable of creating high-quality long-form content on any topic. Your task is to:

1. Understand the topic and content type requested
2. Adapt your writing style to match the audience and tone
3. Create well-structured, engaging content
4. Include relevant examples and insights
5. Ensure proper flow and readability

Guidelines:
- Research-backed information when possible
- Clear structure with headings and subheadings
- Engaging introduction and strong conclusion
- Appropriate length for the content type
- SEO-friendly when applicable

Always ask clarifying questions if the request is too broad or unclear.'
  )
ON CONFLICT (id) DO NOTHING;

-- Insert questions for Ad Writer (HAO)
INSERT INTO tool_questions (id, tool_id, label, type, placeholder, required, question_order, options) VALUES
  (
    '550e8400-e29b-41d4-a716-446655440201',
    '550e8400-e29b-41d4-a716-446655440101',
    'What product or service are you advertising?',
    'textarea',
    'Describe your product or service in detail...',
    true,
    1,
    NULL
  ),
  (
    '550e8400-e29b-41d4-a716-446655440202',
    '550e8400-e29b-41d4-a716-446655440101',
    'Who is your target audience?',
    'textarea',
    'Describe your ideal customer...',
    true,
    2,
    NULL
  ),
  (
    '550e8400-e29b-41d4-a716-446655440203',
    '550e8400-e29b-41d4-a716-446655440101',
    'What platform will you advertise on?',
    'select',
    NULL,
    true,
    3,
    ARRAY['Facebook', 'Instagram', 'Google Ads', 'LinkedIn', 'Twitter', 'TikTok', 'YouTube']
  ),
  (
    '550e8400-e29b-41d4-a716-446655440204',
    '550e8400-e29b-41d4-a716-446655440101',
    'What is your main advertising goal?',
    'select',
    NULL,
    true,
    4,
    ARRAY['Brand Awareness', 'Lead Generation', 'Direct Sales', 'App Downloads', 'Event Registration']
  )
ON CONFLICT (id) DO NOTHING;

-- Insert questions for Money Tales Emails
INSERT INTO tool_questions (id, tool_id, label, type, placeholder, required, question_order, options) VALUES
  (
    '550e8400-e29b-41d4-a716-446655440301',
    '550e8400-e29b-41d4-a716-446655440102',
    'What story or experience do you want to share?',
    'textarea',
    'Tell me about a personal experience, observation, or story...',
    true,
    1,
    NULL
  ),
  (
    '550e8400-e29b-41d4-a716-446655440302',
    '550e8400-e29b-41d4-a716-446655440102',
    'What product or service are you promoting?',
    'input',
    'Your product or service name...',
    true,
    2,
    NULL
  ),
  (
    '550e8400-e29b-41d4-a716-446655440303',
    '550e8400-e29b-41d4-a716-446655440102',
    'Who is your email audience?',
    'textarea',
    'Describe your email subscribers...',
    true,
    3,
    NULL
  ),
  (
    '550e8400-e29b-41d4-a716-446655440304',
    '550e8400-e29b-41d4-a716-446655440102',
    'What is your call-to-action?',
    'input',
    'What action do you want readers to take?',
    true,
    4,
    NULL
  )
ON CONFLICT (id) DO NOTHING;

-- Insert questions for Freestyle Long Form
INSERT INTO tool_questions (id, tool_id, label, type, placeholder, required, question_order, options) VALUES
  (
    '550e8400-e29b-41d4-a716-446655440401',
    '550e8400-e29b-41d4-a716-446655440103',
    'What topic do you want to write about?',
    'input',
    'Enter your topic or subject...',
    true,
    1,
    NULL
  ),
  (
    '550e8400-e29b-41d4-a716-446655440402',
    '550e8400-e29b-41d4-a716-446655440103',
    'What type of content? (blog post, article, guide, etc.)',
    'input',
    'Specify the content format...',
    true,
    2,
    NULL
  ),
  (
    '550e8400-e29b-41d4-a716-446655440403',
    '550e8400-e29b-41d4-a716-446655440103',
    'Who is your target audience?',
    'textarea',
    'Describe who will be reading this content...',
    true,
    3,
    NULL
  ),
  (
    '550e8400-e29b-41d4-a716-446655440404',
    '550e8400-e29b-41d4-a716-446655440103',
    'What tone should the content have?',
    'select',
    NULL,
    true,
    4,
    ARRAY['Professional', 'Casual', 'Academic', 'Conversational', 'Authoritative', 'Friendly', 'Technical']
  ),
  (
    '550e8400-e29b-41d4-a716-446655440405',
    '550e8400-e29b-41d4-a716-446655440103',
    'Approximate word count?',
    'select',
    NULL,
    false,
    5,
    ARRAY['500-1000', '1000-2000', '2000-3000', '3000+']
  )
ON CONFLICT (id) DO NOTHING;

-- Create database functions for common operations
CREATE OR REPLACE FUNCTION get_user_role(user_uuid UUID)
RETURNS TEXT AS $$
BEGIN
  RETURN (
    SELECT role FROM user_profiles WHERE id = user_uuid
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION increment_tool_usage(tool_uuid UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE tools SET usage_count = usage_count + 1 WHERE id = tool_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;