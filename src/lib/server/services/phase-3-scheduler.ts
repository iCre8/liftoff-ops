import type {
  AutomationJob,
  AutomationJobStatus,
  AutomationJobType,
  Prisma,
  PrismaClient,
} from '@prisma/client';

import {
  automationJobKey,
  isUsFederalHoliday,
  planDailyAutomation,
  planUnclaimedReminders,
  retryAt,
  shouldSuppressStaleOutreach,
} from '../../domain/phase-3';
import {
  resolvePermittedLearnerChannel,
  type AutomatedLearnerChannel,
} from '../../domain/communication-preferences';
import { programDateTime } from '../../domain/module-2';
import type { AttendanceSheetPort } from '../integrations/contracts';
import { reconcileSheetSession } from './phase-3-reconciliation';

export interface Phase3WorkerDependencies {
  attendanceSheet?: AttendanceSheetPort;
}

function sessionDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export async function ensureAutomationJobs(
  database: PrismaClient,
  input: { from: Date; through: Date },
): Promise<number> {
  const sessions = await database.programSession.findMany({
    where: {
      cancelledAt: null,
      sessionDate: { gte: input.from, lte: input.through },
    },
    select: { id: true, cohortId: true, sessionDate: true },
  });
  let created = 0;
  for (const session of sessions) {
    for (const planned of planDailyAutomation(sessionDate(session.sessionDate))) {
      const result = await database.automationJob.createMany({
        data: [
          {
            idempotencyKey: automationJobKey({
              cohortId: session.cohortId,
              sessionId: session.id,
              type: planned.type,
              sequence: planned.sequence,
            }),
            cohortId: session.cohortId,
            sessionId: session.id,
            type: planned.type as AutomationJobType,
            runAt: planned.runAt,
            payload: { sequence: planned.sequence },
          },
        ],
        skipDuplicates: true,
      });
      created += result.count;
    }
  }
  const cohorts = await database.cohort.findMany({
    where: { archivedAt: null, startsOn: { lte: input.through }, endsOn: { gte: input.from } },
    include: {
      sessions: {
        where: { cancelledAt: null, sessionDate: { gte: input.from, lte: input.through } },
        orderBy: { sessionDate: 'asc' },
      },
      blackoutDates: { where: { removedAt: null } },
    },
  });
  for (const cohort of cohorts) {
    const first = cohort.startsOn.getTime();
    const byDate = new Map(
      cohort.sessions.map((session) => [sessionDate(session.sessionDate), session]),
    );
    for (const session of cohort.sessions) {
      const date = session.sessionDate;
      if (date.getUTCDay() !== 5) continue;
      const week = Math.floor((date.getTime() - first) / (7 * 24 * 60 * 60_000));
      if (week < 0 || week % 2 !== 0) continue;
      const friday = sessionDate(date);
      const fridayBlocked =
        isUsFederalHoliday(date) ||
        cohort.blackoutDates.some((item) => sessionDate(item.date) === friday);
      let reportSession = session;
      if (fridayBlocked) {
        for (let offset = 1; offset <= 4; offset += 1) {
          const prior = new Date(date);
          prior.setUTCDate(prior.getUTCDate() - offset);
          const candidate = byDate.get(sessionDate(prior));
          if (candidate && !isUsFederalHoliday(prior)) {
            reportSession = candidate;
            break;
          }
        }
      }
      const result = await database.automationJob.createMany({
        data: [
          {
            idempotencyKey: `phase3:${cohort.id}:report:${friday}`,
            cohortId: cohort.id,
            sessionId: reportSession.id,
            type: 'BIWEEKLY_REPORT',
            runAt: programDateTime(sessionDate(reportSession.sessionDate), 15, 30),
            payload: { reportingFriday: friday },
          },
        ],
        skipDuplicates: true,
      });
      created += result.count;
    }
  }
  return created;
}

