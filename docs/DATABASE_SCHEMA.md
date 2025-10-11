# Database Schema Documentation

**Status:** Approved  
**Last Updated:** 2025-01-20  
**Author:** Technical Documentation Team  
**Source of Truth:** Current production database schema  

## Overview
 
This document provides the authoritative reference for the Artemo AI Dashboard database schema. All tables use Row Level Security (RLS) for data protection and user isolation.

## Core Tables

### Authentication & Users

#### `user_profiles`
Extends Supabase auth.users with additional profile information.

| Column | Type | Default | Nullable | Description |
|--------|------|---------|----------|-------------|
| `id` | uuid | - | NO | Primary key, references auth.users(id) |
| `full_name` | text | - | YES | User's full name |
| `role` | text | 'user' | YES | User role: 'user' or 'admin' |
| `organization` | text | - | YES | User's organization |
| `avatar_url` | text | - | YES | Profile picture URL |
| `preferences` | jsonb | '{}' | YES | User preferences and settings |
| `created_at` | timestamptz | now() | YES | Account creation timestamp |
| `updated_at` | timestamptz | now() | YES | Last update timestamp |
| `active` | boolean | true | NO | Account active status |
| `deleted_at` | timestamptz | - | YES | Soft delete timestamp |
| `last_login` | timestamptz | - | YES | Last login timestamp |
| `status_updated_by` | uuid | - | YES | Admin who updated status |
| `status_updated_at` | timestamptz | now() | YES | Status update timestamp |
| `default_client_profile_id` | uuid | - | YES | Default client profile reference |

**Constraints:**
- Primary Key: `id`
- Foreign Key: `id` → `auth.users(id)` ON DELETE CASCADE
- Foreign Key: `status_updated_by` → `user_profiles(id)`
- Check: `role IN ('user', 'admin')`

### Dynamic Tool System

#### `categories`
Admin-controlled tool categories with custom ordering and icons.

| Column | Type | Default | Nullable | Description |
|--------|------|---------|----------|-------------|
| `id` | uuid | uuid_generate_v4() | NO | Primary key |
| `name` | text | - | NO | Category name (unique) |
| `slug` | text | - | NO | URL-friendly slug (unique) |
| `description` | text | - | YES | Category description |
| `display_order` | integer | 0 | NO | Display order for sorting |
| `active` | boolean | true | YES | Category visibility |
| `created_at` | timestamptz | now() | YES | Creation timestamp |
| `updated_at` | timestamptz | now() | YES | Last update timestamp |
| `icon_name` | text | 'Settings' | YES | Icon component name |
| `icon_color` | text | 'text-blue-600' | YES | Icon color class |

**Constraints:**
- Primary Key: `id`
- Unique: `name`, `slug`

#### `tools`
Dynamic AI tools created by administrators.

| Column | Type | Default | Nullable | Description |
|--------|------|---------|----------|-------------|
| `id` | uuid | uuid_generate_v4() | NO | Primary key |
| `title` | text | - | NO | Tool title |
| `slug` | text | - | NO | URL-friendly slug (unique) |
| `description` | text | - | NO | Tool description |
| `category_id` | uuid | - | YES | Category reference |
| `active` | boolean | true | YES | Tool availability |
| `featured` | boolean | false | YES | Featured on homepage |
| `primary_model` | text | 'Claude' | NO | Primary AI model |
| `fallback_models` | text[] | ['OpenAI'] | YES | Fallback AI models |
| `prompt_instructions` | text | - | NO | AI prompt template |
| `usage_count` | integer | 0 | YES | Usage statistics |
| `created_by` | uuid | - | YES | Creator reference |
| `created_at` | timestamptz | now() | YES | Creation timestamp |
| `updated_at` | timestamptz | now() | YES | Last update timestamp |
| `knowledge_base_file_id` | uuid | - | YES | Linked knowledge base file |

**Constraints:**
- Primary Key: `id`
- Unique: `slug`
- Foreign Key: `category_id` → `categories(id)` ON DELETE CASCADE
- Foreign Key: `created_by` → `user_profiles(id)` ON DELETE SET NULL
- Foreign Key: `knowledge_base_file_id` → `knowledge_base_files(id)` ON DELETE SET NULL

#### `tool_questions`
Sequential questions for structured tool interactions.

