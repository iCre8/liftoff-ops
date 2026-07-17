import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

import { CodeChallengeMethod, OAuth2Client } from 'google-auth-library';

import { COMPANY_DOMAIN, SESSION_DURATION_HOURS } from '../domain/module-2';
import { readRequiredSecret } from './config/secrets';

export const SESSION_COOKIE = 'liftoff_session';
export const OAUTH_STATE_COOKIE = 'liftoff_oauth_state';
export const OAUTH_NONCE_COOKIE = 'liftoff_oauth_nonce';
export const OAUTH_VERIFIER_COOKIE = 'liftoff_oauth_verifier';

export function googleOAuthConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_OAUTH_CLIENT_ID?.trim() &&
    process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim() &&
    (process.env.GOOGLE_OAUTH_CLIENT_SECRET_FILE?.trim() ||
      process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim()),
  );
}

export function googleOAuthClient(): OAuth2Client {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim();
  if (!clientId || !redirectUri) throw new Error('Google OAuth is not configured');
  return new OAuth2Client(clientId, readRequiredSecret('GOOGLE_OAUTH_CLIENT_SECRET'), redirectUri);
}

export function oauthCookieOptions(maxAge = 10 * 60) {
  return {
    path: '/',
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    maxAge,
  };
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function hashToken(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function pkceChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

export function tokensMatch(left: string | undefined, right: string | null): boolean {
  if (!left || !right) return false;
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function sessionExpiresAt(now = new Date()): Date {
  return new Date(now.getTime() + SESSION_DURATION_HOURS * 60 * 60 * 1000);
}

export function googleAuthorizationUrl(input: {
  state: string;
  nonce: string;
  verifier: string;
}): string {
  return googleOAuthClient().generateAuthUrl({
    access_type: 'online',
    scope: ['openid', 'email', 'profile'],
    state: input.state,
    nonce: input.nonce,
    hd: COMPANY_DOMAIN,
    prompt: 'select_account',
    code_challenge_method: CodeChallengeMethod.S256,
    code_challenge: pkceChallenge(input.verifier),
  });
}