export async function recoverStaleClaims(
  database: PrismaClient,
  now: Date,
  staleAfterMinutes = 15,
): Promise<number> {
  const before = new Date(now.getTime() - staleAfterMinutes * 60_000);
  const result = await database.automationJob.updateMany({
    where: { status: 'CLAIMED', claimedAt: { lt: before } },
    data: { status: 'PENDING', claimedAt: null, claimedBy: null, errorCode: 'stale_claim' },
  });
  return result.count;
}

export async function ensureUnclaimedReminderJobs(
  database: PrismaClient,
  input: {
    incidentId: string;
    cohortId: string;
    sessionId: string;
    learnerId: string;
    taskCreatedAt: Date;
  },
): Promise<number> {
  let created = 0;
  for (const reminder of planUnclaimedReminders(input.taskCreatedAt)) {
    const result = await database.automationJob.createMany({
      data: [
        {
          idempotencyKey: `phase3:${input.incidentId}:unclaimed:${reminder.sequence}`,
          cohortId: input.cohortId,
          sessionId: input.sessionId,
          learnerId: input.learnerId,
          type: 'UNCLAIMED_REMINDER',
          runAt: reminder.runAt,
          payload: {
            incidentId: input.incidentId,
            sequence: reminder.sequence,
            prepareTeamEmail: reminder.prepareTeamEmail,
            addToUnresolvedDashboard: reminder.addToUnresolvedDashboard,
          },
        },
      ],
      skipDuplicates: true,
    });
    created += result.count;
  }
  return created;
}

export async function claimDueJobs(
  database: PrismaClient,
  input: { now: Date; workerId: string; limit?: number },
): Promise<AutomationJob[]> {
  const candidates = await database.automationJob.findMany({
    where: {
      status: 'PENDING',
      runAt: { lte: input.now },
      OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: input.now } }],
    },
    orderBy: [{ runAt: 'asc' }, { createdAt: 'asc' }],
    take: input.limit ?? 25,
  });
  const claimed: AutomationJob[] = [];
  for (const candidate of candidates) {
    const result = await database.automationJob.updateMany({
      where: { id: candidate.id, status: 'PENDING' },
      data: {
        status: 'CLAIMED',
        claimedAt: input.now,
        claimedBy: input.workerId,
        attemptNumber: { increment: 1 },
      },
    });
    if (result.count === 1) {
      claimed.push(
        (await database.automationJob.findUniqueOrThrow({
          where: { id: candidate.id },
        })) as AutomationJob,
      );
    }
  }
  return claimed;
}

async function finishJob(
  database: PrismaClient,
  jobId: string,
  status: AutomationJobStatus,
  now: Date,
  payload?: Prisma.InputJsonValue,
) {
  await database.automationJob.update({
    where: { id: jobId },
    data: {
      status,
      completedAt: now,
      claimedAt: null,
      claimedBy: null,
      ...(payload ? { payload } : {}),
    },
  });
}

async function activePause(
  database: PrismaClient,
  input: { cohortId: string; learnerId?: string | null; now: Date },
) {
  return database.automationPause.findFirst({
    where: {
      cohortId: input.cohortId,
      OR: [{ learnerId: null }, ...(input.learnerId ? [{ learnerId: input.learnerId }] : [])],
      startsAt: { lte: input.now },
      AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: input.now } }] }],
    },
  });
}

async function missingLearners(
  database: PrismaClient,
  cohortId: string,
  sessionId: string,
  type: 'GOALS_CHECK_IN' | 'EXIT_TICKET',
  now: Date,
) {
  const learners = await database.learner.findMany({
    where: {
      cohort: { sessions: { some: { id: sessionId } } },
      submissions: { none: { sessionId, type } },
    },
    select: {
      id: true,
      externalId: true,
      preferredChannel: true,
      slackMemberId: true,
      communicationPreferences: {
        where: { channel: { in: ['EMAIL', 'SLACK'] } },
        select: { channel: true, enabled: true },
      },
    },
  });
  const eligible: typeof learners = [];
  for (const learner of learners) {
    const paused = await activePause(database, {
      cohortId,
      learnerId: learner.id,
      now,
    });
    if (!paused) eligible.push(learner);
  }
  return eligible;
}

