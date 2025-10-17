# Artemo AI Dashboard - Edge Functions

This directory contains Supabase Edge Functions that power server-side operations for the Artemo AI Dashboard.

## Functions Overview

### 1. `ghl-sync` - GoHighLevel Webhook Handler

**Purpose:** Automates user lifecycle management based on GoHighLevel events.

**Endpoint:** `https://[your-project].supabase.co/functions/v1/ghl-sync`

**Handles:**
- Pro purchase events → Creates/upgrades users to `pro` role
- Trial signup events → Creates users with `user` role
- Payment failures → Deactivates accounts (`active = false`)
- Payment recovery → Reactivates accounts (`active = true`)
- Cancellations → Deactivates accounts
- Role upgrades → Safely upgrades from `user` to `pro`

**Security:**
- Validates GHL webhook signatures using RSA-SHA256
- Uses Supabase service role key for admin operations
- Includes comprehensive logging for debugging

**Environment Variables Required:**
```bash
GHL_PRO_PRODUCT_IDS=prod_123,prod_456      # Comma-separated Pro product IDs
GHL_TRIAL_PRODUCT_IDS=trial_123,trial_456  # Comma-separated Trial product IDs
APP_LOGIN_URL=https://your-app.com/login   # Optional redirect after invitation
```

**Documentation:** See `/docs/GHL_INTEGRATION_GUIDE.md` for complete setup instructions.

---

### 2. `ai-chat` - AI Conversation Handler

**Purpose:** Processes AI chat requests with Claude and OpenAI models.

**Endpoint:** `https://[your-project].supabase.co/functions/v1/ai-chat`

**Features:**
- Primary model: Claude (Anthropic)
- Fallback model: OpenAI GPT-4
- Processes tool-specific prompts
- Handles conversation context

---

### 3. `generate-embeddings` - Vector Search Support

**Purpose:** Generates embeddings for knowledge base files and tools.

**Endpoint:** `https://[your-project].supabase.co/functions/v1/generate-embeddings`

**Features:**
- Uses Supabase built-in embedding model
- Supports semantic search
- Indexes tool descriptions and knowledge base content

---

### 4. `admin-user-management` - Admin Operations

**Purpose:** Handles admin-only user management operations.

**Endpoint:** `https://[your-project].supabase.co/functions/v1/admin-user-management`

**Operations:**
- Update user status (active/inactive)
- Change user roles
- Soft delete users
- Audit trail logging

**Security:** Requires admin role verification.

---

### 5. `admin-invite-user` - User Invitation System

**Purpose:** Sends email invitations to new users.

**Endpoint:** `https://[your-project].supabase.co/functions/v1/admin-invite-user`

**Features:**
- Creates Supabase auth users
- Sends invitation emails
- Pre-assigns roles
- Tracks invitation status

**Security:** Requires admin role verification.

---

## Development

### Local Testing

```bash
# Start local Supabase
supabase start

# Serve functions locally
supabase functions serve

# Test function
curl -X POST http://localhost:54321/functions/v1/ghl-sync \
  -H "Content-Type: application/json" \
  -d '{"event":"test","contact":{"email":"test@example.com"}}'
```

### Deployment

```bash
# Deploy all functions
supabase functions deploy

# Deploy specific function
supabase functions deploy ghl-sync

# View logs
supabase functions logs ghl-sync
```

### Environment Variables

Set secrets in Supabase Dashboard:
1. Go to Project Settings → Edge Functions → Secrets
2. Add required variables for each function

---

## Security Notes

### Authentication

- All functions use CORS headers for browser access
- Admin functions verify user role before execution
- Service role key used only for privileged operations

### Webhook Security (ghl-sync)

- Validates GHL webhook signatures
- Uses RSA-SHA256 verification
- Rejects unsigned or invalid requests
- Logs all verification attempts

### Best Practices

✅ Always use service role key for admin operations
✅ Validate all input data
✅ Log errors with request IDs for debugging
✅ Return appropriate HTTP status codes
✅ Handle errors gracefully
✅ Use idempotent operations where possible

---

## Monitoring

### Key Metrics

- **Invocation count** - Total function calls
- **Success rate** - Percentage of successful executions
- **Execution time** - Average response time
- **Error rate** - Failed invocations

### View Logs

**In Supabase Dashboard:**
1. Edge Functions → Select function
2. Click "Logs" tab
3. Filter by date/status

**Via CLI:**
```bash
supabase functions logs ghl-sync --tail
```

### Alerts

Set up monitoring for:
- High error rates (>5%)
- Slow execution times (>5 seconds)
- Signature verification failures
- Failed user creations

---

## Troubleshooting

### Function Not Responding

1. Check if function is deployed: `supabase functions list`
2. Verify environment variables are set
3. Check function logs for errors
4. Test with curl to isolate issue

### Signature Verification Failing (ghl-sync)

1. Verify `x-wh-signature` header is included
2. Check GHL workflow sends correct signature format
3. Ensure no payload modifications between GHL and function
4. Test with GHL webhook testing tool

### User Not Created (ghl-sync)

1. Check payload includes contact email
2. Verify product IDs match environment variables
3. Check if user already exists
4. Review edge function logs for specific error

### Admin Operations Failing

1. Verify user has admin role
2. Check `is_admin()` function returns true
3. Ensure RLS policies allow admin access
4. Review function logs for authorization errors

---

## Support

**Documentation:**
- Main guide: `/docs/GHL_INTEGRATION_GUIDE.md`
- Database schema: `/docs/DATABASE_SCHEMA.md`
- RLS policies: `/docs/RLS_POLICIES.md`

**Debugging:**
1. Check function logs first
2. Verify environment variables
3. Test with sample payloads
4. Review recent code changes

**Common Issues:**
- Missing environment variables → Set in Supabase Dashboard
- CORS errors → Check headers in function response
- Timeout errors → Optimize function code or increase timeout
- Memory errors → Reduce payload size or optimize processing

---

## Function Template

When creating new functions:

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  // Handle OPTIONS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // Your function logic here
    const data = { message: "Success" };

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
```

---

**Last Updated:** 2025-10-17
**Supabase Version:** 2.x
**Deno Runtime:** Deploy V2
