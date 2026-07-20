import { fail } from '@sveltejs/kit';
import { randomUUID } from 'node:crypto';

import { activationEligibility, validatePause } from '$lib/domain/phase-3';
import { requireAccount } from '$lib/server/auth';
import { readRequiredSecret } from '$lib/server/config/secrets';
import { getDatabase } from '$lib/server/db';
import { SlackDirectory } from '$lib/server/integrations/slack-directory';
import {
  archiveCohortIncidents,
  restoreCohortIncidents,
} from '$lib/server/services/phase-3-operations';

const staffRoles = new Set(['ADMIN', 'FACILITATOR', 'INSTRUCTOR_TA', 'OUTREACH_SUPPORT']);

function staffAccount(locals: App.Locals) {
  const account = requireAccount(locals);
  if (!account.roles.some((assignment) => staffRoles.has(assignment.role))) {
    throw new Error('Staff automation access is required');
  }
  return account;
}

function isAdmin(account: ReturnType<typeof staffAccount>) {
  return account.roles.some((assignment) => assignment.role === 'ADMIN');
}

function canManageTemplates(account: ReturnType<typeof staffAccount>) {
  return account.roles.some((assignment) => ['ADMIN', 'FACILITATOR'].includes(assignment.role));
}

function canReview(account: ReturnType<typeof staffAccount>) {
  return account.roles.some((assignment) =>
    ['ADMIN', 'FACILITATOR', 'INSTRUCTOR_TA'].includes(assignment.role),
  );
}

function authorizedCohortIds(account: ReturnType<typeof staffAccount>) {
  return isAdmin(account)
    ? null
    : [
        ...new Set(
          account.roles.flatMap((assignment) =>
            assignment.cohortId && staffRoles.has(assignment.role) ? [assignment.cohortId] : [],
          ),
        ),
      ];
}

function canAccessCohort(account: ReturnType<typeof staffAccount>, cohortId: string) {
  const cohortIds = authorizedCohortIds(account);
  return cohortIds === null || cohortIds.includes(cohortId);
}

async function resolveSlackMappings(cohortId: string) {
  const learners = await getDatabase().learner.findMany({
    where: { cohortId },
    select: { id: true, externalId: true },
    orderBy: { externalId: 'asc' },
  });
  if (learners.length === 0) throw new Error('The cohort has no learners to map');

  const directory = new SlackDirectory(readRequiredSecret('SLACK_BOT_TOKEN'));
  const mappings: Array<{
    learnerId: string;
    learnerExternalId: string;
    slackMemberId: string;
  }> = [];
  for (const learner of learners) {
    const match = await directory.lookupByEmail(learner.externalId);
    mappings.push({
      learnerId: learner.id,
      learnerExternalId: match.normalizedEmail,
      slackMemberId: match.memberId,
    });
  }
  if (new Set(mappings.map((mapping) => mapping.slackMemberId)).size !== mappings.length) {
    throw new Error('Slack directory resolution produced duplicate member IDs');
  }
  return mappings;
}