export async function executeAutomationJob(
  database: PrismaClient,
  job: AutomationJob,
  now = new Date(),
  dependencies: Phase3WorkerDependencies = {},
): Promise<void> {
  const context = await database.automationJob.findUniqueOrThrow({
    where: { id: job.id },
    include: { cohort: true, session: true },
  });
  if (context.cohort.automationMode === 'DISABLED') {
    await finishJob(database, job.id, 'SUPPRESSED', now, {
      reason: 'cohort_disabled',
      plannedType: job.type,
    });
    return;
  }
  const blackout = context.session
    ? await database.blackoutDate.findFirst({
        where: {
          cohortId: context.cohortId,
          date: context.session.sessionDate,
          removedAt: null,
        },
      })
    : null;
  const federalHoliday = context.session ? isUsFederalHoliday(context.session.sessionDate) : false;
  if (
    blackout ||
    federalHoliday ||
    (await activePause(database, { cohortId: context.cohortId, now }))
  ) {
    await finishJob(database, job.id, 'SUPPRESSED', now, {
      reason: blackout ? 'blackout' : federalHoliday ? 'federal_holiday' : 'cohort_pause',
      plannedType: job.type,
    });
    return;
  }
  if (
    context.session &&
    shouldSuppressStaleOutreach({
      now,
      programDayEndsAt: context.session.programDayEndsAt,
      jobType: job.type as never,
    })
  ) {
    await finishJob(database, job.id, 'HUMAN_REVIEW', now, {
      reason: 'stale_after_day_close',
      plannedType: job.type,
    });
    return;
  }

  let plannedLearners: Awaited<ReturnType<typeof missingLearners>> = [];
  if (context.session && job.type === 'LATE_EVALUATION') {
    plannedLearners = await missingLearners(
      database,
      context.cohortId,
      context.session.id,
      'GOALS_CHECK_IN',
      now,
    );
  } else if (context.session && job.type === 'NO_CALL_NO_SHOW_EVALUATION') {
    plannedLearners = await missingLearners(
      database,
      context.cohortId,
      context.session.id,
      'GOALS_CHECK_IN',
      now,
    );
  } else if (context.session && job.type === 'EXIT_REMINDER') {
    plannedLearners = await missingLearners(
      database,
      context.cohortId,
      context.session.id,
      'EXIT_TICKET',
      now,
    );
  } else if (context.session && job.type === 'INCOMPLETE_DAY_EVALUATION') {
    plannedLearners = await missingLearners(
      database,
      context.cohortId,
      context.session.id,
      'EXIT_TICKET',
      now,
    );
  }
  const plannedCount = plannedLearners.length;

  if (context.cohort.automationMode === 'DRY_RUN') {
    const templateKey =
      job.type === 'LATE_EVALUATION'
        ? 'late'
        : job.type === 'NO_CALL_NO_SHOW_EVALUATION'
          ? 'no_call_no_show'
          : job.type === 'EXIT_REMINDER'
            ? 'exit_reminder'
            : null;
    const template = templateKey
      ? await database.messageTemplate.findFirst({
          where: { cohortId: context.cohortId, key: templateKey, status: 'APPROVED' },
          orderBy: { version: 'desc' },
          select: { key: true, version: true },
        })
      : null;
    const operations = plannedLearners.map((learner) => {
      const enabledChannels = new Set<AutomatedLearnerChannel>(['EMAIL', 'SLACK']);
      for (const preference of learner.communicationPreferences) {
        if (!preference.enabled)
          enabledChannels.delete(preference.channel as AutomatedLearnerChannel);
      }
      const preferredChannel = ['EMAIL', 'SLACK'].includes(learner.preferredChannel ?? '')
        ? (learner.preferredChannel as AutomatedLearnerChannel)
        : null;
      const primaryChannel = resolvePermittedLearnerChannel({
        preferredChannel,
        slackAvailable: Boolean(learner.slackMemberId),
        enabledChannels,
      });
      return {
        learnerReference: learner.externalId,
        trigger: job.type,
        primaryChannel,
        learnerMessageSuppressed: primaryChannel === null,
        recipientCategory: 'learner',
        templateKey: template?.key ?? templateKey,
        templateVersion: template?.version ?? null,
        teamCallTask: ['LATE_EVALUATION', 'NO_CALL_NO_SHOW_EVALUATION'].includes(job.type),
        programDirectorEscalation: job.type === 'NO_CALL_NO_SHOW_EVALUATION',
        proposedSheetWrite: null,
      };
    });
    await database.auditEvent.create({
      data: {
        eventType: 'automation.dry_run.planned',
        entityType: 'AutomationJob',
        entityId: job.id,
        payload: {
          type: job.type,
          plannedCount,
          operations,
          wouldReadAuthoritativeSheet: [
            'PRE_TRIGGER_RECONCILIATION',
            'SHEET_RECONCILIATION',
          ].includes(job.type),
          externalWrites: 0,
          externalMessages: 0,
        },
      },
    });
    await finishJob(database, job.id, 'COMPLETED', now, {
      type: job.type,
      plannedCount,
      operations,
      executionMode: 'DRY_RUN',
    });
    return;
  }

  if (['PRE_TRIGGER_RECONCILIATION', 'SHEET_RECONCILIATION'].includes(job.type)) {
    if (!context.session || !dependencies.attendanceSheet) {
      await finishJob(database, job.id, 'HUMAN_REVIEW', now, {
        reason: 'sheet_adapter_unconfigured',
        plannedType: job.type,
      });
      return;
    }
    const summary = await reconcileSheetSession(
      database,
      dependencies.attendanceSheet,
      context.session.id,
    );
    await finishJob(database, job.id, 'COMPLETED', now, {
      type: job.type,
      executionMode: 'ACTIVE',
      ...summary,
    });
    return;
  }

  if (job.type === 'BIWEEKLY_REPORT') {
    await finishJob(database, job.id, 'COMPLETED', now, {
      type: job.type,
      executionMode: 'ACTIVE',
      reportReady: true,
      deliveryRequiresStaffExport: true,
    });
    return;
  }

  await finishJob(database, job.id, 'HUMAN_REVIEW', now, {
    reason: 'active_provider_execution_not_authorized',
    plannedType: job.type,
    plannedCount,
  });
}

