import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { timingSafeEqual } from 'https://deno.land/std@0.224.0/crypto/timing_safe_equal.ts';

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
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type LifecycleAction =
  | { type: 'pro_purchase'; reason: string }
  | { type: 'trial_signup'; reason: string }
  | { type: 'payment_failed'; reason: string }
  | { type: 'payment_recovered'; reason: string }
  | { type: 'cancellation'; reason: string }
  | { type: 'ignore'; reason: string };

type Role = 'user' | 'pro' | 'admin';

const ROLE_PRIORITY: Record<Role, number> = {
  user: 1,
  pro: 2,
  admin: 3,
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const webhookSecret = Deno.env.get('GHL_WEBHOOK_SECRET');

  if (!supabaseUrl || !supabaseServiceKey || !webhookSecret) {
    console.error('Missing required environment variables for Supabase or webhook secret.');
    return new Response(
      JSON.stringify({ error: 'Server configuration error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }

// This is the NEW Public Key verification block
  const rawBody = await req.text();
  const signatureHeader = req.headers.get('x-wh-signature'); // Use the correct header name

  if (!signatureHeader) {
    console.warn('Request rejected: Missing x-wh-signature header.');
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  const signatureValid = await verifySignature(rawBody, signatureHeader, GHL_PUBLIC_KEY_PEM);
  if (!signatureValid) {
    console.warn('Signature verification failed.');
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch (error) {
    console.error('Invalid JSON payload received from GHL.', error);
    return new Response(
      JSON.stringify({ error: 'Invalid JSON payload' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  const eventId = extractString(payload, [
    'event_id',
    'eventId',
    'id',
    'meta.event_id',
    'meta.eventId',
  ]);
  const eventType = normalizeEventType(payload);
  const contact = extractContact(payload);
  const productId = extractProductId(payload);
  const tagSet = extractTags(payload);

  console.log('Processing GHL webhook', { eventId, eventType, productId, tags: Array.from(tagSet) });

  if (!contact.email) {
    console.warn('Webhook payload missing contact email. Cannot reconcile user.');
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Webhook ignored: contact email is required.',
        eventId,
      }),
      { status: 202, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const proProductIds = parseEnvList(Deno.env.get('GHL_PRO_PRODUCT_IDS'));
  const trialProductIds = parseEnvList(Deno.env.get('GHL_TRIAL_PRODUCT_IDS'));

  const action = determineLifecycleAction({
    eventType,
    productId,
    tags: tagSet,
    proProductIds,
    trialProductIds,
  });

  if (action.type === 'ignore') {
    console.log('Webhook ignored', { reason: action.reason, eventId });
    return new Response(
      JSON.stringify({
        success: true,
        action: action.type,
        reason: action.reason,
        eventId,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  try {
    let result: Record<string, unknown> = {};
    switch (action.type) {
      case 'pro_purchase':
      case 'trial_signup': {
        const desiredRole: Role = action.type === 'pro_purchase' ? 'pro' : 'user';
        result = await ensureAccount({
          supabase,
          email: contact.email,
          fullName: contact.name,
          ghlContactId: contact.id,
          desiredRole,
          activate: true,
          sendInvite: true,
        });
        break;
      }
      case 'payment_failed': {
        result = await updateActiveStatus({
          supabase,
          email: contact.email,
          active: false,
          ghlContactId: contact.id,
        });
        break;
      }
      case 'payment_recovered': {
        result = await updateActiveStatus({
          supabase,
          email: contact.email,
          active: true,
          ghlContactId: contact.id,
        });
        break;
      }
      case 'cancellation': {
        result = await updateActiveStatus({
          supabase,
          email: contact.email,
          active: false,
          ghlContactId: contact.id,
        });
        break;
      }
    }

    console.log('Webhook processed successfully', { eventId, action: action.type, result });

    return new Response(
      JSON.stringify({
        success: true,
        action: action.type,
        reason: action.reason,
        result,
        eventId,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('Failed processing webhook action', { eventId, action: action.type, error });
    return new Response(
      JSON.stringify({ error: 'Internal server error', eventId }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});

async function verifySignature(body: string, signature: string, secret: string): Promise<boolean> {
  try {
    const cleaned = signature.replace(/^sha256=/i, '').trim();
    const providedBytes = parseSignatureBytes(cleaned);
    if (!providedBytes) {
      return false;
    }

    const expectedBytes = await computeHmac(body, secret);
    if (providedBytes.length !== expectedBytes.length) {
      return false;
    }

    return timingSafeEqual(providedBytes, expectedBytes);
  } catch (error) {
    console.error('Error verifying webhook signature', error);
    return false;
  }
}

async function computeHmac(body: string, secret: string): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
  return new Uint8Array(signature);
}

function hexToBytes(hex: string): Uint8Array {
  const normalized = hex.toLowerCase();
  const bytes = new Uint8Array(normalized.length / 2);
  for (let i = 0; i < normalized.length; i += 2) {
    bytes[i / 2] = parseInt(normalized.slice(i, i + 2), 16);
  }
  return bytes;
}

function base64ToBytes(base64: string): Uint8Array {
  const cleaned = base64
    .replace(/\s+/g, '')
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const padding = cleaned.length % 4;
  const padded = padding === 0 ? cleaned : cleaned + '='.repeat(4 - padding);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function parseSignatureBytes(signature: string): Uint8Array | null {
  if (/^[0-9a-f]+$/i.test(signature) && signature.length % 2 === 0) {
    return hexToBytes(signature);
  }

  try {
    return base64ToBytes(signature);
  } catch (_error) {
    console.error('Failed to parse signature as base64 or hex');
    return null;
  }
}

function parseEnvList(value: string | null): Set<string> {
  if (!value) return new Set();
  return new Set(
    value
      .split(',')
      .map((v) => v.trim())
      .filter((v) => v.length > 0),
  );
}

function extractString(payload: any, paths: string[]): string | null {
  for (const path of paths) {
    const segments = path.split('.');
    let current: any = payload;
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

function normalizeEventType(payload: any): string | null {
  const raw = extractString(payload, [
    'event',
    'event_type',
    'eventType',
    'type',
    'eventName',
    'meta.event',
    'meta.type',
  ]);
  if (!raw) return null;
  return raw.toLowerCase();
}

function extractProductId(payload: any): string | null {
  return (
    extractString(payload, [
      'product.id',
      'productId',
      'product_id',
      'offer.id',
      'offerId',
      'invoice.product_id',
      'meta.product_id',
    ]) || null
  );
}

function extractTags(payload: any): Set<string> {
  const tags = new Set<string>();
  const candidates = [
    getAny(payload, ['tags']),
    getAny(payload, ['contact', 'tags']),
    getAny(payload, ['contact', 'tagList']),
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    if (Array.isArray(candidate)) {
      for (const value of candidate) {
        if (typeof value === 'string') {
          tags.add(value.toLowerCase());
        }
      }
    } else if (typeof candidate === 'string') {
      candidate
        .split(',')
        .map((tag) => tag.trim().toLowerCase())
        .filter((tag) => tag.length > 0)
        .forEach((tag) => tags.add(tag));
    }
  }
  return tags;
}

function extractContact(payload: any): { email: string | null; id: string | null; name: string | null } {
  const email = extractString(payload, [
    'contact.email',
    'email',
    'customer.email',
    'payload.email',
  ]);
  const id = extractString(payload, [
    'contact.id',
    'contactId',
    'customer.id',
    'customerId',
  ]);
  const firstName = extractString(payload, [
    'contact.first_name',
    'contact.firstName',
    'customer.first_name',
    'customer.firstName',
    'first_name',
    'firstName',
  ]);
  const lastName = extractString(payload, [
    'contact.last_name',
    'contact.lastName',
    'customer.last_name',
    'customer.lastName',
    'last_name',
    'lastName',
  ]);
  const fullName = extractString(payload, ['contact.name', 'customer.name']) ||
    [firstName, lastName].filter(Boolean).join(' ').trim() ||
    firstName ||
    lastName;

  return {
    email,
    id,
    name: fullName && fullName.length > 0 ? fullName : null,
  };
}

function getAny(payload: any, path: string[]): any {
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

function determineLifecycleAction({
  eventType,
  productId,
  tags,
  proProductIds,
  trialProductIds,
}: {
  eventType: string | null;
  productId: string | null;
  tags: Set<string>;
  proProductIds: Set<string>;
  trialProductIds: Set<string>;
}): LifecycleAction {
  if (!eventType && !productId) {
    return { type: 'ignore', reason: 'No actionable event type or product id provided.' };
  }

  if (productId) {
    if (proProductIds.has(productId)) {
      return { type: 'pro_purchase', reason: `Matched pro product id ${productId}` };
    }
    if (trialProductIds.has(productId)) {
      return { type: 'trial_signup', reason: `Matched trial product id ${productId}` };
    }
  }

  if (eventType) {
    if (eventType.includes('trial')) {
      return { type: 'trial_signup', reason: `Event type indicates trial lifecycle: ${eventType}` };
    }

    if (eventType.includes('payment') && eventType.includes('failed')) {
      return { type: 'payment_failed', reason: `Payment failure event: ${eventType}` };
    }

    if (eventType.includes('payment') && (eventType.includes('success') || eventType.includes('paid') || eventType.includes('recovered'))) {
      if (eventType.includes('recovered')) {
        return { type: 'payment_recovered', reason: `Payment recovered event: ${eventType}` };
      }
      return { type: 'payment_recovered', reason: `Payment success event without specific product match: ${eventType}` };
    }

    if (eventType.includes('recover') || eventType.includes('reactivat')) {
      return { type: 'payment_recovered', reason: `Account recovery event: ${eventType}` };
    }

    if (eventType.includes('cancel')) {
      return { type: 'cancellation', reason: `Cancellation event: ${eventType}` };
    }
  }

  if (tags.size > 0) {
    if (Array.from(tags).some((tag) => tag.includes('pro'))) {
      return { type: 'pro_purchase', reason: 'Matched pro tag from contact.' };
    }
    if (Array.from(tags).some((tag) => tag.includes('trial'))) {
      return { type: 'trial_signup', reason: 'Matched trial tag from contact.' };
    }
  }

  return { type: 'ignore', reason: 'No lifecycle transition rules matched.' };
}

async function ensureAccount({
  supabase,
  email,
  fullName,
  ghlContactId,
  desiredRole,
  activate,
  sendInvite,
}: {
  supabase: ReturnType<typeof createClient>;
  email: string;
  fullName: string | null;
  ghlContactId: string | null;
  desiredRole: Role;
  activate: boolean;
  sendInvite: boolean;
}): Promise<Record<string, unknown>> {
  const metadata: Record<string, unknown> = {};
  if (fullName) {
    metadata.full_name = fullName;
  }
  if (desiredRole) {
    metadata.role_hint = desiredRole;
  }
  if (ghlContactId) {
    metadata.ghl_contact_id = ghlContactId;
  }

  let userId: string | null = null;
  let createdNewUser = false;
  let existingUserRole: Role | null = null;
  let userMetadata: Record<string, unknown> = {};

  const { data: existingUserResponse, error: fetchError } = await supabase.auth.admin.getUserByEmail(email);
  if (fetchError && fetchError.message && !fetchError.message.includes('User not found')) {
    throw fetchError;
  }

  if (existingUserResponse?.user) {
    userId = existingUserResponse.user.id;
    existingUserRole = (existingUserResponse.user.user_metadata?.role as Role) || null;
    userMetadata = { ...(existingUserResponse.user.user_metadata ?? {}) };
  }

  if (!userId) {
    const { data: createData, error: createError } = await supabase.auth.admin.createUser({
      email,
      email_confirm: false,
      user_metadata: metadata,
    });

    if (createError) {
      if (createError.message?.includes('already registered')) {
        const { data: retryUser, error: retryError } = await supabase.auth.admin.getUserByEmail(email);
        if (retryError) {
          throw retryError;
        }
        userId = retryUser?.user?.id ?? null;
        existingUserRole = (retryUser?.user?.user_metadata?.role as Role) || null;
        userMetadata = { ...(retryUser?.user?.user_metadata ?? {}) };
      } else {
        throw createError;
      }
    } else {
      userId = createData.user?.id ?? null;
      createdNewUser = true;
      userMetadata = { ...(createData.user?.user_metadata ?? metadata) };
    }
  }

  if (!userId) {
    throw new Error('Unable to resolve Supabase user id for webhook contact');
  }

  if (!createdNewUser) {
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
        user_metadata: nextMetadata,
      });
      if (updateMetadataError) {
        console.error('Failed to update user metadata for existing account', updateMetadataError);
      } else {
        userMetadata = nextMetadata;
      }
    }
  }

  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('role, preferences, full_name, active')
    .eq('id', userId)
    .maybeSingle();

  if (profileError && profileError.code !== 'PGRST116') {
    // PGRST116 = Row not found
    console.warn('Error fetching user profile; proceeding with upsert.', profileError);
  }

  const nextRole = resolveRoleUpgrade({
    currentRole: (profile?.role as Role) || existingUserRole || 'user',
    desiredRole,
  });

  const preferences = mergePreferences(profile?.preferences, ghlContactId);

  const updates: Record<string, unknown> = {
    id: userId,
    role: nextRole,
    active: activate,
    updated_at: new Date().toISOString(),
    status_updated_at: new Date().toISOString(),
  };

  if (fullName) {
    updates.full_name = fullName;
  }

  if (preferences) {
    updates.preferences = preferences;
  }

  const { error: upsertError } = await supabase.from('user_profiles').upsert(updates, { onConflict: 'id' });
  if (upsertError) {
    throw upsertError;
  }

  if (sendInvite && createdNewUser) {
    const inviteOptions: { redirectTo?: string; data?: Record<string, unknown> } = {
      data: metadata,
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
    active: activate,
  };
}

async function updateActiveStatus({
  supabase,
  email,
  active,
  ghlContactId,
}: {
  supabase: ReturnType<typeof createClient>;
  email: string;
  active: boolean;
  ghlContactId: string | null;
}): Promise<Record<string, unknown>> {
  const { data: userResponse, error: fetchError } = await supabase.auth.admin.getUserByEmail(email);
  if (fetchError && fetchError.message && !fetchError.message.includes('User not found')) {
    throw fetchError;
  }

  const userId = userResponse?.user?.id;
  if (!userId) {
    return {
      skipped: true,
      reason: 'User not found by email',
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('role, active, preferences')
    .eq('id', userId)
    .maybeSingle();

  if (profileError && profileError.code !== 'PGRST116') {
    console.warn('Error fetching user profile prior to status update', profileError);
  }

  const existingContactId = getContactIdFromPreferences(profile?.preferences);
  const shouldUpdateContactId = Boolean(ghlContactId && ghlContactId !== existingContactId);

  if (profile?.active === active && !shouldUpdateContactId) {
    return {
      skipped: true,
      reason: 'Active status already set',
    };
  }

  const preferences = mergePreferences(profile?.preferences, ghlContactId);

  const updates: Record<string, unknown> = {
    id: userId,
    active,
    role: (profile?.role as Role) || 'user',
    updated_at: new Date().toISOString(),
    status_updated_at: new Date().toISOString(),
  };

  if (preferences) {
    updates.preferences = preferences;
  }

  const { error: upsertError } = await supabase.from('user_profiles').upsert(updates, { onConflict: 'id' });
  if (upsertError) {
    throw upsertError;
  }

  return {
    userId,
    updatedActive: active,
  };
}

function resolveRoleUpgrade({
  currentRole,
  desiredRole,
}: {
  currentRole: Role;
  desiredRole: Role;
}): Role {
  const currentPriority = ROLE_PRIORITY[currentRole];
  const desiredPriority = ROLE_PRIORITY[desiredRole];
  return desiredPriority > currentPriority ? desiredRole : currentRole;
}

function mergePreferences(existing: unknown, ghlContactId: string | null): Record<string, unknown> | null {
  let preferences: Record<string, unknown>;
  if (existing && typeof existing === 'object') {
    preferences = { ...(existing as Record<string, unknown>) };
  } else {
    preferences = {};
  }
  if (ghlContactId) {
    preferences.ghl_contact_id = ghlContactId;
  }
  return Object.keys(preferences).length > 0 ? preferences : null;
}

function getContactIdFromPreferences(preferences: unknown): string | null {
  if (preferences && typeof preferences === 'object') {
    const value = (preferences as Record<string, unknown>).ghl_contact_id;
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
  }
  return null;
}
