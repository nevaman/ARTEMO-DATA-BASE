import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type ProvisioningEvent =
  | 'pro_subscription_purchase'
  | 'trial_started'
  | 'payment_failed'
  | 'payment_recovered'
  | 'subscription_cancelled';

interface ProvisioningPayload {
  email: string;
  fullName?: string;
  event: ProvisioningEvent;
  metadata?: Record<string, unknown>;
}

type BanAction = 'ban' | 'unban' | 'none';

interface ProvisioningRule {
  role?: 'user' | 'pro';
  active: boolean;
  createIfMissing?: boolean;
  banAction: BanAction;
}

const EVENT_RULES: Record<ProvisioningEvent, ProvisioningRule> = {
  pro_subscription_purchase: {
    role: 'pro',
    active: true,
    createIfMissing: true,
    banAction: 'unban',
  },
  trial_started: {
    role: 'pro',
    active: true,
    createIfMissing: true,
    banAction: 'unban',
  },
  payment_failed: {
    active: false,
    createIfMissing: false,
    banAction: 'ban',
  },
  payment_recovered: {
    role: 'pro',
    active: true,
    createIfMissing: false,
    banAction: 'unban',
  },
  subscription_cancelled: {
    active: false,
    createIfMissing: false,
    banAction: 'ban',
  },
};

type SupabaseClient = ReturnType<typeof createClient>;

