import { z } from 'zod';

export const COMPANY_DOMAIN = 'launchpadphilly.org';
export const PROGRAM_TIMEZONE = 'America/New_York';
export const SESSION_DURATION_HOURS = 8;

export const appRoleSchema = z.enum([
  'learner',
  'admin',
  'facilitator',
  'instructor_ta',
  'outreach_support',
  'read_only',
]);

export type AppRole = z.infer<typeof appRoleSchema>;

const optionalText = (maximum: number) =>
  z
    .string()
    .trim()
    .max(maximum)
    .optional()
    .transform((value) => value || undefined);

export const morningGoalsSchema = z.object({
  goals: z.string().trim().min(1).max(2000),
  firstTask: z.string().trim().min(1).max(1000),
  blockers: optionalText(1000),
  supportNeeded: optionalText(1000),
});

export const exitTicketSchema = z
  .object({
    goalResult: z.enum(['yes', 'partially', 'no']),
    completed: z.string().trim().min(1).max(2000),
    explanation: optionalText(2000),
    blockers: optionalText(1000),
    supportNeeded: optionalText(1000),
  })
  .superRefine((value, context) => {
    if (value.goalResult !== 'yes' && !value.explanation) {
      context.addIssue({
        code: 'custom',
        path: ['explanation'],
        message: 'Explain why the goals were not fully achieved',
      });
    }
  });

export const accommodationRequestSchema = z.object({
  category: z.enum([
    'schedule_timing',
    'attendance_check_in_method',
    'communication',
    'accessibility_technology',
    'temporary_personal_circumstance',
    'other',
  ]),
  requestedStart: z.coerce.date(),
  requestedEnd: z.coerce.date().optional(),
  requestedAdjustment: z.string().trim().min(1).max(2000),
  expectedBenefit: z.string().trim().min(1).max(2000),
  preferredFollowUp: z.enum(['email', 'in_app']),
});

export function normalizeCompanyEmail(value: string): string {
  const email = value.trim().toLowerCase();
  if (!/^[^@\s]+@launchpadphilly\.org$/.test(email)) {
    throw new Error(`Email must use the @${COMPANY_DOMAIN} domain`);
  }
  return email;
}

export interface WorkspaceClaims {
  iss: string;
  aud: string;
  sub: string;
  email: string;
  email_verified: boolean;
  hd: string;
}

export interface ProvisionedIdentity {
  email: string;
  googleSubject?: string | null;
  status: 'active' | 'inactive';
}

export function authorizeWorkspaceIdentity(
  claims: WorkspaceClaims,
  account: ProvisionedIdentity | null,
  expectedAudience: string,
): { email: string; googleSubject: string } {
  if (!['accounts.google.com', 'https://accounts.google.com'].includes(claims.iss)) {
    throw new Error('Untrusted Google identity issuer');
  }
  if (claims.aud !== expectedAudience || !claims.email_verified || claims.hd !== COMPANY_DOMAIN) {
    throw new Error('Google Workspace identity is not valid for this application');
  }
  const email = normalizeCompanyEmail(claims.email);
  if (!account || normalizeCompanyEmail(account.email) !== email || account.status !== 'active') {
    throw new Error('Account is not provisioned and active');
  }
  if (account.googleSubject && account.googleSubject !== claims.sub) {
    throw new Error('Google identity does not match the provisioned account');
  }
  return { email, googleSubject: claims.sub };
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === ',' && !quoted) {
      fields.push(field.trim());
      field = '';
    } else {
      field += character;
    }
  }
  if (quoted) throw new Error('CSV contains an unterminated quoted value');
  fields.push(field.trim());
  return fields;
}

export interface AccountImportRow {
  rowNumber: number;
  email: string;
  cohort?: string;
  status: 'active' | 'inactive';
  roles: AppRole[];
}

