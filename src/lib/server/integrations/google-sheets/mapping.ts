import { z } from 'zod';

const column = z.string().regex(/^[A-Z]{1,3}$/, 'must be an uppercase A1 column');

const worksheetId = z.preprocess((value) => {
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) return Number(value.trim());
  return value;
}, z.number().int().nonnegative());

const sessionMapping = z.object({
  checkInColumn: column,
  exitTicketColumn: column,
  excusedColumn: column,
  outcomeColumn: column,
});

const detectedSessionGroup = z.object({
  checkInColumn: column,
  checkOutColumn: column,
  excusedColumn: column,
  outcomeColumn: column,
});

export const attendanceSheetMappingSchema = z
  .object({
    dataStartRow: z.number().int().min(1),
    dataEndRow: z.number().int().min(1),
    learnerExternalIdColumn: column,
    sessions: z.record(z.string().trim().min(1), sessionMapping),
  })
  .superRefine((mapping, context) => {
    if (mapping.dataEndRow < mapping.dataStartRow) {
      context.addIssue({
        code: 'custom',
        path: ['dataEndRow'],
        message: 'must be greater than or equal to dataStartRow',
      });
    }

    for (const [sessionExternalId, session] of Object.entries(mapping.sessions)) {
      const protectedColumns = new Set([
        mapping.learnerExternalIdColumn,
        session.checkInColumn,
        session.exitTicketColumn,
        session.excusedColumn,
      ]);
      if (protectedColumns.has(session.outcomeColumn)) {
        context.addIssue({
          code: 'custom',
          path: ['sessions', sessionExternalId, 'outcomeColumn'],
          message: 'must not overlap a configured attendance input column',
        });
      }
    }
  });

export type AttendanceSheetMapping = z.infer<typeof attendanceSheetMappingSchema>;
export type DetectedSessionGroup = z.infer<typeof detectedSessionGroup>;

export interface ContiguousLearnerRange {
  dataStartRow: number;
  dataEndRow: number;
  learnerExternalIdColumn: string;
}

export function deriveContiguousLearnerRange(input: {
  dataStartRow: number;
  learnerExternalIdColumn: string;
  identifiers: readonly unknown[];
}): ContiguousLearnerRange {
  const populated = input.identifiers.map((value) => String(value ?? '').trim().length > 0);
  const firstPopulatedIndex = populated.indexOf(true);
  const lastPopulatedIndex = populated.lastIndexOf(true);

  if (firstPopulatedIndex < 0) {
    throw new Error('Stable learner identifier rows are empty or non-contiguous');
  }
  if (!populated.slice(firstPopulatedIndex, lastPopulatedIndex + 1).every(Boolean)) {
    throw new Error('Stable learner identifier rows are empty or non-contiguous');
  }

  return {
    dataStartRow: input.dataStartRow + firstPopulatedIndex,
    dataEndRow: input.dataStartRow + lastPopulatedIndex,
    learnerExternalIdColumn: column.parse(input.learnerExternalIdColumn),
  };
}

export function parseCompleteDetectedSessionGroups(
  input: unknown,
  detectedCheckPairCount: number,
): DetectedSessionGroup[] {
  const groups = z.array(detectedSessionGroup).min(1).parse(input);
  if (!Number.isSafeInteger(detectedCheckPairCount) || detectedCheckPairCount < 1) {
    throw new Error('At least one complete check-in/check-out pair is required');
  }
  if (groups.length !== detectedCheckPairCount) {
    throw new Error('Detected session groups do not match the complete check-in/check-out pairs');
  }

  const usedColumns = new Set<string>();
  for (const group of groups) {
    for (const value of [
      group.checkInColumn,
      group.checkOutColumn,
      group.excusedColumn,
      group.outcomeColumn,
    ]) {
      if (usedColumns.has(value)) throw new Error('Session-group columns overlap');
      usedColumns.add(value);
    }
  }
  return groups;
}

export function parseAttendanceSheetMapping(input: unknown): AttendanceSheetMapping {
  return attendanceSheetMappingSchema.parse(input);
}

export function parseGoogleSheetsWorksheetId(input: unknown): number {
  return worksheetId.parse(input);
}
