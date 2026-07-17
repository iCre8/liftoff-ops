import type { AttendanceSheetPort, AttendanceSheetWrite } from '../integrations/contracts.ts';
import {
  SheetAuthorityConflictError,
  SheetRecordNotFoundError,
  SheetVersionConflictError,
} from '../integrations/google-sheets/errors.ts';

export interface SheetSyncAuditPort {
  recordAttempt(input: {
    idempotencyKey: string;
    attemptNumber: number;
    status: 'written' | 'already_applied' | 'conflict' | 'failed';
    reason?: string;
  }): Promise<void>;
  requestHumanReview(input: {
    idempotencyKey: string;
    learnerExternalId: string;
    sessionExternalId: string;
    attempts: number;
    reason: 'sheet_value_preserved' | 'retry_limit_exhausted' | 'record_not_found';
  }): Promise<void>;
}

export type SheetReconciliationResult =
  | { status: 'written' | 'already_applied'; attempts: number; sourceVersion: string }
  | {
      status: 'human_review';
      attempts: number;
      reason: 'sheet_value_preserved' | 'retry_limit_exhausted' | 'record_not_found';
    };

export async function reconcileSheetOutcome(input: {
  sheet: AttendanceSheetPort;
  audit: SheetSyncAuditPort;
  idempotencyKey: string;
  write: AttendanceSheetWrite;
  retryLimit?: number;
}): Promise<SheetReconciliationResult> {
  const retryLimit = input.retryLimit ?? 3;
  if (!Number.isInteger(retryLimit) || retryLimit < 1) {
    throw new RangeError('retryLimit must be a positive integer');
  }

  let write = input.write;
  let sheetValuePreserved = false;

  for (let attemptNumber = 1; attemptNumber <= retryLimit; attemptNumber += 1) {
    try {
      const result = await input.sheet.writeOutcome(write);
      const status = result.changed ? 'written' : 'already_applied';
      await input.audit.recordAttempt({
        idempotencyKey: input.idempotencyKey,
        attemptNumber,
        status,
      });
      return { status, attempts: attemptNumber, sourceVersion: result.sourceVersion };
    } catch (error) {
      if (error instanceof SheetRecordNotFoundError) {
        await input.audit.recordAttempt({
          idempotencyKey: input.idempotencyKey,
          attemptNumber,
          status: 'failed',
          reason: error.name,
        });
        await input.audit.requestHumanReview({
          idempotencyKey: input.idempotencyKey,
          learnerExternalId: write.learnerExternalId,
          sessionExternalId: write.sessionExternalId,
          attempts: attemptNumber,
          reason: 'record_not_found',
        });
        return { status: 'human_review', attempts: attemptNumber, reason: 'record_not_found' };
      }

      if (
        !(error instanceof SheetVersionConflictError) &&
        !(error instanceof SheetAuthorityConflictError)
      ) {
        throw error;
      }

      await input.audit.recordAttempt({
        idempotencyKey: input.idempotencyKey,
        attemptNumber,
        status: 'conflict',
        reason: error.name,
      });

      const latest = (await input.sheet.readSession(write.sessionExternalId)).find(
        (record) => record.learnerExternalId === write.learnerExternalId,
      );

      if (!latest) {
        await input.audit.requestHumanReview({
          idempotencyKey: input.idempotencyKey,
          learnerExternalId: write.learnerExternalId,
          sessionExternalId: write.sessionExternalId,
          attempts: attemptNumber,
          reason: 'record_not_found',
        });
        return { status: 'human_review', attempts: attemptNumber, reason: 'record_not_found' };
      }
      if (latest.outcome === write.outcome) {
        await input.audit.recordAttempt({
          idempotencyKey: input.idempotencyKey,
          attemptNumber,
          status: 'already_applied',
        });
        return {
          status: 'already_applied',
          attempts: attemptNumber,
          sourceVersion: latest.sourceVersion,
        };
      }

      sheetValuePreserved = latest.outcome !== null;
      write = { ...write, expectedSourceVersion: latest.sourceVersion };
    }
  }

  const reason = sheetValuePreserved ? 'sheet_value_preserved' : 'retry_limit_exhausted';
  await input.audit.requestHumanReview({
    idempotencyKey: input.idempotencyKey,
    learnerExternalId: write.learnerExternalId,
    sessionExternalId: write.sessionExternalId,
    attempts: retryLimit,
    reason,
  });
  return { status: 'human_review', attempts: retryLimit, reason };
}
