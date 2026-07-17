import { dev } from '$app/environment';
import { error, redirect } from '@sveltejs/kit';

import type { AppRole } from '$lib/domain/module-2';

const databaseRole: Record<AppRole, string> = {
  learner: 'LEARNER',
  admin: 'ADMIN',
  facilitator: 'FACILITATOR',
  instructor_ta: 'INSTRUCTOR_TA',
  outreach_support: 'OUTREACH_SUPPORT',
  read_only: 'READ_ONLY',
};

export function requireAccount(locals: App.Locals) {
  if (!locals.account) {
    if (dev && process.env.ENABLE_SANITIZED_DEV_AUTH === 'true') {
      redirect(303, '/dev-login');
    } else {
      redirect(303, '/');
    }
  }
  return locals.account;
}

export function requireRole(locals: App.Locals, role: AppRole) {
  const account = requireAccount(locals);
  if (!account.roles.some((assignment) => assignment.role === databaseRole[role])) {
    error(403, 'This workspace is not available for the signed-in account');
  }
  return account;
}
