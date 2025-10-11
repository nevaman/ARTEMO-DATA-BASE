# RLS Policy Rollback Procedure

## 🚨 Emergency Rollback Plan

**Date Created**: 2025-01-18  
**Purpose**: Restore original RLS policies if optimization causes issues  
**Estimated Rollback Time**: 5-10 minutes  
**Potential Downtime**: 2-3 minutes during policy recreation  

---
 
## 📋 Pre-Rollback Checklist

Before executing rollback, verify:

- [ ] **Database Access**: Confirm you have SUPERUSER or sufficient privileges
- [ ] **Backup Verification**: Confirm `current-rls-policies-backup.sql` is accessible
- [ ] **User Impact**: Notify users of potential brief service interruption
- [ ] **Monitoring**: Prepare to monitor application logs during rollback
- [ ] **Team Notification**: Alert development team of rollback initiation

---

## 🔄 Rollback Execution Steps

### Step 1: Disable New Policies (if they exist)

Execute these commands to remove the optimized policies:

```sql
-- Drop optimized user_profiles policies
DROP POLICY IF EXISTS "Enable users to view their own profile and admins to view all profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;

-- Drop optimized categories policies
DROP POLICY IF EXISTS "Enable public to view active categories and admins to view all categories" ON public.categories;
DROP POLICY IF EXISTS "Admins can insert categories" ON public.categories;
DROP POLICY IF EXISTS "Admins can update categories" ON public.categories;
DROP POLICY IF EXISTS "Admins can delete categories" ON public.categories;

-- Drop optimized tools policies
DROP POLICY IF EXISTS "Enable public to view active tools and admins to view all tools" ON public.tools;
DROP POLICY IF EXISTS "Admins can insert tools" ON public.tools;
DROP POLICY IF EXISTS "Admins can update tools" ON public.tools;
DROP POLICY IF EXISTS "Admins can delete tools" ON public.tools;

-- Drop optimized tool_questions policies
DROP POLICY IF EXISTS "Enable public to view questions for active tools and admins to view all questions" ON public.tool_questions;
DROP POLICY IF EXISTS "Admins can insert tool questions" ON public.tool_questions;
DROP POLICY IF EXISTS "Admins can update tool questions" ON public.tool_questions;
DROP POLICY IF EXISTS "Admins can delete tool questions" ON public.tool_questions;

-- Drop optimized projects policies
DROP POLICY IF EXISTS "Users can manage own projects" ON public.projects;

-- Drop optimized chat_sessions policies
DROP POLICY IF EXISTS "Enable users to view their own chat sessions and admins to view all chat sessions" ON public.chat_sessions;
DROP POLICY IF EXISTS "Users can manage own chat sessions" ON public.chat_sessions;

-- Drop optimized knowledge_base_files policies
DROP POLICY IF EXISTS "Users can manage own files" ON public.knowledge_base_files;

-- Drop optimized usage_analytics policies
DROP POLICY IF EXISTS "Enable users to view their own analytics and admins to view all analytics" ON public.usage_analytics;
DROP POLICY IF EXISTS "Users can insert own analytics" ON public.usage_analytics;

-- Drop optimized announcements policies
DROP POLICY IF EXISTS "Enable public to view active announcements and admins to view all announcements" ON public.announcements;
DROP POLICY IF EXISTS "Admins can insert announcements" ON public.announcements;
DROP POLICY IF EXISTS "Admins can update announcements" ON public.announcements;
DROP POLICY IF EXISTS "Admins can delete announcements" ON public.announcements;
```

### Step 2: Restore Original Policies

Execute the complete backup script:

```sql
-- Execute the entire current-rls-policies-backup.sql file
-- This will restore all original policies with their exact configurations
```

**Alternative**: Copy and paste the policy creation statements from `current-rls-policies-backup.sql`

### Step 3: Verify Rollback Success

Run these verification queries:

```sql
-- 1. Verify all expected policies are restored
SELECT tablename, policyname, cmd, permissive
FROM pg_policies 
WHERE schemaname = 'public' 
ORDER BY tablename, policyname;

-- 2. Verify RLS is still enabled on all tables
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND rowsecurity = true;

-- 3. Count policies per table (should match original counts)
SELECT tablename, COUNT(*) as policy_count
FROM pg_policies 
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

-- Current production policy counts:
-- announcements: 4
-- categories: 6
-- chat_sessions: 5
-- knowledge_base_files: 6
-- projects: 1
-- tool_questions: 6
-- tools: 6
-- tool_embeddings: 3
-- usage_analytics: 3
-- user_management_audit: 2
-- user_profiles: 5
-- TOTAL: 47 policies
```

**Note:** For detailed policy information, see [../docs/RLS_POLICIES.md](../docs/RLS_POLICIES.md).
### Step 4: Test Application Functionality

After rollback, verify these critical functions:

- [ ] **User Authentication**: Login/logout works correctly
- [ ] **Admin Access**: Admin panel accessible to admin users
- [ ] **Tool Access**: Users can view and use active tools
- [ ] **Project Management**: Users can create/edit their own projects
- [ ] **Chat Sessions**: Users can create and view their own chats
- [ ] **File Uploads**: Knowledge base file uploads work
- [ ] **Category Browsing**: Public can view active categories

---

## 🔍 Rollback Verification Checklist

### Database Level Verification
- [ ] All original policies restored with correct names
- [ ] Policy conditions match backup exactly
- [ ] RLS enabled status unchanged on all tables
- [ ] No orphaned or duplicate policies exist
- [ ] Helper functions (`is_admin()`, `uid()`) still functional

### Application Level Verification
- [ ] User login/registration functional
- [ ] Admin panel accessible to admins only
- [ ] Regular users cannot access admin functions
- [ ] Tool browsing works for all users
- [ ] Project creation/management functional
- [ ] Chat history accessible to correct users only
- [ ] File uploads work with proper permissions

### Performance Verification
- [ ] Query response times acceptable
- [ ] No significant performance degradation
- [ ] Database CPU usage within normal ranges
- [ ] No connection pool exhaustion

---

## 🚨 Emergency Contacts & Escalation

### If Rollback Fails:
1. **Immediate Action**: Disable RLS temporarily on affected tables
2. **Contact**: Database administrator or senior developer
3. **Escalation**: If application is completely broken, consider emergency maintenance mode

### Temporary RLS Disable (EMERGENCY ONLY):
```sql
-- ONLY USE IN EXTREME EMERGENCY
-- This removes all security - use with extreme caution
ALTER TABLE public.user_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tools DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tool_questions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_base_files DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_analytics DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements DISABLE ROW LEVEL SECURITY;
```

---

## 📊 Rollback Success Metrics

### Database Metrics
- **Policy Count**: Should match original (17 total policies)
- **Query Performance**: Response times within 10% of baseline
- **Error Rate**: Zero RLS-related errors in logs

### Application Metrics  
- **User Authentication**: 100% success rate
- **Admin Functions**: All admin operations functional
- **Data Access**: Users see only their own data
- **Public Access**: Anonymous users can browse tools/categories

---

## 📝 Post-Rollback Actions

1. **Document Issues**: Record what went wrong with the optimization
2. **Analyze Logs**: Review application and database logs for errors
3. **Plan Retry**: Determine if/when to attempt optimization again
4. **Update Team**: Communicate rollback completion and next steps
5. **Monitor**: Continue monitoring for 24 hours post-rollback

---

**Rollback Prepared By**: Database Administrator  
**Backup Location**: `/database/rls-backup/current-rls-policies-backup.sql`  
**Last Updated**: 2025-01-18  
**Status**: Ready for Emergency Use