import { json } from '@sveltejs/kit';

import { readRequiredSecret } from '$lib/server/config/secrets';
import { getDatabase } from '$lib/server/db';
import { verifySlackSignature } from '$lib/server/integrations/webhook-signatures';
import { ingestProviderEvent } from '$lib/server/services/provider-events';

export const POST = async ({ request }) => {
  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody) > 1_000_000)
    return new Response('Payload too large', { status: 413 });
  const timestamp = request.headers.get('x-slack-request-timestamp') ?? '';
  const signature = request.headers.get('x-slack-signature') ?? '';
  if (
    !verifySlackSignature({
      rawBody,
      timestamp,
      signature,
      signingSecret: readRequiredSecret('SLACK_SIGNING_SECRET'),
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
  if (payload.type === 'url_verification' && typeof payload.challenge === 'string') {
    return json({ challenge: payload.challenge });
  }
  if (typeof payload.event_id !== 'string')
    return new Response('Missing event ID', { status: 400 });
  const event =
    payload.event && typeof payload.event === 'object'
      ? (payload.event as Record<string, unknown>)
      : {};
  const eventType = typeof event.type === 'string' ? event.type : 'unknown';
  const occurredAt = new Date(Number(payload.event_time ?? 0) * 1000);
  const actor = typeof event.user === 'string' ? event.user : '';
  const allowedActors = new Set(
    readRequiredSecret('SLACK_STAFF_MEMBER_IDS')
      .split(/[\s,]+/)
      .map((value) => value.trim())
      .filter(Boolean),
  );
  const item =
    event.item && typeof event.item === 'object' ? (event.item as Record<string, unknown>) : {};
  const providerMessageId =
    allowedActors.has(actor) && typeof item.ts === 'string'
      ? item.ts
      : allowedActors.has(actor) && typeof event.thread_ts === 'string'
        ? event.thread_ts
        : undefined;
  await ingestProviderEvent(getDatabase(), {
    provider: 'slack',
    providerEventId: payload.event_id,
    eventType,
    occurredAt,
    providerMessageId,
  });
  return json({ ok: true });
};
