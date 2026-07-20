import { describe, expect, it } from 'vitest';

import { deriveContiguousLearnerRange, parseCompleteDetectedSessionGroups } from './mapping';

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

  it('accepts the current six complete session groups without a fixed annual count', () => {
    const columns = Array.from({ length: 24 }, (_, index) =>
      String.fromCharCode('A'.charCodeAt(0) + index),
    );
    const groups = Array.from({ length: 6 }, (_, index) => ({
      checkInColumn: columns[index * 4],
      checkOutColumn: columns[index * 4 + 1],
      excusedColumn: columns[index * 4 + 2],
      outcomeColumn: columns[index * 4 + 3],
    }));

    expect(parseCompleteDetectedSessionGroups(groups, 6)).toEqual(groups);
  });

  it('rejects missing, incomplete, or overlapping session groups', () => {
    expect(() => parseCompleteDetectedSessionGroups([], 0)).toThrow();
    expect(() =>
      parseCompleteDetectedSessionGroups(
        [{ checkInColumn: 'I', checkOutColumn: 'J', excusedColumn: 'K', outcomeColumn: 'L' }],
        2,
      ),
    ).toThrow('do not match');
    expect(() =>
      parseCompleteDetectedSessionGroups(
        [{ checkInColumn: 'I', checkOutColumn: 'J', excusedColumn: 'K', outcomeColumn: 'I' }],
        1,
      ),
    ).toThrow('overlap');
  });
});
