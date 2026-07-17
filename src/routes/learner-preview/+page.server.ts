import { error } from '@sveltejs/kit';

import { requireAccount } from '$lib/server/auth';

const previewRoles = new Set(['ADMIN', 'FACILITATOR', 'INSTRUCTOR_TA']);

export const load = ({ locals }) => {
  const account = requireAccount(locals);
  if (!account.roles.some((assignment) => previewRoles.has(assignment.role))) {
    error(403, 'Learner preview access is required');
  }
  return { displayName: account.displayName ?? 'Staff' };
};
