import type { sheets_v4 } from '@googleapis/sheets';
import { describe, expect, it, vi } from 'vitest';

import { analyzeSheetHeaders, inventoryAttendanceWorkbook } from './workbook-inventory';

const metadata = {
  worksheetId: 42,
  worksheetTitle: 'Sanitized Attendance',
  sheetIndex: 0,
  rowCount: 250,
  columnCount: 20,
  protectedRangeCount: 0,
};
async function inventoryFromRows(rows: readonly (readonly unknown[])[]) {
  const batchGet = vi.fn().mockResolvedValue({ data: { valueRanges: [{ values: rows }] } });
  const get = vi.fn().mockResolvedValue({
    data: {
      sheets: [
        {
          properties: {
            sheetId: metadata.worksheetId,
            title: metadata.worksheetTitle,
            index: metadata.sheetIndex,
            sheetType: 'GRID',
            gridProperties: {
              rowCount: metadata.rowCount,
              columnCount: metadata.columnCount,
            },
          },
        },
      ],
    },
  });
  const api = { spreadsheets: { get, values: { batchGet } } } as unknown as sheets_v4.Sheets;
  return inventoryAttendanceWorkbook({
    api,
    spreadsheetId: 'sanitized-copy',
    worksheetId: metadata.worksheetId,
    generatedAt: '2026-07-19T00:00:00.000Z',
  });
}

describe('workbook inventory header analysis', () => {
  it('detects an attendance candidate and adjacent check-in/check-out pairs', () => {
    const sheet = analyzeSheetHeaders(metadata, [
      [],
      [],
      [],
      [
        '',
        '',
        '',
        '',
        '',
        'Check in Friday',
        'Check out Friday',
        'Excused Status',
        'Incident Outcome',
      ],
      [],
      ['Student Number', 'Name', 'PLP', 'Email', 'Attendance Notes'],
    ]);

    expect(sheet.attendanceCandidate).toBe(true);
    expect(sheet.detectedCheckPairs).toEqual([{ checkInColumn: 'F', checkOutColumn: 'G' }]);
    expect(sheet.detectedSessionGroups).toEqual([
      {
        headerRow: 4,
        checkInColumn: 'F',
        checkOutColumn: 'G',
        excusedColumn: 'H',
        outcomeColumn: 'I',
      },
    ]);
    expect(sheet.recognizedHeaders).toContainEqual({ kind: 'learner_id', row: 6, column: 'A' });
  });

  it('maps learner identities from the unique email header at D10', async () => {
    const rows = Array.from({ length: 9 }, () => [] as string[]);
    rows[8] = [
      'Student Number',
      'Name',
      'PLP',
      'Email',
      'Attendance Notes',
      'Check in Friday',
      'Check out Friday',
      'Excused Status',
      'Incident Outcome',
    ];

    const report = await inventoryFromRows(rows);

    expect(report.mappingDraft).toMatchObject({
      dataStartRow: 10,
      dataEndRow: null,
      learnerExternalIdColumn: 'D',
    });
  });

  it.each([
    ['missing', ['Student Number', 'Name', 'PLP', '', 'Attendance Notes']],
    ['ambiguous', ['Student Number', 'Name', 'Email', 'Email', 'Attendance Notes']],
  ])('does not create a mapping draft when the email header is %s', async (_case, headers) => {
    const rows = Array.from({ length: 9 }, () => [] as string[]);
    rows[8] = [
      ...headers,
      'Check in Friday',
      'Check out Friday',
      'Excused Status',
      'Incident Outcome',
    ];

    const report = await inventoryFromRows(rows);

    expect(report.sheets[0]?.attendanceCandidate).toBe(true);
    expect(report.mappingDraft).toBeNull();
  });

  it('does not retain unrecognized or learner-like raw values', () => {
    const sensitiveMarker = 'learner-001@example.invalid';
    const sheet = analyzeSheetHeaders(metadata, [
      [sensitiveMarker, 'Student Number'],
      ['Private free-form note'],
    ]);

    expect(JSON.stringify(sheet)).not.toContain(sensitiveMarker);
    expect(JSON.stringify(sheet)).not.toContain('Private free-form note');
  });

  it('includes row 12 and excludes values beyond the bounded inventory range', () => {
    const rows = Array.from({ length: 13 }, () => [] as string[]);
    rows[11] = ['Student Number', 'Name', 'Check in Monday', 'Check out Monday'];
    rows[12] = ['', '', 'Check in Tuesday', 'Check out Tuesday'];

    const sheet = analyzeSheetHeaders(metadata, rows);

    expect(sheet.attendanceCandidate).toBe(true);
    expect(sheet.recognizedHeaders).toContainEqual({ kind: 'learner_id', row: 12, column: 'A' });
    expect(sheet.detectedCheckPairs).toEqual([{ checkInColumn: 'C', checkOutColumn: 'D' }]);
    expect(sheet.recognizedHeaders).not.toContainEqual({ kind: 'check_in', row: 13, column: 'C' });
  });

  it('reads only the configured worksheet ID through its current title', async () => {
    const batchGet = vi.fn().mockResolvedValue({
      data: { valueRanges: [{ values: [['Student Number', 'Check in', 'Check out']] }] },
    });
    const get = vi.fn().mockResolvedValue({
      data: {
        sheets: [
          { properties: { sheetId: 7, title: 'Other', sheetType: 'GRID' } },
          {
            properties: {
              sheetId: 42,
              title: 'Renamed Attendance',
              index: 1,
              sheetType: 'GRID',
              gridProperties: { rowCount: 250, columnCount: 20 },
            },
          },
        ],
      },
    });
    const api = { spreadsheets: { get, values: { batchGet } } } as unknown as sheets_v4.Sheets;
    const report = await inventoryAttendanceWorkbook({
      api,
      spreadsheetId: 'sanitized-copy',
      worksheetId: 42,
      generatedAt: '2026-07-14T00:00:00.000Z',
    });
    expect(batchGet).toHaveBeenCalledWith(
      expect.objectContaining({ ranges: ["'Renamed Attendance'!A1:T12"] }),
    );
    expect(report.sheets).toHaveLength(1);
    expect(report.sheets[0]).toMatchObject({ worksheetId: 42, attendanceCandidate: true });
  });
});
