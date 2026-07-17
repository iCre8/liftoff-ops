import { createHash } from 'node:crypto';

import type { AttendanceState, Prisma, PrismaClient, SubmissionType } from '@prisma/client';

import { planSheetRecordReconciliation } from '$lib/domain/phase-3';
import type {
  AttendanceSheetPort,
  AttendanceSheetRecord,
} from '$lib/server/integrations/contracts';

export interface SheetReconciliationSummary {
  recordsRead: number;
  timestampsImported: number;
  attendanceCorrections: number;
  humanReviewItems: number;
}

function reconciliationKey(parts: readonly string[]): string {
  return `sheet-read:${createHash('sha256').update(parts.join('\u0000')).digest('hex')}`;
}

async function ensureSheetSubmission(
  transaction: Prisma.TransactionClient,
  input: {
    learnerId: string;
    sessionId: string;
    type: SubmissionType;
    submittedAt: Date | null;
  },
): Promise<void> {
  if (!input.submittedAt) return;
  const existing = await transaction.submission.findUnique({
    where: {
      learnerId_sessionId_type: {
        learnerId: input.learnerId,
        sessionId: input.sessionId,
        type: input.type,
      },
    },
  });
  if (existing) return;
  await transaction.submission.create({
    data: {
      learnerId: input.learnerId,
      sessionId: input.sessionId,
      type: input.type,
      submittedAt: input.submittedAt,
      content: { importedFromAuthoritativeSheet: true },
      source: 'google_sheet',
      sourceId: reconciliationKey([
        input.learnerId,
        input.sessionId,
        input.type,
        input.submittedAt.toISOString(),
      ]),
    },
  });
}

async function recordHumanReview(
  database: PrismaClient,
  input: { sessionId: string; record: AttendanceSheetRecord; errorCode: string },
): Promise<void> {
  await database.syncAttempt.createMany({
    data: [
      {
        idempotencyKey: reconciliationKey([
          input.sessionId,
          input.record.learnerExternalId,
          input.record.sourceVersion,
          input.errorCode,
        ]),
        system: 'google_sheets',
        direction: 'sheet_to_postgres',
        attemptNumber: 1,
        observedSourceVersion: input.record.sourceVersion,
        status: 'HUMAN_REVIEW',
        errorCode: input.errorCode,
      },
    ],
    skipDuplicates: true,
  });
}

export async function reconcileSheetSession(
  database: PrismaClient,
  sheet: AttendanceSheetPort,
  sessionId: string,
): Promise<SheetReconciliationSummary> {
  const session = await database.programSession.findUniqueOrThrow({ where: { id: sessionId } });
  const records = await sheet.readSession(session.externalId);
  const summary: SheetReconciliationSummary = {
    recordsRead: records.length,
    timestampsImported: 0,
    attendanceCorrections: 0,
    humanReviewItems: 0,
  };

  for (const record of records) {
    if (record.sessionExternalId !== session.externalId) {
      await recordHumanReview(database, { sessionId, record, errorCode: 'session_mismatch' });
      summary.humanReviewItems += 1;
      continue;
    }
    const learner = await database.learner.findUnique({
      where: {
        cohortId_externalId: { cohortId: session.cohortId, externalId: record.learnerExternalId },
      },
      include: {
        submissions: { where: { sessionId } },
        attendanceRecords: { where: { sessionId } },
      },
    });
    if (!learner) {
      await recordHumanReview(database, {
        sessionId,
        record,
        errorCode: 'learner_mapping_missing',
      });
      summary.humanReviewItems += 1;
      continue;
    }
    const checkIn = learner.submissions.find((item) => item.type === 'GOALS_CHECK_IN');
    const exitTicket = learner.submissions.find((item) => item.type === 'EXIT_TICKET');
    const attendance = learner.attendanceRecords[0];
    let plan;
    try {
      plan = planSheetRecordReconciliation({
        checkInReleasedAt: session.checkInReleasedAt,
        existingCheckInAt: checkIn?.submittedAt,
        existingExitTicketAt: exitTicket?.submittedAt,
        existingAttendanceState: attendance?.state as never,
        sheetCheckInAt: record.checkInAt,
        sheetExitTicketAt: record.exitTicketAt,
        sheetExcused: record.excused,
        sheetOutcome: record.outcome,
      });
    } catch {
      await recordHumanReview(database, { sessionId, record, errorCode: 'invalid_sheet_value' });
      summary.humanReviewItems += 1;
      continue;
    }

    await database.$transaction(
      async (transaction) => {
        await ensureSheetSubmission(transaction, {
          learnerId: learner.id,
          sessionId,
          type: 'GOALS_CHECK_IN',
          submittedAt: plan.checkInAt,
        });
        await ensureSheetSubmission(transaction, {
          learnerId: learner.id,
          sessionId,
          type: 'EXIT_TICKET',
          submittedAt: plan.exitTicketAt,
        });
        if (plan.attendanceState) {
          const state = plan.attendanceState as AttendanceState;
          const eligible = !['EXCUSED', 'ACCOMMODATED'].includes(state);
          const attended = ['ON_TIME', 'LATE'].includes(state);
          await transaction.attendanceRecord.upsert({
            where: { learnerId_sessionId: { learnerId: learner.id, sessionId } },
            create: {
              learnerId: learner.id,
              sessionId,
              state,
              countsAsEligible: eligible,
              countsAsAttended: attended,
              sourceVersion: record.sourceVersion,
            },
            update: {
              ...(plan.attendanceChanged
                ? {
                    state,
                    countsAsEligible: eligible,
                    countsAsAttended: attended,
                    correctedAt: new Date(),
                    correctionReason: 'authoritative_sheet',
                  }
                : {}),
              sourceVersion: record.sourceVersion,
            },
          });
        }
        await transaction.syncAttempt.createMany({
          data: [
            {
              idempotencyKey: reconciliationKey([
                sessionId,
                learner.id,
                record.sourceVersion,
                'completed',
              ]),
              system: 'google_sheets',
              direction: 'sheet_to_postgres',
              attemptNumber: 1,
              observedSourceVersion: record.sourceVersion,
              status: 'COMPLETED',
            },
          ],
          skipDuplicates: true,
        });
      },
      { isolationLevel: 'Serializable' },
    );
    summary.timestampsImported += plan.timestampChanges;
    summary.attendanceCorrections += Number(plan.attendanceChanged);
  }
  return summary;
}
