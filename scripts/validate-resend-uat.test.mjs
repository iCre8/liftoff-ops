import { spawnSync } from 'node:child_process';

import { describe, expect, it } from 'vitest';

import {
  assertCanaryRecipient,
  normalizeRecipientList,
  normalizeReplyTo,
  normalizeSender,
} from './validate-resend-uat.mjs';

describe('Resend UAT validation command', () => {
  it('normalizes and deduplicates the external staff allowlist', () => {
    expect(
      normalizeRecipientList('STAFF@example.test, staff@example.test second@example.test'),
    ).toEqual(['staff@example.test', 'second@example.test']);
  });

  it('requires the canary recipient to be a staff allowlist member', () => {
    expect(assertCanaryRecipient('STAFF@example.test', ['staff@example.test'])).toBe(
      'staff@example.test',
    );
    expect(() => assertCanaryRecipient('learner@example.test', ['staff@example.test'])).toThrow(
      /staff allowlist/,
    );
  });

  it('requires the isolated LiftOff UAT sender domain', () => {
    expect(normalizeSender('LiftOff UAT <notifications@uat-mail.liftofflearning.tech>')).toEqual({
      sender: 'LiftOff UAT <notifications@uat-mail.liftofflearning.tech>',
      address: 'notifications@uat-mail.liftofflearning.tech',
    });
    expect(() => normalizeSender('not-an-address')).toThrow(/sender/);
    expect(() => normalizeSender('LiftOff <notifications@mail.liftofflearning.tech>')).toThrow(
      /UAT sender/,
    );
  });

  it('requires a corporate reply-to in the staff allowlist', () => {
    expect(normalizeReplyTo('STAFF@launchpadphilly.org', ['staff@launchpadphilly.org'])).toBe(
      'staff@launchpadphilly.org',
    );
    expect(() =>
      normalizeReplyTo('learner@launchpadphilly.org', ['staff@launchpadphilly.org']),
    ).toThrow(/reply-to/);
  });

  it('loads under the pinned Node runtime before checking external secrets', () => {
    const result = spawnSync(process.execPath, ['scripts/validate-resend-uat.mjs'], {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: { PATH: process.env.PATH },
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('RESEND_API_KEY or RESEND_API_KEY_FILE is required');
    expect(result.stderr).not.toContain('ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX');
  });
});
