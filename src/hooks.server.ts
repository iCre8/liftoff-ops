import 'dotenv/config';
import { dev } from '$app/environment';
import type { Handle } from '@sveltejs/kit';

import { getDatabase } from '$lib/server/db';
import { hashToken, SESSION_COOKIE } from '$lib/server/google-oauth';

export const handle: Handle = async ({ event, resolve }) => {
  event.locals.account = null;
  if (dev && process.env.ENABLE_SANITIZED_DEV_AUTH === 'true') {
    const email = event.cookies.get('liftoff_dev_identity');
    if (email?.endsWith('@example.test')) {
      event.locals.account = await getDatabase().account.findUnique({
        where: { email },
        include: { roles: true, learner: true },
      });
    }
  }
  if (!event.locals.account) {
    const token = event.cookies.get(SESSION_COOKIE);
    if (token) {
      const session = await getDatabase().authSession.findFirst({
        where: {
          tokenHash: hashToken(token),
          revokedAt: null,
          expiresAt: { gt: new Date() },
          account: { status: 'ACTIVE' },
        },
        include: { account: { include: { roles: true, learner: true } } },
      });
      event.locals.account = session?.account ?? null;
      if (!session) event.cookies.delete(SESSION_COOKIE, { path: '/' });
    }
  }

  if (!['GET', 'HEAD', 'OPTIONS'].includes(event.request.method)) {
    const origin = event.request.headers.get('origin');
    if (origin && origin !== event.url.origin) {
      return new Response('Cross-origin request rejected', { status: 403 });
    }
  }
  return resolve(event);
};
