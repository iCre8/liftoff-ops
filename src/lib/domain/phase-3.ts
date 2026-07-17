import { z } from 'zod';

import { programDateTime } from './module-2.ts';

export const PHASE_3_TEMPLATE_KEYS = [
  'late',
  'no_call_no_show',
  'exit_reminder',
  'team_call_task',
  'unclaimed_escalation',
  'synchronization_failure',
  'attendance_warning',
  'attendance_concern',
] as const;

export const phase3TemplateKeySchema = z.enum(PHASE_3_TEMPLATE_KEYS);
export type Phase3TemplateKey = z.infer<typeof phase3TemplateKeySchema>;

export const SANITIZED_TEMPLATE_DRAFTS: Record<Phase3TemplateKey, string> = {
  late: 'Your morning check-in is still missing. Please complete it now or request support.',
  no_call_no_show:
    'We have not received your morning check-in. Please check in and contact the program team if you need support.',
  exit_reminder:
    'Your exit ticket is still missing. Please complete your end-of-day reflection before the form closes.',
  team_call_task: 'A learner attendance follow-up needs a staff owner. Open LiftOff to claim it.',
  unclaimed_escalation:
    'An attendance follow-up is still unclaimed. Open LiftOff to review and assign it.',
  synchronization_failure:
    'An attendance synchronization operation needs staff review. Open LiftOff for the audit details.',
  attendance_warning:
    'Your attendance is currently in the warning range. Please review your record and contact the program team for support.',
  attendance_concern:
    'Your attendance is currently in the concern range. Please review your record and contact the program team for support.',
};

export type Phase3JobType =
  | 'PRE_TRIGGER_RECONCILIATION'
  | 'LATE_EVALUATION'
  | 'NO_CALL_NO_SHOW_EVALUATION'
  | 'SHEET_RECONCILIATION'
  | 'EXIT_REMINDER'
  | 'INCOMPLETE_DAY_EVALUATION';

export interface PlannedPhase3Job {
  type: Phase3JobType;
  runAt: Date;
  sequence: number;
}

export function planDailyAutomation(sessionDate: string): PlannedPhase3Job[] {
  return [
    {
      type: 'PRE_TRIGGER_RECONCILIATION',
      runAt: programDateTime(sessionDate, 9, 24),
      sequence: 10,
    },
    { type: 'LATE_EVALUATION', runAt: programDateTime(sessionDate, 9, 25), sequence: 20 },
    {
      type: 'PRE_TRIGGER_RECONCILIATION',
      runAt: programDateTime(sessionDate, 10, 44),
      sequence: 30,
    },
    {
      type: 'NO_CALL_NO_SHOW_EVALUATION',
      runAt: programDateTime(sessionDate, 10, 45),
      sequence: 40,
    },
    { type: 'SHEET_RECONCILIATION', runAt: programDateTime(sessionDate, 11, 0), sequence: 50 },
    { type: 'EXIT_REMINDER', runAt: programDateTime(sessionDate, 15, 0), sequence: 60 },
    {
      type: 'PRE_TRIGGER_RECONCILIATION',
      runAt: programDateTime(sessionDate, 15, 14),
      sequence: 70,
    },
    { type: 'SHEET_RECONCILIATION', runAt: programDateTime(sessionDate, 15, 15), sequence: 80 },
    {
      type: 'INCOMPLETE_DAY_EVALUATION',
      runAt: programDateTime(sessionDate, 15, 15),
      sequence: 90,
    },
  ];
}

export function automationJobKey(input: {
  cohortId: string;
  sessionId: string;
  type: string;
  sequence: number;
}): string {
  return `phase3:${input.cohortId}:${input.sessionId}:${input.sequence}:${input.type}`;
}

