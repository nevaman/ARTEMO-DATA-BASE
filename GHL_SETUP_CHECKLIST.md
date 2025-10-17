# GoHighLevel Setup Checklist

**Use this checklist to ensure your GHL integration is properly configured.**

---

## 📋 Pre-Setup Verification

- [ ] Supabase project is live and accessible
- [ ] Edge function `ghl-sync` is deployed
- [ ] Database migrations are applied
- [ ] You have admin access to GHL account
- [ ] You have your Supabase project reference ID

---

## 🔧 Configuration Steps

### 1. Environment Variables

**Location:** Supabase Dashboard → Project Settings → Edge Functions → Secrets

- [ ] Added `GHL_PRO_PRODUCT_IDS` with your Pro product IDs
- [ ] Added `GHL_TRIAL_PRODUCT_IDS` with your Trial product IDs
- [ ] (Optional) Added `APP_LOGIN_URL` with your app URL

**Format Example:**
```
GHL_PRO_PRODUCT_IDS=prod_abc123,prod_def456
GHL_TRIAL_PRODUCT_IDS=trial_free,trial_7day
```

---

### 2. Webhook URL

- [ ] Copied your webhook URL: `https://[project-ref].supabase.co/functions/v1/ghl-sync`
- [ ] Verified URL is accessible (test with curl or browser)
- [ ] Saved URL for workflow configuration

---

### 3. GHL Workflows

Create and configure each workflow:

#### Workflow 1: Pro Purchase
- [ ] Created workflow in GHL
- [ ] Trigger: Payment successful for Pro product
- [ ] Added "Send Webhook" action
- [ ] Set Method: POST
- [ ] Set URL: Your webhook URL
- [ ] Added headers:
  - [ ] `Content-Type: application/json`
  - [ ] `x-wh-signature: {{workflow.signature}}`
- [ ] Configured JSON body (see Quick Reference)
- [ ] Workflow is ACTIVE

#### Workflow 2: Trial Signup
- [ ] Created workflow in GHL
- [ ] Trigger: Form submission / Free signup
- [ ] Added "Send Webhook" action
- [ ] Set Method: POST
- [ ] Set URL: Your webhook URL
- [ ] Added headers (same as above)
- [ ] Configured JSON body
- [ ] Workflow is ACTIVE

#### Workflow 3: Payment Failed
- [ ] Created workflow in GHL
- [ ] Trigger: Payment declined / Card failed
- [ ] Added "Send Webhook" action
- [ ] Set Method: POST
- [ ] Set URL: Your webhook URL
- [ ] Added headers (same as above)
- [ ] Configured JSON body
- [ ] Workflow is ACTIVE

#### Workflow 4: Payment Recovered
- [ ] Created workflow in GHL
- [ ] Trigger: Payment successful after failure
- [ ] Added "Send Webhook" action
- [ ] Set Method: POST
- [ ] Set URL: Your webhook URL
- [ ] Added headers (same as above)
- [ ] Configured JSON body
- [ ] Workflow is ACTIVE

#### Workflow 5: Cancellation
- [ ] Created workflow in GHL
- [ ] Trigger: Subscription cancelled
- [ ] Added "Send Webhook" action
- [ ] Set Method: POST
- [ ] Set URL: Your webhook URL
- [ ] Added headers (same as above)
- [ ] Configured JSON body
- [ ] Workflow is ACTIVE

---

## 🧪 Testing

### Test Environment Setup
- [ ] Created test contact in GHL with email: `test-pro@example.com`
- [ ] Contact has first and last name
- [ ] Contact is not in any real campaigns

### Test 1: Pro Purchase
- [ ] Manually triggered Pro Purchase workflow
- [ ] Checked Supabase logs for successful processing
- [ ] Verified in database:
  ```sql
  SELECT role, active FROM user_profiles
  WHERE id = (SELECT id FROM auth.users WHERE email = 'test-pro@example.com');
  ```
- [ ] Expected result: `role = 'pro'`, `active = true`
- [ ] Received invitation email
- [ ] Can log in to app
- [ ] Can see and access pro tools

### Test 2: Payment Failure
- [ ] Triggered Payment Failed workflow
- [ ] Checked logs for success
- [ ] Verified: `active = false` in database
- [ ] Cannot log in to app

