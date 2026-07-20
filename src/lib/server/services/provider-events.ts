import type { PrismaClient } from '@prisma/client';

const DELIVERY_STATUS: Readonly<Record<string, 'ACCEPTED' | 'DELIVERED' | 'FAILED'>> = {
  'email.sent': 'ACCEPTED',
  'email.delivered': 'DELIVERED',
  'email.bounced': 'FAILED',
  'email.failed': 'FAILED',
};
const DELIVERY_EVENT_TYPES = Object.keys(DELIVERY_STATUS);

export async function ingestProviderEvent(
  database: PrismaClient,
  input: {
    provider: 'slack' | 'resend';
    providerEventId: string;
    eventType: string;
    occurredAt: Date;
    providerMessageId?: string;
  },
): Promise<{ duplicate: boolean; outreachUpdated: boolean }> {
  const boundedEventType = input.eventType.trim().slice(0, 100);
  if (
    !input.providerEventId.trim() ||
    !boundedEventType ||
    !Number.isFinite(input.occurredAt.getTime())
  ) {
    throw new Error('Provider event metadata is invalid');
  }
  return database.$transaction(async (transaction) => {
    const outreach = input.providerMessageId
      ? await transaction.outreachAttempt.findFirst({
          where: { providerMessageId: input.providerMessageId },
          select: { id: true },
        })
      : null;
    const created = await transaction.providerEvent.createMany({
      data: [
        {
          provider: input.provider,
          providerEventId: input.providerEventId,
          eventType: boundedEventType,
          occurredAt: input.occurredAt,
          outreachAttemptId: outreach?.id,
        },
      ],
      skipDuplicates: true,
    });
    if (created.count === 0) return { duplicate: true, outreachUpdated: false };
    const status = input.provider === 'resend' ? DELIVERY_STATUS[boundedEventType] : undefined;
    let applyResendStatus = Boolean(status);
    if (outreach && status) {
      const latest = await transaction.providerEvent.findFirst({
        where: {
          outreachAttemptId: outreach.id,
          provider: 'resend',
          eventType: { in: DELIVERY_EVENT_TYPES },
        },
        orderBy: [{ occurredAt: 'desc' }, { receivedAt: 'desc' }],
        select: { providerEventId: true },
      });
      applyResendStatus = latest?.providerEventId === input.providerEventId;
    }
    const slackAcknowledged =
      input.provider === 'slack' && ['reaction_added', 'message'].includes(boundedEventType);
    const providerStateChanged = Boolean((status && applyResendStatus) || slackAcknowledged);
    if (outreach && providerStateChanged) {
      await transaction.outreachAttempt.update({
        where: { id: outreach.id },
        data: {
          status: slackAcknowledged ? 'CLOSED' : status,
          ...(slackAcknowledged ? { closedAt: input.occurredAt } : {}),
          ...(status === 'ACCEPTED' ? { acceptedAt: input.occurredAt } : {}),
          ...(status === 'FAILED' ? { errorCode: 'provider_delivery_failed' } : {}),
        },
      });
    }
    return {
      duplicate: false,
      outreachUpdated: Boolean(outreach && providerStateChanged),
    };
  });
}
