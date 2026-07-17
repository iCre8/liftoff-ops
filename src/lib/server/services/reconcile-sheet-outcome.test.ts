import { describe, expect, it } from 'vitest';

import type {
  AttendanceSheetPort,
  AttendanceSheetRecord,
  AttendanceSheetWrite,
} from '../integrations/contracts';
import {
  SheetAuthorityConflictError,
  SheetVersionConflictError,
} from '../integrations/google-sheets/errors';
import { reconcileSheetOutcome, type SheetSyncAuditPort } from './reconcile-sheet-outcome';

const baseRecord: AttendanceSheetRecord = {
  learnerExternalId: 'learner-001',
  sessionExternalId: 'session-001',
  sourceRow: 7,
  checkInAt: null,
  exitTicketAt: null,
  excused: false,
  outcome: null,
  sourceVersion: 'version-1',
};

class AuditSpy implements SheetSyncAuditPort {
  readonly attempts: Parameters<SheetSyncAuditPort['recordAttempt']>[0][] = [];
  readonly reviews: Parameters<SheetSyncAuditPort['requestHumanReview']>[0][] = [];

  async recordAttempt(input: Parameters<SheetSyncAuditPort['recordAttempt']>[0]): Promise<void> {
    this.attempts.push(input);
  }

  async requestHumanReview(
    input: Parameters<SheetSyncAuditPort['requestHumanReview']>[0],
  ): Promise<void> {
    this.reviews.push(input);
  }
}

describe('reconcileSheetOutcome', () => {
  it('refreshes a stale empty row and succeeds without duplicating the write', async () => {
    let writeCount = 0;
    const sheet: AttendanceSheetPort = {
      async readSession() {
        return [{ ...baseRecord, sourceVersion: 'version-2' }];
      },
      async writeOutcome(write: AttendanceSheetWrite) {
        writeCount += 1;
        if (write.expectedSourceVersion === 'version-1') {
          throw new SheetVersionConflictError('stale');
        }
        return { sourceVersion: 'version-3', changed: true };
      },
    };
    const audit = new AuditSpy();

    const result = await reconcileSheetOutcome({
      sheet,
      audit,
      idempotencyKey: 'incident-001:outcome',
      write: {
        learnerExternalId: 'learner-001',
        sessionExternalId: 'session-001',
        expectedSourceVersion: 'version-1',
        outcome: 'contacted',
      },
    });

    expect(result).toEqual({ status: 'written', attempts: 2, sourceVersion: 'version-3' });
    expect(writeCount).toBe(2);
    expect(audit.reviews).toHaveLength(0);
  });

  it('recognizes an outcome that another process already applied', async () => {
    const sheet: AttendanceSheetPort = {
      async readSession() {
        return [{ ...baseRecord, outcome: 'contacted', sourceVersion: 'version-2' }];
      },
      async writeOutcome() {
        throw new SheetVersionConflictError('stale');
      },
    };
    const audit = new AuditSpy();

    const result = await reconcileSheetOutcome({
      sheet,
      audit,
      idempotencyKey: 'incident-001:outcome',
      write: {
        learnerExternalId: 'learner-001',
        sessionExternalId: 'session-001',
        expectedSourceVersion: 'version-1',
        outcome: 'contacted',
      },
    });

    expect(result).toEqual({
      status: 'already_applied',
      attempts: 1,
      sourceVersion: 'version-2',
    });
    expect(audit.reviews).toHaveLength(0);
  });

  it('preserves a staff value for three attempts and requests one human review', async () => {
    let writeCount = 0;
    const sheet: AttendanceSheetPort = {
      async readSession() {
        return [{ ...baseRecord, outcome: 'staff-corrected', sourceVersion: 'staff-version' }];
      },
      async writeOutcome() {
        writeCount += 1;
        throw new SheetAuthorityConflictError('staff value');
      },
    };
    const audit = new AuditSpy();

    const result = await reconcileSheetOutcome({
      sheet,
      audit,
      idempotencyKey: 'incident-001:outcome',
      write: {
        learnerExternalId: 'learner-001',
        sessionExternalId: 'session-001',
        expectedSourceVersion: 'version-1',
        outcome: 'contacted',
      },
    });

    expect(result).toEqual({
      status: 'human_review',
      attempts: 3,
      reason: 'sheet_value_preserved',
    });
    expect(writeCount).toBe(3);
    expect(audit.reviews).toEqual([
      {
        idempotencyKey: 'incident-001:outcome',
        learnerExternalId: 'learner-001',
        sessionExternalId: 'session-001',
        attempts: 3,
        reason: 'sheet_value_preserved',
      },
    ]);
  });
});
