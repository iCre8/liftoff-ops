import type { LearnerMessagePort, MessageRequest, MessageResult } from './contracts';

type FetchPort = typeof fetch;

export class ProviderDeliveryError extends Error {
  constructor(
    readonly code: string,
    readonly permanent: boolean,
  ) {
    super(code);
  }
}

function validateRequest(request: MessageRequest): void {
  if (!request.idempotencyKey || request.idempotencyKey.length > 256)
    throw new Error('A bounded idempotency key is required');
  if (
    !request.recipientExternalId ||
    !request.renderedContent ||
    request.renderedContent.length > 4000
  )
    throw new Error('A recipient and bounded approved content are required');
}

export class SlackLearnerMessages implements LearnerMessagePort {
  constructor(
    private readonly botToken: string,
    private readonly http: FetchPort = fetch,
  ) {}

  async send(request: MessageRequest): Promise<MessageResult> {
    validateRequest(request);
    const response = await this.http('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.botToken}`,
        'content-type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify({ channel: request.recipientExternalId, text: request.renderedContent }),
    });
    if (!response.ok)
      throw new ProviderDeliveryError(
        `slack_http_${response.status}`,
        response.status < 500 && response.status !== 429,
      );
    const result = (await response.json()) as { ok?: boolean; ts?: string; error?: string };
    if (!result.ok || !result.ts) {
      const code = (result.error ?? 'invalid_response').slice(0, 100);
      throw new ProviderDeliveryError(
        `slack_${code}`,
        ['channel_not_found', 'user_not_found', 'invalid_auth', 'account_inactive'].includes(code),
      );
    }
    return { providerMessageId: result.ts, acceptedAt: new Date().toISOString() };
  }
}

export class ResendLearnerMessages implements LearnerMessagePort {
  constructor(
    private readonly apiKey: string,
    private readonly sender: string,
    private readonly http: FetchPort = fetch,
  ) {}

  async send(request: MessageRequest): Promise<MessageResult> {
    validateRequest(request);
    const response = await this.http('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        'content-type': 'application/json',
        'idempotency-key': request.idempotencyKey,
      },
      body: JSON.stringify({
        from: this.sender,
        to: [request.recipientExternalId],
        subject: request.subject ?? 'LiftOff program check-in',
        text: request.renderedContent,
      }),
    });
    if (!response.ok)
      throw new ProviderDeliveryError(
        `resend_http_${response.status}`,
        response.status < 500 && response.status !== 429,
      );
    const result = (await response.json()) as { id?: string };
    if (!result.id) throw new ProviderDeliveryError('resend_invalid_response', false);
    return { providerMessageId: result.id, acceptedAt: new Date().toISOString() };
  }
}