export function parseAccountImportCsv(csv: string): AccountImportRow[] {
  const lines = csv
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((line) => line.trim());
  if (lines.length < 2) throw new Error('CSV must contain a header and at least one account');
  const headers = parseCsvLine(lines[0]).map((header) => header.toLowerCase());
  const expected = ['email', 'cohort', 'status', 'roles'];
  if (headers.join(',') !== expected.join(',')) {
    throw new Error(`CSV headers must be exactly: ${expected.join(',')}`);
  }

  const rows = lines.slice(1).map((line, index) => {
    const values = parseCsvLine(line);
    if (values.length !== expected.length)
      throw new Error(`Row ${index + 2} has the wrong column count`);
    const roles = values[3]
      .split(';')
      .map((role) => appRoleSchema.parse(role.trim().toLowerCase()));
    if (new Set(roles).size !== roles.length || roles.length === 0) {
      throw new Error(`Row ${index + 2} must contain unique roles`);
    }
    const cohort = values[1].trim() || undefined;
    if (roles.some((role) => role !== 'admin') && !cohort) {
      throw new Error(`Row ${index + 2} requires a cohort for cohort-scoped roles`);
    }
    return {
      rowNumber: index + 2,
      email: normalizeCompanyEmail(values[0]),
      cohort,
      status: z.enum(['active', 'inactive']).parse(values[2].toLowerCase()),
      roles,
    };
  });

  const emails = rows.map((row) => row.email);
  if (new Set(emails).size !== emails.length) throw new Error('CSV contains duplicate emails');
  return rows;
}

export function assertSheetEmailContract(
  values: readonly unknown[],
  expectedRows: number,
): string[] {
  if (values.length !== expectedRows)
    throw new Error('Sheet learner email row count does not match');
  const emails = values.map((value) => normalizeCompanyEmail(String(value ?? '')));
  if (new Set(emails).size !== emails.length)
    throw new Error('Sheet learner emails must be unique');
  return emails;
}

export function formWindowState(input: {
  now: Date;
  releaseAt: Date;
  closesAt: Date;
}): 'not_released' | 'open' | 'closed' {
  const now = input.now.getTime();
  if (now < input.releaseAt.getTime()) return 'not_released';
  if (now > input.closesAt.getTime()) return 'closed';
  return 'open';
}

const sessionDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => !Number.isNaN(new Date(`${value}T12:00:00Z`).getTime()), 'Invalid date');

export const sessionCatalogSchema = z
  .object({
    version: z.literal(1),
    sessions: z
      .array(z.object({ externalId: z.string().trim().min(1).max(100), sessionDate }))
      .length(42),
  })
  .superRefine((catalog, context) => {
    const externalIds = catalog.sessions.map((session) => session.externalId);
    const dates = catalog.sessions.map((session) => session.sessionDate);
    if (new Set(externalIds).size !== externalIds.length) {
      context.addIssue({
        code: 'custom',
        path: ['sessions'],
        message: 'Session IDs must be unique',
      });
    }
    if (new Set(dates).size !== dates.length) {
      context.addIssue({
        code: 'custom',
        path: ['sessions'],
        message: 'Session dates must be unique',
      });
    }
    catalog.sessions.forEach((session, index) => {
      const weekday = new Date(`${session.sessionDate}T12:00:00Z`).getUTCDay();
      if (weekday === 0 || weekday === 6) {
        context.addIssue({
          code: 'custom',
          path: ['sessions', index, 'sessionDate'],
          message: 'Program sessions must be weekdays',
        });
      }
    });
  });

export type SessionCatalog = z.infer<typeof sessionCatalogSchema>;

export function parseSessionCatalog(input: unknown): SessionCatalog {
  return sessionCatalogSchema.parse(input);
}

export function programSessionTimes(sessionDate: string) {
  const [year, month, day] = sessionDate.split('-').map(Number);
  const inProgramTimezone = (hour: number, minute: number) =>
    programDateTime(sessionDate, hour, minute);
  return {
    sessionDate: new Date(Date.UTC(year, month - 1, day)),
    checkInReleasedAt: inProgramTimezone(9, 15),
    exitTicketReleasedAt: inProgramTimezone(14, 45),
    programDayEndsAt: inProgramTimezone(15, 15),
  };
}

export function programDateTime(sessionDate: string, hour: number, minute: number) {
  const [year, month, day] = sessionDate.split('-').map(Number);
  const desired = Date.UTC(year, month - 1, day, hour, minute);
  let guess = desired;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: PROGRAM_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(guess));
    const values = Object.fromEntries(parts.map((part) => [part.type, Number(part.value)]));
    const represented = Date.UTC(
      values.year,
      values.month - 1,
      values.day,
      values.hour,
      values.minute,
    );
    guess -= represented - desired;
  }
  return new Date(guess);
}
