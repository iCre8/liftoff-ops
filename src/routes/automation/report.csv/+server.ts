import { error } from '@sveltejs/kit';

import { requireAccount } from '$lib/server/auth';
import { getDatabase } from '$lib/server/db';
import { buildCohortReportCsv } from '$lib/server/services/phase-3-operations';

const staffRoles = new Set(['ADMIN', 'FACILITATOR', 'INSTRUCTOR_TA', 'OUTREACH_SUPPORT']);

export const GET = async ({ locals, url }) => {
  const account = requireAccount(locals);
  const cohortId = url.searchParams.get('cohortId') ?? '';
  const isAdmin = account.roles.some((assignment) => assignment.role === 'ADMIN');
  const scoped = account.roles.some(
    (assignment) => assignment.cohortId === cohortId && staffRoles.has(assignment.role),
  );
  if (!cohortId || (!isAdmin && !scoped)) throw error(403, 'Cohort report access required');
  const csv = await buildCohortReportCsv(getDatabase(), cohortId);
  return new Response(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': 'attachment; filename="liftoff-attendance-report.csv"',
      'cache-control': 'private, no-store',
    },
  });
};
