import type { PrismaClient } from '@prisma/client';

import type { AutomatedLearnerChannel } from '$lib/domain/communication-preferences';
import type {
  LearnerMessagePort,
  MessageRequest,
  MessageResult,
} from '$lib/server/integrations/contracts';

export interface CommunicationPreferencePort {
  isEnabled(learnerId: string, channel: AutomatedLearnerChannel): Promise<boolean>;
  recordSuppressed(input: {
    learnerId: string;
    channel: AutomatedLearnerChannel;
    idempotencyKey: string;
  }): Promise<void>;
}

export class PrismaCommunicationPreferences implements CommunicationPreferencePort {
  constructor(private readonly database: PrismaClient) {}

  async isEnabled(learnerId: string, channel: AutomatedLearnerChannel): Promise<boolean> {
    const preference = await this.database.learnerCommunicationPreference.findUnique({
      where: { learnerId_channel: { learnerId, channel } },
      select: { enabled: true },
    });
    return preference?.enabled ?? true;
  }

  async recordSuppressed(input: {
    learnerId: string;
    channel: AutomatedLearnerChannel;
    idempotencyKey: string;
  }): Promise<void> {
    await this.database.auditEvent.create({
      data: {
        eventType: 'learner_message.suppressed_by_preference',
        entityType: 'Learner',
        entityId: input.learnerId,
        payload: { channel: input.channel, idempotencyKey: input.idempotencyKey },
      },
    });
  }
}

interface PreferenceChangeInput {
  learnerId: string;
  actorAccountId: string;
  changes: ReadonlyArray<{ channel: AutomatedLearnerChannel; enabled: boolean }>;
  source: 'LEARNER_FORM' | 'ADMIN_RECORDED_REQUEST' | 'LEARNER_RESUME' | 'ADMIN_CORRECTION';
  adminReason?: string;
  now?: Date;
}

export async function setLearnerCommunicationPreferences(
  database: PrismaClient,
  input: PreferenceChangeInput,
): Promise<void> {
  const adminReason = input.adminReason?.trim();
  if (input.source === 'ADMIN_CORRECTION' && !adminReason) {
    throw new Error('Administrator corrections require a reason');
  }
  if (adminReason && adminReason.length > 500)
    throw new Error('Administrator reasons must be 500 characters or fewer');
  if (input.changes.length === 0) throw new Error('At least one preference change is required');
  const effectiveAt = input.now ?? new Date();
  await database.$transaction(async (transaction) => {
    for (const change of input.changes) {
      await transaction.learnerCommunicationPreference.upsert({
        where: { learnerId_channel: { learnerId: input.learnerId, channel: change.channel } },
        create: {
          learnerId: input.learnerId,
          channel: change.channel,
          enabled: change.enabled,
          source: input.source,
          effectiveAt,
          changedByAccountId: input.actorAccountId,
          adminReason: adminReason || null,
        },
        update: {
          enabled: change.enabled,
          source: input.source,
          effectiveAt,
          changedByAccountId: input.actorAccountId,
          adminReason: adminReason || null,
        },
      });
      await transaction.auditEvent.create({
        data: {
          accountId: input.actorAccountId,
          eventType: 'learner.communication_preference_changed',
          entityType: 'Learner',
          entityId: input.learnerId,
          payload: { channel: change.channel, enabled: change.enabled, source: input.source },
        },
      });
    }
  });
}

export async function setLearnerCommunicationPreference(
  database: PrismaClient,
  input: Omit<PreferenceChangeInput, 'changes'> & {
    channel: AutomatedLearnerChannel;
    enabled: boolean;
  },
): Promise<void> {
  return setLearnerCommunicationPreferences(database, {
    learnerId: input.learnerId,
    actorAccountId: input.actorAccountId,
    changes: [{ channel: input.channel, enabled: input.enabled }],
    source: input.source,
    adminReason: input.adminReason,
    now: input.now,
  });
}

export type PreferenceAwareDeliveryResult =
  { status: 'SUPPRESSED' } | { status: 'SENT'; result: MessageResult };

export async function sendLearnerMessageWithPreference(input: {
  preferences: CommunicationPreferencePort;
  provider: LearnerMessagePort;
  learnerId: string;
  channel: AutomatedLearnerChannel;
  request: MessageRequest;
}): Promise<PreferenceAwareDeliveryResult> {
  if (!(await input.preferences.isEnabled(input.learnerId, input.channel))) {
    await input.preferences.recordSuppressed({
      learnerId: input.learnerId,
      channel: input.channel,
      idempotencyKey: input.request.idempotencyKey,
    });
    return { status: 'SUPPRESSED' };
  }
  return { status: 'SENT', result: await input.provider.send(input.request) };
}
