import { describe, expect, it } from 'vitest';

import {
  rosterRepairPlan,
  SafeRosterRepairError,
  validateRosterRepairInvocation,
} from './repair-uat-roster.mjs';

const approvedSeed = {
  cohortName: 'Sanitized Cohort 3',
  automationMode: 'DISABLED',
  actionableJobCount: 0,
  startsOn: '2026-07-15',
  endsOn: '2026-09-15',
  learnerCount: 1,
  fixtureLearnerCount: 1,
  learnerDependencyCount: 0,
  fixtureAccountCount: 3,
  fixtureRoleCount: 3,
  fixtureAuthSessionCount: 0,
  fixtureAuditEventCount: 0,
  sessionCount: 1,
  sessionDependencyCount: 0,
  templateCount: 8,
  activeCorporateAdminCount: 1,
  sheetEmailCount: 14,
  sheetEmailLearners: 0,
};

describe('UAT roster repair', () => {
  it('requires explicit UAT confirmation and keeps apply opt-in', () => {
    expect(() => validateRosterRepairInvocation([])).toThrow(SafeRosterRepairError);
    expect(validateRosterRepairInvocation(['--uat'])).toEqual({ apply: false });
    expect(validateRosterRepairInvocation(['--uat', '--apply'])).toEqual({ apply: true });
  });

  it('accepts only the exact approved empty seed state', () => {
    expect(rosterRepairPlan(approvedSeed)).toEqual({
      alreadyApplied: false,
      disableCohort: false,
    });
    expect(() => rosterRepairPlan({ ...approvedSeed, learnerDependencyCount: 1 })).toThrow(
      SafeRosterRepairError,
    );
    expect(rosterRepairPlan({ ...approvedSeed, automationMode: 'DRY_RUN' })).toEqual({
      alreadyApplied: false,
      disableCohort: true,
    });
    expect(() =>
      rosterRepairPlan({ ...approvedSeed, automationMode: 'DRY_RUN', actionableJobCount: 1 }),
    ).toThrow(SafeRosterRepairError);
    expect(() => rosterRepairPlan({ ...approvedSeed, automationMode: 'ACTIVE' })).toThrow(
      SafeRosterRepairError,
    );
  });

  it('is idempotent for the complete target roster', () => {
    expect(
      rosterRepairPlan({
        ...approvedSeed,
        cohortName: 'Cohort 3',
        learnerCount: 14,
        fixtureAccountCount: 0,
        sessionCount: 0,
        sheetEmailLearners: 14,
      }),
    ).toEqual({ alreadyApplied: true, disableCohort: false });
  });
});