export function retryAt(failedAt: Date, attemptNumber: number): Date {
  if (!Number.isInteger(attemptNumber) || attemptNumber < 1 || attemptNumber > 3) {
    throw new Error('Retry attempt must be between one and three');
  }
  return new Date(failedAt.getTime() + [1, 5, 15][attemptNumber - 1] * 60_000);
}

export function planUnclaimedReminders(taskCreatedAt: Date): Array<{
  sequence: number;
  runAt: Date;
  prepareTeamEmail: boolean;
  addToUnresolvedDashboard: boolean;
}> {
  return [1, 2, 3].map((sequence) => ({
    sequence,
    runAt: new Date(taskCreatedAt.getTime() + sequence * 60 * 60_000),
    prepareTeamEmail: sequence === 1,
    addToUnresolvedDashboard: sequence === 3,
  }));
}

export function validatePause(input: {
  startsAt: Date;
  endsAt?: Date;
  actorIsAdmin: boolean;
}): void {
  if (input.endsAt && input.endsAt <= input.startsAt) {
    throw new Error('Pause end must follow its start');
  }
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  if (
    !input.actorIsAdmin &&
    (!input.endsAt || input.endsAt.getTime() - input.startsAt.getTime() > sevenDays)
  ) {
    throw new Error('Facilitator pauses cannot exceed seven days');
  }
}

export function activationEligibility(input: {
  completeDryRunDays: number;
  hasFormalReview: boolean;
  duplicateCount: number;
  unresolvedMappings: number;
  approvedExceptionReason?: string;
}): { eligible: boolean; reason?: string } {
  if (input.duplicateCount > 0) return { eligible: false, reason: 'Dry run contains duplicates' };
  if (input.unresolvedMappings > 0)
    return { eligible: false, reason: 'Recipient mappings are unresolved' };
  if (!input.hasFormalReview)
    return { eligible: false, reason: 'A formal staff review is required' };
  if (input.completeDryRunDays >= 5) return { eligible: true };
  if (input.completeDryRunDays >= 1 && input.approvedExceptionReason?.trim()) {
    return { eligible: true };
  }
  return { eligible: false, reason: 'Five complete dry-run days are required' };
}

export function reconcileFirstTimestamp(input: {
  postgresTimestamp?: Date | null;
  sheetTimestamp?: Date | null;
}): { timestamp: Date | null; source: 'postgres' | 'sheet' | 'missing' } {
  if (input.postgresTimestamp) return { timestamp: input.postgresTimestamp, source: 'postgres' };
  if (input.sheetTimestamp) return { timestamp: input.sheetTimestamp, source: 'sheet' };
  return { timestamp: null, source: 'missing' };
}

export type ReconciledAttendanceState =
  'ON_TIME' | 'LATE' | 'NO_CALL_NO_SHOW' | 'EXCUSED' | 'ACCOMMODATED' | 'CORRECTED';

const SHEET_OUTCOME_STATES: Readonly<Record<string, ReconciledAttendanceState>> = {
  on_time: 'ON_TIME',
  late: 'LATE',
  no_call_no_show: 'NO_CALL_NO_SHOW',
  excused: 'EXCUSED',
  accommodated: 'ACCOMMODATED',
  corrected: 'CORRECTED',
};

function optionalSheetTimestamp(value: string | null): Date | null {
  if (value === null || value.trim() === '') return null;
  const timestamp = new Date(value);
  if (!Number.isFinite(timestamp.getTime())) throw new Error('Sheet timestamp is invalid');
  return timestamp;
}

function classifySheetCheckIn(releasedAt: Date, submittedAt: Date): ReconciledAttendanceState {
  const minutes = (submittedAt.getTime() - releasedAt.getTime()) / 60_000;
  if (minutes <= 10) return 'ON_TIME';
  if (minutes < 90) return 'LATE';
  return 'NO_CALL_NO_SHOW';
}

