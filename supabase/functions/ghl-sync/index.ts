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
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  if (req.method !== 'POST') {
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
    console.error('Missing required Supabase environment variables.');
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
  // This is the NEW Public Key verification block
  const rawBody = await req.text();
  const signatureHeader = req.headers.get('x-wh-signature'); // Use the correct header name
  if (!signatureHeader) {
    console.warn('Request rejected: Missing x-wh-signature header.');
    return new Response(JSON.stringify({
      error: 'Unauthorized'
    }), {
      status: 401,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
  const signatureValid = await verifySignature(rawBody, signatureHeader, GHL_PUBLIC_KEY_PEM);
  if (!signatureValid) {
    console.warn('Signature verification failed.');
    return new Response(JSON.stringify({
      error: 'Unauthorized'
    }), {
      status: 401,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch (error) {
    console.error('Invalid JSON payload received from GHL.', error);
    return new Response(JSON.stringify({
      error: 'Invalid JSON payload'
    }), {
      status: 400,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
  const eventId = extractString(payload, [
    'event_id',
    'eventId',
    'id',
    'meta.event_id',
    'meta.eventId'
  ]);
  const eventType = normalizeEventType(payload);
  const contact = extractContact(payload);
  const productId = extractProductId(payload);
  const tagSet = extractTags(payload);
  console.log('Processing GHL webhook', {
    eventId,
    eventType,
    productId,
    tags: Array.from(tagSet)
  });
  if (!contact.email) {
    console.warn('Webhook payload missing contact email. Cannot reconcile user.');
    return new Response(JSON.stringify({
      success: false,
      message: 'Webhook ignored: contact email is required.',
      eventId
    }), {
      status: 202,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const proProductIds = parseEnvList(Deno.env.get('GHL_PRO_PRODUCT_IDS'));
  const trialProductIds = parseEnvList(Deno.env.get('GHL_TRIAL_PRODUCT_IDS'));
  const action = determineLifecycleAction({
    eventType,
    productId,
    tags: tagSet,
    proProductIds,
    trialProductIds
  });
  if (action.type === 'ignore') {
    console.log('Webhook ignored', {
      reason: action.reason,
      eventId
    });
    return new Response(JSON.stringify({
      success: true,
      action: action.type,
      reason: action.reason,
      eventId
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
  try {
    let result = {};
    switch(action.type){
      case 'pro_purchase':
      case 'trial_signup':
        {
          const desiredRole = action.type === 'pro_purchase' ? 'pro' : 'user';
          result = await ensureAccount({
            supabase,
            email: contact.email,
            fullName: contact.name,
            ghlContactId: contact.id,
            desiredRole,
            activate: true,
            sendInvite: true
          });
          break;
        }
      case 'payment_failed':
        {
          result = await updateActiveStatus({
            supabase,
            email: contact.email,
            active: false,
            ghlContactId: contact.id
          });
          break;
        }
      case 'payment_recovered':
        {
          result = await updateActiveStatus({
            supabase,
            email: contact.email,
            active: true,
            ghlContactId: contact.id
          });
          break;
        }
      case 'cancellation':
        {
          result = await updateActiveStatus({
            supabase,
            email: contact.email,
            active: false,
            ghlContactId: contact.id
          });
          break;
        }
    }
    console.log('Webhook processed successfully', {
      eventId,
      action: action.type,
      result
    });
    return new Response(JSON.stringify({
      success: true,
      action: action.type,
      reason: action.reason,
      result,
      eventId
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Failed processing webhook action', {
      eventId,
      action: action.type,
      error
    });
    return new Response(JSON.stringify({
      error: 'Internal server error',
      eventId
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
    const publicKey = await crypto.subtle.importKey('spki', pemToBinary(publicKeyPem), {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-26'
    }, false, [
      'verify'
    ]);
    const signatureBytes = base64ToArrayBuffer(signature);
    const payloadBytes = new TextEncoder().encode(payload);
    return await crypto.subtle.verify('RSASSA-PKCS1-v1_5', publicKey, signatureBytes, payloadBytes);
  } catch (error) {
    console.error("Error during signature verification:", error);
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
  let userId = null;
  let createdNewUser = false;
  let existingUserRole = null;
  let userMetadata = {};
  const { data: existingUserResponse, error: fetchError } = await supabase.auth.admin.getUserByEmail(email);
  if (fetchError && fetchError.message && !fetchError.message.includes('User not found')) {
    throw fetchError;
  }
  if (existingUserResponse?.user) {
    userId = existingUserResponse.user.id;
    existingUserRole = existingUserResponse.user.user_metadata?.role || null;
    userMetadata = {
      ...existingUserResponse.user.user_metadata ?? {}
    };
  }
  if (!userId) {
    const { data: createData, error: createError } = await supabase.auth.admin.createUser({
      email,
      email_confirm: false,
      user_metadata: metadata
    });
    if (createError) {
      if (createError.message?.includes('already registered')) {
        const { data: retryUser, error: retryError } = await supabase.auth.admin.getUserByEmail(email);
        if (retryError) {
          throw retryError;
        }
        userId = retryUser?.user?.id ?? null;
        existingUserRole = retryUser?.user?.user_metadata?.role || null;
        userMetadata = {
          ...retryUser?.user?.user_metadata ?? {}
        };
      } else {
        throw createError;
      }
    } else {
      userId = createData.user?.id ?? null;
      createdNewUser = true;
      userMetadata = {
        ...createData.user?.user_metadata ?? metadata
      };
    }
  }
  if (!userId) {
    throw new Error('Unable to resolve Supabase user id for webhook contact');
  }
  if (!createdNewUser) {
    const nextMetadata = {
      ...userMetadata
    };
    let metadataChanged = false;
    if (fullName && nextMetadata.full_name !== fullName) {
      nextMetadata.full_name = fullName;
      metadataChanged = true;
    }
    if (ghlContactId && nextMetadata.ghl_contact_id !== ghlContactId) {
      nextMetadata.ghl_contact_id = ghlContactId;
      metadataChanged = true;
    }
    if (nextMetadata.role_hint !== desiredRole) {
      nextMetadata.role_hint = desiredRole;
      metadataChanged = true;
    }
    if (metadataChanged) {
      const { error: updateMetadataError } = await supabase.auth.admin.updateUserById(userId, {
        user_metadata: nextMetadata
      });
      if (updateMetadataError) {
        console.error('Failed to update user metadata for existing account', updateMetadataError);
      } else {
        userMetadata = nextMetadata;
      }
    }
  }
  const { data: profile, error: profileError } = await supabase.from('user_profiles').select('role, preferences, full_name, active').eq('id', userId).maybeSingle();
  if (profileError && profileError.code !== 'PGRST116') {
    // PGRST116 = Row not found
    console.warn('Error fetching user profile; proceeding with upsert.', profileError);
  }
  const nextRole = resolveRoleUpgrade({
    currentRole: profile?.role || existingUserRole || 'user',
    desiredRole
  });
  const preferences = mergePreferences(profile?.preferences, ghlContactId);
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
  const { error: upsertError } = await supabase.from('user_profiles').upsert(updates, {
    onConflict: 'id'
  });
  if (upsertError) {
    throw upsertError;
  }
  if (sendInvite && createdNewUser) {
    const inviteOptions = {
      data: metadata
    };
    const redirectTo = Deno.env.get('APP_LOGIN_URL');
    if (redirectTo) {
      inviteOptions.redirectTo = redirectTo;
    }
    const { error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email, inviteOptions);
    if (inviteError) {
      console.error('Failed to send invitation email for new user', inviteError);
    }
  }
  return {
    userId,
    createdNewUser,
    updatedRole: nextRole,
    active: activate
  };
}
async function updateActiveStatus({ supabase, email, active, ghlContactId }) {
  const { data: userResponse, error: fetchError } = await supabase.auth.admin.getUserByEmail(email);
  if (fetchError && fetchError.message && !fetchError.message.includes('User not found')) {
    throw fetchError;
  }
  const userId = userResponse?.user?.id;
  if (!userId) {
    return {
      skipped: true,
      reason: 'User not found by email'
    };
  }
  const { data: profile, error: profileError } = await supabase.from('user_profiles').select('role, active, preferences').eq('id', userId).maybeSingle();
  if (profileError && profileError.code !== 'PGRST116') {
    console.warn('Error fetching user profile prior to status update', profileError);
  }
  const existingContactId = getContactIdFromPreferences(profile?.preferences);
  const shouldUpdateContactId = Boolean(ghlContactId && ghlContactId !== existingContactId);
  if (profile?.active === active && !shouldUpdateContactId) {
    return {
      skipped: true,
      reason: 'Active status already set'
    };
  }
  const preferences = mergePreferences(profile?.preferences, ghlContactId);
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
  const { error: upsertError } = await supabase.from('user_profiles').upsert(updates, {
    onConflict: 'id'
  });
  if (upsertError) {
    throw upsertError;
  }
  return {
    userId,
    updatedActive: active
  };
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
