import { describe, expect, it } from 'vitest';

import {
  assertSheetEmailContract,
  authorizeWorkspaceIdentity,
  exitTicketSchema,
  formWindowState,
  morningGoalsSchema,
  normalizeCompanyEmail,
  parseAccountImportCsv,
  parseSessionCatalog,
  programSessionTimes,
} from './module-2';

describe('Module 2 identity and provisioning', () => {
  it('normalizes company email and rejects other domains', () => {
    expect(normalizeCompanyEmail(' Learner@LaunchPadPhilly.org ')).toBe(
      'learner@launchpadphilly.org',
    );
    expect(() => normalizeCompanyEmail('learner@example.test')).toThrow(/company|domain/i);
  });

  it('requires a verified, provisioned, active Workspace identity', () => {
    const claims = {
      iss: 'https://accounts.google.com',
      aud: 'client-id',
      sub: 'google-subject',
      email: 'learner@launchpadphilly.org',
      email_verified: true,
      hd: 'launchpadphilly.org',
    };
    expect(
      authorizeWorkspaceIdentity(claims, { email: claims.email, status: 'active' }, 'client-id'),
    ).toEqual({ email: claims.email, googleSubject: claims.sub });
    expect(() =>
      authorizeWorkspaceIdentity(claims, { email: claims.email, status: 'inactive' }, 'client-id'),
    ).toThrow(/active/);
    expect(() =>
      authorizeWorkspaceIdentity({ ...claims, hd: 'example.org' }, null, 'client-id'),
    ).toThrow();
  });

  it('parses multi-role CSV rows atomically and requires cohort scope', () => {
    const rows = parseAccountImportCsv(
      'email,cohort,status,roles\nfacilitator@launchpadphilly.org,Cohort 3,active,facilitator;instructor_ta',
    );
    expect(rows[0]).toMatchObject({
      email: 'facilitator@launchpadphilly.org',
      roles: ['facilitator', 'instructor_ta'],
    });
    expect(() =>
      parseAccountImportCsv(
        'email,cohort,status,roles\nfacilitator@launchpadphilly.org,,active,facilitator',
      ),
    ).toThrow(/cohort/);
  });

  it('fails closed unless Sheet emails are complete and unique', () => {
    expect(
      assertSheetEmailContract(['one@launchpadphilly.org', 'two@launchpadphilly.org'], 2),
    ).toHaveLength(2);
    expect(() =>
      assertSheetEmailContract(['one@launchpadphilly.org', 'one@launchpadphilly.org'], 2),
    ).toThrow(/unique/);
  });
});

describe('Module 2 learner forms', () => {
  it('enforces morning limits and conditional exit explanation', () => {
    expect(
      morningGoalsSchema.parse({ goals: 'Ship a feature', firstTask: 'Write a test' }),
    ).toMatchObject({ goals: 'Ship a feature' });
    expect(() => exitTicketSchema.parse({ goalResult: 'no', completed: 'Research only' })).toThrow(
      /not fully achieved/,
    );
    expect(
      exitTicketSchema.parse({
        goalResult: 'partially',
        completed: 'Tests',
        explanation: 'Blocked by an API',
      }),
    ).toMatchObject({ goalResult: 'partially' });
  });

  it('opens and closes forms at exact boundaries', () => {
    const releaseAt = new Date('2026-07-15T13:15:00Z');
    const closesAt = new Date('2026-07-15T19:15:00Z');
    expect(formWindowState({ now: new Date('2026-07-15T13:14:59Z'), releaseAt, closesAt })).toBe(
      'not_released',
    );
    expect(formWindowState({ now: releaseAt, releaseAt, closesAt })).toBe('open');
    expect(formWindowState({ now: new Date('2026-07-15T19:15:01Z'), releaseAt, closesAt })).toBe(
      'closed',
    );
  });
});

describe('Module 2 program sessions', () => {
  function weekdays(count: number) {
    const sessions: { externalId: string; sessionDate: string }[] = [];
    const date = new Date('2026-01-05T12:00:00Z');
    while (sessions.length < count) {
      if (![0, 6].includes(date.getUTCDay())) {
        sessions.push({
          externalId: `session-${String(sessions.length + 1).padStart(3, '0')}`,
          sessionDate: date.toISOString().slice(0, 10),
        });
      }
      date.setUTCDate(date.getUTCDate() + 1);
    }
    return sessions;
  }

  it('requires exactly 42 unique weekday Sheet groups', () => {
    const sessions = weekdays(42);
    expect(parseSessionCatalog({ version: 1, sessions }).sessions).toHaveLength(42);
    expect(() =>
      parseSessionCatalog({
        version: 1,
        sessions: sessions.map((session, index) =>
          index === 41 ? { ...session, sessionDate: sessions[0].sessionDate } : session,
        ),
      }),
    ).toThrow(/unique/);
  });

  it('builds release times in New York across daylight-saving changes', () => {
    expect(programSessionTimes('2026-01-05').checkInReleasedAt.toISOString()).toBe(
      '2026-01-05T14:15:00.000Z',
    );
    expect(programSessionTimes('2026-07-15').exitTicketReleasedAt.toISOString()).toBe(
      '2026-07-15T18:45:00.000Z',
    );
    expect(programSessionTimes('2026-07-15').programDayEndsAt.toISOString()).toBe(
      '2026-07-15T19:15:00.000Z',
    );
  });
});
