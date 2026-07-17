import { describe, expect, it } from 'vitest';

import { hashToken, pkceChallenge, sessionExpiresAt, tokensMatch } from './google-oauth';

describe('Google OAuth security helpers', () => {
  it('hashes stored session tokens and compares one-time values safely', () => {
    expect(hashToken('session-secret')).toMatch(/^[a-f0-9]{64}$/);
    expect(tokensMatch('state-value', 'state-value')).toBe(true);
    expect(tokensMatch('state-value', 'different')).toBe(false);
    expect(tokensMatch(undefined, 'state-value')).toBe(false);
  });

  it('creates an S256 PKCE challenge and an eight-hour expiry', () => {
    expect(pkceChallenge('verifier')).toMatch(/^[A-Za-z0-9_-]+$/);
    const now = new Date('2026-07-15T12:00:00Z');
    expect(sessionExpiresAt(now).toISOString()).toBe('2026-07-15T20:00:00.000Z');
  });
});
