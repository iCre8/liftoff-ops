import { describe, expect, it } from 'vitest';

import {
  calculateAttendanceMetrics,
  classifyAttendanceBand,
  classifyExitTicket,
  classifyMorningAttendance,
  planIncident,
} from './attendance';

const release = '2026-07-15T13:15:00.000Z'; // 09:15 America/New_York

describe('morning attendance policy', () => {
  it('treats a submission at the 09:25 boundary as on time', () => {
    expect(
      classifyMorningAttendance({
        checkInReleasedAt: release,
        evaluatedAt: '2026-07-15T13:25:00.000Z',
        submittedAt: '2026-07-15T13:25:00.000Z',
      }),
    ).toBe('on_time');
  });

  it('marks a missing submission late at 09:25', () => {
    expect(
      classifyMorningAttendance({
        checkInReleasedAt: release,
        evaluatedAt: '2026-07-15T13:25:00.000Z',
      }),
    ).toBe('late');
  });

  it('marks a missing submission no-call/no-show at 10:45', () => {
    expect(
      classifyMorningAttendance({
        checkInReleasedAt: release,
        evaluatedAt: '2026-07-15T14:45:00.000Z',
      }),
    ).toBe('no_call_no_show');
  });

  it('lets an approved exception override scheduled classification', () => {
    expect(
      classifyMorningAttendance({
        checkInReleasedAt: release,
        evaluatedAt: '2026-07-15T15:00:00.000Z',
        override: 'excused',
      }),
    ).toBe('excused');
  });
});

describe('incident planning', () => {
  it('creates one late incident and does not duplicate it', () => {
    expect(planIncident(null, 'late')).toEqual({ action: 'create', type: 'late' });
    expect(planIncident('late', 'late')).toEqual({ action: 'none' });
  });

  it('transitions the existing late incident to no-call/no-show', () => {
    expect(planIncident('late', 'no_call_no_show')).toEqual({
      action: 'transition',
      from: 'late',
      to: 'no_call_no_show',
    });
  });
});

describe('attendance metrics', () => {
  it('excludes ineligible sessions and separates attendance from punctuality', () => {
    const metrics = calculateAttendanceMetrics([
      { eligible: true, attended: true, onTime: true, exitTicketCompleted: true },
      { eligible: true, attended: true, onTime: false, exitTicketCompleted: false },
      { eligible: true, attended: false, onTime: false, exitTicketCompleted: false },
      { eligible: false, attended: false, onTime: false, exitTicketCompleted: false },
    ]);

    expect(metrics).toMatchObject({
      eligibleSessions: 3,
      attendedSessions: 2,
      onTimeSessions: 1,
      completedExitTickets: 1,
      attendanceRate: 2 / 3,
      punctualityRate: 1 / 2,
      completionRate: 1 / 2,
      band: 'concern',
    });
  });

  it('uses concern below 75% and warning from 75% through below 80%', () => {
    expect(classifyAttendanceBand(0.7499)).toBe('concern');
    expect(classifyAttendanceBand(0.75)).toBe('warning');
    expect(classifyAttendanceBand(0.7999)).toBe('warning');
    expect(classifyAttendanceBand(0.8)).toBe('healthy');
  });
});

describe('exit ticket policy', () => {
  it('requests a reminder at 15:00 and creates an incomplete day at day end', () => {
    const input = {
      releasedAt: '2026-07-15T18:45:00.000Z',
      programDayEndsAt: '2026-07-15T19:30:00.000Z',
    };

    expect(classifyExitTicket({ ...input, evaluatedAt: '2026-07-15T19:00:00.000Z' })).toBe(
      'reminder_due',
    );
    expect(classifyExitTicket({ ...input, evaluatedAt: '2026-07-15T19:30:00.000Z' })).toBe(
      'incomplete_day',
    );
  });
});
