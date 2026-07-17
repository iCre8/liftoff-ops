import { redirect } from '@sveltejs/kit';

import { getDatabase } from '$lib/server/db';
import { hashToken, SESSION_COOKIE } from '$lib/server/google-oauth';

export const POST = async ({ cookies }) => {
  const token = cookies.get(SESSION_COOKIE);
  if (token) {
    await getDatabase().authSession.updateMany({
      where: { tokenHash: hashToken(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  cookies.delete(SESSION_COOKIE, { path: '/' });
  redirect(303, '/');
};
