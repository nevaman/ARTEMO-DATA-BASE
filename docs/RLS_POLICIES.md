# Row Level Security (RLS) Policies

**Status:** Approved  
**Last Updated:** 2025-01-20  
**Author:** Database Administrator  
**Source of Truth:** Current production RLS policies  

## Overview 

This document provides the authoritative reference for all Row Level Security policies in the Artemo AI Dashboard. All tables have RLS enabled for data protection and user isolation.

## Policy Summary by Table

| Table | Total Policies | SELECT | INSERT | UPDATE | DELETE | ALL |
|-------|----------------|--------|--------|--------|--------|-----|
| `user_profiles` | 5 | 3 | 0 | 2 | 0 | 0 |
| `categories` | 6 | 2 | 1 | 1 | 1 | 1 |
| `tools` | 6 | 2 | 1 | 1 | 1 | 1 |
| `tool_questions` | 6 | 2 | 1 | 1 | 1 | 1 |
| `projects` | 1 | 0 | 0 | 0 | 0 | 1 |
| `chat_sessions` | 5 | 1 | 1 | 1 | 1 | 1 |
| `knowledge_base_files` | 6 | 1 | 2 | 1 | 2 | 0 |
| `usage_analytics` | 3 | 2 | 1 | 0 | 0 | 0 |
| `announcements` | 4 | 1 | 1 | 1 | 1 | 0 |
| `user_management_audit` | 2 | 1 | 1 | 0 | 0 | 0 |
| `tool_embeddings` | 3 | 2 | 0 | 0 | 0 | 1 |

**Total Policies:** 47

## Detailed Policy Definitions

### `user_profiles` (5 policies)

**SELECT Policies:**
- `Admins can view all user profiles`: Admin access to all profiles
- `Enable users to view profiles in joins`: Public read for joins
- `User profiles select (auth)`: Users can view own profile + admin override

**UPDATE Policies:**
- `Admins can update user profiles and status`: Admin management
- `User profiles update (auth)`: Users can update own profile + admin override

### `categories` (6 policies)

**SELECT Policies:**
- `Categories select (anon)`: Anonymous users see active categories
- `Categories select (auth)`: Authenticated users see active + admin sees all

**INSERT/UPDATE/DELETE Policies:**
- `Categories insert (admin)`: Admin-only creation
- `Categories update (admin)`: Admin-only updates
- `Categories delete (admin)`: Admin-only deletion

**ALL Policies:**
- `Admins can manage categories`: Comprehensive admin access

### `tools` (6 policies)

**SELECT Policies:**
- `Tools select (anon)`: Anonymous users see active tools
- `Tools select (auth)`: Authenticated users see active + admin sees all

**INSERT/UPDATE/DELETE Policies:**
- `Tools insert (admin)`: Admin-only creation
- `Tools update (admin)`: Admin-only updates
- `Tools delete (admin)`: Admin-only deletion

**ALL Policies:**
- `Admins can manage tools`: Comprehensive admin access

### `tool_questions` (6 policies)

**SELECT Policies:**
- `Tool Qs select (anon)`: Anonymous users see questions for active tools
- `Tool Qs select (auth)`: Authenticated users see questions + admin override

**INSERT/UPDATE/DELETE Policies:**
- `Tool Qs insert (admin)`: Admin-only creation
- `Tool Qs update (admin)`: Admin-only updates
- `Tool Qs delete (admin)`: Admin-only deletion

**ALL Policies:**
- `Admins can manage tool questions`: Comprehensive admin access

### `projects` (1 policy)

**ALL Policies:**
- `Users can manage own projects`: Complete user control over own projects

### `chat_sessions` (5 policies)

**SELECT Policies:**
- `Chat sessions select (auth)`: Users see own + admin sees all

**INSERT/UPDATE/DELETE Policies:**
- `Chat sessions insert (auth)`: Users create own + admin override
- `Chat sessions update (auth)`: Users update own + admin override
- `Chat sessions delete (auth)`: Users delete own + admin override

**ALL Policies:**
- `Admins can view all chat sessions`: Admin read access

### `knowledge_base_files` (6 policies)

**SELECT Policies:**
- `KB files select (auth)`: Users see own + admin sees all

**INSERT Policies:**
- `Allow users to insert their own files`: User file uploads
- `KB files insert (auth)`: Enhanced user + admin access

**UPDATE Policies:**
- `KB files update (auth)`: Users update own + admin override

**DELETE Policies:**
- `Allow users to delete their own files`: User file management
- `KB files delete (auth)`: Enhanced user + admin access

### `usage_analytics` (3 policies)

**SELECT Policies:**
- `Admins can view all usage analytics`: Admin analytics access
- `Usage analytics select (auth)`: Users see own + admin sees all

**INSERT Policies:**
- `Users can insert own analytics`: User activity tracking

### `announcements` (4 policies)

**SELECT Policies:**
- `Announcements select (auth)`: Users see active + admin sees all

**INSERT/UPDATE/DELETE Policies:**
- `Announcements insert (admin)`: Admin-only creation
- `Announcements update (admin)`: Admin-only updates
- `Announcements delete (admin)`: Admin-only deletion

### `user_management_audit` (2 policies)

**SELECT Policies:**
- `Admins can view audit logs`: Admin audit access

**INSERT Policies:**
- `Admins can insert audit logs`: Admin audit logging

### `tool_embeddings` (3 policies)

**SELECT Policies:**
- `Anyone can view tool embeddings for active tools`: Public vector search access
- `Admins can manage tool embeddings`: Admin management access

**ALL Policies:**
- `Admins can manage tool embeddings`: Comprehensive admin access

## Security Principles

### Data Isolation
- Users can only access their own projects, chat sessions, and files
- Admin users have override access to all data for management purposes
- Anonymous users can browse active tools and categories only

### Admin Controls
- All content management (tools, categories, announcements) requires admin role
- User management operations are admin-only with audit trail
- System analytics and health metrics are admin-only

### Public Access
- Active tools and categories are publicly readable for discovery
- Tool questions are readable for active tools to support UI
- Vector embeddings are publicly readable for tool recommendations

---

**For database schema details, see:** [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md)  
**For implementation guides, see:** [../database/rls-backup/](../database/rls-backup/)