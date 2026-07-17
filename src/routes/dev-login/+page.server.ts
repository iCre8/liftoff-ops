import { dev } from '$app/environment';
import { error, redirect } from '@sveltejs/kit';

import { getDatabase } from '$lib/server/db';

export const load = async () => {
  if (!dev || process.env.ENABLE_SANITIZED_DEV_AUTH !== 'true') error(404);
  return {
    accounts: await getDatabase().account.findMany({
      where: { email: { endsWith: '@example.test' }, status: 'ACTIVE' },
      select: { email: true, displayName: true, roles: { select: { role: true } } },
      orderBy: { email: 'asc' },
    }),
  };
};

export const actions = {
  default: async ({ request, cookies }) => {
    if (!dev || process.env.ENABLE_SANITIZED_DEV_AUTH !== 'true') error(404);
    const email = String((await request.formData()).get('email') ?? '');
    const account = await getDatabase().account.findUnique({
      where: { email },
      include: { roles: true },
    });
    if (!account || !email.endsWith('@example.test') || account.status !== 'ACTIVE') error(403);
    cookies.set('liftoff_dev_identity', email, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      maxAge: 8 * 60 * 60,
    });
    const roles = new Set(account.roles.map((assignment) => assignment.role));
    const learner = roles.has('LEARNER');
    const operations = (
      ['ADMIN', 'FACILITATOR', 'INSTRUCTOR_TA', 'OUTREACH_SUPPORT'] as const
    ).some((role) => roles.has(role));
    if (learner && !operations) redirect(303, '/learner');
    if (operations && !learner) redirect(303, '/operations');
    redirect(303, '/');
  },
};
