# GoHighLevel (GHL) Integration Guide

**Last Updated:** 2025-10-17
**Status:** Production Ready
**Purpose:** Complete guide for integrating Artemo AI Dashboard with GoHighLevel for automated user lifecycle management

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [How It Works](#how-it-works)
3. [Required GHL Workflows](#required-ghl-workflows)
4. [Environment Configuration](#environment-configuration)
5. [Webhook Setup](#webhook-setup)
6. [User Lifecycle Management](#user-lifecycle-management)
7. [Testing & Verification](#testing--verification)
8. [Troubleshooting](#troubleshooting)

---

## Overview

The GHL integration automates user account management based on payment events, subscriptions, and lifecycle changes from GoHighLevel. When users purchase, cancel, or experience payment issues in GHL, the system automatically creates/updates their Artemo AI Dashboard account and adjusts their access level.

### What Gets Automated

✅ **User Account Creation** - Automatic account creation from GHL contacts
✅ **Pro Access Activation** - Grant Pro features on successful purchase
✅ **Trial Account Setup** - Create trial accounts for free signups
✅ **Payment Failure Handling** - Suspend access when payments fail
✅ **Payment Recovery** - Restore access when payments are recovered
✅ **Cancellation Processing** - Deactivate accounts on subscription cancellation
✅ **Role Upgrades** - Automatic upgrade from user to pro when they purchase

---

## How It Works

### Architecture Flow

```
GoHighLevel Event (Purchase/Cancel/etc.)
    ↓
GHL Workflow Triggered
    ↓
Webhook sent to Supabase Edge Function
    ↓
Edge Function (ghl-sync) validates signature
    ↓
Determines action based on event/product/tags
    ↓
Updates Supabase database:
    - Creates/updates user in auth.users
    - Sets role in user_profiles (user/pro/admin)
    - Activates/deactivates account
    ↓
Frontend automatically reflects changes
    - Pro users see pro tools
    - Inactive users cannot access system
```

### Key Components

1. **Edge Function**: `/supabase/functions/ghl-sync/index.ts`
2. **Database Tables**: `auth.users`, `user_profiles`
3. **User Roles**: `user` (free/trial), `pro` (paid), `admin` (system admin)
4. **Tool Access**: Tools marked `is_pro = true` require pro or admin role

---

## Required GHL Workflows

You need to create **6 GHL workflows** to cover all user lifecycle events:

### 1. Pro Purchase Workflow

**Trigger:** Payment successful for Pro product/subscription
**When to Fire:** When a contact successfully purchases your Pro membership

**Webhook Configuration:**
- **URL:** `https://[your-project].supabase.co/functions/v1/ghl-sync`
- **Method:** POST
- **Headers:**
  - `Content-Type: application/json`
  - `x-wh-signature: {{workflow.signature}}` (GHL auto-generates)

**Payload:**
```json
{
  "event_id": "{{workflow.execution_id}}",
  "event": "pro_purchase",
  "contact": {
    "id": "{{contact.id}}",
    "email": "{{contact.email}}",
    "first_name": "{{contact.first_name}}",
    "last_name": "{{contact.last_name}}"
  },
  "product": {
    "id": "{{product.id}}"
  }
}
```

**Result:** User account created/updated with `role = 'pro'` and `active = true`

---

### 2. Trial Signup Workflow

**Trigger:** Contact signs up for free trial or creates free account
**When to Fire:** Form submission, free signup, or trial activation

**Webhook Configuration:**
- Same URL and headers as Pro Purchase

**Payload:**
```json
{
  "event_id": "{{workflow.execution_id}}",
  "event": "trial_signup",
  "contact": {
    "id": "{{contact.id}}",
    "email": "{{contact.email}}",
    "first_name": "{{contact.first_name}}",
    "last_name": "{{contact.last_name}}"
  },
  "product": {
    "id": "{{trial_product.id}}"
  }
}
```

**Result:** User account created with `role = 'user'` and `active = true`

---

### 3. Payment Failed Workflow

**Trigger:** Recurring payment fails / Card declined
**When to Fire:** When subscription payment fails

**Webhook Configuration:**
- Same URL and headers

**Payload:**
```json
{
  "event_id": "{{workflow.execution_id}}",
  "event": "payment_failed",
  "contact": {
    "id": "{{contact.id}}",
    "email": "{{contact.email}}"
  }
}
```

**Result:** User account set to `active = false` (access suspended)

---

### 4. Payment Recovered Workflow

**Trigger:** Failed payment successfully retried / Card updated and payment processed
**When to Fire:** After payment failure is resolved

**Webhook Configuration:**
- Same URL and headers

**Payload:**
```json
{
  "event_id": "{{workflow.execution_id}}",
  "event": "payment_recovered",
  "contact": {
    "id": "{{contact.id}}",
    "email": "{{contact.email}}"
  }
}
```

**Result:** User account set to `active = true` (access restored)

---

### 5. Cancellation Workflow

**Trigger:** Subscription cancelled / User requests cancellation
**When to Fire:** When subscription is actively cancelled

**Webhook Configuration:**
- Same URL and headers

**Payload:**
```json
{
  "event_id": "{{workflow.execution_id}}",
  "event": "cancellation",
  "contact": {
    "id": "{{contact.id}}",
    "email": "{{contact.email}}"
  }
}
```

**Result:** User account set to `active = false` (access removed)

---

### 6. Pro Upgrade Workflow (Optional but Recommended)

**Trigger:** Existing trial/free user upgrades to Pro
**When to Fire:** When user with existing account purchases Pro

**Webhook Configuration:**
- Same URL and headers

**Payload:**
```json
{
  "event_id": "{{workflow.execution_id}}",
  "event": "pro_upgrade",
  "contact": {
    "id": "{{contact.id}}",
    "email": "{{contact.email}}"
  },
  "product": {
    "id": "{{pro_product.id}}"
  }
}
```

**Result:** Existing user upgraded from `role = 'user'` to `role = 'pro'`

---

## Environment Configuration

### Required Environment Variables

Set these in your Supabase project:

1. **Navigate to:** Supabase Dashboard → Project Settings → Edge Functions → Secrets

2. **Add these variables:**

```bash
# Pro Product IDs (comma-separated)
GHL_PRO_PRODUCT_IDS=prod_123abc,prod_456def,prod_789ghi

# Trial Product IDs (comma-separated)
GHL_TRIAL_PRODUCT_IDS=trial_123abc,trial_456def

# Optional: Redirect URL after invitation acceptance
APP_LOGIN_URL=https://your-app-domain.com/login
```

### How to Get Product IDs from GHL

1. Go to GHL Dashboard → Products
2. Click on your product
3. Copy the Product ID from the URL or product settings
4. Add to environment variables (comma-separated if multiple)

**Example:**
- If you have 3 Pro products: `GHL_PRO_PRODUCT_IDS=prod_abc123,prod_def456,prod_ghi789`
- If you have 2 Trial products: `GHL_TRIAL_PRODUCT_IDS=trial_free,trial_7day`

---

## Webhook Setup

### Step 1: Get Your Webhook URL

Your webhook URL format:
```
https://[your-supabase-project-ref].supabase.co/functions/v1/ghl-sync
```

**Find your project ref:**
- Supabase Dashboard → Settings → General → Reference ID

**Example URL:**
```
https://xrnamhiilyeeqnbgkoin.supabase.co/functions/v1/ghl-sync
```

### Step 2: Configure Webhook in GHL

For **each workflow** you create:

1. Add "Send Webhook" action to your workflow
2. Set **Method**: POST
3. Set **URL**: Your edge function URL
4. Add **Headers**:
   ```
   Content-Type: application/json
   x-wh-signature: {{workflow.signature}}
   ```
5. Configure **Body** (JSON) as shown in workflow examples above

### Step 3: Enable Webhook Signature

GHL automatically signs webhooks for security. The edge function verifies this signature using GHL's public key (already configured in the code).

**Important:** Always include `x-wh-signature: {{workflow.signature}}` header in GHL workflows.

---

## User Lifecycle Management

### Role Hierarchy

The system uses role priority to prevent accidental downgrades:

```
admin (highest) > pro > user (lowest)
```

**Upgrade Rules:**
- `user` → `pro` ✅ Allowed
- `user` → `admin` ✅ Allowed (manual only)
- `pro` → `admin` ✅ Allowed (manual only)
- `pro` → `user` ❌ Prevented (requires manual admin action)
- `admin` → any ❌ Prevented (requires manual admin action)

### Account States

**Active Account (`active = true`):**
- Can log in
- Can access tools based on role
- Can create projects and chat sessions

**Inactive Account (`active = false`):**
- Cannot log in
- Existing sessions terminated
- Data preserved but inaccessible

### Tool Access Rules

**Regular Tools (`is_pro = false`):**
- Accessible by: `user`, `pro`, `admin`

**Pro Tools (`is_pro = true`):**
- Accessible by: `pro`, `admin` only
- `user` role sees tool but gets "Upgrade Required" modal

---

## Testing & Verification

### 1. Test Pro Purchase

**In GHL:**
1. Create a test contact with valid email
2. Trigger your Pro Purchase workflow
3. Check webhook was sent successfully

**Verify in Supabase:**
```sql
-- Check user was created
SELECT * FROM auth.users WHERE email = 'test@example.com';

-- Check profile has pro role
SELECT id, full_name, role, active
FROM user_profiles
WHERE id = (SELECT id FROM auth.users WHERE email = 'test@example.com');
```

**Expected Result:**
- User exists in `auth.users`
- Profile has `role = 'pro'` and `active = true`
- User receives invitation email

### 2. Test Payment Failure

**In GHL:**
1. Use existing test contact
2. Trigger Payment Failed workflow

**Verify in Supabase:**
```sql
SELECT role, active FROM user_profiles
WHERE id = (SELECT id FROM auth.users WHERE email = 'test@example.com');
```

**Expected Result:**
- `role` unchanged (still `pro`)
- `active = false`
- User cannot log in

### 3. Test Payment Recovery

**In GHL:**
1. Trigger Payment Recovered workflow

**Verify in Supabase:**
```sql
SELECT role, active FROM user_profiles
WHERE id = (SELECT id FROM auth.users WHERE email = 'test@example.com');
```

**Expected Result:**
- `role` unchanged (still `pro`)
- `active = true`
- User can log in again

### 4. Check Edge Function Logs

**In Supabase Dashboard:**
1. Go to Edge Functions → ghl-sync
2. Click "Logs"
3. Check for successful processing

**Look for:**
```
✓ Webhook processed successfully
✓ ensureAccount completed with result
✓ User created successfully
```

---

## Troubleshooting

### Problem: Webhook Not Received

**Check:**
1. ✅ Webhook URL is correct
2. ✅ Edge function is deployed: `supabase functions list`
3. ✅ GHL workflow is active
4. ✅ Headers include `x-wh-signature`

**Test webhook manually:**
```bash
curl -X POST https://[your-project].supabase.co/functions/v1/ghl-sync \
  -H "Content-Type: application/json" \
  -H "x-wh-signature: test_signature_will_fail" \
  -d '{"event":"test","contact":{"email":"test@example.com"}}'
```

Expected: You should get a signature verification error (this is good - means function is running)

---

### Problem: User Not Created

**Check Edge Function Logs:**
```sql
-- In Supabase Dashboard → Edge Functions → ghl-sync → Logs
```

**Common Issues:**
- ❌ Missing contact email in payload
- ❌ Product ID doesn't match environment variables
- ❌ Event type not recognized
- ❌ Signature verification failed

**Solution:**
- Verify payload structure matches examples
- Check `GHL_PRO_PRODUCT_IDS` matches actual product IDs
- Ensure event names are consistent

---

### Problem: User Created But No Invitation Email

**Check:**
1. ✅ User exists in `auth.users`
2. ✅ Email address is valid
3. ✅ Supabase email service is configured

**Verify:**
```sql
SELECT email, email_confirmed_at, invited_at
FROM auth.users
WHERE email = 'test@example.com';
```

**Solution:**
- Check Supabase Auth → Email Templates are configured
- Verify SMTP settings if using custom email provider
- User can still log in with password reset flow

---

### Problem: Role Not Upgrading

**Scenario:** User has `user` role, purchases Pro, but stays as `user`

**Check:**
1. Product ID in webhook matches `GHL_PRO_PRODUCT_IDS`
2. Edge function logs show "pro_purchase" action
3. No errors in `ensureAccount` function

**Manual Fix:**
```sql
-- Manually upgrade user to pro
UPDATE user_profiles
SET role = 'pro',
    status_updated_at = NOW()
WHERE id = (SELECT id FROM auth.users WHERE email = 'user@example.com');
```

---

### Problem: Payment Failure Not Deactivating Account

**Check:**
1. Event type includes "payment" AND "failed"
2. Edge function determines action as "payment_failed"
3. User email matches exactly

**Verify:**
```sql
-- Check account status
SELECT email,
       up.role,
       up.active,
       up.status_updated_at
FROM auth.users u
JOIN user_profiles up ON u.id = up.id
WHERE u.email = 'user@example.com';
```

---

## Advanced Configuration

### Using Tags Instead of Product IDs

If you prefer using GHL contact tags:

**In GHL Workflow:**
Add tags to contact before sending webhook:
- Tag: "pro-member" for Pro users
- Tag: "trial-user" for trial users

**Payload:**
```json
{
  "contact": {
    "tags": ["pro-member", "active-subscription"]
  }
}
```

The edge function automatically detects:
- Tags containing "pro" → triggers pro_purchase
- Tags containing "trial" → triggers trial_signup

---

### Multiple Pro Tiers

If you have multiple Pro tiers (Basic Pro, Premium Pro, etc.):

**Option 1: All Pro Tiers Get Same Access**
- Add all Pro product IDs to `GHL_PRO_PRODUCT_IDS`

**Option 2: Different Access Levels (Requires Custom Development)**
- Current system: `user` vs `pro` only
- To add tiers: Add new role to database and update RLS policies

---

## Support & Monitoring

### Monitor Webhook Activity

**Daily Checks:**
1. Supabase Dashboard → Edge Functions → ghl-sync → Invocations
2. Look for errors or failures
3. Check success rate

**Key Metrics:**
- Total invocations per day
- Success rate (should be >95%)
- Average execution time
- Failed signature verifications (should be 0)

### Alert on Failures

Set up alerts for:
- Edge function errors
- Failed user creations
- Signature verification failures

---

## Summary Checklist

Before going live, verify:

- [ ] All 6 GHL workflows created and active
- [ ] Webhook URL correct in all workflows
- [ ] Environment variables set (`GHL_PRO_PRODUCT_IDS`, `GHL_TRIAL_PRODUCT_IDS`)
- [ ] Edge function deployed and running
- [ ] Test webhooks work for all scenarios
- [ ] Email invitations being sent
- [ ] Pro tools properly restricted to pro users
- [ ] Payment failure suspends access
- [ ] Payment recovery restores access
- [ ] Monitoring and logging enabled

---

## Need Help?

**Check Logs:**
- Supabase Dashboard → Edge Functions → ghl-sync → Logs

**Test Manually:**
- Use GHL workflow testing feature
- Check edge function invocation history
- Verify database records after each test

**Common Support Issues:**
1. Webhook signature failures → Check GHL signature header
2. Users not created → Check email format and payload structure
3. Role not updating → Check product ID matching
4. Access not granted → Check `active` status and role in database

---

**Document Version:** 1.0
**Last Tested:** 2025-10-17
**Edge Function Version:** ghl-sync v1.0
