import { fail } from '@sveltejs/kit';

import { getDatabase } from '$lib/server/db';
import { requireAccount } from '$lib/server/auth';
import { hashToken, oauthCookieOptions, tokensMatch } from '$lib/server/google-oauth';
import { applyAccountImport, previewAccountImport } from '$lib/server/services/provisioning';
import {
  applyProgramSessions,
  previewProgramSessions,
  readSessionCatalog,
  sessionCatalogConfigured,
} from '$lib/server/services/program-sessions';

const operationalRoles = new Set(['ADMIN', 'FACILITATOR', 'INSTRUCTOR_TA', 'OUTREACH_SUPPORT']);
const ACCOUNT_PREVIEW_COOKIE = 'liftoff_account_import_preview';
const SESSION_PREVIEW_COOKIE = 'liftoff_session_import_preview';

function operationsAccount(locals: App.Locals) {
  const account = requireAccount(locals);
  if (!account.roles.some((assignment) => operationalRoles.has(assignment.role))) {
    throw new Error('Operations access is required');
  }
  return account;
}

function accountScope(account: ReturnType<typeof operationsAccount>) {
  const isAdmin = account.roles.some((assignment) => assignment.role === 'ADMIN');
  const cohortIds = [
    ...new Set(
      account.roles
        .filter((assignment) => operationalRoles.has(assignment.role))
        .flatMap((assignment) => (assignment.cohortId ? [assignment.cohortId] : [])),
    ),
  ];
  return {
    isAdmin,
    learner: isAdmin ? {} : { learner: { cohortId: { in: cohortIds } } },
  };
}