### Test 3: Payment Recovery
- [ ] Triggered Payment Recovered workflow
- [ ] Checked logs for success
- [ ] Verified: `active = true` in database
- [ ] Can log in again

### Test 4: Trial Signup
- [ ] Created new test contact: `test-trial@example.com`
- [ ] Triggered Trial Signup workflow
- [ ] Verified: `role = 'user'`, `active = true`
- [ ] Cannot access pro tools (sees lock icon)

### Test 5: Cancellation
- [ ] Triggered Cancellation workflow on pro test user
- [ ] Verified: `active = false`
- [ ] Cannot access app

---

## 🎨 Frontend Verification

### Visual Checks
- [ ] Pro tools show purple/fuchsia gradient background
- [ ] Pro tools have "PRO" badge
- [ ] Free users see lock icon on hover
- [ ] Pro users can access all tools
- [ ] Free users get upgrade modal when clicking pro tools

### Access Control
- [ ] Free user cannot access pro tool via direct URL
- [ ] Redirected to tools page with upgrade modal
- [ ] Pro user can access all tools freely
- [ ] Admin can access everything

---

## 📊 Monitoring Setup

### Supabase Dashboard
- [ ] Bookmarked edge function logs page
- [ ] Verified logs are displaying correctly
- [ ] Can filter by date/status
- [ ] Understand log format

### Daily Checks (First Week)
- [ ] Check invocation count
- [ ] Check success rate (should be >95%)
- [ ] Check for signature failures (should be 0)
- [ ] Check average execution time

---

## 🚨 Emergency Procedures

### If Webhooks Stop Working
1. [ ] Check edge function is still deployed
2. [ ] Verify environment variables are set
3. [ ] Check GHL workflows are active
4. [ ] Review recent changes to workflows
5. [ ] Test with manual curl request

### If Users Not Created
1. [ ] Check edge function logs for errors
2. [ ] Verify contact email is present in payload
3. [ ] Confirm product ID matches environment variables
4. [ ] Check signature verification is passing

### If Emails Not Sending
1. [ ] Check Supabase Auth email settings
2. [ ] Verify SMTP configuration
3. [ ] Check email templates are configured
4. [ ] Test with password reset flow

---

## 📚 Documentation Review

- [ ] Read `/docs/GHL_QUICK_REFERENCE.md`
- [ ] Skimmed `/docs/GHL_INTEGRATION_GUIDE.md`
- [ ] Bookmarked documentation for future reference
- [ ] Understand how to view logs
- [ ] Know where to find troubleshooting info

---

## ✅ Final Verification

### System Health
- [ ] All 5 workflows created and active
- [ ] Environment variables configured
- [ ] Test contacts processed successfully
- [ ] Database shows correct roles
- [ ] Frontend shows correct access
- [ ] Emails being sent
- [ ] Logs are clean (no errors)

### Go-Live Readiness
- [ ] Tested with real test purchases (if possible)
- [ ] Verified refund/cancellation flow
- [ ] Confirmed payment recovery works
- [ ] Tested edge cases (missing email, duplicate users, etc.)
- [ ] Team trained on monitoring procedures
- [ ] Support procedures documented

---

## 🎉 Go Live!

When all items above are checked:

- [ ] Switch from test contacts to real contacts
- [ ] Monitor closely for first 24 hours
- [ ] Check logs every few hours
- [ ] Verify first real users are created correctly
- [ ] Confirm invitation emails are received
- [ ] Validate access control works in production

---

## 📞 Support Resources

**Documentation:**
- Quick Reference: `/docs/GHL_QUICK_REFERENCE.md`
- Full Guide: `/docs/GHL_INTEGRATION_GUIDE.md`
- Implementation Summary: `/docs/IMPLEMENTATION_SUMMARY.md`

**Monitoring:**
- Supabase Dashboard → Edge Functions → ghl-sync → Logs

**Testing:**
- SQL queries in documentation
- Manual webhook testing via curl
- GHL workflow testing feature

---

**Status:** Ready for Production
**Completion Date:** _______________
**Verified By:** _______________
**Notes:** _______________

---

**🚀 You're ready to go live! All systems operational.**
