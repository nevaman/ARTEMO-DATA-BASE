import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-wh-signature, x-gohighlevel-signature, x-hl-signature, x-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type Role = 'user' | 'pro' | 'admin';

const ROLE_PRIORITY: Record<Role, number> = {
  user: 1,
  pro: 2,
  admin: 3,
};

type LifecycleAction =
  | { type: 'ensure_role'; role: Role; activate: boolean; sendInvite: boolean; reason: string }
  | { type: 'set_active'; active: boolean; reason: string }
  | { type: 'ignore'; reason: string };

interface PlanRuleMatchers {
  productIds?: string[];
  eventTypes?: string[];
  tags?: string[];
}

interface PlanRuleOutcome {
  role: Role;
  active?: boolean;
  sendInvite?: boolean;
}

interface PlanRule {
  id: string;
  description?: string;
  matchers: PlanRuleMatchers;
  outcome: PlanRuleOutcome;
}

const FALLBACK_GHL_PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
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

const publicKeyPem = (Deno.env.get('GHL_PUBLIC_KEY') ?? FALLBACK_GHL_PUBLIC_KEY_PEM).trim();

const defaultPlanRules: PlanRule[] = [];
const planRules = loadPlanRules(Deno.env.get('GHL_PLAN_RULES_JSON'));

const DEFAULT_MAX_AGE_SECONDS = 300;
const parsedMaxAge = Number(Deno.env.get('GHL_SIGNATURE_MAX_AGE_SECONDS'));
const maxSignatureAgeSeconds = Number.isFinite(parsedMaxAge) && parsedMaxAge >= 0 ? parsedMaxAge : DEFAULT_MAX_AGE_SECONDS;

denoServe();

