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

export function parseAttendanceSheetMapping(input: unknown): AttendanceSheetMapping {
  return attendanceSheetMappingSchema.parse(input);
}

export function parseGoogleSheetsWorksheetId(input: unknown): number {
  return worksheetId.parse(input);
}
