import { describe, expect, it } from 'vitest';

import {
  RETENTION_DATA_CATEGORIES,
  retentionReviewPlan,
  threeCalendarYearsAfter,
} from './retention-reviews';

describe('retention review planning', () => {
  it('uses three calendar years, including leap-day normalization', () => {
    expect(threeCalendarYearsAfter(new Date('2024-02-29T12:00:00Z')).toISOString()).toBe(
      '2027-03-01T12:00:00.000Z',
    );
  });

  it('creates one review for every approved data category', () => {
    const plan = retentionReviewPlan('cohort-ref', new Date('2026-07-20T00:00:00Z'));
    expect(plan).toHaveLength(RETENTION_DATA_CATEGORIES.length);
    expect(new Set(plan.map((item) => item.category)).size).toBe(RETENTION_DATA_CATEGORIES.length);
    expect(plan.every((item) => item.dueAt.toISOString() === '2029-07-20T00:00:00.000Z')).toBe(
      true,
    );
  });
});
