import type { Prisma, PrismaClient, RetentionDataCategory } from '@prisma/client';

export const RETENTION_DATA_CATEGORIES = [
  'ACCOUNTS_AND_SESSIONS',
  'LEARNER_IDENTIFIERS_AND_MAPPINGS',
  'SUBMISSIONS_AND_REVISIONS',
  'ATTENDANCE_RECORDS',
  'INCIDENTS_AND_OUTREACH',
  'SUPPORT_ITEMS',
  'ACCOMMODATIONS_AND_PAUSES',
  'SYNCHRONIZATION_HISTORY',
  'AUDIT_HISTORY',
  'PROVIDER_METADATA',
  'REPORTING_AND_BASELINES',
  'AUTOMATION_JOBS',
] as const satisfies readonly RetentionDataCategory[];

export function threeCalendarYearsAfter(value: Date): Date {
  const result = new Date(value);
  result.setUTCFullYear(result.getUTCFullYear() + 3);
  return result;
}

export function retentionReviewPlan(cohortId: string, archivedAt: Date) {
  const dueAt = threeCalendarYearsAfter(archivedAt);
  return RETENTION_DATA_CATEGORIES.map((category) => ({ cohortId, category, dueAt }));
}

export async function ensureRetentionReviews(
  transaction: Prisma.TransactionClient,
  cohortId: string,
  archivedAt: Date,
): Promise<number> {
  const result = await transaction.dataRetentionReview.createMany({
    data: retentionReviewPlan(cohortId, archivedAt),
    skipDuplicates: true,
  });
  return result.count;
}

export async function placeRetentionHold(
  database: PrismaClient,
  input: {
    cohortId: string;
    category: RetentionDataCategory;
    actorAccountId: string;
    reason: string;
    reviewAt: Date;
    now?: Date;
  },
): Promise<void> {
  const reason = input.reason.trim();
  const now = input.now ?? new Date();
  if (!reason || reason.length > 500) throw new Error('A bounded hold reason is required');
  if (input.reviewAt <= now) throw new Error('A future hold review date is required');
  await database.$transaction(async (transaction) => {
    const updated = await transaction.dataRetentionReview.updateMany({
      where: { cohortId: input.cohortId, category: input.category },
      data: {
        holdPlacedAt: now,
        holdPlacedBy: input.actorAccountId,
        holdReason: reason,
        holdReviewAt: input.reviewAt,
        holdReleasedAt: null,
        holdReleasedBy: null,
      },
    });
    if (updated.count !== 1) throw new Error('Retention review was not found');
    await transaction.auditEvent.create({
      data: {
        accountId: input.actorAccountId,
        eventType: 'retention.hold_placed',
        entityType: 'Cohort',
        entityId: input.cohortId,
        payload: { category: input.category, reviewAt: input.reviewAt.toISOString() },
      },
    });
  });
}
