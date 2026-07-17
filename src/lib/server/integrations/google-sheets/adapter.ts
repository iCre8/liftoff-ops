import { createHash } from 'node:crypto';

import type {
  AttendanceSheetPort,
  AttendanceSheetRecord,
  AttendanceSheetWrite,
} from '../contracts.ts';
import {
  SheetAuthorityConflictError,
  SheetRecordNotFoundError,
  SheetVersionConflictError,
} from './errors.ts';
import type { SheetCellValue, SheetRangeValues, SheetValuesGateway } from './gateway.ts';
import {
  parseAttendanceSheetMapping,
  parseGoogleSheetsWorksheetId,
  type AttendanceSheetMapping,
} from './mapping.ts';

interface IndexedRecord extends AttendanceSheetRecord {
  outcomeRange: string;
}

function quoteWorksheet(title: string): string {
  return `'${title.replaceAll("'", "''")}'`;
}

function columnRange(
  worksheetTitle: string,
  column: string,
  startRow: number,
  endRow: number,
): string {
  return `${quoteWorksheet(worksheetTitle)}!${column}${startRow}:${column}${endRow}`;
}

function cellRange(worksheetTitle: string, column: string, row: number): string {
  return `${quoteWorksheet(worksheetTitle)}!${column}${row}`;
}

function valueAt(range: SheetRangeValues | undefined, index: number): SheetCellValue {
  return range?.values[index]?.[0] ?? null;
}

function optionalString(value: SheetCellValue): string | null {
  if (value === null) return null;
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

function booleanValue(value: SheetCellValue): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  return ['true', 'yes', 'excused'].includes(
    String(value ?? '')
      .trim()
      .toLowerCase(),
  );
}

function sourceVersion(record: Omit<AttendanceSheetRecord, 'sourceVersion'>): string {
  const canonical = JSON.stringify({
    learnerExternalId: record.learnerExternalId,
    sessionExternalId: record.sessionExternalId,
    sourceRow: record.sourceRow,
    checkInAt: record.checkInAt,
    exitTicketAt: record.exitTicketAt,
    excused: record.excused,
    outcome: record.outcome,
  });

  return `sha256:${createHash('sha256').update(canonical).digest('hex')}`;
}

export class ConfiguredAttendanceSheetAdapter implements AttendanceSheetPort {
  readonly #gateway: SheetValuesGateway;
  readonly #mapping: AttendanceSheetMapping;
  readonly #worksheetId: number;

  constructor(gateway: SheetValuesGateway, mapping: unknown, worksheetId: unknown) {
    this.#gateway = gateway;
    this.#mapping = parseAttendanceSheetMapping(mapping);
    this.#worksheetId = parseGoogleSheetsWorksheetId(worksheetId);
  }

  async readSession(sessionExternalId: string): Promise<readonly AttendanceSheetRecord[]> {
    return (await this.#readIndexedSession(sessionExternalId)).map(
      ({ outcomeRange: _outcomeRange, ...record }) => record,
    );
  }

  async writeOutcome(
    write: AttendanceSheetWrite,
  ): Promise<{ sourceVersion: string; changed: boolean }> {
    const before = (await this.#readIndexedSession(write.sessionExternalId)).find(
      (record) => record.learnerExternalId === write.learnerExternalId,
    );

    if (!before) {
      throw new SheetRecordNotFoundError('Configured learner/session row was not found');
    }
    if (before.sourceVersion !== write.expectedSourceVersion) {
      throw new SheetVersionConflictError('Attendance row changed after it was read');
    }
    if (before.outcome === write.outcome) {
      return { sourceVersion: before.sourceVersion, changed: false };
    }
    if (before.outcome !== null) {
      throw new SheetAuthorityConflictError('Sheet outcome is already populated by staff');
    }

    await this.#gateway.writeCell({ range: before.outcomeRange, value: write.outcome });

    const after = (await this.#readIndexedSession(write.sessionExternalId)).find(
      (record) => record.learnerExternalId === write.learnerExternalId,
    );

    if (!after || after.outcome !== write.outcome) {
      throw new SheetVersionConflictError('Outcome write could not be verified');
    }

    return { sourceVersion: after.sourceVersion, changed: true };
  }

  async #readIndexedSession(sessionExternalId: string): Promise<readonly IndexedRecord[]> {
    const session = this.#mapping.sessions[sessionExternalId];
    if (!session) {
      throw new SheetRecordNotFoundError('Session is not present in the approved mapping');
    }

    const columns = [
      this.#mapping.learnerExternalIdColumn,
      session.checkInColumn,
      session.exitTicketColumn,
      session.excusedColumn,
      session.outcomeColumn,
    ];
    const worksheetTitle = await this.#gateway.resolveWorksheetTitle(this.#worksheetId);
    const ranges = columns.map((columnName) =>
      columnRange(worksheetTitle, columnName, this.#mapping.dataStartRow, this.#mapping.dataEndRow),
    );
    const values = await this.#gateway.readRanges(ranges);
    const byRange = new Map(values.map((range) => [range.range, range]));
    const rowCount = this.#mapping.dataEndRow - this.#mapping.dataStartRow + 1;
    const records: IndexedRecord[] = [];

    for (let index = 0; index < rowCount; index += 1) {
      const learnerExternalId = optionalString(valueAt(byRange.get(ranges[0]), index));
      if (!learnerExternalId) continue;

      const sourceRow = this.#mapping.dataStartRow + index;
      const withoutVersion: Omit<AttendanceSheetRecord, 'sourceVersion'> = {
        learnerExternalId,
        sessionExternalId,
        sourceRow,
        checkInAt: optionalString(valueAt(byRange.get(ranges[1]), index)),
        exitTicketAt: optionalString(valueAt(byRange.get(ranges[2]), index)),
        excused: booleanValue(valueAt(byRange.get(ranges[3]), index)),
        outcome: optionalString(valueAt(byRange.get(ranges[4]), index)),
      };

      records.push({
        ...withoutVersion,
        sourceVersion: sourceVersion(withoutVersion),
        outcomeRange: cellRange(worksheetTitle, session.outcomeColumn, sourceRow),
      });
    }

    return records;
  }
}
