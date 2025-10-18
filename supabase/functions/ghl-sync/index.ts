import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const ROLE_PRIORITY = {
  user: 1,
  pro: 2,
  admin: 3
};

Deno.serve(async (req) => {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    console.log(`[${requestId}] ========== NEW REQUEST ==========`);
    console.log(`[${requestId}] Method: ${req.method}`);
    console.log(`[${requestId}] URL: ${req.url}`);

    if (req.method === 'OPTIONS') {
      console.log(`[${requestId}] Handling OPTIONS request`);
      return jsonResponse({ success: true }, 200);
    }

    if (req.method !== 'POST') {
      console.warn(`[${requestId}] Method not allowed: ${req.method}`);
      return jsonResponse({ error: 'Method not allowed' }, 405);
    }

    // SECURITY: Simple secret key check via URL parameter
    const url = new URL(req.url);
    const providedSecret = url.searchParams.get('secret');
    const expectedSecret = Deno.env.get('WEBHOOK_SECRET');

    if (!expectedSecret) {
      console.error(`[${requestId}] WEBHOOK_SECRET not configured in environment`);
      return jsonResponse({ error: 'Server configuration error' }, 500);
    }

    if (providedSecret !== expectedSecret) {
      console.warn(`[${requestId}] Unauthorized: Invalid or missing secret parameter`);
      return jsonResponse({ error: 'Unauthorized', message: 'Invalid or missing secret' }, 401);
    }

    console.log(`[${requestId}] ✓ Secret validated successfully`);

    // Get environment configuration
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error(`[${requestId}] Missing required Supabase environment variables`);
      return jsonResponse({ error: 'Server configuration error' }, 500);
    }

    // Read request body
    let rawBody = '';
    try {
      rawBody = await req.text();
      console.log(`[${requestId}] Raw body length: ${rawBody.length} bytes`);
    } catch (err) {
      console.error(`[${requestId}] Failed to read request body:`, err);
      return jsonResponse({ error: 'Bad request body', details: String(err) }, 400);
    }

    // Parse JSON payload
    let payload;
    try {
      payload = JSON.parse(rawBody);
      console.log(`[${requestId}] Parsed JSON payload successfully`);
    } catch (err) {
      console.error(`[${requestId}] Invalid JSON payload:`, err);
      return jsonResponse({ error: 'Invalid JSON payload' }, 400);
    }

    console.log(`[${requestId}] Full payload:`, JSON.stringify(payload, null, 2));

    // Extract webhook data
    const eventId = extractString(payload, ['event_id', 'eventId', 'id', 'meta.event_id', 'meta.eventId']);
    const eventType = normalizeEventType(payload);
    const contact = extractContact(payload);
    const productId = extractProductId(payload);
    const tagSet = extractTags(payload);

    console.log(`[${requestId}] Extracted data:`, {
      eventId,
      eventType,
      productId,
      contactEmail: contact.email,
      contactName: contact.name,
      tags: Array.from(tagSet)
    });

    // Validate contact email
    if (!contact.email) {
      console.warn(`[${requestId}] No contact email in webhook payload`);
      return jsonResponse({
        success: false,
        message: 'Webhook ignored: contact email is required',
        eventId,
        requestId
      }, 202);
    }

    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });

    // Parse product ID lists from environment
    const proProductIds = parseEnvList(Deno.env.get('GHL_PRO_PRODUCT_IDS'));
    const trialProductIds = parseEnvList(Deno.env.get('GHL_TRIAL_PRODUCT_IDS'));

    console.log(`[${requestId}] Config - Pro Product IDs: ${Array.from(proProductIds).join(', ') || 'NONE'}`);
    console.log(`[${requestId}] Config - Trial Product IDs: ${Array.from(trialProductIds).join(', ') || 'NONE'}`);

    // Determine what action to take
    const action = determineLifecycleAction({
      eventType,
      productId,
      tags: tagSet,
      proProductIds,
      trialProductIds,
      contact
    });

    console.log(`[${requestId}] Determined action: ${action.type} - ${action.reason}`);

    if (action.type === 'ignore') {
      console.log(`[${requestId}] Webhook ignored: ${action.reason}`);
      return jsonResponse({
        success: true,
        action: action.type,
        reason: action.reason,
        eventId,
        requestId
      });
    }

    // Execute the determined action
    let result = {};

    try {
      switch (action.type) {
        case 'pro_purchase':
        case 'trial_signup': {
          const desiredRole = action.type === 'pro_purchase' ? 'pro' : 'user';
          const defaultInitialCredits = parseInt(Deno.env.get('DEFAULT_INITIAL_CREDITS') || '1000');
          const defaultMonthlyCredits = parseInt(Deno.env.get('DEFAULT_MONTHLY_CREDITS') || '1000');

          console.log(`[${requestId}] Executing ${action.type} with role: ${desiredRole}`);
          result = await ensureAccount({
            supabase,
            email: contact.email,
            fullName: contact.name,
            ghlContactId: contact.id,
            desiredRole,
            activate: true,
            sendInvite: true,
            initialCredits: defaultInitialCredits,
            monthlyCredits: defaultMonthlyCredits,
            requestId
          });
          break;
        }

        case 'payment_failed':
        case 'cancellation': {
          const message = action.type === 'payment_failed'
            ? "Oops! Looks like your account took a little nap—payment didn't go through.\n\nYou can reach out to support@aifreelancer.com for help"
            : "Looks like you canceled your subscription—but hey, we all make mistakes.\n\nIf you're ready to come back, reach out to support@aifreelancer.com for help";

          console.log(`[${requestId}] Executing ${action.type} - Deactivating account`);
          result = await updateActiveStatus({
            supabase,
            email: contact.email,
            active: false,
            disabledMessage: message,
            ghlContactId: contact.id,
            requestId
          });
          break;
        }

        case 'payment_recovered': {
          console.log(`[${requestId}] Executing payment_recovered - Reactivating account`);
          result = await updateActiveStatus({
            supabase,
            email: contact.email,
            active: true,
            disabledMessage: null,
            ghlContactId: contact.id,
            requestId
          });
          break;
        }

        case 'user_update': {
          console.log(`[${requestId}] Executing user_update - Updating user data`);
          result = await ensureAccount({
            supabase,
            email: contact.email,
            fullName: contact.name,
            ghlContactId: contact.id,
            desiredRole: 'user',
            activate: true,
            sendInvite: false,
            requestId
          });
          break;
        }
      }

      const duration = Date.now() - startTime;
      console.log(`[${requestId}] ✓ Webhook processed successfully in ${duration}ms`);

      return jsonResponse({
        success: true,
        action: action.type,
        reason: action.reason,
        result,
        eventId,
        requestId
      });

    } catch (error) {
      console.error(`[${requestId}] ✗ Failed processing webhook action:`, {
        eventId,
        action: action.type,
        error: error.message,
        stack: error.stack
      });

      return jsonResponse({
        error: 'Internal server error',
        message: error.message,
        eventId,
        requestId
      }, 500);
    }

  } catch (error) {
    console.error(`[${requestId}] ✗ Unhandled error:`, {
      error: error.message,
      stack: error.stack
    });

    return jsonResponse({
      error: 'Internal server error',
      message: error.message,
      requestId
    }, 500);
  } finally {
    const duration = Date.now() - startTime;
    console.log(`[${requestId}] Request completed in ${duration}ms`);
  }
});

