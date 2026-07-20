import { requireRole } from '$lib/server/auth';

export const load = ({ locals }) => {
  requireRole(locals, 'learner');
  return {};
};
