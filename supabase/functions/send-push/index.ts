// FirebaseMessagingService.sendPush(userId, title, message) from the design class diagram.
// Called by the database (pg_net) for every new row in public.notifications.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { JWT } from 'npm:google-auth-library@10';

type NotificationRecord = {
  id: string;
  recipient_id: string;
  category: string;
  title: string;
  body: string | null;
  data: Record<string, unknown> | null;
};

type ServiceAccount = { project_id: string; client_email: string; private_key: string };
type SendResult = 'sent' | 'invalid-token' | 'error';

const serviceAccount: ServiceAccount = JSON.parse(Deno.env.get('FIREBASE_SERVICE_ACCOUNT') ?? '{}');
const webhookSecret = Deno.env.get('PUSH_WEBHOOK_SECRET') ?? '';

// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically by Supabase.
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } }
);

// ---- Google OAuth token for FCM HTTP v1 (cached ~1 hour) ----
let cachedAccessToken: { value: string; expiresAt: number } | null = null;

async function getFirebaseAccessToken(): Promise<string> {
  if (cachedAccessToken && Date.now() < cachedAccessToken.expiresAt - 60_000) {
    return cachedAccessToken.value;
  }
  const jwt = new JWT({
    email: serviceAccount.client_email,
    key: serviceAccount.private_key,
    scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
  });
  const credentials = await jwt.authorize();
  if (!credentials.access_token) throw new Error('Google did not return an access token');
  cachedAccessToken = {
    value: credentials.access_token,
    expiresAt: credentials.expiry_date ?? Date.now() + 50 * 60_000,
  };
  return cachedAccessToken.value;
}

// FCM `data` values must all be strings.
function toStringMap(input: Record<string, unknown> | null): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(input ?? {})) {
    if (value === null || value === undefined) continue;
    out[key] = typeof value === 'string' ? value : JSON.stringify(value);
  }
  return out;
}

async function sendToDevice(token: string, n: NotificationRecord, accessToken: string): Promise<SendResult> {
  const response = await fetch(
    `https://fcm.googleapis.com/v1/projects/${serviceAccount.project_id}/messages:send`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: {
          token,
          notification: { title: n.title, body: n.body ?? '' },
          data: { ...toStringMap(n.data), notificationId: n.id, category: n.category },
          android: {
            priority: 'high',
            notification: { channel_id: 'default', sound: 'default', color: '#16302a' },
          },
        },
      }),
    }
  );

  if (response.ok) return 'sent';

  const errorBody = await response.json().catch(() => ({}));
  const details: Array<{ errorCode?: string }> = errorBody?.error?.details ?? [];
  const fcmCode = details.find((d) => d.errorCode)?.errorCode;
  console.error('[send-push] FCM error', response.status, fcmCode, JSON.stringify(errorBody));

  // Uninstalled app / expired registration -> stop using this token.
  if (response.status === 404 || fcmCode === 'UNREGISTERED') return 'invalid-token';
  return 'error';
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!webhookSecret || req.headers.get('x-webhook-secret') !== webhookSecret) {
    return json({ error: 'Unauthorized' }, 401);
  }
  if (!serviceAccount.project_id || !serviceAccount.private_key) {
    return json({ error: 'FIREBASE_SERVICE_ACCOUNT secret is missing or invalid' }, 500);
  }

  const payload = await req.json().catch(() => null);
  const record = payload?.record as NotificationRecord | undefined;
  if (!record?.id || !record.recipient_id) return json({ error: 'Missing notification record' }, 400);

  // Only Android tokens are FCM tokens for now (iOS needs a paid Apple account).
  const { data: devices, error } = await supabase
    .from('device_registrations')
    .select('id, fcm_token')
    .eq('profile_id', record.recipient_id)
    .eq('is_active', true)
    .eq('platform', 'android');

  if (error) {
    console.error('[send-push] device lookup failed', error);
    return json({ error: error.message }, 500);
  }
  if (!devices || devices.length === 0) {
    return json({ sent: 0, reason: 'recipient has no active Android devices' });
  }

  const accessToken = await getFirebaseAccessToken();
  const results = await Promise.all(devices.map((d) => sendToDevice(d.fcm_token, record, accessToken)));

  const invalidIds = devices.filter((_, i) => results[i] === 'invalid-token').map((d) => d.id);
  if (invalidIds.length > 0) {
    await supabase
      .from('device_registrations')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .in('id', invalidIds);
  }

  return json({
    sent: results.filter((r) => r === 'sent').length,
    deactivated: invalidIds.length,
    failed: results.filter((r) => r === 'error').length,
  });
});