Deno.serve(async (req: Request) => {
  const requestId = crypto.randomUUID();
  console.log(`[${requestId}] Incoming request: ${req.method} ${req.url}`);

  if (req.method === 'OPTIONS') {
    console.log(`[${requestId}] CORS preflight request handled`);
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    console.warn(`[${requestId}] Invalid method: ${req.method}`);
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const webhookSecret = Deno.env.get('MAKE_WEBHOOK_SECRET')?.trim();

  console.log(`[${requestId}] Environment check:`, {
    hasSupabaseUrl: !!supabaseUrl,
    hasServiceKey: !!supabaseServiceKey,
    hasWebhookSecret: !!webhookSecret,
  });

  if (!supabaseUrl || !supabaseServiceKey || !webhookSecret) {
    console.error(`[${requestId}] Missing required environment variables for make-webhook-handler`);
    return jsonResponse({ error: 'Server configuration error' }, 500);
  }

  const authHeader = req.headers.get('authorization');
  console.log(`[${requestId}] Authorization header present:`, !!authHeader);

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.warn(`[${requestId}] Missing or invalid Authorization header format`);
    return jsonResponse({
      error: 'Unauthorized: Bearer token missing',
      hint: 'Include "Authorization: Bearer <MAKE_WEBHOOK_SECRET>" header'
    }, 401);
  }

  const incomingToken = authHeader.slice('Bearer '.length).trim();
  console.log(`[${requestId}] Token received (length: ${incomingToken.length}), expected (length: ${webhookSecret.length})`);

  if (!safeEquals(incomingToken, webhookSecret)) {
    console.warn(`[${requestId}] Rejected request due to invalid bearer token`);
    return jsonResponse({
      error: 'Unauthorized',
      hint: 'Bearer token does not match MAKE_WEBHOOK_SECRET'
    }, 401);
  }

  console.log(`[${requestId}] Authentication successful`);

  let payload: ProvisioningPayload;
  try {
    payload = await req.json();
    console.log(`[${requestId}] Payload parsed:`, JSON.stringify(payload));
  } catch (error) {
    console.error(`[${requestId}] Failed to parse webhook payload:`, error);
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const normalizedEmail = payload.email?.toLowerCase().trim();
  if (!normalizedEmail) {
    console.warn(`[${requestId}] Missing email in payload`);
    return jsonResponse({ error: 'Email is required' }, 400);
  }

  console.log(`[${requestId}] Processing event: ${payload.event} for ${normalizedEmail}`);

  const rule = EVENT_RULES[payload.event];
  if (!rule) {
    console.error(`[${requestId}] Unsupported event type: ${payload.event}`);
    return jsonResponse({
      error: `Unsupported event: ${payload.event}`,
      supportedEvents: Object.keys(EVENT_RULES)
    }, 400);
  }

  console.log(`[${requestId}] Event rule:`, rule);

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log(`[${requestId}] Looking up user in Auth by email: ${normalizedEmail}`);

  const adminList = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1,
    email: normalizedEmail,
  });

  console.log(`[${requestId}] Auth lookup result:`, {
    found: !!adminList.data?.users?.[0],
    error: adminList.error?.message,
  });

  let user = adminList.data?.users?.[0];
  if (!user && rule.createIfMissing) {
    console.log(`[${requestId}] Creating new user in Auth: ${normalizedEmail}`);
    const createResult = await supabase.auth.admin.createUser({
      email: normalizedEmail,
      email_confirm: true,
      user_metadata: {
        full_name: payload.fullName?.trim() || undefined,
      },
    });

    if (createResult.error) {
      console.error(`[${requestId}] Failed to create user:`, createResult.error);
      return jsonResponse({
        error: 'Failed to create user',
        details: createResult.error.message
      }, 500);
    }

    user = createResult.data.user ?? undefined;
    console.log(`[${requestId}] User created successfully: ${user?.id}`);
  }

  if (!user) {
    console.warn(`[${requestId}] No auth user found for ${normalizedEmail}; event=${payload.event}`);
    return jsonResponse(
      { status: 'accepted', message: 'User not found; no changes applied' },
      202,
    );
  }

  console.log(`[${requestId}] Processing user: ${user.id}`);

  console.log(`[${requestId}] Fetching user profile from database`);

  const { data: existingProfile, error: existingProfileError } = await supabase
    .from('user_profiles')
    .select('full_name, role, active')
    .eq('id', user.id)
    .maybeSingle();

  if (existingProfileError) {
    console.error(`[${requestId}] Failed to fetch existing profile:`, existingProfileError);
    return jsonResponse({ error: 'Database error', details: existingProfileError.message }, 500);
  }

  console.log(`[${requestId}] Existing profile:`, existingProfile || 'none');

  const fullName =
    payload.fullName?.trim() ||
    existingProfile?.full_name ||
    (typeof user.user_metadata?.full_name === 'string'
      ? user.user_metadata.full_name
      : '') ||
    user.email ||
    normalizedEmail;

  const desiredRole =
    rule.role !== undefined
      ? existingProfile?.role === 'admin'
        ? 'admin'
        : rule.role
      : existingProfile?.role || 'user';

  const desiredActive =
    rule.active !== undefined ? rule.active : existingProfile?.active ?? true;

  const profileUpdate = {
    id: user.id,
    full_name: fullName,
    role: desiredRole,
    active: desiredActive,
    status_updated_by: null,
    status_updated_at: new Date().toISOString(),
  };

  console.log(`[${requestId}] Upserting user profile:`, profileUpdate);

  const { error: upsertError } = await supabase.from('user_profiles').upsert(
    profileUpdate,
    { onConflict: 'id' },
  );

  if (upsertError) {
    console.error(`[${requestId}] Failed to upsert user profile:`, upsertError);
    return jsonResponse({ error: 'Database error', details: upsertError.message }, 500);
  }

  console.log(`[${requestId}] User profile upserted successfully`);

  try {
    console.log(`[${requestId}] Syncing ban status: ${rule.banAction}`);
    await syncBanStatus(supabase, user.id, rule.banAction);
    console.log(`[${requestId}] Ban status synced successfully`);
  } catch (error) {
    console.error(`[${requestId}] Failed to sync ban status in Auth:`, error);
    return jsonResponse({ error: 'Auth sync failed', details: String(error) }, 500);
  }

  console.log(`[${requestId}] Webhook processing completed successfully`);

  return jsonResponse({
    status: 'ok',
    userId: user.id,
    email: normalizedEmail,
    event: payload.event,
    role: desiredRole,
    active: desiredActive,
  });
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function safeEquals(a: string, b: string) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

async function syncBanStatus(client: SupabaseClient, userId: string, action: BanAction) {
  if (action === 'ban') {
    await client.auth.admin.updateUserById(userId, { ban_duration: 'none' });
  } else if (action === 'unban') {
    await client.auth.admin.updateUserById(userId, { ban_duration: '0' });
  }
}
