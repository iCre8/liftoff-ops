import { describe, expect, it } from 'vitest';

import { ConfiguredAttendanceSheetAdapter } from './adapter';
import { SheetAuthorityConflictError, SheetVersionConflictError } from './errors';
import type { SheetCellValue, SheetRangeValues, SheetValuesGateway } from './gateway';
import { parseAttendanceSheetMapping } from './mapping';

const mapping = {
  dataStartRow: 7,
  dataEndRow: 9,
  learnerExternalIdColumn: 'A',
  sessions: {
    'session-001': {
      checkInColumn: 'B',
      exitTicketColumn: 'C',
      excusedColumn: 'D',
      outcomeColumn: 'E',
    },
  },
};

class MemorySheetGateway implements SheetValuesGateway {
  readonly cells = new Map<string, SheetCellValue>();
  readonly writes: { range: string; value: SheetCellValue }[] = [];
  worksheetTitle = 'Sanitized Attendance';
  readonly resolvedWorksheetIds: number[] = [];

  async resolveWorksheetTitle(worksheetId: number): Promise<string> {
    this.resolvedWorksheetIds.push(worksheetId);
    return this.worksheetTitle;
  }

  setCell(column: string, row: number, value: SheetCellValue): void {
    this.cells.set(`${column}${row}`, value);
  }

  async readRanges(ranges: readonly string[]): Promise<readonly SheetRangeValues[]> {
    return ranges.map((range) => {
      const match = range.match(/!([A-Z]+)(\d+):\1(\d+)$/);
      if (!match) throw new Error(`Unexpected test range: ${range}`);
      const [, column, firstRow, lastRow] = match;
      const values: SheetCellValue[][] = [];
      for (let row = Number(firstRow); row <= Number(lastRow); row += 1) {
        values.push([this.cells.get(`${column}${row}`) ?? null]);
      }
      return { range, values };
    });
  }

  async writeCell(input: { range: string; value: SheetCellValue }): Promise<void> {
    const match = input.range.match(/!([A-Z]+)(\d+)$/);
    if (!match) throw new Error(`Unexpected test cell: ${input.range}`);
    this.writes.push(input);
    this.cells.set(`${match[1]}${match[2]}`, input.value);
  }
}

function populatedGateway(): MemorySheetGateway {
  const gateway = new MemorySheetGateway();
  gateway.setCell('A', 7, 'learner-001');
  gateway.setCell('B', 7, '2026-07-15T13:20:00.000Z');
  gateway.setCell('C', 7, null);
  gateway.setCell('D', 7, false);
  gateway.setCell('E', 7, null);
  return gateway;
}

describe('ConfiguredAttendanceSheetAdapter', () => {
  it('rejects a writable outcome column that overlaps attendance input', () => {
    expect(() =>
      parseAttendanceSheetMapping({
        ...mapping,
        sessions: {
          'session-001': { ...mapping.sessions['session-001'], outcomeColumn: 'B' },
        },
      }),
    ).toThrow(/must not overlap/);
  });

  it('maps only configured columns and skips blank roster rows', async () => {
    const adapter = new ConfiguredAttendanceSheetAdapter(populatedGateway(), mapping, 42);
    const records = await adapter.readSession('session-001');

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      learnerExternalId: 'learner-001',
      sessionExternalId: 'session-001',
      sourceRow: 7,
      checkInAt: '2026-07-15T13:20:00.000Z',
      exitTicketAt: null,
      excused: false,
      outcome: null,
    });
    expect(records[0]?.sourceVersion).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it('writes only the configured outcome cell and verifies the result', async () => {
    const gateway = populatedGateway();
    gateway.worksheetTitle = 'Renamed Attendance';
    const adapter = new ConfiguredAttendanceSheetAdapter(gateway, mapping, '42');
    const [record] = await adapter.readSession('session-001');

    const result = await adapter.writeOutcome({
      learnerExternalId: 'learner-001',
      sessionExternalId: 'session-001',
      expectedSourceVersion: record.sourceVersion,
      outcome: 'contacted',
    });

    expect(result.changed).toBe(true);
    expect(gateway.writes).toEqual([{ range: "'Renamed Attendance'!E7", value: 'contacted' }]);
    expect(gateway.resolvedWorksheetIds).toEqual([42, 42, 42]);
  });

  it('refuses a stale version without writing', async () => {
    const gateway = populatedGateway();
    const adapter = new ConfiguredAttendanceSheetAdapter(gateway, mapping, 42);
    const [record] = await adapter.readSession('session-001');
    gateway.setCell('B', 7, '2026-07-15T13:30:00.000Z');

    await expect(
      adapter.writeOutcome({
        learnerExternalId: 'learner-001',
        sessionExternalId: 'session-001',
        expectedSourceVersion: record.sourceVersion,
        outcome: 'contacted',
      }),
    ).rejects.toBeInstanceOf(SheetVersionConflictError);
    expect(gateway.writes).toHaveLength(0);
  });

  it('preserves a different staff-entered outcome', async () => {
    const gateway = populatedGateway();
    gateway.setCell('E', 7, 'staff-corrected');
    const adapter = new ConfiguredAttendanceSheetAdapter(gateway, mapping, 42);
    const [record] = await adapter.readSession('session-001');

    await expect(
      adapter.writeOutcome({
        learnerExternalId: 'learner-001',
        sessionExternalId: 'session-001',
        expectedSourceVersion: record.sourceVersion,
        outcome: 'contacted',
      }),
    ).rejects.toBeInstanceOf(SheetAuthorityConflictError);
    expect(gateway.writes).toHaveLength(0);
  });
});