/* ========================================
   ACCOUNT MANAGEMENT FUNCTIONS
   ======================================== */

async function ensureAccount({
  supabase,
  email,
  fullName,
  ghlContactId,
  desiredRole = 'user',
  activate = true,
  sendInvite = false,
  initialCredits = 1000,
  monthlyCredits = 1000,
  requestId
}) {
  console.log(`[${requestId}][ensureAccount] Starting:`, {
    email,
    fullName,
    ghlContactId,
    desiredRole,
    activate,
    sendInvite
  });

  // Fetch user by email using listUsers
  const { data, error: fetchError } = await supabase.auth.admin.listUsers({
    email: email,
    page: 1,
    perPage: 1
  });

  if (fetchError) {
    console.error(`[${requestId}][ensureAccount] Error fetching user:`, fetchError);
    throw fetchError;
  }

  const users = data?.users || [];
  const existingUser = users.length > 0 ? users[0] : null;

  let userId = existingUser?.id;
  let createdNewUser = false;
  let existingUserRole = existingUser?.user_metadata?.role || null;
  let userMetadata = existingUser?.user_metadata || {};

  console.log(`[${requestId}][ensureAccount] Existing user:`, userId ? 'Found' : 'Not found');

  // Create user if doesn't exist
  if (!userId) {
    console.log(`[${requestId}][ensureAccount] Creating new user`);

    const metadata = {
      full_name: fullName,
      role_hint: desiredRole,
      ghl_contact_id: ghlContactId
    };

    const { data: createData, error: createError } = await supabase.auth.admin.createUser({
      email,
      email_confirm: false,
      user_metadata: metadata
    });

    if (createError) {
      if (createError.message?.includes('already registered')) {
        console.log(`[${requestId}][ensureAccount] User already exists, retrying fetch`);
        const { data: retryData, error: retryError } = await supabase.auth.admin.listUsers({
          email: email,
          page: 1,
          perPage: 1
        });

        if (retryError) throw retryError;

        const retryUser = retryData?.users?.[0] || null;
        if (!retryUser) {
          console.error(`[${requestId}][ensureAccount] Create failed (user exists) but retry fetch failed`);
          throw createError; // Throw original error
        }

        userId = retryUser.id;
        existingUserRole = retryUser.user_metadata?.role || null;
        userMetadata = retryUser.user_metadata || {};
      } else {
        throw createError;
      }
    } else {
      userId = createData.user?.id;
      createdNewUser = true;
      userMetadata = createData.user?.user_metadata || metadata;
      console.log(`[${requestId}][ensureAccount] User created successfully:`, userId);
    }
  }

  if (!userId) {
    throw new Error('Unable to resolve Supabase user id');
  }

  // Update user metadata if existing user
  if (!createdNewUser) {
    console.log(`[${requestId}][ensureAccount] Updating existing user metadata`);

    const nextMetadata = { ...userMetadata };
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
        console.error(`[${requestId}][ensureAccount] Failed to update metadata:`, updateMetadataError);
      } else {
        console.log(`[${requestId}][ensureAccount] Metadata updated successfully`);
        userMetadata = nextMetadata;
      }
    }
  }

  // Fetch existing profile
  console.log(`[${requestId}][ensureAccount] Fetching user profile`);
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('role, preferences, full_name, active')
    .eq('id', userId)
    .maybeSingle();

  if (profileError && profileError.code !== 'PGRST116') {
    console.warn(`[${requestId}][ensureAccount] Profile fetch error:`, profileError);
  }

  // Determine final role (preserve higher priority role)
  const nextRole = resolveRoleUpgrade({
    currentRole: profile?.role || existingUserRole || 'user',
    desiredRole
  });

  console.log(`[${requestId}][ensureAccount] Role resolution:`, {
    currentRole: profile?.role || existingUserRole || 'user',
    desiredRole,
    nextRole
  });

  // Merge preferences with credits and GHL contact ID
  const preferences = mergePreferences(
    profile?.preferences,
    ghlContactId,
    createdNewUser ? initialCredits : null,
    createdNewUser ? monthlyCredits : null
  );

  console.log(`[${requestId}][ensureAccount] Merged preferences:`, preferences);

  // Upsert profile
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

  console.log(`[${requestId}][ensureAccount] Upserting profile`);
  const { error: upsertError } = await supabase
    .from('user_profiles')
    .upsert(updates, { onConflict: 'id' });

  if (upsertError) {
    console.error(`[${requestId}][ensureAccount] Profile upsert error:`, upsertError);
    throw upsertError;
  }

  console.log(`[${requestId}][ensureAccount] Profile upserted successfully`);

  // Send invitation email for new users
  if (sendInvite && createdNewUser) {
    console.log(`[${requestId}][ensureAccount] Sending invitation email`);

    const inviteOptions = {
      data: {
        full_name: fullName,
        role_hint: desiredRole
      }
    };

    const redirectTo = Deno.env.get('APP_LOGIN_URL');
    if (redirectTo) {
      inviteOptions.redirectTo = redirectTo;
    }

    const { error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email, inviteOptions);

    if (inviteError) {
      console.error(`[${requestId}][ensureAccount] Failed to send invitation:`, inviteError);
    } else {
      console.log(`[${requestId}][ensureAccount] Invitation sent successfully`);
    }
  }

  const result = {
    userId,
    createdNewUser,
    updatedRole: nextRole,
    active: activate,
    initialCredits: createdNewUser ? initialCredits : null,
    monthlyCredits: createdNewUser ? monthlyCredits : null
  };

  console.log(`[${requestId}][ensureAccount] Completed:`, result);
  return result;
}

