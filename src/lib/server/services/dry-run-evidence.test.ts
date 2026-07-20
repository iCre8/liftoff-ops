import { describe, expect, it } from 'vitest';

import { assessDryRunDayEvidence, type DryRunEvidenceJob } from './dry-run-evidence';

const types = [
  'PRE_TRIGGER_RECONCILIATION',
  'PRE_TRIGGER_RECONCILIATION',
  'PRE_TRIGGER_RECONCILIATION',
  'LATE_EVALUATION',
  'NO_CALL_NO_SHOW_EVALUATION',
  'SHEET_RECONCILIATION',
  'SHEET_RECONCILIATION',
  'EXIT_REMINDER',
  'INCOMPLETE_DAY_EVALUATION',
];

function completeJobs(): DryRunEvidenceJob[] {
  return types.map((type, index) => ({
    id: `job-${index}`,
    type,
    status: 'COMPLETED',
    completedAt: new Date('2026-07-24T20:00:00Z'),
    payload: {
      executionMode: 'DRY_RUN',
      ...(type.includes('RECONCILIATION')
        ? { reconciliationPreview: { humanReviewItems: 0 } }
        : {}),
    },
  }));
}

function zeroEffectAudits(jobs: readonly DryRunEvidenceJob[]) {
  return jobs.map((job) => ({
    entityId: job.id,
    payload: { externalMessages: 0, externalWrites: 0 },
  }));
}

describe('dry-run day evidence', () => {
  it('requires all nine daily jobs and one zero-effect audit per job', () => {
    const jobs = completeJobs();
    expect(assessDryRunDayEvidence(jobs, zeroEffectAudits(jobs))).toEqual({
      complete: true,
      expectedJobCount: 9,
      completedJobCount: 9,
      duplicateCount: 0,
      unresolvedMappings: 0,
    });
  });

  it('rejects missing jobs, duplicates, external effects, and unresolved mappings', () => {
    const jobs = completeJobs();
    expect(assessDryRunDayEvidence(jobs.slice(1), zeroEffectAudits(jobs.slice(1))).complete).toBe(
      false,
    );
    expect(
      assessDryRunDayEvidence([...jobs, { ...jobs[0], id: 'duplicate' }], zeroEffectAudits(jobs))
        .duplicateCount,
    ).toBe(1);
    const unsafeAudits = zeroEffectAudits(jobs);
    unsafeAudits[0] = { entityId: jobs[0].id, payload: { externalMessages: 1, externalWrites: 0 } };
    expect(assessDryRunDayEvidence(jobs, unsafeAudits).complete).toBe(false);
    jobs[0].payload = {
      executionMode: 'DRY_RUN',
      reconciliationPreview: { humanReviewItems: 1 },
    };
    expect(assessDryRunDayEvidence(jobs, zeroEffectAudits(jobs)).unresolvedMappings).toBe(1);
  });
});
