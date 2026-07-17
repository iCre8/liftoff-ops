import { randomUUID } from 'node:crypto';

import { fail } from '@sveltejs/kit';

import { getDatabase } from '$lib/server/db';
import { requireRole } from '$lib/server/auth';
import { submitDailyForm } from '$lib/server/services/module-2';
import {
  accommodationRequestSchema,
  formWindowState,
  morningGoalsSchema,
} from '$lib/domain/module-2';

function todayInNewYork(): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return new Date(Date.UTC(Number(value.year), Number(value.month) - 1, Number(value.day)));
}

function currentWeekBounds() {
  const today = todayInNewYork();
  const monday = new Date(today);
  monday.setUTCDate(today.getUTCDate() - ((today.getUTCDay() + 6) % 7));
  const friday = new Date(monday);
  friday.setUTCDate(monday.getUTCDate() + 4);
  return { monday, friday };
}

async function context(locals: App.Locals) {
  const account = requireRole(locals, 'learner');
  if (!account.learner) throw new Error('Learner role is missing its cohort profile');
  const database = getDatabase();
  const session = await database.programSession.findUnique({
    where: {
      cohortId_sessionDate: {
        cohortId: account.learner.cohortId,
        sessionDate: todayInNewYork(),
      },
    },
  });
  return { account, database, learner: account.learner, session };
}

export const load = async ({ locals }) => {
  const { account, database, learner, session } = await context(locals);
  const submissions = session
    ? await database.submission.findMany({
        where: { learnerId: learner.id, sessionId: session.id },
        orderBy: { type: 'asc' },
      })
    : [];
  const morningSubmission = submissions.find((submission) => submission.type === 'GOALS_CHECK_IN');
  const morning = morningSubmission
    ? (morningGoalsSchema.safeParse(morningSubmission.content).data ?? null)
    : null;
  const now = new Date();
  const { monday, friday } = currentWeekBounds();
  const history = await database.submission.findMany({
    where: { learnerId: learner.id, session: { sessionDate: { gte: monday, lte: friday } } },
    include: {
      session: { select: { sessionDate: true } },
      _count: { select: { revisions: true } },
    },
    orderBy: { submittedAt: 'desc' },
  });
  const accommodations = await database.accommodation.findMany({
    where: { learnerId: learner.id },
    select: { id: true, category: true, status: true, requestedAt: true },
    orderBy: { requestedAt: 'desc' },
  });
  return {
    displayName: account.displayName ?? 'Learner',
    session: session
      ? {
          id: session.id,
          releaseAt: session.checkInReleasedAt,
          exitReleaseAt: session.exitTicketReleasedAt,
          closesAt: session.programDayEndsAt,
        }
      : null,
    submissions: submissions.map((submission) => ({
      type: submission.type,
      content: submission.content,
      submittedAt: submission.submittedAt,
      revisedAt: submission.updatedAt,
    })),
    morning,
    morningWindow: session
      ? formWindowState({
          now,
          releaseAt: session.checkInReleasedAt,
          closesAt: session.programDayEndsAt,
        })
      : 'closed',
    exitWindow: session
      ? formWindowState({
          now,
          releaseAt: session.exitTicketReleasedAt,
          closesAt: session.programDayEndsAt,
        })
      : 'closed',
    history: history.map((item) => ({
      id: item.id,
      type: item.type,
      sessionDate: item.session.sessionDate,
      submittedAt: item.submittedAt,
      revised: item._count.revisions > 1,
    })),
    accommodations,
    morningKey: randomUUID(),
    exitKey: randomUUID(),
  };
};

export const actions = {
  morning: async ({ request, locals }) => {
    const { account, database, learner, session } = await context(locals);
    if (!session) return fail(400, { message: 'No program session is scheduled today' });
    const data = await request.formData();
    try {
      await submitDailyForm(database, {
        learnerId: learner.id,
        sessionId: session.id,
        actorAccountId: account.id,
        type: 'GOALS_CHECK_IN',
        idempotencyKey: String(data.get('idempotencyKey') ?? ''),
        submittedAt: new Date(),
        content: {
          goals: data.get('goals'),
          firstTask: data.get('firstTask'),
          blockers: data.get('blockers'),
          supportNeeded: data.get('supportNeeded'),
        },
      });
      return { success: true, message: 'Morning goals saved' };
    } catch (cause) {
      return fail(400, {
        message: cause instanceof Error ? cause.message : 'Unable to save goals',
      });
    }
  },
  exit: async ({ request, locals }) => {
    const { account, database, learner, session } = await context(locals);
    if (!session) return fail(400, { message: 'No program session is scheduled today' });
    const data = await request.formData();
    try {
      await submitDailyForm(database, {
        learnerId: learner.id,
        sessionId: session.id,
        actorAccountId: account.id,
        type: 'EXIT_TICKET',
        idempotencyKey: String(data.get('idempotencyKey') ?? ''),
        submittedAt: new Date(),
        content: {
          goalResult: data.get('goalResult'),
          completed: data.get('completed'),
          explanation: data.get('explanation'),
          blockers: data.get('blockers'),
          supportNeeded: data.get('supportNeeded'),
        },
      });
      return { success: true, message: 'Exit ticket saved' };
    } catch (cause) {
      return fail(400, {
        message: cause instanceof Error ? cause.message : 'Unable to save exit ticket',
      });
    }
  },
  accommodation: async ({ request, locals }) => {
    const { account, database, learner } = await context(locals);
    const data = await request.formData();
    try {
      const requestValue = accommodationRequestSchema.parse({
        category: data.get('category'),
        requestedStart: data.get('requestedStart'),
        requestedEnd: data.get('requestedEnd') || undefined,
        requestedAdjustment: data.get('requestedAdjustment'),
        expectedBenefit: data.get('expectedBenefit'),
        preferredFollowUp: data.get('preferredFollowUp'),
      });
      const accommodation = await database.accommodation.create({
        data: {
          learnerId: learner.id,
          category: requestValue.category.toUpperCase() as never,
          startsAt: requestValue.requestedStart,
          endsAt: requestValue.requestedEnd,
          requestedAdjustment: requestValue.requestedAdjustment,
          expectedBenefit: requestValue.expectedBenefit,
          preferredFollowUp: requestValue.preferredFollowUp,
        },
      });
      await database.auditEvent.create({
        data: {
          accountId: account.id,
          eventType: 'accommodation.requested',
          entityType: 'Accommodation',
          entityId: accommodation.id,
          payload: {},
        },
      });
      return { success: true, message: 'Accommodation request submitted for review' };
    } catch (cause) {
      return fail(400, {
        message: cause instanceof Error ? cause.message : 'Unable to submit request',
      });
    }
  },
};
