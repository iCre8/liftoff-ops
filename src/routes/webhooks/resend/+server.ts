import { json } from '@sveltejs/kit';

import { readRequiredSecret } from '$lib/server/config/secrets';
import { getDatabase } from '$lib/server/db';
import { verifyResendSignature } from '$lib/server/integrations/webhook-signatures';
import { ingestProviderEvent } from '$lib/server/services/provider-events';

export const POST = async ({ request }) => {
  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody) > 1_000_000)
    return new Response('Payload too large', { status: 413 });
  const eventId = request.headers.get('svix-id') ?? '';
  const timestamp = request.headers.get('svix-timestamp') ?? '';
  const signature = request.headers.get('svix-signature') ?? '';
  if (
    !verifyResendSignature({
      rawBody,
      eventId,
      timestamp,
      signature,
      signingSecret: readRequiredSecret('RESEND_WEBHOOK_SECRET'),
    })
  ) {
    return new Response('Invalid signature', { status: 401 });
  }
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return new Response('Invalid payload', { status: 400 });
  }
  const data =
    payload.data && typeof payload.data === 'object'
      ? (payload.data as Record<string, unknown>)
      : {};
  if (typeof payload.type !== 'string' || typeof payload.created_at !== 'string') {
    return new Response('Invalid event metadata', { status: 400 });
  }
  await ingestProviderEvent(getDatabase(), {
    provider: 'resend',
    providerEventId: eventId,
    eventType: payload.type,
    occurredAt: new Date(payload.created_at),
    providerMessageId: typeof data.email_id === 'string' ? data.email_id : undefined,
  });
  return json({ ok: true });
};
