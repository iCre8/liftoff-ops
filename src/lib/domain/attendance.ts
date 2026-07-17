export const ATTENDANCE_POLICY = Object.freeze({
  timezone: 'America/New_York',
  checkInReleaseMinute: 9 * 60 + 15,
  lateAfterMinutes: 10,
  noCallNoShowAfterMinutes: 90,
  exitTicketReleaseMinute: 14 * 60 + 45,
  exitTicketReminderAfterMinutes: 15,
  warningBelow: 0.8,
  concernBelow: 0.75,
  syncRetryLimit: 3,
  outreachReminderCount: 3,
  outreachReminderIntervalMinutes: 60,
});

export type MorningAttendanceState =
  'pending' | 'on_time' | 'late' | 'no_call_no_show' | 'excused' | 'accommodated';

export type IncidentType = 'late' | 'no_call_no_show' | 'incomplete_day';

type Instant = Date | string;

export interface MorningAttendanceInput {
  checkInReleasedAt: Instant;
  evaluatedAt: Instant;
  submittedAt?: Instant | null;
  override?: 'excused' | 'accommodated';
}

export interface AttendanceMetricInput {
  eligible: boolean;
  attended: boolean;
  onTime: boolean;
  exitTicketCompleted: boolean;
}

export interface AttendanceMetrics {
  eligibleSessions: number;
  attendedSessions: number;
  onTimeSessions: number;
  completedExitTickets: number;
  attendanceRate: number | null;
  punctualityRate: number | null;
  completionRate: number | null;
  band: 'insufficient_data' | 'healthy' | 'warning' | 'concern';
}

export type IncidentPlan =
  | { action: 'none' }
  | { action: 'create'; type: IncidentType }
  | { action: 'transition'; from: IncidentType; to: IncidentType }
  | { action: 'close'; type: IncidentType; reason: 'attendance_resolved' };

export type ExitTicketState = 'pending' | 'completed' | 'reminder_due' | 'incomplete_day';

export interface ExitTicketInput {
  releasedAt: Instant;
  evaluatedAt: Instant;
  programDayEndsAt: Instant;
  submittedAt?: Instant | null;
}

function asTimestamp(value: Instant, field: string): number {
  const timestamp = value instanceof Date ? value.getTime() : Date.parse(value);

  if (!Number.isFinite(timestamp)) {
    throw new TypeError(`${field} must be a valid date or ISO timestamp`);
  }

  return timestamp;
}

function addMinutes(timestamp: number, minutes: number): number {
  return timestamp + minutes * 60_000;
}

function ratio(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : numerator / denominator;
}

export function classifyMorningAttendance(input: MorningAttendanceInput): MorningAttendanceState {
  if (input.override) return input.override;

  const releasedAt = asTimestamp(input.checkInReleasedAt, 'checkInReleasedAt');
  const evaluatedAt = asTimestamp(input.evaluatedAt, 'evaluatedAt');
  const submittedAt = input.submittedAt ? asTimestamp(input.submittedAt, 'submittedAt') : null;
  const lateAt = addMinutes(releasedAt, ATTENDANCE_POLICY.lateAfterMinutes);
  const noCallNoShowAt = addMinutes(releasedAt, ATTENDANCE_POLICY.noCallNoShowAfterMinutes);

  if (submittedAt !== null && submittedAt <= evaluatedAt) {
    if (submittedAt <= lateAt) return 'on_time';
    if (submittedAt < noCallNoShowAt) return 'late';
    return 'no_call_no_show';
  }

  if (evaluatedAt < lateAt) return 'pending';
  if (evaluatedAt < noCallNoShowAt) return 'late';
  return 'no_call_no_show';
}

export function planIncident(
  current: IncidentType | null,
  observed: MorningAttendanceState,
): IncidentPlan {
  if (observed === 'late') {
    if (current === null) return { action: 'create', type: 'late' };
    return { action: 'none' };
  }

  if (observed === 'no_call_no_show') {
    if (current === null) return { action: 'create', type: 'no_call_no_show' };
    if (current === 'late') {
      return { action: 'transition', from: 'late', to: 'no_call_no_show' };
    }
    return { action: 'none' };
  }

  if (current === 'late' || current === 'no_call_no_show') {
    return { action: 'close', type: current, reason: 'attendance_resolved' };
  }

  return { action: 'none' };
}

export function calculateAttendanceMetrics(
  sessions: readonly AttendanceMetricInput[],
): AttendanceMetrics {
  const eligible = sessions.filter((session) => session.eligible);
  const attended = eligible.filter((session) => session.attended);
  const onTime = attended.filter((session) => session.onTime);
  const completedExitTickets = attended.filter((session) => session.exitTicketCompleted);
  const attendanceRate = ratio(attended.length, eligible.length);
  const punctualityRate = ratio(onTime.length, attended.length);
  const completionRate = ratio(completedExitTickets.length, attended.length);

  return {
    eligibleSessions: eligible.length,
    attendedSessions: attended.length,
    onTimeSessions: onTime.length,
    completedExitTickets: completedExitTickets.length,
    attendanceRate,
    punctualityRate,
    completionRate,
    band: classifyAttendanceBand(attendanceRate),
  };
}

export function classifyAttendanceBand(attendanceRate: number | null): AttendanceMetrics['band'] {
  if (attendanceRate === null) return 'insufficient_data';
  if (attendanceRate < 0 || attendanceRate > 1) {
    throw new RangeError('attendanceRate must be between 0 and 1');
  }
  if (attendanceRate < ATTENDANCE_POLICY.concernBelow) return 'concern';
  if (attendanceRate < ATTENDANCE_POLICY.warningBelow) return 'warning';
  return 'healthy';
}

export function classifyExitTicket(input: ExitTicketInput): ExitTicketState {
  const releasedAt = asTimestamp(input.releasedAt, 'releasedAt');
  const evaluatedAt = asTimestamp(input.evaluatedAt, 'evaluatedAt');
  const programDayEndsAt = asTimestamp(input.programDayEndsAt, 'programDayEndsAt');
  const submittedAt = input.submittedAt ? asTimestamp(input.submittedAt, 'submittedAt') : null;

  if (programDayEndsAt < releasedAt) {
    throw new RangeError('programDayEndsAt must be at or after releasedAt');
  }
  if (submittedAt !== null && submittedAt <= evaluatedAt) return 'completed';
  if (evaluatedAt >= programDayEndsAt) return 'incomplete_day';
  if (evaluatedAt >= addMinutes(releasedAt, ATTENDANCE_POLICY.exitTicketReminderAfterMinutes)) {
    return 'reminder_due';
  }
  return 'pending';
}
