import { describe, expect, it, vi } from 'vitest';

import type { AttendanceSheetPort } from '$lib/server/integrations/contracts';

import { previewSheetSessionReconciliation } from './phase-3-reconciliation';

describe('dry-run Sheet reconciliation preview', () => {
  it('reads and plans authoritative changes without a Sheet write or database mutation', async () => {
    const writeOutcome = vi.fn();
    const sheet: AttendanceSheetPort = {
      async readSession() {
        return [
          {
            learnerExternalId: 'learner@example.test',
            sessionExternalId: 'session-ref',
            sourceRow: 10,
            checkInAt: '2026-07-24T13:20:00.000Z',
            exitTicketAt: null,
            excused: false,
            outcome: null,
            sourceVersion: 'version-ref',
          },
        ];
      },
      writeOutcome,
    };
    const database = {
      programSession: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: 'session-id',
          cohortId: 'cohort-id',
          externalId: 'session-ref',
          checkInReleasedAt: new Date('2026-07-24T13:15:00.000Z'),
        }),
      },
      learner: {
        findUnique: vi.fn().mockResolvedValue({
          submissions: [],
          attendanceRecords: [],
        }),
      },
      $transaction: vi.fn(),
      submission: { create: vi.fn() },
      attendanceRecord: { upsert: vi.fn() },
      syncAttempt: { createMany: vi.fn() },
    };

    await expect(
      previewSheetSessionReconciliation(database as never, sheet, 'session-id'),
    ).resolves.toEqual({
      recordsRead: 1,
      timestampsWouldImport: 1,
      attendanceCorrectionsPlanned: 1,
      humanReviewItems: 0,
    });
    expect(writeOutcome).not.toHaveBeenCalled();
    expect(database.$transaction).not.toHaveBeenCalled();
    expect(database.submission.create).not.toHaveBeenCalled();
    expect(database.attendanceRecord.upsert).not.toHaveBeenCalled();
    expect(database.syncAttempt.createMany).not.toHaveBeenCalled();
  });
});
