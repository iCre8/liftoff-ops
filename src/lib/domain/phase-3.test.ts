import { describe, expect, it } from 'vitest';

import {
  activationEligibility,
  automationJobKey,
  planDailyAutomation,
  planSheetRecordReconciliation,
  planUnclaimedReminders,
  reconcileFirstTimestamp,
  retryAt,
  shouldSuppressStaleOutreach,
  validatePause,
  isUsFederalHoliday,
} from './phase-3';

describe('Phase 3 scheduler', () => {
  it('plans exact New York triggers in deterministic order', () => {
    const jobs = planDailyAutomation('2026-07-15');
    expect(jobs.map((job) => [job.type, job.runAt.toISOString()])).toEqual([
      ['PRE_TRIGGER_RECONCILIATION', '2026-07-15T13:24:00.000Z'],
      ['LATE_EVALUATION', '2026-07-15T13:25:00.000Z'],
      ['PRE_TRIGGER_RECONCILIATION', '2026-07-15T14:44:00.000Z'],
      ['NO_CALL_NO_SHOW_EVALUATION', '2026-07-15T14:45:00.000Z'],
      ['SHEET_RECONCILIATION', '2026-07-15T15:00:00.000Z'],
      ['EXIT_REMINDER', '2026-07-15T19:00:00.000Z'],
      ['PRE_TRIGGER_RECONCILIATION', '2026-07-15T19:14:00.000Z'],
      ['SHEET_RECONCILIATION', '2026-07-15T19:15:00.000Z'],
      ['INCOMPLETE_DAY_EVALUATION', '2026-07-15T19:15:00.000Z'],
    ]);
    expect(
      new Set(
        jobs.map((job) =>
          automationJobKey({
            cohortId: 'cohort',
            sessionId: 'session',
            type: job.type,
            sequence: job.sequence,
          }),
        ),
      ).size,
    ).toBe(jobs.length);
  });

  it('suppresses United States federal holidays including observed dates', () => {
    expect(isUsFederalHoliday(new Date('2026-07-03T00:00:00Z'))).toBe(true);
    expect(isUsFederalHoliday(new Date('2026-11-26T00:00:00Z'))).toBe(true);
    expect(isUsFederalHoliday(new Date('2026-07-15T00:00:00Z'))).toBe(false);
  });

  it('uses bounded retry backoff and suppresses stale learner outreach', () => {
    const failedAt = new Date('2026-07-15T13:25:00Z');
    expect(retryAt(failedAt, 3).toISOString()).toBe('2026-07-15T13:40:00.000Z');
    expect(
      shouldSuppressStaleOutreach({
        now: new Date('2026-07-15T19:16:00Z'),
        programDayEndsAt: new Date('2026-07-15T19:15:00Z'),
        jobType: 'EXIT_REMINDER',
      }),
    ).toBe(true);
  });

  it('plans three hourly unclaimed reminders with the approved escalations', () => {
    const reminders = planUnclaimedReminders(new Date('2026-07-15T14:00:00Z'));
    expect(reminders.map((item) => item.runAt.toISOString())).toEqual([
      '2026-07-15T15:00:00.000Z',
      '2026-07-15T16:00:00.000Z',
      '2026-07-15T17:00:00.000Z',
    ]);
    expect(reminders[0].prepareTeamEmail).toBe(true);
    expect(reminders[2].addToUnresolvedDashboard).toBe(true);
  });
});

describe('Phase 3 controls and reconciliation', () => {
  it('requires admin approval for long or open facilitator pauses', () => {
    const startsAt = new Date('2026-07-15T12:00:00Z');
    expect(() => validatePause({ startsAt, actorIsAdmin: false })).toThrow(/seven days/);
    expect(() =>
      validatePause({
        startsAt,
        endsAt: new Date('2026-07-23T12:00:00Z'),
        actorIsAdmin: false,
      }),
    ).toThrow(/seven days/);
    expect(() => validatePause({ startsAt, actorIsAdmin: true })).not.toThrow();
  });

  it('requires five clean days or a reviewed one-day exception', () => {
    expect(
      activationEligibility({
        completeDryRunDays: 5,
        hasFormalReview: true,
        duplicateCount: 0,
        unresolvedMappings: 0,
      }).eligible,
    ).toBe(true);
    expect(
      activationEligibility({
        completeDryRunDays: 1,
        hasFormalReview: true,
        duplicateCount: 0,
        unresolvedMappings: 0,
        approvedExceptionReason: 'Approved pilot constraint',
      }).eligible,
    ).toBe(true);
    expect(
      activationEligibility({
        completeDryRunDays: 5,
        hasFormalReview: true,
        duplicateCount: 1,
        unresolvedMappings: 0,
      }).eligible,
    ).toBe(false);
  });

  it('never overwrites an existing Postgres first timestamp', () => {
    const postgres = new Date('2026-07-15T13:20:00Z');
    const sheet = new Date('2026-07-15T13:19:00Z');
    expect(reconcileFirstTimestamp({ postgresTimestamp: postgres, sheetTimestamp: sheet })).toEqual(
      {
        timestamp: postgres,
        source: 'postgres',
      },
    );
    expect(reconcileFirstTimestamp({ sheetTimestamp: sheet })).toEqual({
      timestamp: sheet,
      source: 'sheet',
    });
  });

  it('imports only missing Sheet timestamps and preserves original Postgres timestamps', () => {
    const original = new Date('2026-07-15T13:20:00Z');
    const plan = planSheetRecordReconciliation({
      checkInReleasedAt: new Date('2026-07-15T13:15:00Z'),
      existingCheckInAt: original,
      existingAttendanceState: 'ON_TIME',
      sheetCheckInAt: '2026-07-15T13:40:00Z',
      sheetExitTicketAt: '2026-07-15T19:01:00Z',
      sheetExcused: false,
      sheetOutcome: null,
    });
    expect(plan.checkInAt).toEqual(original);
    expect(plan.exitTicketAt?.toISOString()).toBe('2026-07-15T19:01:00.000Z');
    expect(plan.timestampChanges).toBe(1);
    expect(plan.attendanceState).toBe('ON_TIME');
  });

  it('applies authoritative Sheet corrections without deleting blank history', () => {
    const plan = planSheetRecordReconciliation({
      checkInReleasedAt: new Date('2026-07-15T13:15:00Z'),
      existingCheckInAt: new Date('2026-07-15T13:35:00Z'),
      existingExitTicketAt: new Date('2026-07-15T19:00:00Z'),
      existingAttendanceState: 'LATE',
      sheetCheckInAt: null,
      sheetExitTicketAt: null,
      sheetExcused: true,
      sheetOutcome: null,
    });
    expect(plan.checkInAt?.toISOString()).toBe('2026-07-15T13:35:00.000Z');
    expect(plan.exitTicketAt?.toISOString()).toBe('2026-07-15T19:00:00.000Z');
    expect(plan.attendanceState).toBe('EXCUSED');
    expect(plan.attendanceChanged).toBe(true);
  });

  it('fails closed for an unrecognized Sheet outcome', () => {
    expect(() =>
      planSheetRecordReconciliation({
        checkInReleasedAt: new Date('2026-07-15T13:15:00Z'),
        sheetCheckInAt: null,
        sheetExitTicketAt: null,
        sheetExcused: false,
        sheetOutcome: 'ambiguous staff note',
      }),
    ).toThrow(/human review/);
  });
});