export const load = async ({ locals }) => {
  const account = staffAccount(locals);
  const database = getDatabase();
  const cohortIds = authorizedCohortIds(account);
  const cohortWhere = cohortIds === null ? {} : { id: { in: cohortIds } };
  const learnerMapping = await database.learner.groupBy({
    by: ['cohortId'],
    where: cohortIds === null ? {} : { cohortId: { in: cohortIds } },
    _count: { id: true, slackMemberId: true },
  });
  return {
    isAdmin: isAdmin(account),
    canManageTemplates: canManageTemplates(account),
    canReview: canReview(account),
    activeModeEnabled: process.env.ENABLE_PHASE3_ACTIVE_MODE === 'true',
    cohorts: await database.cohort.findMany({
      where: { archivedAt: null, ...cohortWhere },
      select: {
        id: true,
        name: true,
        automationMode: true,
        modeChangedAt: true,
        _count: {
          select: {
            automationJobs: { where: { status: { in: ['PENDING', 'HUMAN_REVIEW'] } } },
            blackoutDates: { where: { removedAt: null } },
          },
        },
      },
      orderBy: { startsOn: 'desc' },
    }),
    archivedCohorts: isAdmin(account)
      ? await database.cohort.findMany({
          where: { archivedAt: { not: null } },
          select: { id: true, name: true, archivedAt: true },
          orderBy: { archivedAt: 'desc' },
        })
      : [],
    templates: await database.messageTemplate.findMany({
      where: cohortIds === null ? {} : { cohortId: { in: cohortIds } },
      select: { id: true, cohortId: true, key: true, version: true, status: true },
      orderBy: [{ key: 'asc' }, { version: 'desc' }],
    }),
    jobs: await database.automationJob.findMany({
      where: {
        ...(cohortIds === null ? {} : { cohortId: { in: cohortIds } }),
        status: { in: ['PENDING', 'HUMAN_REVIEW', 'FAILED'] },
      },
      select: { id: true, cohortId: true, type: true, status: true, runAt: true, errorCode: true },
      orderBy: { runAt: 'asc' },
      take: 50,
    }),
    dryRunPlans: await database.automationJob.findMany({
      where: {
        ...(cohortIds === null ? {} : { cohortId: { in: cohortIds } }),
        status: 'COMPLETED',
        payload: { path: ['executionMode'], equals: 'DRY_RUN' },
      },
      select: { id: true, type: true, runAt: true, payload: true },
      orderBy: { completedAt: 'desc' },
      take: 20,
    }),
    blackouts: await database.blackoutDate.findMany({
      where: {
        ...(cohortIds === null ? {} : { cohortId: { in: cohortIds } }),
        removedAt: null,
      },
      select: { id: true, cohortId: true, date: true, reason: true },
      orderBy: { date: 'asc' },
    }),
    mappingCounts: learnerMapping.map((item) => ({
      cohortId: item.cohortId,
      learners: item._count.id,
      verifiedSlackMappings: item._count.slackMemberId,
    })),
    unresolvedReviews: await database.unresolvedReview.findMany({
      where: {
        incident: {
          learner: cohortIds === null ? {} : { cohortId: { in: cohortIds } },
        },
      },
      select: {
        id: true,
        incidentId: true,
        status: true,
        dueAt: true,
        annotatedAt: true,
        incident: { select: { type: true, learner: { select: { externalId: true } } } },
      },
      orderBy: { dueAt: 'asc' },
      take: 100,
    }),
    dryRunDays: await database.dryRunDay.findMany({
      where: cohortIds === null ? {} : { cohortId: { in: cohortIds } },
      orderBy: { date: 'desc' },
      take: 30,
    }),
    baselines: await database.baselineMeasurement.findMany({
      where: cohortIds === null ? {} : { cohortId: { in: cohortIds } },
      orderBy: { measurementDate: 'desc' },
      take: 30,
    }),
    outreach: await database.outreachAttempt.findMany({
      where: {
        incident: { learner: cohortIds === null ? {} : { cohortId: { in: cohortIds } } },
        status: { in: ['FAILED', 'DELIVERED', 'ACCEPTED'] },
      },
      select: { id: true, channel: true, status: true, attemptNumber: true, errorCode: true },
      orderBy: { updatedAt: 'desc' },
      take: 30,
    }),
    sessions: await database.programSession.findMany({
      where: cohortIds === null ? {} : { cohortId: { in: cohortIds } },
      select: { id: true, cohortId: true, sessionDate: true },
      orderBy: { sessionDate: 'desc' },
      take: 50,
    }),
  };
};

