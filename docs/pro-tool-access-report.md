# Pro Tool Access Lock Issue

## Observed Behavior
- Tools flagged with `is_pro` correctly save to Supabase and appear with a "PRO" badge in the toolbox.
- Even when the current user has been upgraded to the Pro tier, the UI still treats the tool as locked and shows the upgrade modal.

## Root Cause
- `components/ToolCard.tsx` checks `user?.role` to decide whether a tool can be opened.
- The `user` object in the auth store is the raw Supabase Auth user, whose type does **not** include application roles (it only knows about authentication metadata).
- Role information lives in the `user_profiles` row, which the auth store exposes as `profile` and also as derived booleans `isPro` and `isAdmin`.
- Because the card relies on `user?.role`, it always receives `undefined`, so Pro gating never unlocks—even for true Pro subscribers.

## Recommended Fix
1. Update `ToolCard` (and any other components doing the same check) to use `profile?.role` or the derived booleans from the auth store (`isPro` / `isAdmin`).
2. Example logic:
   ```ts
   const { profile, isPro, isAdmin } = useAuthStore();
   const canAccess = !isProTool || isPro || isAdmin;
   ```
   or, if you prefer using the profile:
   ```ts
   const role = profile?.role;
   const canAccess = !isProTool || role === 'pro' || role === 'admin';
   ```
3. After adjusting the check, verify that:
   - Pro users can open Pro tools without seeing the lock overlay.
   - Standard users still see the upgrade modal for Pro tools.
   - Admins continue to have access (covered by `isAdmin`).

## Implementation Plan
1. **Locate usage** – Search for any `user?.role` checks in the frontend (starting with `ToolCard.tsx`).
2. **Swap to store flags** – Replace those conditions with `isPro` / `isAdmin` (or `profile?.role`). Ensure TypeScript picks up the correct imports from `useAuthStore`.
3. **Retest the flow** – Log in as a Pro user and as a regular user to confirm the lock overlay matches expectations.
4. **Optional hardening** – Consider centralizing a `canAccessTool(tool)` selector in the auth/UI store to keep future checks consistent.
