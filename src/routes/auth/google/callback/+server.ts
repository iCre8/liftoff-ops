import { error, redirect } from '@sveltejs/kit';

import { authorizeWorkspaceIdentity, normalizeCompanyEmail } from '$lib/domain/module-2';
import { getDatabase } from '$lib/server/db';
import {
  googleOAuthClient,
  OAUTH_NONCE_COOKIE,
  OAUTH_STATE_COOKIE,
  OAUTH_VERIFIER_COOKIE,
  oauthCookieOptions,
  randomToken,
  SESSION_COOKIE,
  sessionExpiresAt,
  hashToken,
  tokensMatch,
} from '$lib/server/google-oauth';

async function provisionedAccount(email: string) {
  const database = getDatabase();
  const existing = await database.account.findUnique({
    where: { email },
    include: { roles: true },
  });
  if (existing) return existing;

  const initialAdmin = process.env.INITIAL_ADMIN_EMAIL?.trim();
  if (!initialAdmin || normalizeCompanyEmail(initialAdmin) !== email) return null;
  return database.$transaction(async (transaction) => {
    if ((await transaction.account.count()) !== 0) return null;
    return transaction.account.create({
      data: {
        email,
        roles: { create: { role: 'ADMIN' } },
        auditEvents: {
          create: {
            eventType: 'account.initial_admin_bootstrapped',
            entityType: 'Account',
            entityId: 'self',
            payload: {},
          },
        },
      },
      include: { roles: true },
    });
  });
}

export const GET = async ({ url, cookies }) => {
  const stateCookie = cookies.get(OAUTH_STATE_COOKIE);
  const nonceCookie = cookies.get(OAUTH_NONCE_COOKIE);
  const verifier = cookies.get(OAUTH_VERIFIER_COOKIE);
  cookies.delete(OAUTH_STATE_COOKIE, { path: '/' });
  cookies.delete(OAUTH_NONCE_COOKIE, { path: '/' });
  cookies.delete(OAUTH_VERIFIER_COOKIE, { path: '/' });

  if (url.searchParams.get('error')) error(401, 'Google Workspace sign-in was not completed');
  if (!tokensMatch(stateCookie, url.searchParams.get('state')) || !nonceCookie || !verifier) {
    error(401, 'Google Workspace sign-in state is invalid or expired');
  }
  const code = url.searchParams.get('code');
  if (!code) error(400, 'Google Workspace authorization code is missing');

  const oauth = googleOAuthClient();
  const { tokens } = await oauth.getToken({ code, codeVerifier: verifier });
  if (!tokens.id_token) error(401, 'Google did not return an identity token');
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  if (!clientId) error(503, 'Google OAuth is not configured');
  const ticket = await oauth.verifyIdToken({ idToken: tokens.id_token, audience: clientId });
  const claims = ticket.getPayload();
  if (
    !claims ||
    !tokensMatch(nonceCookie, typeof claims.nonce === 'string' ? claims.nonce : null) ||
    typeof claims.iss !== 'string' ||
    typeof claims.sub !== 'string' ||
    typeof claims.email !== 'string' ||
    typeof claims.email_verified !== 'boolean' ||
    typeof claims.hd !== 'string'
  ) {
    error(401, 'Google identity claims are invalid');
  }

  const email = normalizeCompanyEmail(claims.email);
  const account = await provisionedAccount(email);
  const identity = authorizeWorkspaceIdentity(
    {
      iss: claims.iss,
      aud: Array.isArray(claims.aud) ? claims.aud[0] : claims.aud,
      sub: claims.sub,
      email,
      email_verified: claims.email_verified,
      hd: claims.hd,
    },
    account
      ? {
          email: account.email,
          googleSubject: account.googleSubject,
          status: account.status.toLowerCase() as 'active' | 'inactive',
        }
      : null,
    clientId,
  );

  const sessionToken = randomToken();
  const expiresAt = sessionExpiresAt();
  await getDatabase().$transaction([
    getDatabase().account.update({
      where: { id: account!.id },
      data: {
        googleSubject: identity.googleSubject,
        lastSignedInAt: new Date(),
        displayName: account!.displayName ?? claims.name ?? undefined,
      },
    }),
    getDatabase().authSession.create({
      data: { accountId: account!.id, tokenHash: hashToken(sessionToken), expiresAt },
    }),
  ]);
  cookies.set(SESSION_COOKIE, sessionToken, oauthCookieOptions(8 * 60 * 60));
  redirect(303, '/');
};