export async function failAutomationJob(
  database: PrismaClient,
  job: AutomationJob,
  now: Date,
  errorCode: string,
) {
  if (job.attemptNumber >= job.maxAttempts) {
    await database.automationJob.update({
      where: { id: job.id },
      data: {
        status: 'HUMAN_REVIEW',
        completedAt: now,
        claimedAt: null,
        claimedBy: null,
        errorCode,
      },
    });
    return;
  }
  await database.automationJob.update({
    where: { id: job.id },
    data: {
      status: 'PENDING',
      claimedAt: null,
      claimedBy: null,
      nextAttemptAt: retryAt(now, job.attemptNumber),
      errorCode,
    },
  });
}

export async function nextPendingRunAt(database: PrismaClient): Promise<Date | null> {
  const next = await database.automationJob.findFirst({
    where: { status: 'PENDING' },
    orderBy: [{ nextAttemptAt: 'asc' }, { runAt: 'asc' }],
    select: { runAt: true, nextAttemptAt: true },
  });
  if (!next) return null;
  return next.nextAttemptAt && next.nextAttemptAt > next.runAt ? next.nextAttemptAt : next.runAt;
}

export function nextWakeDelay(now: Date, nextRunAt: Date | null): number {
  if (!nextRunAt) return 15 * 60_000;
  return Math.max(1_000, Math.min(15 * 60_000, nextRunAt.getTime() - now.getTime()));
}
