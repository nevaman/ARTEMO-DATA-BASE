# Pro Tool Visibility Gap

## Summary
- Normal users cannot see Pro-designated tools because row-level security (RLS) only returns `tools` rows where `is_pro = false` for non-pro roles. 【F:supabase/migrations/20251011211207_feature_pro_user_rls.sql†L42-L55】
- The client still queries the base `tools` table, so the RLS filter removes every Pro tool before React renders the toolbox.
- Visibility must be restored without exposing full Pro-only prompt data to free accounts.

## Root Cause Details
1. **RLS policy excludes Pro rows.** The "Users can view non-pro tools" policy explicitly requires `is_pro = false`, while the Pro-policy grants access only when `public.is_pro_user() = true`. Standard accounts therefore receive an empty result set for Pro entries. 【F:supabase/migrations/20251011211207_feature_pro_user_rls.sql†L42-L55】
2. **Frontend relies on that query.** `AppApiService.getTools()` selects from `tools` with no additional filtering, assuming the backend returns every active tool. RLS enforces the restriction before JavaScript can label cards as locked, so nothing renders. 【F:services/app.api.service.ts†L40-L74】

## Implementation Plan
1. **Introduce a read-only catalog view.** Create a `tool_catalog` (or similarly named) database view that exposes safe fields (id, title, category, description, `is_pro`) for all active tools and omits sensitive prompt content.
2. **Loosen visibility via policies.** Grant `SELECT` on the view to all authenticated users (or `anon` if needed) so every account can read the catalog, while keeping the stricter RLS policies on the underlying `tools` table.
3. **Query the view in the app.** Point `AppApiService.getTools()` (and any other read paths meant for end users) at the new view. Merge the view payload with existing `tool_questions` fetch logic if questions should remain hidden for locked tools.
4. **Gate execution elsewhere.** Ensure tool execution endpoints (`ai-chat` edge function, etc.) continue to check the user’s role before running a Pro tool, so visibility does not grant usage rights.
5. **Verify end-to-end.** Test with regular, Pro, and admin accounts: confirm Pro cards appear (locked) for regular users, unlock for Pro users, and remain fully manageable for admins.

## Additional Considerations
- If Pro-only questions or prompts must stay hidden, either exclude them from the view or wrap them in conditional logic so non-Pro readers receive placeholders.
- Update unit/integration tests (or add new ones) to cover the expected catalog payload for different roles to prevent regressions.