export const load = async ({ locals }) => {
  const account = operationsAccount(locals);
  const database = getDatabase();
  const { isAdmin, learner } = accountScope(account);
  const canReviewAccommodations = account.roles.some((assignment) =>
    ['ADMIN', 'FACILITATOR'].includes(assignment.role),
  );
  return {
    displayName: account.displayName ?? 'Staff',
    isAdmin,
    supportItems: await database.supportItem.findMany({
      where: { status: { not: 'RESOLVED' }, ...learner },
      select: { id: true, summary: true, status: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    }),
    incidents: await database.incident.findMany({
      where: { status: { in: ['OPEN', 'CLAIMED'] }, ...learner },
      select: { id: true, type: true, status: true, detectedAt: true },
      orderBy: { detectedAt: 'asc' },
    }),
    accommodations: canReviewAccommodations
      ? await database.accommodation.findMany({
          where: { status: { in: ['REQUESTED', 'TEMPORARILY_PAUSED'] }, ...learner },
          select: {
            id: true,
            category: true,
            requestedAdjustment: true,
            expectedBenefit: true,
            preferredFollowUp: true,
            status: true,
          },
          orderBy: { requestedAt: 'asc' },
        })
      : [],
    accounts: isAdmin
      ? await database.account.findMany({
          select: { email: true, displayName: true, status: true },
          orderBy: { email: 'asc' },
        })
      : [],
    cohorts: isAdmin
      ? await database.cohort.findMany({
          where: { archivedAt: null },
          select: { id: true, name: true },
          orderBy: { startsOn: 'desc' },
        })
      : [],
    sessionCatalogConfigured: isAdmin && sessionCatalogConfigured(),
  };
};

export const actions = {
  support: async ({ request, locals }) => {
    const account = operationsAccount(locals);
    const { learner } = accountScope(account);
    const data = await request.formData();
    const id = String(data.get('id') ?? '');
    const mode = data.get('mode') === 'resolve' ? 'resolve' : 'acknowledge';
    const result = await getDatabase().supportItem.updateMany({
      where: { id, status: { not: 'RESOLVED' }, ...learner },
      data:
        mode === 'resolve'
          ? { status: 'RESOLVED', resolvedAt: new Date(), resolvedBy: account.id }
          : { status: 'ACKNOWLEDGED', acknowledgedAt: new Date(), acknowledgedBy: account.id },
    });
    return result.count === 1
      ? { success: true, message: `Support item ${mode}d` }
      : fail(409, { message: 'Support item was already updated' });
  },
  incident: async ({ request, locals }) => {
    const account = operationsAccount(locals);
    const { learner } = accountScope(account);
    const data = await request.formData();
    const id = String(data.get('id') ?? '');
    const mode = data.get('mode') === 'close' ? 'close' : 'claim';
    const database = getDatabase();
    if (mode === 'claim') {
      const result = await database.incident.updateMany({
        where: { id, status: 'OPEN', ...learner },
        data: { status: 'CLAIMED', claimedAt: new Date() },
      });
      if (result.count !== 1) return fail(409, { message: 'Incident was already claimed' });
      await database.incidentEvent.create({
        data: {
          incidentId: id,
          eventType: 'claimed',
          actorType: 'account',
          actorId: account.id,
          payload: {},
        },
      });
      return { success: true, message: 'Incident claimed' };
    }
    const closureReason = String(data.get('closureReason') ?? '').trim();
    const resultCode = String(data.get('result') ?? '').trim();
    const disposition = String(data.get('disposition') ?? '').trim();
    if (!closureReason || !resultCode || !disposition)
      return fail(400, { message: 'Outcome, disposition, and closure reason are required' });
    const result = await database.incident.updateMany({
      where: { id, status: 'CLAIMED', ...learner },
      data: { status: 'RESOLVED', closedAt: new Date(), closureReason },
    });
    if (result.count !== 1) return fail(409, { message: 'Incident was already updated' });
    await database.incidentEvent.create({
      data: {
        incidentId: id,
        eventType: 'outcome_recorded',
        actorType: 'account',
        actorId: account.id,
        payload: {
          result: resultCode,
          disposition,
          followUpDate: String(data.get('followUpDate') ?? ''),
        },
      },
    });
    return { success: true, message: 'Incident outcome saved' };
  },
  accommodation: async ({ request, locals }) => {
    const account = operationsAccount(locals);
    const canReview = account.roles.some((assignment) =>
      ['ADMIN', 'FACILITATOR'].includes(assignment.role),
    );
    if (!canReview) return fail(403, { message: 'Accommodation review access required' });
    const { isAdmin, learner } = accountScope(account);
    const data = await request.formData();
    const id = String(data.get('id') ?? '');
    const decision = String(data.get('decision') ?? '');
    if (!isAdmin && decision !== 'TEMPORARILY_PAUSED')
      return fail(403, { message: 'Admin approval is required' });
    if (!['TEMPORARILY_PAUSED', 'APPROVED', 'DENIED'].includes(decision))
      return fail(400, { message: 'Invalid decision' });
    const result = await getDatabase().accommodation.updateMany({
      where: { id, ...learner },
      data: { status: decision as never, reviewedAt: new Date(), reviewedBy: account.id },
    });
    if (result.count !== 1) return fail(404, { message: 'Accommodation request was not found' });
    return { success: true, message: 'Accommodation review saved' };
  },
  importAccounts: async ({ request, locals, cookies }) => {
    const account = operationsAccount(locals);
    if (!account.roles.some((assignment) => assignment.role === 'ADMIN'))
      return fail(403, { message: 'Admin access required' });
    const data = await request.formData();
    const csv = String(data.get('csv') ?? '');
    const csvHash = hashToken(csv);
    try {
      const confirm = data.get('confirm') === 'yes';
      if (confirm && !tokensMatch(cookies.get(ACCOUNT_PREVIEW_COOKIE), csvHash)) {
        return fail(409, { message: 'Preview this exact account import before confirming it' });
      }
      const preview = confirm
        ? await applyAccountImport(getDatabase(), csv, account.id)
        : await previewAccountImport(getDatabase(), csv);
      if (confirm) cookies.delete(ACCOUNT_PREVIEW_COOKIE, { path: '/' });
      else cookies.set(ACCOUNT_PREVIEW_COOKIE, csvHash, oauthCookieOptions());
      return {
        success: confirm,
        message: confirm ? 'Account import applied' : 'Preview ready',
        preview,
        accountImport: confirm ? undefined : { csv },
      };
    } catch (cause) {
      return fail(400, { message: cause instanceof Error ? cause.message : 'Import failed' });
    }
  },
  importSessions: async ({ request, locals, cookies }) => {
    const account = operationsAccount(locals);
    if (!account.roles.some((assignment) => assignment.role === 'ADMIN'))
      return fail(403, { message: 'Admin access required' });
    const data = await request.formData();
    const cohortId = String(data.get('cohortId') ?? '').trim();
    const authorizedCohort = await getDatabase().cohort.findUnique({ where: { id: cohortId } });
    if (!authorizedCohort) return fail(404, { message: 'Cohort was not found' });
    try {
      const catalog = readSessionCatalog();
      const catalogHash = hashToken(JSON.stringify({ cohortId, catalog }));
      const confirm = data.get('confirm') === 'yes';
      if (confirm && !tokensMatch(cookies.get(SESSION_PREVIEW_COOKIE), catalogHash)) {
        return fail(409, { message: 'Preview this exact session import before confirming it' });
      }
      const sessionPreview = confirm
        ? await applyProgramSessions(getDatabase(), cohortId, catalog, account.id)
        : await previewProgramSessions(getDatabase(), cohortId, catalog);
      if (confirm) cookies.delete(SESSION_PREVIEW_COOKIE, { path: '/' });
      else cookies.set(SESSION_PREVIEW_COOKIE, catalogHash, oauthCookieOptions());
      return {
        success: confirm,
        message: confirm ? 'Program sessions imported' : 'Session preview ready',
        sessionPreview,
        sessionImport: confirm ? undefined : { cohortId },
      };
    } catch (cause) {
      return fail(400, {
        message: cause instanceof Error ? cause.message : 'Session import failed',
      });
    }
  },
};
