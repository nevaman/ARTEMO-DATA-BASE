# Pro Tool Visibility & Access: Final Implementation Plan

## Executive Summary
- **Visibility bug** – Standard users query the `tools` table directly. Row-level security (RLS) only returns rows where `is_pro = false`, so any Pro-marked entry disappears from their catalog. 【F:supabase/migrations/20251011211207_feature_pro_user_rls.sql†L40-L55】【F:services/app.api.service.ts†L47-L88】
- **Access bug** – Tool cards rely on `user?.role`, but Supabase session objects do not include role metadata. The auth store keeps the role on `profile`/`isPro`/`isAdmin`, so the check always fails and every Pro tool renders as locked. 【F:components/ToolCard.tsx†L24-L143】【F:stores/authStore.ts†L58-L167】

## Current Data Flow (Problematic)
1. **Catalog fetch** – `AppApiService.getTools()` selects from `public.tools`. RLS filters out Pro rows for non-pro accounts, so the response array is empty when most tools are Pro. 【F:services/app.api.service.ts†L47-L88】
2. **Card gating** – `<ToolCard />` reads `user?.role` to decide if the lock overlay should appear. Because `user` mirrors Supabase's auth payload (no custom claims), `user?.role` is `undefined`, forcing `canAccess = false` for everyone. 【F:components/ToolCard.tsx†L31-L143】
3. **Auth store** – `useAuthStore` already exposes `profile?.role`, `isPro`, and `isAdmin`, but the card never uses them. 【F:stores/authStore.ts†L58-L167】

## Implementation Blueprint

### 1. Restore Visibility Without Exposing Sensitive Prompts
1. **Create a read-only view**
   ```sql
   create or replace view public.tool_catalog
   with (security_invoker = false) as
   select
     id,
     title,
     description,
     active,
     featured,
     is_pro,
     primary_model,
     fallback_models,
     category_id,
     created_at
   from public.tools
   where active = true;
   ```
   - Keeps prompt instructions and other sensitive fields inside the base table.
2. **Grant view access**
   ```sql
   grant usage on schema public to authenticated;
   grant select on public.tool_catalog to authenticated;
   ```
   - Because the view omits prompts, it is safe for all signed-in users.
3. **(Optional) Enforce RLS on the view** – If you prefer policies, create a `WITH CHECK (true)` policy granting `SELECT` to `authenticated`. RLS on the underlying table no longer blocks because the view hides Pro prompts.
4. **Update the API layer**
   - Change `supabase.from('tools')...` to `supabase.from('tool_catalog')...` inside `AppApiService.getTools()`.
   - Join the category table via `category:categories!tool_catalog_category_id_fkey(name, icon_name, icon_color)` or derive it with a second query.
   - Leave admin flows (`AdminApiService`) pointed at `tools` so they retain full control.
5. **Verify** – Log in as `user` and `pro` accounts and confirm the catalog returns the same number of rows (`console.log` already exists in `getTools`).

### 2. Fix Role-Based Access in the UI
1. **Consume role from the profile**
   - Update `<ToolCard />` so `const { profile, isPro, isAdmin } = useAuthStore();` and compute `const canAccess = !isProTool || isPro || isAdmin;`.
   - Alternatively, derive once: `const role = profile?.role ?? 'user';` and check against `'pro' | 'admin'`.
2. **Propagate to other callers** – Audit other components that call `useAuthStore()` and rely on `user?.role` (e.g., dashboards, feature gates) to ensure they read `profile`/`isPro` instead.
3. **Re-test card behaviour**
   - As an **admin**: Pro badges should show without locks; clicking opens the tool.
   - As a **pro**: Same as admin.
   - As a **user**: Cards remain visible; clicking shows the upgrade modal via `setShowProUpgradeModal(true)`.

### 3. Regression Safety Nets
- **Type guarding** – Extend `DynamicTool` usage so that any mapper missing `is_pro` causes a TypeScript error (e.g., via helper `mapToolRow(row: ToolRow): DynamicTool`).
- **End-to-end smoke test** – After changes, seed at least one pro and one non-pro tool, then:
  1. Visit the toolbox as a regular user → both cards render, Pro shows lock overlay.
  2. Promote the user to Pro (update profile role) → reload and confirm lock disappears.
  3. Sign in as admin → verify admin panel still shows edit controls.
- **Monitor RLS logs** – Use Supabase's query logs to ensure `tool_catalog` selects succeed for user roles and that no direct `tools` queries appear from the front-end.

With these adjustments the catalog will list every tool for every role, while the lock logic will correctly respect Pro and Admin entitlements.
