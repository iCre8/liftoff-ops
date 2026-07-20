import { describe, expect, it, vi } from 'vitest';

import { ingestProviderEvent } from './provider-events';

describe('provider event ingestion', () => {
  it('does not let an older sent event regress a delivered attempt', async () => {
    const update = vi.fn(async () => ({}));
    const transaction = {
      outreachAttempt: {
        findFirst: vi.fn(async () => ({ id: 'attempt_sanitized' })),
        update,
      },
      providerEvent: {
        createMany: vi.fn(async () => ({ count: 1 })),
        findFirst: vi
          .fn()
          .mockResolvedValueOnce({ providerEventId: 'event_delivered' })
          .mockResolvedValue({ providerEventId: 'event_delivered' }),
      },
    };
    const database = {
      $transaction: async (callback: (value: typeof transaction) => unknown) =>
        callback(transaction),
    };
    const delivered = await ingestProviderEvent(database as never, {
      provider: 'resend',
      providerEventId: 'event_delivered',
      eventType: 'email.delivered',
      occurredAt: new Date('2026-07-20T14:02:00Z'),
      providerMessageId: 'message_sanitized',
    });
    const lateSent = await ingestProviderEvent(database as never, {
      provider: 'resend',
      providerEventId: 'event_sent',
      eventType: 'email.sent',
      occurredAt: new Date('2026-07-20T14:01:00Z'),
      providerMessageId: 'message_sanitized',
    });

    expect(delivered).toEqual({ duplicate: false, outreachUpdated: true });
    expect(lateSent).toEqual({ duplicate: false, outreachUpdated: false });
    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'DELIVERED' }) }),
    );
  });
});
