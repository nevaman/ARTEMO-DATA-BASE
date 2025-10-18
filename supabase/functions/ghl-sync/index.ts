import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
// --- GHL Public Key from their documentation ---
const GHL_PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
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
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-gohighlevel-signature, x-hl-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
const ROLE_PRIORITY = {
  user: 1,
  pro: 2,
  admin: 3
};
Deno.serve(async (req)=>{
  const requestId = crypto.randomUUID();
  console.log(`[${requestId}] ========== NEW REQUEST ==========`);
  console.log(`[${requestId}] Method: ${req.method}`);
  console.log(`[${requestId}] URL: ${req.url}`);

  // Log all headers for debugging
  const headers = {};
  req.headers.forEach((value, key) => {
    headers[key] = value;
  });
  console.log(`[${requestId}] Headers:`, JSON.stringify(headers, null, 2));

  if (req.method === 'OPTIONS') {
    console.log(`[${requestId}] Handling OPTIONS request`);
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  if (req.method !== 'POST') {
    console.warn(`[${requestId}] Method not allowed: ${req.method}`);
    return new Response(JSON.stringify({
      error: 'Method not allowed'
    }), {
      status: 405,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error(`[${requestId}] Missing required Supabase environment variables.`);
    return new Response(JSON.stringify({
      error: 'Server configuration error'
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }

  // Read the raw body
  const rawBody = await req.text();
  console.log(`[${requestId}] Raw body length: ${rawBody.length} bytes`);
  console.log(`[${requestId}] Raw body preview: ${rawBody.substring(0, 500)}...`);

  // Check for signature header
  const signatureHeader = req.headers.get('x-wh-signature');
  console.log(`[${requestId}] Signature header (x-wh-signature): ${signatureHeader ? 'PRESENT' : 'MISSING'}`);

  if (!signatureHeader) {
    console.warn(`[${requestId}] Request rejected: Missing signature header.`);
    console.log(`[${requestId}] Available headers: ${Object.keys(headers).join(', ')}`);
    return new Response(JSON.stringify({
      error: 'Unauthorized',
      message: 'Missing signature header',
      requestId
    }), {
      status: 401,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }

  console.log(`[${requestId}] Starting signature verification...`);
  const signatureValid = await verifySignature(rawBody, signatureHeader, GHL_PUBLIC_KEY_PEM);
  console.log(`[${requestId}] Signature verification result: ${signatureValid ? 'VALID' : 'INVALID'}`);

  if (!signatureValid) {
    console.warn(`[${requestId}] Signature verification failed.`);
    return new Response(JSON.stringify({
      error: 'Unauthorized',
      message: 'Signature verification failed',
      requestId
    }), {
      status: 401,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }

  console.log(`[${requestId}] Signature verified successfully`);

  let payload;
  try {
    payload = JSON.parse(rawBody);
    console.log(`[${requestId}] Parsed JSON payload successfully`);
  } catch (error) {
    console.error(`[${requestId}] Invalid JSON payload received from GHL.`, error);
    return new Response(JSON.stringify({
      error: 'Invalid JSON payload',
      requestId
    }), {
      status: 400,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }

  console.log(`[${requestId}] Full payload:`, JSON.stringify(payload, null, 2));

  const eventId = extractString(payload, [
    'event_id',
    'eventId',
    'id',
    'meta.event_id',
    'meta.eventId'
  ]);
  console.log(`[${requestId}] Extracted eventId: ${eventId}`);

  const eventType = normalizeEventType(payload);
  console.log(`[${requestId}] Extracted eventType: ${eventType}`);

  const contact = extractContact(payload);
  console.log(`[${requestId}] Extracted contact:`, JSON.stringify(contact, null, 2));

  const productId = extractProductId(payload);
  console.log(`[${requestId}] Extracted productId: ${productId}`);

  const tagSet = extractTags(payload);
  console.log(`[${requestId}] Extracted tags:`, Array.from(tagSet));

  console.log(`[${requestId}] Processing GHL webhook`, {
    eventId,
    eventType,
    productId,
    contactEmail: contact.email,
    contactName: contact.name,
    tags: Array.from(tagSet)
  });

  if (!contact.email) {
    console.warn(`[${requestId}] Webhook payload missing contact email. Cannot reconcile user.`);
    return new Response(JSON.stringify({
      success: false,
      message: 'Webhook ignored: contact email is required.',
      eventId,
      requestId
    }), {
      status: 202,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  console.log(`[${requestId}] Created Supabase client`);

  const proProductIds = parseEnvList(Deno.env.get('GHL_PRO_PRODUCT_IDS'));
  const trialProductIds = parseEnvList(Deno.env.get('GHL_TRIAL_PRODUCT_IDS'));
  console.log(`[${requestId}] Environment config - Pro Product IDs: ${Array.from(proProductIds).join(', ') || 'NONE'}`);
  console.log(`[${requestId}] Environment config - Trial Product IDs: ${Array.from(trialProductIds).join(', ') || 'NONE'}`);

  const action = determineLifecycleAction({
    eventType,
    productId,
    tags: tagSet,
    proProductIds,
    trialProductIds
  });
  console.log(`[${requestId}] Determined action:`, JSON.stringify(action, null, 2));

  if (action.type === 'ignore') {
    console.log(`[${requestId}] Webhook ignored - Reason: ${action.reason}`);
    return new Response(JSON.stringify({
      success: true,
      action: action.type,
      reason: action.reason,
      eventId,
      requestId
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }

  console.log(`[${requestId}] Starting to execute action: ${action.type}`);

  try {
    let result = {};
    switch(action.type){
      case 'pro_purchase':
      case 'trial_signup':
        {
          const desiredRole = action.type === 'pro_purchase' ? 'pro' : 'user';
          console.log(`[${requestId}] Executing ${action.type} - Creating/updating account with role: ${desiredRole}`);
          result = await ensureAccount({
            supabase,
            email: contact.email,
            fullName: contact.name,
            ghlContactId: contact.id,
            desiredRole,
            activate: true,
            sendInvite: true
          });
          console.log(`[${requestId}] ensureAccount result:`, JSON.stringify(result, null, 2));
          break;
        }
      case 'payment_failed':
        {
          console.log(`[${requestId}] Executing payment_failed - Deactivating account`);
          result = await updateActiveStatus({
            supabase,
            email: contact.email,
            active: false,
            ghlContactId: contact.id
          });
          console.log(`[${requestId}] updateActiveStatus result:`, JSON.stringify(result, null, 2));
          break;
        }
      case 'payment_recovered':
        {
          console.log(`[${requestId}] Executing payment_recovered - Reactivating account`);
          result = await updateActiveStatus({
            supabase,
            email: contact.email,
            active: true,
            ghlContactId: contact.id
          });
          console.log(`[${requestId}] updateActiveStatus result:`, JSON.stringify(result, null, 2));
          break;
        }
      case 'cancellation':
        {
          console.log(`[${requestId}] Executing cancellation - Deactivating account`);
          result = await updateActiveStatus({
            supabase,
            email: contact.email,
            active: false,
            ghlContactId: contact.id
          });
          console.log(`[${requestId}] updateActiveStatus result:`, JSON.stringify(result, null, 2));
          break;
        }
    }
    console.log(`[${requestId}] ✓ Webhook processed successfully`, {
      eventId,
      action: action.type,
      result
    });
    return new Response(JSON.stringify({
      success: true,
      action: action.type,
      reason: action.reason,
      result,
      eventId,
      requestId
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error(`[${requestId}] ✗ Failed processing webhook action`, {
      eventId,
      action: action.type,
      errorMessage: error.message,
      errorStack: error.stack,
      error: JSON.stringify(error, null, 2)
    });
    return new Response(JSON.stringify({
      error: 'Internal server error',
      message: error.message,
      eventId,
      requestId
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
// ADD THIS NEW BLOCK IN ITS PLACE ↓
// New function to verify the signature using the Public Key
async function verifySignature(payload, signature, publicKeyPem) {
  try {
    console.log('[verifySignature] Starting signature verification');
    console.log('[verifySignature] Signature length:', signature.length);
    console.log('[verifySignature] Payload length:', payload.length);

    const publicKey = await crypto.subtle.importKey('spki', pemToBinary(publicKeyPem), {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256'
    }, false, [
      'verify'
    ]);
    console.log('[verifySignature] Public key imported successfully');

    const signatureBytes = base64ToArrayBuffer(signature);
    console.log('[verifySignature] Signature bytes length:', signatureBytes.byteLength);

    const payloadBytes = new TextEncoder().encode(payload);
    console.log('[verifySignature] Payload bytes length:', payloadBytes.byteLength);

    const isValid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', publicKey, signatureBytes, payloadBytes);
    console.log('[verifySignature] Verification result:', isValid);

    return isValid;
  } catch (error) {
    console.error("[verifySignature] Error during signature verification:", {
      message: error.message,
      stack: error.stack,
      error: JSON.stringify(error, null, 2)
    });
    return false;
  }
}
// Helper function to convert the PEM key string to a binary format
function pemToBinary(pem) {
  const base64 = pem.replace(/-----BEGIN PUBLIC KEY-----/g, '').replace(/-----END PUBLIC KEY-----/g, '').replace(/\s/g, '');
  return base64ToArrayBuffer(base64);
}
// Helper function to convert a base64 string to a binary format (ArrayBuffer)
function base64ToArrayBuffer(base64) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for(let i = 0; i < len; i++){
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}
// ADD THIS NEW BLOCK IN ITS PLACE ↑
function parseEnvList(value) {
  if (!value) return new Set();
  return new Set(value.split(',').map((v)=>v.trim()).filter((v)=>v.length > 0));
}
function extractString(payload, paths) {
  for (const path of paths){
    const segments = path.split('.');
    let current = payload;
    let found = true;
    for (const segment of segments){
      if (current && typeof current === 'object' && segment in current) {
        current = current[segment];
      } else {
        found = false;
        break;
      }
    }
    if (found && typeof current === 'string' && current.trim().length > 0) {
      return current.trim();
    }
  }
  return null;
}
function normalizeEventType(payload) {
  const raw = extractString(payload, [
    'event',
    'event_type',
    'eventType',
    'type',
    'eventName',
    'meta.event',
    'meta.type'
  ]);
  if (!raw) return null;
  return raw.toLowerCase();
}
function extractProductId(payload) {
  return extractString(payload, [
    'product.id',
    'productId',
    'product_id',
    'offer.id',
    'offerId',
    'invoice.product_id',
    'meta.product_id'
  ]) || null;
}
function extractTags(payload) {
  const tags = new Set();
  const candidates = [
    getAny(payload, [
      'tags'
    ]),
    getAny(payload, [
      'contact',
      'tags'
    ]),
    getAny(payload, [
      'contact',
      'tagList'
    ])
  ];
  for (const candidate of candidates){
    if (!candidate) continue;
    if (Array.isArray(candidate)) {
      for (const value of candidate){
        if (typeof value === 'string') {
          tags.add(value.toLowerCase());
        }
      }
    } else if (typeof candidate === 'string') {
      candidate.split(',').map((tag)=>tag.trim().toLowerCase()).filter((tag)=>tag.length > 0).forEach((tag)=>tags.add(tag));
    }
  }
  return tags;
}
function extractContact(payload) {
  const email = extractString(payload, [
    'contact.email',
    'email',
    'customer.email',
    'payload.email'
  ]);
  const id = extractString(payload, [
    'contact.id',
    'contactId',
    'customer.id',
    'customerId'
  ]);
  const firstName = extractString(payload, [
    'contact.first_name',
    'contact.firstName',
    'customer.first_name',
    'customer.firstName',
    'first_name',
    'firstName'
  ]);
  const lastName = extractString(payload, [
    'contact.last_name',
    'contact.lastName',
    'customer.last_name',
    'customer.lastName',
    'last_name',
    'lastName'
  ]);
  const fullName = extractString(payload, [
    'contact.name',
    'customer.name'
  ]) || [
    firstName,
    lastName
  ].filter(Boolean).join(' ').trim() || firstName || lastName;
  return {
    email,
    id,
    name: fullName && fullName.length > 0 ? fullName : null
  };
}
function getAny(payload, path) {
  let current = payload;
  for (const segment of path){
    if (current && typeof current === 'object' && segment in current) {
      current = current[segment];
    } else {
      return undefined;
    }
  }
  return current;
}
function determineLifecycleAction({ eventType, productId, tags, proProductIds, trialProductIds }) {
  if (!eventType && !productId) {
    return {
      type: 'ignore',
      reason: 'No actionable event type or product id provided.'
    };
  }
  if (productId) {
    if (proProductIds.has(productId)) {
      return {
        type: 'pro_purchase',
        reason: `Matched pro product id ${productId}`
      };
    }
    if (trialProductIds.has(productId)) {
      return {
        type: 'trial_signup',
        reason: `Matched trial product id ${productId}`
      };
    }
  }
  if (eventType) {
    if (eventType.includes('trial')) {
      return {
        type: 'trial_signup',
        reason: `Event type indicates trial lifecycle: ${eventType}`
      };
    }
    if (eventType.includes('payment') && eventType.includes('failed')) {
      return {
        type: 'payment_failed',
        reason: `Payment failure event: ${eventType}`
      };
    }
    if (eventType.includes('payment') && (eventType.includes('success') || eventType.includes('paid') || eventType.includes('recovered'))) {
      if (eventType.includes('recovered')) {
        return {
          type: 'payment_recovered',
          reason: `Payment recovered event: ${eventType}`
        };
      }
      return {
        type: 'payment_recovered',
        reason: `Payment success event without specific product match: ${eventType}`
      };
    }
    if (eventType.includes('recover') || eventType.includes('reactivat')) {
      return {
        type: 'payment_recovered',
        reason: `Account recovery event: ${eventType}`
      };
    }
    if (eventType.includes('cancel')) {
      return {
        type: 'cancellation',
        reason: `Cancellation event: ${eventType}`
      };
    }
  }
  if (tags.size > 0) {
    if (Array.from(tags).some((tag)=>tag.includes('pro'))) {
      return {
        type: 'pro_purchase',
        reason: 'Matched pro tag from contact.'
      };
    }
    if (Array.from(tags).some((tag)=>tag.includes('trial'))) {
      return {
        type: 'trial_signup',
        reason: 'Matched trial tag from contact.'
      };
    }
  }
  return {
    type: 'ignore',
    reason: 'No lifecycle transition rules matched.'
  };
}
async function ensureAccount({ supabase, email, fullName, ghlContactId, desiredRole, activate, sendInvite }) {
  console.log('[ensureAccount] Starting with params:', {
    email,
    fullName,
    ghlContactId,
    desiredRole,
    activate,
    sendInvite
  });

  const metadata = {};
  if (fullName) {
    metadata.full_name = fullName;
  }
  if (desiredRole) {
    metadata.role_hint = desiredRole;
  }
  if (ghlContactId) {
    metadata.ghl_contact_id = ghlContactId;
  }
  console.log('[ensureAccount] Prepared metadata:', metadata);

  let userId = null;
  let createdNewUser = false;
  let existingUserRole = null;
  let userMetadata = {};

  console.log('[ensureAccount] Checking for existing user by email:', email);
  const { data: existingUserResponse, error: fetchError } = await supabase.auth.admin.getUserByEmail(email);

  if (fetchError) {
    console.log('[ensureAccount] getUserByEmail error:', {
      message: fetchError.message,
      code: fetchError.code
    });
    if (fetchError.message && !fetchError.message.includes('User not found')) {
      throw fetchError;
    }
  }

  if (existingUserResponse?.user) {
    console.log('[ensureAccount] Found existing user:', {
      userId: existingUserResponse.user.id,
      email: existingUserResponse.user.email,
      userMetadata: existingUserResponse.user.user_metadata
    });
    userId = existingUserResponse.user.id;
    existingUserRole = existingUserResponse.user.user_metadata?.role || null;
    userMetadata = {
      ...existingUserResponse.user.user_metadata ?? {}
    };
  } else {
    console.log('[ensureAccount] No existing user found');
  }

  if (!userId) {
    console.log('[ensureAccount] Creating new user with email:', email);
    const { data: createData, error: createError } = await supabase.auth.admin.createUser({
      email,
      email_confirm: false,
      user_metadata: metadata
    });

    if (createError) {
      console.error('[ensureAccount] Error creating user:', {
        message: createError.message,
        code: createError.code
      });

      if (createError.message?.includes('already registered')) {
        console.log('[ensureAccount] User already registered, retrying fetch');
        const { data: retryUser, error: retryError } = await supabase.auth.admin.getUserByEmail(email);
        if (retryError) {
          console.error('[ensureAccount] Retry fetch failed:', retryError);
          throw retryError;
        }
        userId = retryUser?.user?.id ?? null;
        existingUserRole = retryUser?.user?.user_metadata?.role || null;
        userMetadata = {
          ...retryUser?.user?.user_metadata ?? {}
        };
        console.log('[ensureAccount] Retrieved user on retry:', { userId, existingUserRole });
      } else {
        throw createError;
      }
    } else {
      userId = createData.user?.id ?? null;
      createdNewUser = true;
      userMetadata = {
        ...createData.user?.user_metadata ?? metadata
      };
      console.log('[ensureAccount] User created successfully:', { userId, createdNewUser });
    }
  }

  if (!userId) {
    console.error('[ensureAccount] Failed to resolve userId');
    throw new Error('Unable to resolve Supabase user id for webhook contact');
  }
  if (!createdNewUser) {
    console.log('[ensureAccount] Updating existing user metadata');
    const nextMetadata = {
      ...userMetadata
    };
    let metadataChanged = false;
    if (fullName && nextMetadata.full_name !== fullName) {
      nextMetadata.full_name = fullName;
      metadataChanged = true;
      console.log('[ensureAccount] Full name changed');
    }
    if (ghlContactId && nextMetadata.ghl_contact_id !== ghlContactId) {
      nextMetadata.ghl_contact_id = ghlContactId;
      metadataChanged = true;
      console.log('[ensureAccount] GHL contact ID changed');
    }
    if (nextMetadata.role_hint !== desiredRole) {
      nextMetadata.role_hint = desiredRole;
      metadataChanged = true;
      console.log('[ensureAccount] Role hint changed');
    }
    if (metadataChanged) {
      console.log('[ensureAccount] Updating user metadata:', nextMetadata);
      const { error: updateMetadataError } = await supabase.auth.admin.updateUserById(userId, {
        user_metadata: nextMetadata
      });
      if (updateMetadataError) {
        console.error('[ensureAccount] Failed to update user metadata:', updateMetadataError);
      } else {
        console.log('[ensureAccount] User metadata updated successfully');
        userMetadata = nextMetadata;
      }
    } else {
      console.log('[ensureAccount] No metadata changes needed');
    }
  }

  console.log('[ensureAccount] Fetching user profile from database');
  const { data: profile, error: profileError } = await supabase.from('user_profiles').select('role, preferences, full_name, active').eq('id', userId).maybeSingle();

  if (profileError && profileError.code !== 'PGRST116') {
    console.warn('[ensureAccount] Error fetching user profile:', {
      code: profileError.code,
      message: profileError.message
    });
  }

  if (profile) {
    console.log('[ensureAccount] Found existing profile:', profile);
  } else {
    console.log('[ensureAccount] No existing profile found, will create new one');
  }

  const nextRole = resolveRoleUpgrade({
    currentRole: profile?.role || existingUserRole || 'user',
    desiredRole
  });
  console.log('[ensureAccount] Resolved role:', { currentRole: profile?.role || existingUserRole || 'user', desiredRole, nextRole });

  const preferences = mergePreferences(profile?.preferences, ghlContactId);
  console.log('[ensureAccount] Merged preferences:', preferences);

  const updates = {
    id: userId,
    role: nextRole,
    active: activate,
    updated_at: new Date().toISOString(),
    status_updated_at: new Date().toISOString()
  };
  if (fullName) {
    updates.full_name = fullName;
  }
  if (preferences) {
    updates.preferences = preferences;
  }

  console.log('[ensureAccount] Upserting profile with updates:', updates);
  const { error: upsertError } = await supabase.from('user_profiles').upsert(updates, {
    onConflict: 'id'
  });

  if (upsertError) {
    console.error('[ensureAccount] Profile upsert error:', {
      message: upsertError.message,
      code: upsertError.code,
      details: upsertError.details
    });
    throw upsertError;
  }
  console.log('[ensureAccount] Profile upserted successfully');

  if (sendInvite && createdNewUser) {
    console.log('[ensureAccount] Sending invitation email to:', email);
    const inviteOptions = {
      data: metadata
    };
    const redirectTo = Deno.env.get('APP_LOGIN_URL');
    if (redirectTo) {
      inviteOptions.redirectTo = redirectTo;
      console.log('[ensureAccount] Redirect URL:', redirectTo);
    }
    const { error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email, inviteOptions);
    if (inviteError) {
      console.error('[ensureAccount] Failed to send invitation email:', {
        message: inviteError.message,
        code: inviteError.code
      });
    } else {
      console.log('[ensureAccount] Invitation email sent successfully');
    }
  }

  const result = {
    userId,
    createdNewUser,
    updatedRole: nextRole,
    active: activate
  };
  console.log('[ensureAccount] Completed with result:', result);
  return result;
}
async function updateActiveStatus({ supabase, email, active, ghlContactId }) {
  console.log('[updateActiveStatus] Starting with params:', {
    email,
    active,
    ghlContactId
  });

  console.log('[updateActiveStatus] Fetching user by email:', email);
  const { data: userResponse, error: fetchError } = await supabase.auth.admin.getUserByEmail(email);

  if (fetchError) {
    console.log('[updateActiveStatus] getUserByEmail error:', {
      message: fetchError.message,
      code: fetchError.code
    });
    if (fetchError.message && !fetchError.message.includes('User not found')) {
      throw fetchError;
    }
  }

  const userId = userResponse?.user?.id;
  if (!userId) {
    console.log('[updateActiveStatus] User not found, skipping');
    return {
      skipped: true,
      reason: 'User not found by email'
    };
  }

  console.log('[updateActiveStatus] Found user:', userId);
  console.log('[updateActiveStatus] Fetching user profile');

  const { data: profile, error: profileError } = await supabase.from('user_profiles').select('role, active, preferences').eq('id', userId).maybeSingle();

  if (profileError && profileError.code !== 'PGRST116') {
    console.warn('[updateActiveStatus] Error fetching user profile:', {
      code: profileError.code,
      message: profileError.message
    });
  }

  if (profile) {
    console.log('[updateActiveStatus] Found profile:', {
      role: profile.role,
      active: profile.active,
      preferences: profile.preferences
    });
  } else {
    console.log('[updateActiveStatus] No profile found');
  }

  const existingContactId = getContactIdFromPreferences(profile?.preferences);
  const shouldUpdateContactId = Boolean(ghlContactId && ghlContactId !== existingContactId);

  console.log('[updateActiveStatus] Status check:', {
    currentActive: profile?.active,
    desiredActive: active,
    existingContactId,
    newContactId: ghlContactId,
    shouldUpdateContactId
  });

  if (profile?.active === active && !shouldUpdateContactId) {
    console.log('[updateActiveStatus] No changes needed, skipping');
    return {
      skipped: true,
      reason: 'Active status already set'
    };
  }

  const preferences = mergePreferences(profile?.preferences, ghlContactId);
  console.log('[updateActiveStatus] Merged preferences:', preferences);

  const updates = {
    id: userId,
    active,
    role: profile?.role || 'user',
    updated_at: new Date().toISOString(),
    status_updated_at: new Date().toISOString()
  };
  if (preferences) {
    updates.preferences = preferences;
  }

  console.log('[updateActiveStatus] Upserting profile with updates:', updates);
  const { error: upsertError } = await supabase.from('user_profiles').upsert(updates, {
    onConflict: 'id'
  });

  if (upsertError) {
    console.error('[updateActiveStatus] Profile upsert error:', {
      message: upsertError.message,
      code: upsertError.code,
      details: upsertError.details
    });
    throw upsertError;
  }

  console.log('[updateActiveStatus] Profile updated successfully');
  const result = {
    userId,
    updatedActive: active
  };
  console.log('[updateActiveStatus] Completed with result:', result);
  return result;
}
function resolveRoleUpgrade({ currentRole, desiredRole }) {
  const currentPriority = ROLE_PRIORITY[currentRole];
  const desiredPriority = ROLE_PRIORITY[desiredRole];
  return desiredPriority > currentPriority ? desiredRole : currentRole;
}
function mergePreferences(existing, ghlContactId) {
  let preferences;
  if (existing && typeof existing === 'object') {
    preferences = {
      ...existing
    };
  } else {
    preferences = {};
  }
  if (ghlContactId) {
    preferences.ghl_contact_id = ghlContactId;
  }
  return Object.keys(preferences).length > 0 ? preferences : null;
}
function getContactIdFromPreferences(preferences) {
  if (preferences && typeof preferences === 'object') {
    const value = preferences.ghl_contact_id;
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
  }
  return null;
}
