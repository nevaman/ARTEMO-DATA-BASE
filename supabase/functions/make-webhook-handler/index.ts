import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const webhookSecret = Deno.env.get('MAKE_WEBHOOK_SECRET');

  if (!supabaseUrl || !supabaseServiceKey || !webhookSecret) {
    console.error('Missing required environment variables for make-webhook-handler');
    return jsonResponse({ error: 'Server configuration error' }, 500);
  }

  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Unauthorized: Bearer token missing' }, 401);
  }
  const incomingToken = authHeader.slice('Bearer '.length).trim();
  if (!safeEquals(incomingToken, webhookSecret)) {
    console.warn('Rejected request due to invalid bearer token');
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  let payload: ProvisioningPayload;
  try {
    payload = await req.json();
  } catch (error) {
    console.error('Failed to parse webhook payload', error);
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const normalizedEmail = payload.email?.toLowerCase().trim();
  if (!normalizedEmail) {
    return jsonResponse({ error: 'Email is required' }, 400);
  }

  const rule = EVENT_RULES[payload.event];
  if (!rule) {
    return jsonResponse({ error: `Unsupported event: ${payload.event}` }, 400);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const adminList = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1,
    email: normalizedEmail,
  });

  let user = adminList.data?.users?.[0];
  if (!user && rule.createIfMissing) {
    const createResult = await supabase.auth.admin.createUser({
      email: normalizedEmail,
      email_confirm: true,
      user_metadata: {
        full_name: payload.fullName?.trim() || undefined,
      },
    });
    user = createResult.data.user ?? undefined;
  }

  if (!user) {
    console.warn(`No auth user found for ${normalizedEmail}; event=${payload.event}`);
    return jsonResponse(
      { status: 'accepted', message: 'User not found; no changes applied' },
      202,
    );
  }

  const { data: existingProfile, error: existingProfileError } = await supabase
    .from('user_profiles')
    .select('full_name, role, active')
    .eq('id', user.id)
    .maybeSingle();

  if (existingProfileError) {
    console.error('Failed to fetch existing profile', existingProfileError);
    return jsonResponse({ error: 'Database error', details: existingProfileError.message }, 500);
  }

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

  const { error: upsertError } = await supabase.from('user_profiles').upsert(
    {
      id: user.id,
      full_name: fullName,
      role: desiredRole,
      active: desiredActive,
      status_updated_by: null,
      status_updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  );

  if (upsertError) {
    console.error('Failed to upsert user profile', upsertError);
    return jsonResponse({ error: 'Database error', details: upsertError.message }, 500);
  }

  try {
    await syncBanStatus(supabase, user.id, rule.banAction);
  } catch (error) {
    console.error('Failed to sync ban status in Auth', error);
    return jsonResponse({ error: 'Auth sync failed', details: String(error) }, 500);
  }

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