async function updateActiveStatus({
  supabase,
  email,
  active = false,
  disabledMessage = null,
  ghlContactId = null,
  requestId
}) {
  console.log(`[${requestId}][updateActiveStatus] Starting:`, {
    email,
    active,
    disabledMessage: disabledMessage ? 'SET' : 'NOT SET',
    ghlContactId
  });

  // Fetch user by email using listUsers
  const { data, error: fetchError } = await supabase.auth.admin.listUsers({
    email: email,
    page: 1,
    perPage: 1
  });

  if (fetchError) {
    console.error(`[${requestId}][updateActiveStatus] Error fetching user:`, fetchError);
    throw fetchError;
  }

  const users = data?.users || [];
  const existingUser = users.length > 0 ? users[0] : null;
  const userId = existingUser?.id;

  if (!userId) {
    console.log(`[${requestId}][updateActiveStatus] User not found, skipping`);
    return { skipped: true, reason: 'User not found by email' };
  }

  console.log(`[${requestId}][updateActiveStatus] Found user:`, userId);

  // Fetch existing profile
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('role, active, preferences')
    .eq('id', userId)
    .maybeSingle();

  if (profileError && profileError.code !== 'PGRST116') {
    console.warn(`[${requestId}][updateActiveStatus] Profile fetch error:`, profileError);
  }

  // Check if update is needed
  const existingContactId = getContactIdFromPreferences(profile?.preferences);
  const existingDisabledMessage = getDisabledMessageFromPreferences(profile?.preferences);
  const shouldUpdateContactId = Boolean(ghlContactId && ghlContactId !== existingContactId);
Next-token:   const shouldUpdateMessage = disabledMessage !== existingDisabledMessage;

  console.log(`[${requestId}][updateActiveStatus] Update check:`, {
    currentActive: profile?.active,
    desiredActive: active,
    needsUpdate: profile?.active !== active || shouldUpdateContactId || shouldUpdateMessage
  });

  if (profile?.active === active && !shouldUpdateContactId && !shouldUpdateMessage) {
    console.log(`[${requestId}][updateActiveStatus] No changes needed`);
    return { skipped: true, reason: 'No changes needed' };
  }

  // Merge preferences with new data
  const preferences = mergePreferences(
    profile?.preferences,
    ghlContactId,
    null,
    null,
    disabledMessage
  );

  console.log(`[${requestId}][updateActiveStatus] Updated preferences`);

  // Update profile
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

  console.log(`[${requestId}][updateActiveStatus] Upserting profile`);
  const { error: upsertError } = await supabase
  .from('user_profiles')
    .upsert(updates, { onConflict: 'id' });

  if (upsertError) {
    console.error(`[${requestId}][updateActiveStatus] Profile upsert error:`, upsertError);
    throw upsertError;
  }

  // Update user metadata if GHL contact ID provided
  if (ghlContactId) {
    const currentMetadata = existingUser?.user_metadata || {};

    if (currentMetadata.ghl_contact_id !== ghlContactId) {
      const { error: authError } = await supabase.auth.admin.updateUserById(userId, {
        user_metadata: { ...currentMetadata, ghl_contact_id: ghlContactId }
      });

      if (authError) {
        console.warn(`[${requestId}][updateActiveStatus] Failed to update auth metadata:`, authError);
      }
    }
  }

  const result = {
    userId,
    updatedActive: active,
    disabledMessage: disabledMessage || null
  };

  console.log(`[${requestId}][updateActiveStatus] Completed:`, result);
  return result;
}

