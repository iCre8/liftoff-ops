import { createHmac } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { verifyResendSignature, verifySlackSignature } from './webhook-signatures';

describe('provider webhook signatures', () => {
  const now = new Date('2026-07-15T16:00:00Z');
  const timestamp = String(now.getTime() / 1000);
  const rawBody = '{"type":"sanitized.event"}';

  it('verifies Slack raw-body signatures and rejects replayed timestamps', () => {
    const secret = 'sanitized-slack-secret';
    const signature = `v0=${createHmac('sha256', secret)
      .update(`v0:${timestamp}:${rawBody}`)
      .digest('hex')}`;
    expect(
      verifySlackSignature({ rawBody, timestamp, signature, signingSecret: secret, now }),
    ).toBe(true);
    expect(
      verifySlackSignature({
        rawBody,
        timestamp,
        signature,
        signingSecret: secret,
        now: new Date(now.getTime() + 301_000),
      }),
    ).toBe(false);
  });

  it('verifies Resend Svix signatures and rejects altered bodies', () => {
    const secretBytes = Buffer.from('sanitized-resend-secret');
    const signingSecret = `whsec_${secretBytes.toString('base64')}`;
    const eventId = 'event_sanitized';
    const signature = `v1,${createHmac('sha256', secretBytes)
      .update(`${eventId}.${timestamp}.${rawBody}`)
      .digest('base64')}`;
    expect(
      verifyResendSignature({
        rawBody,
        eventId,
        timestamp,
        signature,
        signingSecret,
        now,
      }),
    ).toBe(true);
    expect(
      verifyResendSignature({
        rawBody: `${rawBody} `,
        eventId,
        timestamp,
        signature,
        signingSecret,
        now,
      }),
    ).toBe(false);
  });
});
