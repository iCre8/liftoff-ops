import type { sheets_v4 } from '@googleapis/sheets';
import { describe, expect, it, vi } from 'vitest';

import { GoogleSheetsValuesGateway } from './google-api-gateway';

function fakeApi(input?: {
  valueRanges?: { values?: unknown[][] }[];
  sheets?: sheets_v4.Schema$Sheet[];
}) {
  const batchGet = vi.fn().mockResolvedValue({
    data: { valueRanges: input?.valueRanges ?? [] },
  });
  const update = vi.fn().mockResolvedValue({ data: {} });
  const get = vi.fn().mockResolvedValue({ data: { sheets: input?.sheets ?? [] } });
  const api = {
    spreadsheets: { values: { batchGet, update }, get },
  } as unknown as sheets_v4.Sheets;

  return { api, batchGet, update };
}

describe('GoogleSheetsValuesGateway', () => {
  it('reads only requested ranges and preserves their configured keys', async () => {
    const { api, batchGet } = fakeApi({
      valueRanges: [{ values: [['learner-001'], [null]] }, { values: [[true]] }],
    });
    const gateway = new GoogleSheetsValuesGateway({ api, spreadsheetId: 'sanitized-copy' });

    await expect(gateway.readRanges(["'Attendance'!A7:A8", "'Attendance'!D7:D8"])).resolves.toEqual(
      [
        { range: "'Attendance'!A7:A8", values: [['learner-001'], [null]] },
        { range: "'Attendance'!D7:D8", values: [[true]] },
      ],
    );
    expect(batchGet).toHaveBeenCalledWith(
      expect.objectContaining({
        spreadsheetId: 'sanitized-copy',
        ranges: ["'Attendance'!A7:A8", "'Attendance'!D7:D8"],
        valueRenderOption: 'UNFORMATTED_VALUE',
      }),
    );
  });

  it('resolves the current tab title from a stable worksheet ID', async () => {
    const { api } = fakeApi({
      sheets: [{ properties: { sheetId: 42, title: 'Renamed Attendance', sheetType: 'GRID' } }],
    });
    const gateway = new GoogleSheetsValuesGateway({ api, spreadsheetId: 'sanitized-copy' });

    await expect(gateway.resolveWorksheetTitle(42)).resolves.toBe('Renamed Attendance');
    await expect(gateway.resolveWorksheetTitle(43)).rejects.toThrow(/was not found/);
  });

  it('fails closed when a read-only gateway is asked to write', async () => {
    const { api, update } = fakeApi();
    const gateway = new GoogleSheetsValuesGateway({ api, spreadsheetId: 'sanitized-copy' });

    await expect(
      gateway.writeCell({ range: "'Attendance'!I7", value: 'contacted' }),
    ).rejects.toThrow(/writes are disabled/);
    expect(update).not.toHaveBeenCalled();
  });

  it('writes one raw cell only when explicitly constructed for read-write access', async () => {
    const { api, update } = fakeApi();
    const gateway = new GoogleSheetsValuesGateway({
      api,
      spreadsheetId: 'sanitized-copy',
      access: 'read-write',
    });

    await gateway.writeCell({ range: "'Attendance'!I7", value: 'contacted' });

    expect(update).toHaveBeenCalledWith({
      spreadsheetId: 'sanitized-copy',
      range: "'Attendance'!I7",
      valueInputOption: 'RAW',
      includeValuesInResponse: false,
      requestBody: { majorDimension: 'ROWS', values: [['contacted']] },
    });
  });

  it('returns identifier-free workbook metadata counts', async () => {
    const { api } = fakeApi({
      sheets: [
        { properties: { sheetType: 'GRID' }, protectedRanges: [{ warningOnly: false }] },
        { properties: { sheetType: 'OBJECT' }, protectedRanges: [] },
      ],
    });
    const gateway = new GoogleSheetsValuesGateway({ api, spreadsheetId: 'sanitized-copy' });

    await expect(gateway.inspectMetadata()).resolves.toEqual({
      sheetCount: 2,
      gridSheetCount: 1,
      protectedRangeCount: 1,
    });
  });
});
