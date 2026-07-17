import { error, redirect } from '@sveltejs/kit';

import {
  googleAuthorizationUrl,
  googleOAuthConfigured,
  OAUTH_NONCE_COOKIE,
  OAUTH_STATE_COOKIE,
  OAUTH_VERIFIER_COOKIE,
  oauthCookieOptions,
  randomToken,
} from '$lib/server/google-oauth';

export const GET = ({ cookies }) => {
  if (!googleOAuthConfigured()) error(503, 'Google Workspace sign-in is not configured');
  const state = randomToken();
  const nonce = randomToken();
  const verifier = randomToken(48);
  cookies.set(OAUTH_STATE_COOKIE, state, oauthCookieOptions());
  cookies.set(OAUTH_NONCE_COOKIE, nonce, oauthCookieOptions());
  cookies.set(OAUTH_VERIFIER_COOKIE, verifier, oauthCookieOptions());
  redirect(303, googleAuthorizationUrl({ state, nonce, verifier }));
};
