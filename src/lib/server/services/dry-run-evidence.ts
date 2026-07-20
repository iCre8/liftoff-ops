const REQUIRED_DAILY_JOBS = new Map<string, number>([
  ['PRE_TRIGGER_RECONCILIATION', 3],
  ['LATE_EVALUATION', 1],
  ['NO_CALL_NO_SHOW_EVALUATION', 1],
  ['SHEET_RECONCILIATION', 2],
  ['EXIT_REMINDER', 1],
  ['INCOMPLETE_DAY_EVALUATION', 1],
]);

export interface DryRunEvidenceJob {
  id: string;
  type: string;
  status: string;
  completedAt: Date | null;
  payload: unknown;
}

export interface DryRunEvidenceAudit {
  entityId: string;
  payload: unknown;
}

export interface DryRunEvidenceAssessment {
  complete: boolean;
  reason?: string;
  expectedJobCount: number;
  completedJobCount: number;
  duplicateCount: number;
  unresolvedMappings: number;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function nonnegativeInteger(value: unknown): number {
  return Number.isInteger(value) && Number(value) >= 0 ? Number(value) : 0;
}

export function assessDryRunDayEvidence(
  jobs: readonly DryRunEvidenceJob[],
  audits: readonly DryRunEvidenceAudit[],
): DryRunEvidenceAssessment {
  const expectedJobCount = [...REQUIRED_DAILY_JOBS.values()].reduce((sum, count) => sum + count, 0);
  const relevantJobs = jobs.filter((job) => REQUIRED_DAILY_JOBS.has(job.type));
  const counts = new Map<string, number>();
  for (const job of relevantJobs) counts.set(job.type, (counts.get(job.type) ?? 0) + 1);
  const duplicateCount = [...REQUIRED_DAILY_JOBS].reduce(
    (sum, [type, expected]) => sum + Math.max(0, (counts.get(type) ?? 0) - expected),
    0,
  );
  const missing = [...REQUIRED_DAILY_JOBS].filter(
    ([type, expected]) => (counts.get(type) ?? 0) < expected,
  );
  const completed = relevantJobs.filter((job) => {
    const payload = record(job.payload);
    return job.status === 'COMPLETED' && job.completedAt && payload?.executionMode === 'DRY_RUN';
  });
  const auditsByJob = new Map<string, DryRunEvidenceAudit[]>();
  for (const audit of audits) {
    const existing = auditsByJob.get(audit.entityId) ?? [];
    existing.push(audit);
    auditsByJob.set(audit.entityId, existing);
  }
  const invalidAudit = completed.some((job) => {
    const matching = auditsByJob.get(job.id) ?? [];
    if (matching.length !== 1) return true;
    const payload = record(matching[0].payload);
    return payload?.externalMessages !== 0 || payload?.externalWrites !== 0;
  });
  const unresolvedMappings = completed.reduce((sum, job) => {
    const payload = record(job.payload);
    const preview = record(payload?.reconciliationPreview);
    return sum + nonnegativeInteger(preview?.humanReviewItems);
  }, 0);

  const base = {
    expectedJobCount,
    completedJobCount: completed.length,
    duplicateCount,
    unresolvedMappings,
  };
  if (duplicateCount > 0) return { ...base, complete: false, reason: 'Duplicate daily jobs found' };
  if (missing.length > 0)
    return { ...base, complete: false, reason: 'Required daily jobs are missing' };
  if (completed.length !== expectedJobCount)
    return {
      ...base,
      complete: false,
      reason: 'Required daily jobs are not complete in dry-run mode',
    };
  if (invalidAudit)
    return {
      ...base,
      complete: false,
      reason: 'Zero-external-effect audit evidence is incomplete',
    };
  if (unresolvedMappings > 0)
    return { ...base, complete: false, reason: 'Authoritative Sheet mappings require review' };
  return { ...base, complete: true };
}
