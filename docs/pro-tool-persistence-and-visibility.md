# Pro Tool Persistence & Visibility Diagnostics

## Summary of Symptoms
- Saving a tool with the **Pro Tool** checkbox enabled does not keep the flag – reloading the admin screen shows the tool as non-pro.
- Standard "user" accounts receive an empty toolbox when every tool is marked as pro, even though the cards should remain visible but locked.

## Root Cause Analysis

### 1. Pro flag falls back to `false`
- The admin modal stores the checkbox in `formData.is_pro` and forwards it when assembling the payload for `createTool` / `updateTool`. 【F:components/AdminTools.tsx†L620-L689】
- The Supabase admin service explicitly includes that flag in its insert and update payloads (`toolData.is_pro ?? false` and `updates.is_pro !== undefined ? updates.is_pro : undefined`). 【F:services/admin.api.service.ts†L102-L149】【F:services/admin.api.service.ts†L196-L236】
- The database column is declared `BOOLEAN NOT NULL DEFAULT false`, so any request that omits the field (or sends `null`) reverts to `false`. 【F:supabase/migrations/20251011211206_feature_pro_user_role.sql†L26-L46】
- Because the admin service normalises undefined values to `false`, any caller that drops the `is_pro` property (for example, legacy forms, API tests, or scripts) will silently reset the flag.

**Diagnosis:** Somewhere before the Supabase call the flag is being stripped, so the insert/update payload resolves to `false`. The current modal is wired correctly, so double-check any alternate save flows, API clients, or data migrations that bypass the modal and omit `is_pro`.

### 2. Regular users lose visibility of pro tools
- User-facing fetches go straight against the `tools` table with `supabase.from('tools').select('*').eq('active', true)`. 【F:services/app.api.service.ts†L32-L74】
- Updated RLS policies now require `is_pro = false` for non-pro roles and only return pro rows when `public.is_pro_user()` passes. 【F:supabase/migrations/20251011211207_feature_pro_user_rls.sql†L42-L55】
- If every tool is flagged pro, the first policy filters the entire result set, leaving regular users with zero rows.

**Diagnosis:** The raw `tools` table is no longer an appropriate source for the public catalog. RLS intentionally hides pro rows, so the UI must read from a view or endpoint that exposes the limited, non-sensitive fields for every active tool regardless of tier.

## Implementation Plan

### Stabilise the pro flag
1. **Audit callers** – Inspect any scripts, seeders, or alternative admin flows to make sure they pass `is_pro` explicitly. Add logging around the admin save path to confirm the payload contains the boolean before it hits Supabase.
2. **Guard the API** – Refactor `AdminApiService.createTool/updateTool` so they reject payloads that omit `is_pro` instead of defaulting to `false`. This prevents silent resets and surfaces configuration mistakes early.
3. **Data cleanup** – Run a one-off SQL update to set `is_pro = true` for any tools that should be pro but were reset, then retest the admin modal to ensure the value sticks across refreshes.

### Restore tool visibility for regular users
1. **Create a safe catalog view** – Add a database view (e.g., `public.tool_catalog`) that exposes only the fields the public UI needs (`id`, `title`, `category`, `description`, `is_pro`, etc.) and grants `SELECT` to all authenticated users regardless of tier.
2. **Adjust RLS** – Keep sensitive prompts locked behind existing policies but allow `SELECT` on the new view for every active tool. Alternatively, extend the existing policy with a `USING (active = true)` rule that omits the prompt columns via column-level permissions.
3. **Update the fetcher** – Point `AppApiService.getTools` at the new view (or Supabase edge function) so standard users can see every card. Keep the lock overlay logic in the UI to block interaction with pro content until the user upgrades.
4. **Regression pass** – Test with admin, pro, and standard accounts to confirm persistence, visibility, and lock behaviour across refreshes.
