# GoHighLevel Integration - Quick Reference

**Quick setup guide for integrating GHL webhooks with Artemo AI Dashboard**

---

## ⚡ Quick Setup (5 Minutes)

### Step 1: Get Your Webhook URL

```
https://[your-supabase-project].supabase.co/functions/v1/ghl-sync
```

Replace `[your-supabase-project]` with your actual Supabase project reference ID.

---

### Step 2: Set Environment Variables

In Supabase Dashboard → Project Settings → Edge Functions → Secrets:

```bash
GHL_PRO_PRODUCT_IDS=your_pro_product_id_1,your_pro_product_id_2
GHL_TRIAL_PRODUCT_IDS=your_trial_product_id_1
```

---

### Step 3: Create GHL Workflows

Create these 5 workflows in GoHighLevel:

#### 1. **Pro Purchase** (When user buys Pro membership)
```json
{
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

#### 2. **Trial Signup** (Free signup or trial start)
```json
{
  "event": "trial_signup",
  "contact": {
    "id": "{{contact.id}}",
    "email": "{{contact.email}}",
    "first_name": "{{contact.first_name}}",
    "last_name": "{{contact.last_name}}"
  }
}
```

#### 3. **Payment Failed**
```json
{
  "event": "payment_failed",
  "contact": {
    "id": "{{contact.id}}",
    "email": "{{contact.email}}"
  }
}
```

#### 4. **Payment Recovered**
```json
{
  "event": "payment_recovered",
  "contact": {
    "id": "{{contact.id}}",
    "email": "{{contact.email}}"
  }
}
```

#### 5. **Cancellation**
```json
{
  "event": "cancellation",
  "contact": {
    "id": "{{contact.id}}",
    "email": "{{contact.email}}"
  }
}
```

---

### Step 4: Configure Webhook in Each Workflow

For ALL workflows:
- **Method:** POST
- **URL:** Your webhook URL from Step 1
- **Headers:**
  ```
  Content-Type: application/json
  x-wh-signature: {{workflow.signature}}
  ```

---

## 📊 What Happens When

| GHL Event | System Action | User Role | Account Status |
|-----------|--------------|-----------|----------------|
| Pro Purchase | Creates/upgrades user | `pro` | `active = true` |
| Trial Signup | Creates user account | `user` | `active = true` |
| Payment Failed | Suspends access | Unchanged | `active = false` |
| Payment Recovered | Restores access | Unchanged | `active = true` |
| Cancellation | Removes access | Unchanged | `active = false` |

---

## 🧪 Testing

### Test Pro Purchase:
1. Create test contact in GHL with email: `test-pro@example.com`
2. Trigger Pro Purchase workflow
3. Verify in Supabase:
   ```sql
   SELECT role, active FROM user_profiles
   WHERE id = (SELECT id FROM auth.users WHERE email = 'test-pro@example.com');
   ```
   Expected: `role = 'pro'`, `active = true`

### Test Payment Failure:
1. Trigger Payment Failed workflow for test contact
2. Verify: `active = false`
3. User cannot log in

### Test Payment Recovery:
1. Trigger Payment Recovered workflow
2. Verify: `active = true`
3. User can log in again

---

## 🔍 Troubleshooting

### Webhook not working?
- Check Edge Function logs in Supabase Dashboard
- Verify webhook URL is correct
- Ensure `x-wh-signature` header is included

### User not created?
- Verify contact email is present in payload
- Check product ID matches environment variables
- Review edge function logs for errors

### Role not updating?
- Verify product ID in `GHL_PRO_PRODUCT_IDS`
- Check edge function determined correct action
- Manually verify with SQL query

---

## 📞 Support

**View Logs:**
```
Supabase Dashboard → Edge Functions → ghl-sync → Logs
```

**Full Documentation:**
- Complete guide: `/docs/GHL_INTEGRATION_GUIDE.md`
- Edge functions: `/supabase/functions/README.md`
- Database schema: `/docs/DATABASE_SCHEMA.md`

---

**Last Updated:** 2025-10-17
