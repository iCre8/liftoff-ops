import type { Prisma, PrismaClient, SubmissionType } from '@prisma/client';

import { classifyMorningAttendance } from '$lib/domain/attendance';
import { exitTicketSchema, morningGoalsSchema } from '$lib/domain/module-2';

type DailyFormType = 'GOALS_CHECK_IN' | 'EXIT_TICKET';

interface SubmitDailyFormInput {
  learnerId: string;
  sessionId: string;
  actorAccountId: string;
  type: DailyFormType;
  idempotencyKey: string;
  submittedAt: Date;
  content: unknown;
}

function jsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function supportSummary(content: Record<string, unknown>): string | undefined {
  const values = [content.blockers, content.supportNeeded].filter(
    (value): value is string => typeof value === 'string' && value.length > 0,
  );
  return values.length > 0 ? values.join('\n') : undefined;
}

export async function submitDailyForm(
  database: PrismaClient,
  input: SubmitDailyFormInput,
): Promise<{ submissionId: string; revision: number; duplicate: boolean }> {
  const parsed =
    input.type === 'GOALS_CHECK_IN'
      ? morningGoalsSchema.parse(input.content)
      : exitTicketSchema.parse(input.content);
  const content = jsonValue(parsed);
  const idempotencyKey = input.idempotencyKey.trim();
  if (!idempotencyKey || idempotencyKey.length > 200) {
    throw new Error('A bounded idempotency key is required');
  }

  return database.$transaction(
    async (transaction) => {
      const duplicate = await transaction.submission.findUnique({
        where: { source_sourceId: { source: 'learner_portal', sourceId: idempotencyKey } },
      });
      if (duplicate) {
        const revision = await transaction.submissionRevision.count({
          where: { submissionId: duplicate.id },
        });
        return { submissionId: duplicate.id, revision, duplicate: true };
      }

      const session = await transaction.programSession.findUniqueOrThrow({
        where: { id: input.sessionId },
      });
      if (session.cancelledAt) throw new Error('No program session is scheduled today');
      const releaseAt =
        input.type === 'GOALS_CHECK_IN' ? session.checkInReleasedAt : session.exitTicketReleasedAt;
      if (input.submittedAt < releaseAt) throw new Error('Form is not released');
      if (input.submittedAt > session.programDayEndsAt) throw new Error('Form edits are closed');

      const existing = await transaction.submission.findUnique({
        where: {
          learnerId_sessionId_type: {
            learnerId: input.learnerId,
            sessionId: input.sessionId,
            type: input.type as SubmissionType,
          },
        },
      });
      const revision = existing
        ? (await transaction.submissionRevision.count({ where: { submissionId: existing.id } })) + 1
        : 1;

      const submission = existing
        ? await transaction.submission.update({
            where: { id: existing.id },
            data: { content, sourceId: idempotencyKey },
          })
        : await transaction.submission.create({
            data: {
              learnerId: input.learnerId,
              sessionId: input.sessionId,
              type: input.type as SubmissionType,
              submittedAt: input.submittedAt,
              content,
              source: 'learner_portal',
              sourceId: idempotencyKey,
            },
          });

      await transaction.submissionRevision.create({
        data: {
          submissionId: submission.id,
          revision,
          content,
          submittedAt: input.submittedAt,
          actorId: input.actorAccountId,
        },
      });
      await transaction.pendingSyncOperation.create({
        data: {
          submissionId: submission.id,
          idempotencyKey: `submission:${submission.id}:revision:${revision}`,
        },
      });
      await transaction.auditEvent.create({
        data: {
          accountId: input.actorAccountId,
          eventType: existing ? 'submission.revised' : 'submission.created',
          entityType: 'Submission',
          entityId: submission.id,
          payload: { type: input.type, revision },
        },
      });

      if (input.type === 'GOALS_CHECK_IN') {
        const state = classifyMorningAttendance({
          checkInReleasedAt: session.checkInReleasedAt,
          evaluatedAt: input.submittedAt,
          submittedAt: existing?.submittedAt ?? input.submittedAt,
        });
        await transaction.attendanceRecord.upsert({
          where: {
            learnerId_sessionId: { learnerId: input.learnerId, sessionId: input.sessionId },
          },
          create: {
            learnerId: input.learnerId,
            sessionId: input.sessionId,
            state: state.toUpperCase() as never,
            countsAsAttended: state === 'on_time' || state === 'late',
            countsAsEligible: true,
          },
          update: {},
        });
      }

      const summary = supportSummary(parsed as Record<string, unknown>);
      if (summary) {
        await transaction.supportItem.upsert({
          where: { idempotencyKey: `submission:${submission.id}:support` },
          create: {
            idempotencyKey: `submission:${submission.id}:support`,
            learnerId: input.learnerId,
            submissionId: submission.id,
            summary,
          },
          update: { summary, status: 'OPEN', resolvedAt: null, resolvedBy: null },
        });
      }

      return { submissionId: submission.id, revision, duplicate: false };
    },
    { isolationLevel: 'Serializable' },
  );
}
