import { dev } from '$app/environment';

import { ATTENDANCE_POLICY } from '$lib/domain/attendance';
import { googleOAuthConfigured } from '$lib/server/google-oauth';

export function load({ locals }) {
  const roles = new Set(locals.account?.roles.map((assignment) => assignment.role) ?? []);
  const workspaces: { label: string; href: string; description: string }[] = [];

  if (roles.has('LEARNER')) {
    workspaces.push({
      label: 'Open my learner forms',
      href: '/learner',
      description: 'Morning goals, exit ticket, weekly history, and accommodation requests',
    });
  }

  if (
    (['ADMIN', 'FACILITATOR', 'INSTRUCTOR_TA', 'OUTREACH_SUPPORT'] as const).some((role) =>
      roles.has(role),
    )
  ) {
    workspaces.push({
      label: 'Open staff operations',
      href: '/operations',
      description: 'Support, incidents, accommodations, sessions, and account access',
    });
    workspaces.push({
      label: 'Open automation controls',
      href: '/automation',
      description: 'Dry runs, schedules, templates, blackouts, pauses, and review gates',
    });
    workspaces.push({
      label: 'Preview the learner workspace',
      href: '/learner-preview',
      description: 'Read-only sample view with no learner record or submission access',
    });
  }

  return {
    accountName: locals.account?.displayName ?? null,
    developmentSignInHref:
      dev && process.env.ENABLE_SANITIZED_DEV_AUTH === 'true' ? '/dev-login' : null,
    googleSignInHref: googleOAuthConfigured() ? '/auth/google' : null,
    workspaces,
    cohort: 'LiftOff Program Cohort 3',
    integrationMode: 'inactive',
    policy: ATTENDANCE_POLICY,
    schedule: [
      { label: 'Goals check-in', time: '9:15 AM' },
      { label: 'Late detection', time: '9:25 AM' },
      { label: 'No-call/no-show', time: '10:45 AM' },
      { label: 'Exit ticket', time: '2:45 PM' },
      { label: 'Exit reminder', time: '3:00 PM' },
    ],
    readiness: [
      { label: 'Attendance rules', state: 'implemented' },
      { label: 'Incident schema', state: 'implemented' },
      { label: 'Google Sheets', state: 'sanitized contract proof complete' },
      { label: 'Slack and Resend', state: 'awaiting validation' },
      { label: 'Beacon learner context', state: 'awaiting validation' },
    ],
  };
}