| Column | Type | Default | Nullable | Description |
|--------|------|---------|----------|-------------|
| `id` | uuid | uuid_generate_v4() | NO | Primary key |
| `tool_id` | uuid | - | YES | Tool reference |
| `label` | text | - | NO | Question text |
| `type` | text | - | NO | Input type: 'input', 'textarea', 'select' |
| `placeholder` | text | - | YES | Input placeholder text |
| `required` | boolean | false | YES | Required field flag |
| `question_order` | integer | - | NO | Display order |
| `options` | text[] | - | YES | Select options (for type='select') |
| `validation_rules` | jsonb | '{}' | YES | Validation configuration |
| `created_at` | timestamptz | now() | YES | Creation timestamp |

**Constraints:**
- Primary Key: `id`
- Foreign Key: `tool_id` → `tools(id)` ON DELETE CASCADE
- Check: `type IN ('input', 'textarea', 'select')`

### User Data & Content

#### `projects`
User-created projects for organizing work.

| Column | Type | Default | Nullable | Description |
|--------|------|---------|----------|-------------|
| `id` | uuid | uuid_generate_v4() | NO | Primary key |
| `name` | text | - | NO | Project name |
| `description` | text | - | YES | Project description |
| `user_id` | uuid | - | YES | Owner reference |
| `color` | text | '#008F6B' | NO | Project color |
| `archived` | boolean | false | YES | Archive status |
| `created_at` | timestamptz | now() | YES | Creation timestamp |
| `updated_at` | timestamptz | now() | YES | Last update timestamp |
| `client_profile_snapshot` | jsonb | - | YES | Client profile data |

**Constraints:**
- Primary Key: `id`
- Foreign Key: `user_id` → `auth.users(id)` ON DELETE CASCADE

#### `chat_sessions`
AI conversations linked to tools and projects.

| Column | Type | Default | Nullable | Description |
|--------|------|---------|----------|-------------|
| `id` | uuid | uuid_generate_v4() | NO | Primary key |
| `user_id` | uuid | - | YES | User reference |
| `tool_id` | uuid | - | YES | Tool reference |
| `project_id` | uuid | - | YES | Project reference |
| `title` | text | - | NO | Session title |
| `session_data` | jsonb | '{}' | NO | Messages and session state |
| `ai_model_used` | text | - | YES | AI model used |
| `token_usage` | integer | 0 | YES | Token consumption |
| `completed` | boolean | false | YES | Session completion status |
| `created_at` | timestamptz | now() | YES | Creation timestamp |
| `updated_at` | timestamptz | now() | YES | Last update timestamp |

**Constraints:**
- Primary Key: `id`
- Foreign Key: `user_id` → `auth.users(id)` ON DELETE CASCADE
- Foreign Key: `tool_id` → `tools(id)` ON DELETE SET NULL
- Foreign Key: `project_id` → `projects(id)` ON DELETE SET NULL

#### `knowledge_base_files`
Document uploads for AI context.

| Column | Type | Default | Nullable | Description |
|--------|------|---------|----------|-------------|
| `id` | uuid | uuid_generate_v4() | NO | Primary key |
| `user_id` | uuid | - | YES | Owner reference |
| `filename` | text | - | NO | Generated filename |
| `original_filename` | text | - | NO | Original filename |
| `file_path` | text | - | NO | Storage path |
| `file_size` | integer | - | NO | File size in bytes |
| `mime_type` | text | - | NO | File MIME type |
| `processed_content` | text | - | YES | Extracted text content |
| `processing_status` | text | 'pending' | YES | Processing status |
| `created_at` | timestamptz | now() | YES | Upload timestamp |
| `updated_at` | timestamptz | now() | YES | Last update timestamp |

**Constraints:**
- Primary Key: `id`
- Foreign Key: `user_id` → `auth.users(id)` ON DELETE CASCADE
- Check: `processing_status IN ('pending', 'processing', 'completed', 'failed')`

### Analytics & Audit

#### `usage_analytics`
Platform usage tracking and analytics.

| Column | Type | Default | Nullable | Description |
|--------|------|---------|----------|-------------|
| `id` | uuid | uuid_generate_v4() | NO | Primary key |
| `user_id` | uuid | - | YES | User reference |
| `tool_id` | uuid | - | YES | Tool reference |
| `action_type` | text | - | NO | Action performed |
| `metadata` | jsonb | '{}' | YES | Additional data |
| `created_at` | timestamptz | now() | YES | Action timestamp |

