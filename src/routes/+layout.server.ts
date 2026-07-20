import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
  if (!locals.account) {
    return { account: null };
  }

  const primaryRole = locals.account.roles[0]?.role || 'LEARNER';
  const roleList = locals.account.roles.map((r) => r.role);
  const displayName = locals.account.displayName || locals.account.email;

  return {
    account: {
      email: locals.account.email,
      displayName,
      primaryRole,
      roles: roleList,
    },
  };
};
