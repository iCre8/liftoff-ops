import { describe, expect, it } from 'vitest';

import { deriveContiguousLearnerRange } from './mapping';

describe('Google Sheets learner mapping', () => {
  it('derives the bounded D10:D23 learner range', () => {
    const identifiers = [
      '',
      ...Array.from({ length: 14 }, (_, index) => 'learner-' + String(index + 1) + '@example.test'),
      '',
      '',
    ];

    expect(
      deriveContiguousLearnerRange({
        dataStartRow: 9,
        learnerExternalIdColumn: 'D',
        identifiers,
      }),
    ).toEqual({
      dataStartRow: 10,
      dataEndRow: 23,
      learnerExternalIdColumn: 'D',
    });
  });

  it('ignores trailing blank capacity rows', () => {
    expect(
      deriveContiguousLearnerRange({
        dataStartRow: 10,
        learnerExternalIdColumn: 'D',
        identifiers: ['learner-1@example.test', 'learner-2@example.test', '', '   '],
      }),
    ).toEqual({
      dataStartRow: 10,
      dataEndRow: 11,
      learnerExternalIdColumn: 'D',
    });
  });

  it('rejects an empty learner range', () => {
    expect(() =>
      deriveContiguousLearnerRange({
        dataStartRow: 10,
        learnerExternalIdColumn: 'D',
        identifiers: [],
      }),
    ).toThrow('empty or non-contiguous');
  });

  it('rejects an internal blank learner row', () => {
    expect(() =>
      deriveContiguousLearnerRange({
        dataStartRow: 10,
        learnerExternalIdColumn: 'D',
        identifiers: ['learner-1@example.test', '', 'learner-3@example.test'],
      }),
    ).toThrow('empty or non-contiguous');
  });
});