**Constraints:**
- Primary Key: `id`
- Foreign Key: `user_id` → `user_profiles(id)` ON DELETE CASCADE
- Foreign Key: `tool_id` → `tools(id)` ON DELETE SET NULL

#### `user_management_audit`
Administrative action audit trail.

| Column | Type | Default | Nullable | Description |
|--------|------|---------|----------|-------------|
| `id` | uuid | gen_random_uuid() | NO | Primary key |
| `target_user_id` | uuid | - | NO | Target user reference |
| `admin_user_id` | uuid | - | NO | Admin user reference |
| `action_type` | text | - | NO | Action performed |
| `old_value` | jsonb | - | YES | Previous value |
| `new_value` | jsonb | - | YES | New value |
| `reason` | text | - | YES | Action reason |
| `created_at` | timestamptz | now() | YES | Action timestamp |

**Constraints:**
- Primary Key: `id`
- Foreign Key: `target_user_id` → `user_profiles(id)`
- Foreign Key: `admin_user_id` → `user_profiles(id)`
- Check: `action_type IN ('status_change', 'role_change', 'soft_delete', 'restore')`

#### `announcements`
System announcements and notifications.

| Column | Type | Default | Nullable | Description |
|--------|------|---------|----------|-------------|
| `id` | uuid | gen_random_uuid() | NO | Primary key |
| `title` | text | - | NO | Announcement title |
| `content` | text | - | NO | Announcement content |
| `active` | boolean | true | YES | Visibility status |
| `show_on_login` | boolean | false | YES | Login popup flag |
| `created_by` | uuid | - | YES | Creator reference |
| `created_at` | timestamptz | now() | YES | Creation timestamp |
| `updated_at` | timestamptz | now() | YES | Last update timestamp |

**Constraints:**
- Primary Key: `id`
- Foreign Key: `created_by` → `user_profiles(id)`

#### `tool_embeddings`
Vector embeddings for AI-powered tool recommendations.

| Column | Type | Default | Nullable | Description |
|--------|------|---------|----------|-------------|
| `id` | uuid | gen_random_uuid() | NO | Primary key |
| `tool_id` | uuid | - | YES | Tool reference |
| `embedding` | vector(1536) | - | YES | Vector embedding |
| `content_hash` | text | - | NO | Content hash for updates |
| `created_at` | timestamptz | now() | YES | Creation timestamp |
| `updated_at` | timestamptz | now() | YES | Last update timestamp |

**Constraints:**
- Primary Key: `id`
- Unique: `tool_id`
- Foreign Key: `tool_id` → `tools(id)` ON DELETE CASCADE

## Views

### `active_users`
Filtered view of active user profiles for admin interfaces.

**Columns:** `id`, `full_name`, `role`, `organization`, `active`, `created_at`, `updated_at`, `last_login`, `status_updated_by`, `status_updated_at`

**Dependencies:** `user_profiles` table

## Functions & Triggers

### Automatic Triggers
- `update_updated_at_column()`: Updates `updated_at` on row modifications
- `handle_new_user()`: Creates user profile on auth.users insert
- `update_tool_embeddings_updated_at()`: Updates tool embeddings timestamp
- `update_announcements_updated_at()`: Updates announcements timestamp

### Database Functions
- `is_admin()`: Checks if current user has admin role
- `get_dashboard_analytics()`: Retrieves admin dashboard metrics
- `get_tool_content_for_embedding()`: Extracts tool content for vector search
- `find_similar_tools()`: Vector similarity search for tool recommendations

## Indexes

### Performance Indexes
- `idx_user_profiles_role`: User role filtering
- `idx_chat_sessions_user`: User chat session queries
- `idx_chat_sessions_project_id`: Project-based chat queries
- `idx_tool_questions_tool_order`: Tool question ordering
- `idx_knowledge_files_user`: User file queries
- `idx_tool_embeddings_vector`: Vector similarity search (IVFFlat)

## Security Notes

- All tables have RLS enabled
- User data is isolated by `auth.uid()`
- Admin operations require `is_admin()` function check
- Public read access for active tools and categories
- File uploads restricted to authenticated users

---

**For RLS policy details, see:** [RLS_POLICIES.md](./RLS_POLICIES.md)  
**For API integration, see:** [API_SERVICES.md](./API_SERVICES.md)