export function planSheetRecordReconciliation(input: {
  checkInReleasedAt: Date;
  existingCheckInAt?: Date | null;
  existingExitTicketAt?: Date | null;
  existingAttendanceState?: ReconciledAttendanceState | null;
  sheetCheckInAt: string | null;
  sheetExitTicketAt: string | null;
  sheetExcused: boolean;
  sheetOutcome: string | null;
}): {
  checkInAt: Date | null;
  exitTicketAt: Date | null;
  attendanceState: ReconciledAttendanceState | null;
  timestampChanges: number;
  attendanceChanged: boolean;
} {
  const checkIn = reconcileFirstTimestamp({
    postgresTimestamp: input.existingCheckInAt,
    sheetTimestamp: optionalSheetTimestamp(input.sheetCheckInAt),
  });
  const exitTicket = reconcileFirstTimestamp({
    postgresTimestamp: input.existingExitTicketAt,
    sheetTimestamp: optionalSheetTimestamp(input.sheetExitTicketAt),
  });
  const normalizedOutcome = input.sheetOutcome
    ?.trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  if (normalizedOutcome && !SHEET_OUTCOME_STATES[normalizedOutcome]) {
    throw new Error('Sheet outcome requires human review');
  }
  const attendanceState = input.sheetExcused
    ? 'EXCUSED'
    : normalizedOutcome
      ? SHEET_OUTCOME_STATES[normalizedOutcome]
      : checkIn.timestamp
        ? classifySheetCheckIn(input.checkInReleasedAt, checkIn.timestamp)
        : (input.existingAttendanceState ?? null);
  return {
    checkInAt: checkIn.timestamp,
    exitTicketAt: exitTicket.timestamp,
    attendanceState,
    timestampChanges: Number(checkIn.source === 'sheet') + Number(exitTicket.source === 'sheet'),
    attendanceChanged:
      attendanceState !== null && attendanceState !== input.existingAttendanceState,
  };
}

export function shouldSuppressStaleOutreach(input: {
  now: Date;
  programDayEndsAt: Date;
  jobType: Phase3JobType;
}): boolean {
  return (
    input.now > input.programDayEndsAt &&
    ['LATE_EVALUATION', 'NO_CALL_NO_SHOW_EVALUATION', 'EXIT_REMINDER'].includes(input.jobType)
  );
}

function observedFixedHoliday(year: number, month: number, day: number): string {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCDay() === 6) date.setUTCDate(date.getUTCDate() - 1);
  if (date.getUTCDay() === 0) date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function nthWeekday(year: number, month: number, weekday: number, occurrence: number): string {
  const date = new Date(Date.UTC(year, month - 1, 1));
  date.setUTCDate(1 + ((weekday - date.getUTCDay() + 7) % 7) + (occurrence - 1) * 7);
  return date.toISOString().slice(0, 10);
}

function lastWeekday(year: number, month: number, weekday: number): string {
  const date = new Date(Date.UTC(year, month, 0));
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() - weekday + 7) % 7));
  return date.toISOString().slice(0, 10);
}

export function usFederalHolidayDates(year: number): ReadonlySet<string> {
  return new Set([
    observedFixedHoliday(year, 1, 1),
    nthWeekday(year, 1, 1, 3),
    nthWeekday(year, 2, 1, 3),
    lastWeekday(year, 5, 1),
    observedFixedHoliday(year, 6, 19),
    observedFixedHoliday(year, 7, 4),
    nthWeekday(year, 9, 1, 1),
    nthWeekday(year, 10, 1, 2),
    observedFixedHoliday(year, 11, 11),
    nthWeekday(year, 11, 4, 4),
    observedFixedHoliday(year, 12, 25),
  ]);
}

export function isUsFederalHoliday(date: Date): boolean {
  const iso = date.toISOString().slice(0, 10);
  const year = date.getUTCFullYear();
  return (
    usFederalHolidayDates(year).has(iso) ||
    usFederalHolidayDates(year - 1).has(iso) ||
    usFederalHolidayDates(year + 1).has(iso)
  );
}