/* ========================================
   HELPER FUNCTIONS
   ======================================== */

function resolveRoleUpgrade({ currentRole = 'user', desiredRole = 'user' }) {
  const currentPriority = ROLE_PRIORITY[currentRole] || 1;
  const desiredPriority = ROLE_PRIORITY[desiredRole] || 1;
  return desiredPriority > currentPriority ? desiredRole : currentRole;
}

function mergePreferences(
  existing,
  ghlContactId = null,
  initialCredits = null,
  monthlyCredits = null,
  disabledMessage = null
) {
  const preferences = existing && typeof existing === 'object' ? { ...existing } : {};

  if (ghlContactId) {
    preferences.ghl_contact_id = ghlContactId;
  }

  if (initialCredits !== null) {
    preferences.initial_credits = initialCredits;
  }

  if (monthlyCredits !== null) {
    preferences.monthly_credits = monthlyCredits;
  }

  if (disabledMessage !== null) {
    if (disabledMessage) {
      preferences.disabled_message = disabledMessage;
    } else {
      delete preferences.disabled_message;
    }
  }

  return Object.keys(preferences).length > 0 ? preferences : null;
}

function getContactIdFromPreferences(preferences) {
  if (preferences && typeof preferences === 'object' && typeof preferences.ghl_contact_id === 'string') {
    return preferences.ghl_contact_id;
  }
  return null;
}

