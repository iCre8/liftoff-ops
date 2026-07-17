import { describe, expect, it, vi } from 'vitest';

import { ResendLearnerMessages, SlackLearnerMessages } from './http-providers';

const request = {
  idempotencyKey: 'outreach:sanitized:1',
  recipientExternalId: 'recipient-reference',
  templateKey: 'late',
  templateVersion: 1,
  approvedFields: {},
  renderedContent: 'Please complete your check-in or request support.',
};

describe('HTTP provider adapters', () => {
  it('posts an accessible Slack DM without exposing the token in the body', async () => {
    const http = vi.fn<typeof fetch>(
      async (url: string | URL | Request, init?: RequestInit) =>
        new Response(JSON.stringify({ ok: true, ts: 'message-ref' }), { status: 200 }),
    );
    const result = await new SlackLearnerMessages('secret-token', http as typeof fetch).send(
      request,
    );
    expect(result.providerMessageId).toBe('message-ref');
    const [, init] = http.mock.calls[0];
    expect(String(init?.body)).not.toContain('secret-token');
  });

  it('uses Resend idempotency and reports permanent recipient failures', async () => {
    const accepted = vi.fn<typeof fetch>(
      async (url: string | URL | Request, init?: RequestInit) =>
        new Response(JSON.stringify({ id: 'email-ref' }), { status: 200 }),
    );
    await new ResendLearnerMessages(
      'secret-key',
      'sender@example.test',
      accepted as typeof fetch,
    ).send(request);
    expect((accepted.mock.calls[0][1]?.headers as Record<string, string>)['idempotency-key']).toBe(
      request.idempotencyKey,
    );
    const rejected = vi.fn<typeof fetch>(
      async (url: string | URL | Request, init?: RequestInit) =>
        new Response('{}', { status: 422 }),
    );
    await expect(
      new ResendLearnerMessages('secret-key', 'sender@example.test', rejected as typeof fetch).send(
        request,
      ),
    ).rejects.toMatchObject({ permanent: true });
  });
});