export const actions = {
  slackMappingPreview: async ({ request, locals }) => {
    const account = staffAccount(locals);
    if (!isAdmin(account)) return fail(403, { message: 'Admin access required' });
    const cohortId = String((await request.formData()).get('cohortId') ?? '');
    if (!canAccessCohort(account, cohortId))
      return fail(403, { message: 'Cohort access required' });
    try {
      const slackMappingPreview = await resolveSlackMappings(cohortId);
      return {
        success: true,
        message: `${slackMappingPreview.length} Slack mappings resolved; confirm every row before saving`,
        cohortId,
        slackMappingPreview,
      };
    } catch (cause) {
      return fail(409, {
        message: cause instanceof Error ? cause.message : 'Slack mapping preview failed',
      });
    }
  },
  slackMappingConfirm: async ({ request, locals }) => {
    const account = staffAccount(locals);
    if (!isAdmin(account)) return fail(403, { message: 'Admin access required' });
    const data = await request.formData();
    const cohortId = String(data.get('cohortId') ?? '');
    const confirmation = String(data.get('confirmation') ?? '');
    const confirmedLearnerIds = new Set(data.getAll('confirmedLearnerId').map(String));
    if (!canAccessCohort(account, cohortId))
      return fail(403, { message: 'Cohort access required' });
    if (confirmation !== 'CONFIRM SLACK MAPPINGS') {
      return fail(400, { message: 'Type CONFIRM SLACK MAPPINGS to save mappings' });
    }
    try {
      const mappings = await resolveSlackMappings(cohortId);
      if (
        confirmedLearnerIds.size !== mappings.length ||
        mappings.some((mapping) => !confirmedLearnerIds.has(mapping.learnerId))
      ) {
        return fail(400, { message: 'Every resolved mapping must be individually confirmed' });
      }
      await getDatabase().$transaction(async (transaction) => {
        for (const mapping of mappings) {
          await transaction.learner.update({
            where: { id: mapping.learnerId },
            data: {
              slackMemberId: mapping.slackMemberId,
              slackMappingVerifiedAt: new Date(),
              slackMappingVerifiedBy: account.id,
            },
          });
        }
        await transaction.auditEvent.create({
          data: {
            accountId: account.id,
            eventType: 'slack.mapping_confirmed',
            entityType: 'Cohort',
            entityId: cohortId,
            payload: { mappingCount: mappings.length },
          },
        });
      });
      return { success: true, message: `${mappings.length} Slack mappings confirmed` };
    } catch (cause) {
      return fail(409, {
        message: cause instanceof Error ? cause.message : 'Slack mapping confirmation failed',
      });
    }
  },
  mode: async ({ request, locals }) => {
    const account = staffAccount(locals);
    if (!isAdmin(account)) return fail(403, { message: 'Admin access required' });
    const data = await request.formData();
    const cohortId = String(data.get('cohortId') ?? '');
    const mode = String(data.get('mode') ?? '');
    if (!['DISABLED', 'DRY_RUN', 'ACTIVE'].includes(mode))
      return fail(400, { message: 'Invalid automation mode' });
    if (!canAccessCohort(account, cohortId))
      return fail(403, { message: 'Cohort access required' });
    if (mode === 'ACTIVE') {
      if (process.env.ENABLE_PHASE3_ACTIVE_MODE !== 'true') {
        return fail(403, { message: 'Active mode is not authorized in this environment' });
      }
      const days = await getDatabase().dryRunDay.findMany({
        where: { cohortId, completedAt: { not: null } },
      });
      const gate = activationEligibility({
        completeDryRunDays: days.length,
        hasFormalReview: days.some((day) => day.reviewedAt),
        duplicateCount: days.reduce((sum, day) => sum + day.duplicateCount, 0),
        unresolvedMappings: days.reduce((sum, day) => sum + day.unresolvedMappings, 0),
        approvedExceptionReason: String(data.get('exceptionReason') ?? ''),
      });
      if (!gate.eligible) return fail(409, { message: gate.reason });
    }
    await getDatabase().$transaction(async (transaction) => {
      await transaction.cohort.update({
        where: { id: cohortId },
        data: {
          automationMode: mode as never,
          modeChangedAt: new Date(),
          modeChangedBy: account.id,
          activatedAt: mode === 'ACTIVE' ? new Date() : undefined,
        },
      });
      await transaction.auditEvent.create({
        data: {
          accountId: account.id,
          eventType: 'automation.mode_changed',
          entityType: 'Cohort',
          entityId: cohortId,
          payload: { mode },
        },
      });
    });
    return { success: true, message: `Automation mode changed to ${mode.toLowerCase()}` };
  },
  templateDraft: async ({ request, locals }) => {
    const account = staffAccount(locals);
    if (!canManageTemplates(account))
      return fail(403, { message: 'Template management access required' });
    const data = await request.formData();
    const cohortId = String(data.get('cohortId') ?? '');
    const key = String(data.get('key') ?? '').trim();
    const content = String(data.get('content') ?? '').trim();
    if (!canAccessCohort(account, cohortId))
      return fail(403, { message: 'Cohort access required' });
    if (!key || !content || content.length > 4000)
      return fail(400, { message: 'A key and bounded template content are required' });
    const latest = await getDatabase().messageTemplate.findFirst({
      where: { cohortId, key },
      orderBy: { version: 'desc' },
    });
    await getDatabase().messageTemplate.create({
      data: { cohortId, key, version: (latest?.version ?? 0) + 1, content, status: 'DRAFT' },
    });
    return { success: true, message: 'New template draft created' };
  },
  templateApprove: async ({ request, locals }) => {
    const account = staffAccount(locals);
    if (!canManageTemplates(account))
      return fail(403, { message: 'Template approval access required' });
    const id = String((await request.formData()).get('id') ?? '');
    const template = await getDatabase().messageTemplate.findUnique({ where: { id } });
    if (!template || !canAccessCohort(account, template.cohortId))
      return fail(404, { message: 'Template was not found' });
    if (template.status !== 'DRAFT') return fail(409, { message: 'Only drafts can be approved' });
    await getDatabase().messageTemplate.update({
      where: { id },
      data: { status: 'APPROVED', approvedAt: new Date(), approvedBy: account.id },
    });
    return { success: true, message: 'Template version approved and locked' };
  },
  blackout: async ({ request, locals }) => {
    const account = staffAccount(locals);
    if (!isAdmin(account)) return fail(403, { message: 'Admin access required' });
    const data = await request.formData();
    const cohortId = String(data.get('cohortId') ?? '');
    const date = new Date(`${String(data.get('date') ?? '')}T00:00:00Z`);
    const reason = String(data.get('reason') ?? '').trim();
    if (!canAccessCohort(account, cohortId) || Number.isNaN(date.getTime()) || !reason)
      return fail(400, { message: 'Cohort, date, and reason are required' });
    await getDatabase().blackoutDate.upsert({
      where: { cohortId_date: { cohortId, date } },
      create: { cohortId, date, reason, createdBy: account.id },
      update: { reason, removedAt: null, removedBy: null, createdBy: account.id },
    });
    return { success: true, message: 'Blackout date saved' };
  },
  pause: async ({ request, locals }) => {
    const account = staffAccount(locals);
    if (!canManageTemplates(account))
      return fail(403, { message: 'Pause management access required' });
    const data = await request.formData();
    const cohortId = String(data.get('cohortId') ?? '');
    const startsAt = new Date(String(data.get('startsAt') ?? ''));
    const endValue = String(data.get('endsAt') ?? '');
    const endsAt = endValue ? new Date(endValue) : undefined;
    const reasonCode = String(data.get('reason') ?? '').trim();
    if (!canAccessCohort(account, cohortId) || Number.isNaN(startsAt.getTime()) || !reasonCode)
      return fail(400, { message: 'Cohort, start, and reason are required' });
    try {
      validatePause({ startsAt, endsAt, actorIsAdmin: isAdmin(account) });
      await getDatabase().automationPause.create({
        data: { cohortId, startsAt, endsAt, reasonCode, approvedBy: account.id },
      });
      return { success: true, message: 'Automation pause saved' };
    } catch (cause) {
      return fail(400, { message: cause instanceof Error ? cause.message : 'Invalid pause' });
    }
  },
  annotateReview: async ({ request, locals }) => {
    const account = staffAccount(locals);
    if (!canReview(account)) return fail(403, { message: 'Review access required' });
    const data = await request.formData();
    const id = String(data.get('id') ?? '');
    const status = String(data.get('status') ?? '').trim();
    const actionTaken = String(data.get('actionTaken') ?? '').trim();
    const disposition = String(data.get('disposition') ?? '').trim();
    const closureNote = String(data.get('closureNote') ?? '').trim();
    const review = await getDatabase().unresolvedReview.findUnique({
      where: { id },
      include: { incident: { include: { learner: true } } },
    });
    if (!review || !canAccessCohort(account, review.incident.learner.cohortId))
      return fail(404, { message: 'Review was not found' });
    if (!status || !actionTaken || !disposition || !closureNote || closureNote.length > 2000)
      return fail(400, { message: 'Status, action, disposition, and closure note are required' });
    await getDatabase().unresolvedReview.update({
      where: { id },
      data: {
        ownerAccountId: account.id,
        status,
        actionTaken,
        disposition,
        closureNote,
        annotatedAt: new Date(),
      },
    });
    return { success: true, message: 'Unresolved review annotated' };
  },
  baseline: async ({ request, locals }) => {
    const account = staffAccount(locals);
    if (!canReview(account)) return fail(403, { message: 'Baseline access required' });
    const data = await request.formData();
    const cohortId = String(data.get('cohortId') ?? '');
    const measurementDate = new Date(`${String(data.get('date') ?? '')}T00:00:00Z`);
    const values = ['minutes', 'incidents', 'unresolved'].map((key) => Number(data.get(key)));
    if (
      !canAccessCohort(account, cohortId) ||
      Number.isNaN(measurementDate.getTime()) ||
      values.some((value) => !Number.isInteger(value) || value < 0)
    )
      return fail(400, {
        message: 'A valid date and nonnegative whole-number measures are required',
      });
    await getDatabase().baselineMeasurement.upsert({
      where: {
        cohortId_measurementDate_recordedBy: {
          cohortId,
          measurementDate,
          recordedBy: account.id,
        },
      },
      create: {
        cohortId,
        measurementDate,
        recordedBy: account.id,
        outreachCoordinationMinutes: values[0],
        incidentsHandled: values[1],
        unresolvedItems: values[2],
      },
      update: {
        outreachCoordinationMinutes: values[0],
        incidentsHandled: values[1],
        unresolvedItems: values[2],
      },
    });
    return { success: true, message: 'Baseline measurement saved' };
  },
  dryRunReview: async ({ request, locals }) => {
    const account = staffAccount(locals);
    if (!canReview(account)) return fail(403, { message: 'Dry-run review access required' });
    const data = await request.formData();
    const cohortId = String(data.get('cohortId') ?? '');
    const date = new Date(`${String(data.get('date') ?? '')}T00:00:00Z`);
    const duplicateCount = Number(data.get('duplicates') ?? 0);
    const unresolvedMappings = Number(data.get('mappings') ?? 0);
    if (
      !canAccessCohort(account, cohortId) ||
      Number.isNaN(date.getTime()) ||
      !Number.isInteger(duplicateCount) ||
      duplicateCount < 0 ||
      !Number.isInteger(unresolvedMappings) ||
      unresolvedMappings < 0
    )
      return fail(400, { message: 'Valid dry-run evidence is required' });
    await getDatabase().dryRunDay.upsert({
      where: { cohortId_date: { cohortId, date } },
      create: {
        cohortId,
        date,
        completedAt: new Date(),
        reviewedAt: new Date(),
        reviewedBy: account.id,
        duplicateCount,
        unresolvedMappings,
      },
      update: {
        completedAt: new Date(),
        reviewedAt: new Date(),
        reviewedBy: account.id,
        duplicateCount,
        unresolvedMappings,
      },
    });
    return { success: true, message: 'Dry-run day completed and reviewed' };
  },
  reconcileNow: async ({ request, locals }) => {
    const account = staffAccount(locals);
    if (!canReview(account)) return fail(403, { message: 'Reconciliation access required' });
    const sessionId = String((await request.formData()).get('sessionId') ?? '');
    const session = await getDatabase().programSession.findUnique({ where: { id: sessionId } });
    if (!session || !canAccessCohort(account, session.cohortId))
      return fail(404, { message: 'Session was not found' });
    await getDatabase().automationJob.create({
      data: {
        idempotencyKey: `manual-reconcile:${session.id}:${randomUUID()}`,
        cohortId: session.cohortId,
        sessionId: session.id,
        type: 'SHEET_RECONCILIATION',
        runAt: new Date(),
        payload: { requestedBy: account.id, boundedReadOnly: true },
      },
    });
    return { success: true, message: 'Bounded reconciliation queued' };
  },
  resend: async ({ request, locals }) => {
    const account = staffAccount(locals);
    if (!canManageTemplates(account)) return fail(403, { message: 'Resend access required' });
    const data = await request.formData();
    const id = String(data.get('id') ?? '');
    const reason = String(data.get('reason') ?? '').trim();
    const attempt = await getDatabase().outreachAttempt.findUnique({
      where: { id },
      include: { incident: { include: { learner: true } } },
    });
    if (!attempt || !canAccessCohort(account, attempt.incident.learner.cohortId))
      return fail(404, { message: 'Outreach attempt was not found' });
    if (attempt.status !== 'FAILED' && (!isAdmin(account) || !reason))
      return fail(409, { message: 'Successful-message resend requires admin override and reason' });
    await getDatabase().outreachAttempt.create({
      data: {
        idempotencyKey: `resend:${attempt.id}:${randomUUID()}`,
        incidentId: attempt.incidentId,
        templateId: attempt.templateId,
        channel: attempt.channel,
        recipientRef: attempt.recipientRef,
        attemptNumber: attempt.attemptNumber + 1,
        executionMode: 'DRY_RUN',
        status: 'PENDING',
      },
    });
    return { success: true, message: 'Resend preview queued with external delivery disabled' };
  },
  archive: async ({ request, locals }) => {
    const account = staffAccount(locals);
    if (!isAdmin(account)) return fail(403, { message: 'Admin access required' });
    const data = await request.formData();
    const cohortId = String(data.get('cohortId') ?? '');
    if (!canAccessCohort(account, cohortId) || data.get('confirmation') !== 'ARCHIVE')
      return fail(400, { message: 'Type ARCHIVE to confirm reversible archival' });
    const count = await archiveCohortIncidents(getDatabase(), { cohortId, actorId: account.id });
    return { success: true, message: `${count} incidents archived with recovery snapshots` };
  },
  restoreArchive: async ({ request, locals }) => {
    const account = staffAccount(locals);
    if (!isAdmin(account)) return fail(403, { message: 'Admin access required' });
    const data = await request.formData();
    const cohortId = String(data.get('cohortId') ?? '');
    if (data.get('confirmation') !== 'RESTORE')
      return fail(400, { message: 'Type RESTORE to confirm archival recovery' });
    const count = await restoreCohortIncidents(getDatabase(), {
      cohortId,
      actorId: account.id,
    });
    return { success: true, message: `${count} archived incidents restored` };
  },
};