function getDisabledMessageFromPreferences(preferences) {
  if (preferences && typeof preferences === 'object' && typeof preferences.disabled_message === 'string') {
s   return preferences.disabled_message;
  }
  return null;
}

function determineLifecycleAction({ eventType, productId, tags, proProductIds, trialProductIds, contact }) {
  // Check product ID first (most reliable)
  if (productId) {
    if (proProductIds.has(productId)) {
      return { type: 'pro_purchase', reason: `Matched pro product id ${productId}` };
    }
    if (trialProductIds.has(productId)) {
      return { type: 'trial_signup', reason: `Matched trial product id ${productId}` };
    }
  }

  // Check event type
  if (eventType) {
    if (eventType.includes('trial')) {
      return { type: 'trial_signup', reason: `Event type indicates trial: ${eventType}` };
section   }
    if (eventType.includes('payment') && eventType.includes('failed')) {
      return { type: 'payment_failed', reason: `Payment failure: ${eventType}` };
    }
    if (eventType.includes('payment') && (eventType.includes('success') || eventType.includes('paid') || eventType.includes('recovered'))) {
      return { type: 'payment_recovered', reason: `Payment success: ${eventType}` };
    }
    if (eventType.includes('recover') || eventType.includes('reactivat')) {
      return { type: 'payment_recovered', reason: `Account recovery: ${eventType}` };
    }
    if (eventType.includes('cancel')) {
      return { type: 'cancellation', reason: `Cancellation: ${eventType}` };
nbsp;   }
  }

  // Check tags
  if (tags && tags.size > 0) {
    if (Array.from(tags).some(t => t.includes('pro'))) {
      return { type: 'pro_purchase', reason: 'Matched pro tag' };
    }
    if (Array.from(tags).some(t => t.includes('trial'))) {
      return { type: 'trial_signup', reason: 'Matched trial tag' };
    }
  }

  // Fallback to user_update if contact email exists
  if (contact?.email) {
    return { type: 'user_update', reason: 'No specific event matched, defaulting to user update' };
s   }

  return { type: 'ignore', reason: 'No actionable data in webhook' };
}

function parseEnvList(value) {
  if (!value) return new Set();
  return new Set(value.split(',').map(v => v.trim()).filter(v => v.length > 0));
}

function extractString(payload, paths) {
  if (!payload || typeof payload !== 'object') return null;

  for (const path of paths) {
    const segments = path.split('.');
    let current = payload;
    let found = true;

    for (const segment of segments) {
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
  return raw ? raw.toLowerCase() : null;
}

function extractProductId(payload) {
source   return extractString(payload, [
    'product.id',
    'productId',
    'product_id',
    'offer.id',
    'offerId',
    'invoice.product_id',
    'meta.product_id'
  ]);
}

function extractTags(payload) {
  const tags = new Set();
  const candidates = [
    getAny(payload, ['tags']),
    getAny(payload, ['contact', 'tags']),
    getAny(payload, ['contact', 'tagList'])
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;

s   if (Array.isArray(candidate)) {
      for (const value of candidate) {
        if (typeof value === 'string') {
          tags.add(value.toLowerCase());
        }
      }
    } else if (typeof candidate === 'string') {
      candidate.split(',')
        .map(tag => tag.trim().toLowerCase())
        .filter(tag => tag.length > 0)
        .forEach(tag => tags.add(tag));
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

  const fullName = extractString(payload, ['contact.name', 'customer.name']) ||
    [firstName, lastName].filter(Boolean).join(' ').trim() ||
    firstName ||
    lastName;

  return {
    email,
    id,
    name: fullName && fullName.length > 0 ? fullName : null
  };
}

function getAny(payload, path) {
  let current = payload;
  for (const segment of path) {
    if (current && typeof current === 'object' && segment in current) {
      current = current[segment];
    } else {
      return undefined;
    }
  }
  return current;
}

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json'
    }
  });
} 