function denoServe() {
  Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey || !publicKeyPem) {
      console.error('Missing Supabase configuration or GHL public key.');
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const rawBody = await req.text();
    const signatureHeader =
      req.headers.get('x-wh-signature') ??
      req.headers.get('x-gohighlevel-signature') ??
      req.headers.get('x-hl-signature') ??
      req.headers.get('x-signature');

    if (!signatureHeader) {
      console.warn('Missing signature header on incoming webhook.');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const signatureValid = await verifyWebhookSignature(rawBody, signatureHeader, publicKeyPem, maxSignatureAgeSeconds);
    if (!signatureValid) {
      console.warn('Signature verification failed.');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch (error) {
      console.error('Invalid JSON payload received from GHL.', error);
      return new Response(JSON.stringify({ error: 'Invalid JSON payload' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const eventId = extractString(payload, ['event_id', 'eventId', 'id', 'meta.event_id', 'meta.eventId']);
    const eventType = normalizeEventType(payload);
    const contact = extractContact(payload);
    const productId = extractProductId(payload);
    const tagSet = extractTags(payload);

    console.log('Processing GHL webhook', {
      eventId,
      eventType,
      productId,
      tags: Array.from(tagSet),
    });

    if (!contact.email) {
      console.warn('Webhook payload missing contact email. Cannot reconcile user.');
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Webhook ignored: contact email is required.',
          eventId,
        }),
        {
          status: 202,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const action = determineLifecycleAction({
      eventType,
      productId,
      tags: tagSet,
      planRules,
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
        case 'ensure_role': {
          result = await ensureAccount({
            supabase,
            email: contact.email,
            fullName: contact.name,
            ghlContactId: contact.id,
            desiredRole: action.role,
            activate: action.activate,
            sendInvite: action.sendInvite,
          });
          break;
        }
        case 'set_active': {
          result = await updateActiveStatus({
            supabase,
            email: contact.email,
            active: action.active,
            ghlContactId: contact.id,
          });
          break;
        }
      }

      console.log('Webhook processed successfully', {
        eventId,
        action: action.type,
        reason: action.reason,
        result,
      });

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
      return new Response(JSON.stringify({ error: 'Internal server error', eventId }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  });
}

async function verifyWebhookSignature(
  body: string,
  signatureHeader: string,
  publicKey: string,
  maxAgeSeconds: number,
): Promise<boolean> {
  try {
    const parsed = parseSignatureHeader(signatureHeader);
    if (!parsed?.signature) {
      return false;
    }

    const key = await importRsaPublicKey(publicKey);
    const signatureBytes = base64ToBytes(parsed.signature);
    const bodyBytes = new TextEncoder().encode(body);

    const verified = await crypto.subtle.verify(
      { name: 'RSASSA-PKCS1-v1_5' },
      key,
      signatureBytes,
      bodyBytes,
    );

    if (!verified) {
      return false;
    }

    if (parsed.timestamp && maxAgeSeconds > 0) {
      const timestampNumber = Number(parsed.timestamp);
      if (!Number.isNaN(timestampNumber)) {
        const timestampMs = parsed.timestamp.length > 10 ? timestampNumber : timestampNumber * 1000;
        const ageMs = Math.abs(Date.now() - timestampMs);
        if (ageMs > maxAgeSeconds * 1000) {
          console.warn('Webhook signature timestamp outside allowable window', {
            ageMillis: ageMs,
          });
          return false;
        }
      }
    }

    return true;
  } catch (error) {
    console.error('Error verifying webhook signature', error);
    return false;
  }
}

async function importRsaPublicKey(pem: string): Promise<CryptoKey> {
  const keyData = pemToArrayBuffer(pem);
  return crypto.subtle.importKey(
    'spki',
    keyData,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  );
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const normalized = pem.replace(/-----(BEGIN|END) PUBLIC KEY-----/g, '').replace(/\s+/g, '');
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function base64ToBytes(base64: string): Uint8Array {
  const cleaned = base64.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
  const padding = cleaned.length % 4;
  const padded = padding === 0 ? cleaned : cleaned + '='.repeat(4 - padding);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function parseSignatureHeader(header: string): { signature: string; timestamp?: string } | null {
  const trimmed = header.trim();
  if (!trimmed) {
    return null;
  }

  if (!trimmed.includes('=')) {
    return { signature: trimmed };
  }

  const parts = trimmed
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  let signature: string | undefined;
  let timestamp: string | undefined;

  for (const part of parts) {
    const [rawKey, rawValue] = part.split('=');
    if (!rawKey || typeof rawValue === 'undefined') {
      continue;
    }
    const key = rawKey.trim().toLowerCase();
    const value = rawValue.trim();
    if (key === 's' || key === 'signature') {
      signature = value;
    } else if (key === 't' || key === 'ts' || key === 'timestamp') {
      timestamp = value;
    }
  }

  if (!signature) {
    return null;
  }

  return { signature, timestamp };
}

function loadPlanRules(raw: string | null): PlanRule[] {
  if (!raw) {
    return defaultPlanRules;
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      console.warn('GHL_PLAN_RULES_JSON must be an array.');
      return defaultPlanRules;
    }

    const rules: PlanRule[] = [];
    parsed.forEach((entry: Record<string, unknown>, index: number) => {
      const id = typeof entry.id === 'string' && entry.id.trim().length > 0 ? entry.id.trim() : `rule-${index}`;
      const matchSource =
        (entry.matchers as Record<string, unknown>) ?? (entry.match as Record<string, unknown>) ?? entry;

      const matchers: PlanRuleMatchers = {};

      const productIds = sanitizeStringArray(
        matchSource.productIds ?? matchSource.product_ids ?? entry.productIds ?? entry.product_ids,
      );
      if (productIds) {
        matchers.productIds = productIds;
      }

      const eventTypes = sanitizeStringArray(
        matchSource.eventTypes ?? matchSource.event_types ?? entry.eventTypes ?? entry.event_types,
        { lowercase: true },
      );
      if (eventTypes) {
        matchers.eventTypes = eventTypes;
      }

      const tags = sanitizeStringArray(matchSource.tags ?? entry.tags, { lowercase: true });
      if (tags) {
        matchers.tags = tags;
      }

      const outcomeSource = (entry.outcome as Record<string, unknown>) ?? entry;
      const roleValue = toRole(outcomeSource.role ?? outcomeSource.planRole ?? outcomeSource.accessLevel);
      if (!roleValue) {
        console.warn('Skipping plan rule without valid role', { id, entry });
        return;
      }

      const activeValue = typeof outcomeSource.active === 'boolean' ? outcomeSource.active : true;
      const sendInviteValue =
        typeof outcomeSource.sendInvite === 'boolean'
          ? outcomeSource.sendInvite
          : typeof outcomeSource.send_invite === 'boolean'
          ? outcomeSource.send_invite
          : undefined;

      rules.push({
        id,
        description:
          typeof entry.description === 'string' && entry.description.trim().length > 0
            ? entry.description.trim()
            : undefined,
        matchers,
        outcome: {
          role: roleValue,
          active: activeValue,
          sendInvite: sendInviteValue,
        },
      });
    });

    return rules;
  } catch (error) {
    console.error('Failed to parse GHL_PLAN_RULES_JSON', error);
    return defaultPlanRules;
  }
}

function sanitizeStringArray(value: unknown, options?: { lowercase?: boolean }): string[] | undefined {
  if (Array.isArray(value)) {
    const normalized = value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
      .map((item) => (options?.lowercase ? item.toLowerCase() : item));
    return normalized.length > 0 ? normalized : undefined;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return undefined;
    }
    return [options?.lowercase ? trimmed.toLowerCase() : trimmed];
  }

  return undefined;
}

function toRole(value: unknown): Role | null {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === 'user' || normalized === 'pro' || normalized === 'admin') {
    return normalized as Role;
  }
  return null;
}

function determineLifecycleAction({
  eventType,
  productId,
  tags,
  planRules: rules,
}: {
  eventType: string | null;
  productId: string | null;
  tags: Set<string>;
  planRules: PlanRule[];
}): LifecycleAction {
  const ruleMatch = matchPlanRules({ eventType, productId, tags, rules });
  if (ruleMatch) {
    return ruleMatch;
  }

  if (!eventType && !productId && tags.size === 0) {
    return { type: 'ignore', reason: 'No actionable event data provided.' };
  }

  if (eventType) {
    if (eventType.includes('payment') && eventType.includes('failed')) {
      return { type: 'set_active', active: false, reason: `Payment failure event: ${eventType}` };
    }

    if (
      eventType.includes('payment') &&
      (eventType.includes('success') || eventType.includes('paid') || eventType.includes('recover'))
    ) {
      return { type: 'set_active', active: true, reason: `Payment success event: ${eventType}` };
    }

    if (eventType.includes('recover') || eventType.includes('reactivat')) {
      return { type: 'set_active', active: true, reason: `Account recovery event: ${eventType}` };
    }

    if (eventType.includes('cancel')) {
      return { type: 'set_active', active: false, reason: `Cancellation event: ${eventType}` };
    }

    if (eventType.includes('trial')) {
      return {
        type: 'ensure_role',
        role: 'user',
        activate: true,
        sendInvite: true,
        reason: `Trial lifecycle event: ${eventType}`,
      };
    }
  }

  if (tags.size > 0) {
    const tagsArray = Array.from(tags);
    if (tagsArray.some((tag) => tag.includes('pro'))) {
      return {
        type: 'ensure_role',
        role: 'pro',
        activate: true,
        sendInvite: true,
        reason: 'Matched pro tag on contact.',
      };
    }

    if (tagsArray.some((tag) => tag.includes('trial'))) {
      return {
        type: 'ensure_role',
        role: 'user',
        activate: true,
        sendInvite: true,
        reason: 'Matched trial tag on contact.',
      };
    }
  }

  if (productId) {
    return {
      type: 'ensure_role',
      role: 'user',
      activate: true,
      sendInvite: true,
      reason: `Defaulted to user role for unmatched product ${productId}`,
    };
  }

  return { type: 'ignore', reason: 'No lifecycle transition rules matched.' };
}

function matchPlanRules({
  eventType,
  productId,
  tags,
  rules,
}: {
  eventType: string | null;
  productId: string | null;
  tags: Set<string>;
  rules: PlanRule[];
}): LifecycleAction | null {
  if (rules.length === 0) {
    return null;
  }

  const normalizedEventType = eventType?.toLowerCase() ?? null;
  const normalizedProductId = productId?.toLowerCase() ?? null;

  for (const rule of rules) {
    const { matchers } = rule;
    let matches = true;

    if (matches && matchers.productIds && matchers.productIds.length > 0) {
      if (!normalizedProductId) {
        matches = false;
      } else {
        matches = matchers.productIds.some((candidate) => candidate.toLowerCase() === normalizedProductId);
      }
    }

    if (matches && matchers.eventTypes && matchers.eventTypes.length > 0) {
      if (!normalizedEventType) {
        matches = false;
      } else {
        matches = matchers.eventTypes.some(
          (candidate) =>
            normalizedEventType === candidate.toLowerCase() || normalizedEventType.includes(candidate.toLowerCase()),
        );
      }
    }

    if (matches && matchers.tags && matchers.tags.length > 0) {
      matches = matchers.tags.some((tag) => tags.has(tag));
    }

    if (matches) {
      const activate = rule.outcome.active ?? true;
      const sendInvite = rule.outcome.sendInvite ?? activate;
      return {
        type: 'ensure_role',
        role: rule.outcome.role,
        activate,
        sendInvite,
        reason: rule.description ? `Rule ${rule.id}: ${rule.description}` : `Rule ${rule.id} matched`,
      };
    }
  }

  return null;
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
  const raw = extractString(payload, ['event', 'event_type', 'eventType', 'type', 'eventName', 'meta.event', 'meta.type']);
  if (!raw) {
    return null;
  }
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
  const candidates = [getAny(payload, ['tags']), getAny(payload, ['contact', 'tags']), getAny(payload, ['contact', 'tagList'])];

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
  const email = extractString(payload, ['contact.email', 'email', 'customer.email', 'payload.email']);
  const id = extractString(payload, ['contact.id', 'contactId', 'customer.id', 'customerId']);
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
  const fullName =
    extractString(payload, ['contact.name', 'customer.name']) ||
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
    console.warn('Error fetching user profile; proceeding with upsert.', profileError);
  }

  const nextRole = resolveRoleUpgrade({
    currentRole: (profile?.role as Role) || existingUserRole || 'user',
    desiredRole,
  });

  const preferences = mergePreferences(profile?.preferences, ghlContactId);

  const nowIso = new Date().toISOString();
  const updates: Record<string, unknown> = {
    id: userId,
    role: nextRole,
    active: activate,
    full_name: fullName ?? profile?.full_name ?? null,
    updated_at: nowIso,
    status_updated_at: nowIso,
  };

  if (preferences) {
    updates.preferences = preferences;
  }

  const { error: upsertError } = await supabase.from('user_profiles').upsert(updates, { onConflict: 'id' });
  if (upsertError) {
    throw upsertError;
  }

  if (sendInvite && createdNewUser) {
    const inviteOptions: { data?: Record<string, unknown>; redirectTo?: string } = {
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
  const nowIso = new Date().toISOString();

  const updates: Record<string, unknown> = {
    id: userId,
    active,
    role: (profile?.role as Role) || 'user',
    updated_at: nowIso,
    status_updated_at: nowIso,
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
