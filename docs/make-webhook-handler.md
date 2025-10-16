# Make Webhook Handler Integration Guide

## Overview
This guide documents the end-to-end provisioning flow that bridges GoHighLevel (GHL) events through Make.com into Supabase. It accompanies the `make-webhook-handler` Edge Function.

## Part A. Supabase Edge Function
The function source resides at [`supabase/functions/make-webhook-handler/index.ts`](../supabase/functions/make-webhook-handler/index.ts). Deploy it with:

```bash
supabase functions deploy make-webhook-handler
```

### Required Supabase Secrets
| Secret | Purpose |
| --- | --- |
| `SUPABASE_URL` | Supabase project URL used by the Edge Function. |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key required for Auth Admin and unrestricted table access. |
| `MAKE_WEBHOOK_SECRET` | Bearer token shared with the Make scenario. |

Configure the secrets via the Supabase dashboard or `supabase functions secrets set` before deploying.

## Part B. Make.com Scenario Blueprint
1. **Create a Scenario** named `Artemo Provisioning Bridge`.
2. **Add Trigger – Webhooks → Custom Webhook**
   - Generate a new custom webhook and copy the URL. This URL will be used in GHL workflows.
   - Send a sample webhook from GHL to let Make determine the payload structure.
3. **Normalize Payload – Tools → JSON → Create JSON**
   - Build the JSON body expected by Supabase:
     - `email`: `{{lower(1.contact.email)}}`
     - `fullName`: `{{trim(concat(1.contact.firstName; " "; 1.contact.lastName))}}`
     - `event`: `{{switch(lower(1.eventName);
         "artemo monthly purchase"; "pro_subscription_purchase";
         "artemo annual purchase"; "pro_subscription_purchase";
         "artemo trial"; "trial_started";
         "artemo failed payment"; "payment_failed";
         "artemo successful payment & after failure"; "payment_recovered";
         "artemo cancel"; "subscription_cancelled";
         "unknown")}}`
     - Optionally map additional identifiers into `metadata` for observability.
   - Save the module output as `MakePayload`.
4. **Forward to Supabase – HTTP → Make a request**
   - Method: `POST`
   - URL: `https://<project-ref>.functions.supabase.co/make-webhook-handler`
   - Headers:
     - `Content-Type: application/json`
     - `Authorization: Bearer {{<Make variable holding MAKE_WEBHOOK_SECRET>}}`
   - Body type: `Raw`
   - Request content: select the `JSON string` output from `MakePayload`.
   - Enable "Parse response" for easier troubleshooting.
5. **Error Handling**
   - Add an error handler on the HTTP module to retry on transient failures (5xx/429) and alert on 4xx responses.
   - Optionally branch to Slack/Email modules for failure notifications.
6. **Security**
   - Store the shared secret as a concealed Make variable.
   - Restrict scenario access to trusted users and enable scenario logging.

## Part C. GoHighLevel Configuration Guide
Update each existing workflow (Artemo Monthly Purchase, Artemo Annual Purchase, Artemo Trial, Artemo Failed Payment, Artemo Successful Payment & After Failure, Artemo Cancel):
1. Edit the **Webhook** action step.
2. Replace the existing URL with the Make Custom Webhook URL created above.
3. Ensure the method is `POST` and that the payload includes the contact and event context used by Make.
4. Save and publish the workflow.
5. Use GHL's "Send test webhook" feature to confirm events reach Make and subsequently Supabase.

## Verification Checklist
- [ ] Supabase secrets configured and function deployed.
- [ ] Make scenario activated and successfully sends test payloads to Supabase.
- [ ] GHL workflows updated with the new Make webhook URL and test deliveries succeed.

Once all steps are complete, production events will automatically update the `user_profiles` table and Supabase Auth state according to the provisioning rules embedded in the Edge Function.
