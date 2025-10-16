// susana.js - Supabase Edge Function (drop-in)
// Keeps your existing import and the provided public key but uses improved verification & logging.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// --- Existing (or default) GHL Public Key from your file ---
// You can override this by setting GHL_PUBLIC_KEY_PEM in Supabase env vars.
const DEFAULT_GHL_PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAokvo/r9tVgcfZ5DysOSC
Frm602qYV0MaAiNnX9O8KxMbiyRKWeL9JpCpVpt4XHIcBOK4u3cLSqJGOLaPuXw6
dO0t6Q/ZVdAV5Phz+ZtzPL16iCGeK9po6D6JHBpbi989mmzMryUnQJezlYJ3DVfB
csedpinheNnyYeFXolrJvcsjDtfAeRx5ByHQmTnSdFUzuAnC9/GepgLT9SM4nCpv
uxmZMxrJt5Rw+VUaQ9B8JSvbMPpez4peKaJPZHBbU3OdeCVx5klVXXZQGNHOs8gF
3kvoV5rTnXV0IknLBXlcKKAQLZcY/Q9rG6Ifi9c+5vqlvHPCUJFT5XUGG5RKgOKU
J062fRtN+rLYZUV+BjafxQauvC8wSWeYja63VSUruvmNj8xkx2zE/Juc+yjLjTXp
IocmaiFeAO6fUtNjDeFVkhf5LNb59vECyrHD2SQIrhgXpO4Q3dVNA5rw576PwTzN
h/AMfHKIjE4xQA1SZuYJmNnmVZLIZBlQAF9Ntd03rfadZ+yDiOXCCs9FkHibELhC
HULgCsnuDJHcrGNd5/Ddm5hxGQ0ASitgHeMZ0kcIOwKDOzOU53lDza6/Y09T7sYJ
PQe7z0cvj7aE4B+Ax1ZoZGPzpJlZtGXCsu9aTEGEnKzmsFqwcSsnw3JB31IGKAyk
T1hhTiaCeIY/OwwwNUY2yvcCAwEAAQ==
-----END PUBLIC KEY-----`;

// Basic CORS headers (tighten in production)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-wh-signature, x-gohighlevel-signature, x-hl-signature, x-wh-timestamp',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Small role priority map used by some helper logic
const ROLE_PRIORITY = { user: 1, pro: 2, admin: 3 };

// Main server entry (Deno serve)
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const requestId = crypto.randomUUID();
  console.log(`[${requestId}] New request: ${new Date().toISOString()} ${req.method} ${req.url}`);

  // Log headers (very useful to see if signature header actually arrived)
  console.log(`[${requestId}] Headers:`);
  for (const [k, v] of req.headers) {
    console.log(`[${requestId}]   ${k}: ${v}`);
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Env and flags
  const DEBUG_BYPASS = Deno?.env?.get?.('DEBUG_BYPASS_GHL_SIGNATURE') === 'true';
  const VERBOSE_DEBUG = Deno?.env?.get?.('VERBOSE_DEBUG') === 'true';
  const publicKeyPem = (Deno?.env?.get?.('GHL_PUBLIC_KEY_PEM') || DEFAULT_GHL_PUBLIC_KEY_PEM).trim();
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error(`[${requestId}] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env var.`);
    return new Response(JSON.stringify({ error: 'Server configuration error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Read exact body bytes (ArrayBuffer) for accurate signature verification
  let bodyArrayBuffer;
  try {
    bodyArrayBuffer = await req.arrayBuffer();
  } catch (err) {
    console.error(`[${requestId}] Failed to read body as ArrayBuffer:`, err);
    return new Response('Bad request body', { status: 400, headers: corsHeaders });
  }

  const bodyText = new TextDecoder().decode(bodyArrayBuffer);
  console.log(`[${requestId}] Body preview (first 5000 chars):\n${bodyText.slice(0, 5000)}`);

  // Accept multiple possible signature header names
  const signatureHeader =
    req.headers.get('x-wh-signature') ||
    req.headers.get('x-gohighlevel-signature') ||
    req.headers.get('x-hl-signature') ||
    req.headers.get('x-signature') ||
    null;

  console.log(`[${requestId}] signatureHeader: ${signatureHeader ? '[present]' : '[missing]'}`);

  if (!signatureHeader) {
    if (DEBUG_BYPASS) {
      console.warn(`[${requestId}] WARNING: Missing signature header but DEBUG_BYPASS=true — continuing (dev only)`);
    } else {
      console.warn(`[${requestId}] Request rejected: Missing signature header.`);
      return new Response(
        JSON.stringify({
          error: 'Missing signature header',
          hint: 'For local testing set DEBUG_BYPASS_GHL_SIGNATURE=true (do not use in production).',
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  }

  // If signature present and public key available -> verify
  if (signatureHeader && publicKeyPem) {
    const verified = await verifySignature(bodyArrayBuffer, signatureHeader, publicKeyPem, VERBOSE_DEBUG, requestId).catch((e) => {
      console.error(`[${requestId}] verifySignature threw:`, e);
      return false;
    });
    console.log(`[${requestId}] Signature verification result: ${verified}`);
    if (!verified && !DEBUG_BYPASS) {
      console.warn(`[${requestId}] Request rejected: signature verification failed.`);
      return new Response(JSON.stringify({ error: 'Signature verification failed' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!verified && DEBUG_BYPASS) {
      console.warn(`[${requestId}] Signature verification failed but DEBUG_BYPASS=true — continuing`);
    }
  } else if (signatureHeader && !publicKeyPem) {
    // shouldn't happen because we provide default, but just in case
    console.warn(`[${requestId}] Signature present but no public key configured. Accepting for now (dev).`);
  }

  // Parse JSON if possible
  let jsonBody = null;
  try {
    jsonBody = bodyText ? JSON.parse(bodyText) : null;
  } catch (err) {
    console.log(`[${requestId}] Body is not valid JSON:`, err?.message || err);
  }

  // Create Supabase admin client
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Basic webhook handling — you can replace/extend below with your original logic
  try {
    console.log(`[${requestId}] Handling webhook. Payload keys: ${jsonBody ? Object.keys(jsonBody).join(', ') : 'none'}`);

    // Extract contact and event info using helper functions below
    const eventId = extractString(jsonBody, ['event_id', 'eventId', 'id', 'meta.event_id', 'meta.eventId']) || null;
    const eventType = normalizeEventType(jsonBody);
    const contact = extractContact(jsonBody);
    const productId = extractProductId(jsonBody);
    const tagSet = extractTags(jsonBody);

    console.log(`[${requestId}] Processed fields: eventId=${eventId}, eventType=${eventType}, productId=${productId}, email=${contact?.email}`);

    // Example lifecycle decision (you had richer logic — hook your existing functions here)
    const action = determineLifecycleAction({ eventType, productId, tags: tagSet, proProductIds: parseEnvList(Deno.env.get('GHL_PRO_PRODUCT_IDS')), trialProductIds: parseEnvList(Deno.env.get('GHL_TRIAL_PRODUCT_IDS')) });

    if (action.type === 'ignore') {
      console.log(`[${requestId}] Ignoring webhook: ${action.reason}`);
      return new Response(JSON.stringify({ success: true, action: 'ignore', reason: action.reason, eventId }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // If action requires account work and we have contact.email
    if (!contact.email) {
      console.warn(`[${requestId}] No contact email provided; cannot reconcile account.`);
      return new Response(JSON.stringify({ success: false, message: 'Webhook ignored: contact email is required.', eventId }), { status: 202, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Example: if pro purchase or trial signup -> ensure account
    if (action.type === 'pro_purchase' || action.type === 'trial_signup') {
      const desiredRole = action.type === 'pro_purchase' ? 'pro' : 'user';
      const result = await ensureAccount({ supabase, email: contact.email, fullName: contact.name, ghlContactId: contact.id, desiredRole, activate: true, sendInvite: true });
      console.log(`[${requestId}] ensureAccount result:`, result);
      return new Response(JSON.stringify({ success: true, action: action.type, result, eventId }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Examples for other actions: payment_failed, payment_recovered, cancellation -> updateActiveStatus
    if (['payment_failed', 'payment_recovered', 'cancellation'].includes(action.type)) {
      const active = action.type === 'payment_recovered';
      const result = await updateActiveStatus({ supabase, email: contact.email, active, ghlContactId: contact.id });
      console.log(`[${requestId}] updateActiveStatus result:`, result);
      return new Response(JSON.stringify({ success: true, action: action.type, result, eventId }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Default response if not handled above
    return new Response(JSON.stringify({ success: true, action: action.type, reason: action.reason, eventId }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error(`[${requestId}] Error processing webhook:`, err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

/* ==========================
   Signature verification helpers (fixed)
   - Works with RSASSA-PKCS1-v1_5 + SHA-256 (public key in SPKI PEM)
   - Accepts signature headers like "sha256=<base64>" or bare base64
   ========================== */
async function verifySignature(payloadArrayBuffer, signatureHeader, publicKeyPem, verbose = false, requestId = '') {
  try {
    if (!signatureHeader) return false;

    // Accept possible prefixes like "sha256=" or "v1=" -> take last segment after '='
    const rawSig = signatureHeader.includes('=') ? signatureHeader.split('=').pop().trim() : signatureHeader.trim();
    const sigBytes = base64ToUint8Array(rawSig);

    if (verbose) {
      console.log(`[${requestId}] Signature (base64): ${rawSig}`);
      console.log(`[${requestId}] Signature bytes length: ${sigBytes.length}`);
    }

    const publicKeyBuffer = pemToArrayBuffer(publicKeyPem);

    if (verbose) {
      const fp = await publicKeyFingerprint(publicKeyBuffer);
      console.log(`[${requestId}] Public key fingerprint (sha256 base64url): ${fp}`);
    }

    // Import public key with correct hash object
    const pubKey = await crypto.subtle.importKey(
      'spki',
      publicKeyBuffer,
      { name: 'RSASSA-PKCS1-v1_5', hash: { name: 'SHA-256' } },
      false,
      ['verify']
    );

    // Verify using exact bytes that were sent
    const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', pubKey, sigBytes, payloadArrayBuffer);
    return Boolean(ok);
  } catch (err) {
    console.error('[verifySignature] error:', err);
    return false;
  }
}

function pemToArrayBuffer(pem) {
  // Remove header/footer and whitespace
  const b64 = pem.replace(/-----BEGIN PUBLIC KEY-----/g, '').replace(/-----END PUBLIC KEY-----/g, '').replace(/\r?\n|\r/g, '').trim();
  return base64ToUint8Array(b64).buffer;
}
function base64ToUint8Array(base64) {
  if (typeof atob === 'function') {
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } else if (typeof Buffer !== 'undefined') {
    const buf = Buffer.from(base64, 'base64');
    return new Uint8Array(buf);
  } else {
    throw new Error('No base64 decoder available in this runtime');
  }
}
async function publicKeyFingerprint(publicKeyArrayBuffer) {
  try {
    const digest = await crypto.subtle.digest('SHA-256', publicKeyArrayBuffer);
    const b64 = arrayBufferToBase64(digest);
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  } catch (err) {
    console.error('publicKeyFingerprint error:', err);
    return null;
  }
}
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  if (typeof btoa === 'function') return btoa(binary);
  if (typeof Buffer !== 'undefined') return Buffer.from(binary, 'binary').toString('base64');
  throw new Error('No base64 encoder available');
}

/* ==============
   Webhook helper utilities (kept minimal & robust)
   You can expand/replace these with your older functions if you want the exact original behavior.
   ============== */

function parseEnvList(value) {
  if (!value) return new Set();
  return new Set(value.split(',').map((v) => v.trim()).filter((v) => v.length > 0));
}
function extractString(payload, paths) {
  if (!payload || typeof payload !== 'object') return null;
  for (const path of paths) {
    const segments = path.split('.');
    let current = payload;
    let found = true;
    for (const seg of segments) {
      if (current && typeof current === 'object' && seg in current) {
        current = current[seg];
      } else {
        found = false;
        break;
      }
    }
    if (found && typeof current === 'string' && current.trim().length > 0) return current.trim();
  }
  return null;
}
function normalizeEventType(payload) {
  const raw = extractString(payload, ['event', 'event_type', 'eventType', 'type', 'eventName', 'meta.event', 'meta.type']);
  if (!raw) return null;
  return raw.toLowerCase();
}
function extractProductId(payload) {
  return extractString(payload, ['product.id', 'productId', 'product_id', 'offer.id', 'offerId', 'invoice.product_id', 'meta.product_id']) || null;
}
function extractTags(payload) {
  const tags = new Set();
  const candidates = [getAny(payload, ['tags']), getAny(payload, ['contact', 'tags']), getAny(payload, ['contact', 'tagList'])];
  for (const c of candidates) {
    if (!c) continue;
    if (Array.isArray(c)) {
      for (const v of c) if (typeof v === 'string') tags.add(v.toLowerCase());
    } else if (typeof c === 'string') {
      c.split(',').map((t) => t.trim().toLowerCase()).filter((t) => t.length > 0).forEach((t) => tags.add(t));
    }
  }
  return tags;
}
function getAny(payload, path) {
  let current = payload;
  for (const segment of path) {
    if (current && typeof current === 'object' && segment in current) current = current[segment];
    else return undefined;
  }
  return current;
}
function extractContact(payload) {
  const email = extractString(payload, ['contact.email', 'email', 'customer.email', 'payload.email']);
  const id = extractString(payload, ['contact.id', 'contactId', 'customer.id', 'customerId']);
  const firstName = extractString(payload, ['contact.first_name', 'contact.firstName', 'customer.first_name', 'customer.firstName', 'first_name', 'firstName']);
  const lastName = extractString(payload, ['contact.last_name', 'contact.lastName', 'customer.last_name', 'customer.lastName', 'last_name', 'lastName']);
  const fullName = extractString(payload, ['contact.name', 'customer.name']) || [firstName, lastName].filter(Boolean).join(' ').trim() || firstName || lastName;
  return { email, id, name: fullName && fullName.length > 0 ? fullName : null };
}
function determineLifecycleAction({ eventType, productId, tags, proProductIds, trialProductIds }) {
  if (!eventType && !productId) return { type: 'ignore', reason: 'No actionable event type or product id provided.' };
  if (productId) {
    if (proProductIds.has(productId)) return { type: 'pro_purchase', reason: `Matched pro product id ${productId}` };
    if (trialProductIds.has(productId)) return { type: 'trial_signup', reason: `Matched trial product id ${productId}` };
  }
  if (eventType) {
    if (eventType.includes('trial')) return { type: 'trial_signup', reason: `Event type indicates trial lifecycle: ${eventType}` };
    if (eventType.includes('payment') && eventType.includes('failed')) return { type: 'payment_failed', reason: `Payment failure event: ${eventType}` };
    if (eventType.includes('payment') && (eventType.includes('success') || eventType.includes('paid') || eventType.includes('recovered'))) {
      if (eventType.includes('recovered')) return { type: 'payment_recovered', reason: `Payment recovered event: ${eventType}` };
      return { type: 'payment_recovered', reason: `Payment success event: ${eventType}` };
    }
    if (eventType.includes('recover') || eventType.includes('reactivat')) return { type: 'payment_recovered', reason: `Account recovery event: ${eventType}` };
    if (eventType.includes('cancel')) return { type: 'cancellation', reason: `Cancellation event: ${eventType}` };
  }
  if (tags && tags.size > 0) {
    if (Array.from(tags).some((t) => t.includes('pro'))) return { type: 'pro_purchase', reason: 'Matched pro tag from contact.' };
    if (Array.from(tags).some((t) => t.includes('trial'))) return { type: 'trial_signup', reason: 'Matched trial tag from contact.' };
  }
  return { type: 'ignore', reason: 'No lifecycle transition rules matched.' };
}

/* ==============
   Minimal account helpers (useful starting point)
   These use Supabase Admin auth and upsert into user_profiles.
   You can replace/extend these with your earlier longer implementations.
   ============== */
async function ensureAccount({ supabase, email, fullName, ghlContactId, desiredRole = 'user', activate = true, sendInvite = false }) {
  if (!email) throw new Error('email required');
  // Try to find user
  const { data: lookup, error: lookupError } = await supabase.auth.admin.getUserByEmail(email);
  if (lookupError && !lookupError.message?.includes('User not found')) throw lookupError;

  let userId = lookup?.user?.id ?? null;
  let createdNewUser = false;

  if (!userId) {
    // Create user (admin)
    const { data: createData, error: createError } = await supabase.auth.admin.createUser({ email, email_confirm: false, user_metadata: { full_name: fullName, role_hint: desiredRole, ghl_contact_id: ghlContactId } });
    if (createError) {
      // If already registered concurrently, re-fetch
      if (createError.message?.includes('already registered')) {
        const { data: retry, error: retryErr } = await supabase.auth.admin.getUserByEmail(email);
        if (retryErr) throw retryErr;
        userId = retry?.user?.id ?? null;
      } else {
        throw createError;
      }
    } else {
      userId = createData.user?.id ?? null;
      createdNewUser = true;
    }
  }

  if (!userId) throw new Error('Unable to resolve Supabase user id for webhook contact');

  // Upsert profile
  const nextRole = resolveRoleUpgrade({ currentRole: 'user', desiredRole }); // simple default
  const updates = { id: userId, role: nextRole, active: activate, updated_at: new Date().toISOString(), full_name: fullName };
  const { error: upsertError } = await supabase.from('user_profiles').upsert(updates, { onConflict: 'id' });
  if (upsertError) console.warn('Upsert profile warning:', upsertError);

  // Optionally invite
  if (sendInvite && createdNewUser) {
    const inviteOptions = {};
    const redirectTo = Deno.env.get('APP_LOGIN_URL');
    if (redirectTo) inviteOptions.redirectTo = redirectTo;
    const { error: inviteErr } = await supabase.auth.admin.inviteUserByEmail(email, inviteOptions);
    if (inviteErr) console.warn('Failed to send invite:', inviteErr);
  }

  return { userId, createdNewUser };
}

async function updateActiveStatus({ supabase, email, active = false, ghlContactId = null }) {
  if (!email) throw new Error('email required');
  const { data: lookup, error: lookupError } = await supabase.auth.admin.getUserByEmail(email);
  if (lookupError && !lookupError.message?.includes('User not found')) throw lookupError;
  const userId = lookup?.user?.id ?? null;
  if (!userId) return { skipped: true, reason: 'User not found by email' };

  const updates = { id: userId, active, updated_at: new Date().toISOString(), status_updated_at: new Date().toISOString() };
  if (ghlContactId) updates.preferences = { ...(lookup?.user?.user_metadata || {}), ghl_contact_id: ghlContactId };
  const { error: upsertErr } = await supabase.from('user_profiles').upsert(updates, { onConflict: 'id' });
  if (upsertErr) throw upsertErr;
  return { userId, updatedActive: active };
}

function resolveRoleUpgrade({ currentRole = 'user', desiredRole = 'user' }) {
  const currentPriority = ROLE_PRIORITY[currentRole] || 1;
  const desiredPriority = ROLE_PRIORITY[desiredRole] || 1;
  return desiredPriority > currentPriority ? desiredRole : currentRole;
}
