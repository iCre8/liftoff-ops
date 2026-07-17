import { auth, sheets, type sheets_v4 } from '@googleapis/sheets';

import type { SheetCellValue, SheetRangeValues, SheetValuesGateway } from './gateway';

const READ_ONLY_SCOPE = 'https://www.googleapis.com/auth/spreadsheets.readonly';
const READ_WRITE_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';

export type GoogleSheetsAccess = 'read-only' | 'read-write';

export interface SpreadsheetMetadataSummary {
  sheetCount: number;
  gridSheetCount: number;
  protectedRangeCount: number;
}

function normalizeCell(value: unknown): SheetCellValue {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }

  throw new Error('Google Sheets returned an unsupported cell value type');
}

function normalizeRows(
  values: unknown[][] | null | undefined,
): readonly (readonly SheetCellValue[])[] {
  return (values ?? []).map((row) => row.map(normalizeCell));
}

export class GoogleSheetsValuesGateway implements SheetValuesGateway {
  readonly #api: sheets_v4.Sheets;
  readonly #spreadsheetId: string;
  readonly #access: GoogleSheetsAccess;

  constructor(input: {
    api: sheets_v4.Sheets;
    spreadsheetId: string;
    access?: GoogleSheetsAccess;
  }) {
    const spreadsheetId = input.spreadsheetId.trim();
    if (!spreadsheetId) throw new Error('Google Sheets spreadsheet ID is required');

    this.#api = input.api;
    this.#spreadsheetId = spreadsheetId;
    this.#access = input.access ?? 'read-only';
  }
  async resolveWorksheetTitle(worksheetId: number): Promise<string> {
    const response = await this.#api.spreadsheets.get({
      spreadsheetId: this.#spreadsheetId,
      includeGridData: false,
      fields: 'sheets(properties(sheetId,title,sheetType))',
    });
    const worksheet = (response.data.sheets ?? []).find(
      (sheet) =>
        sheet.properties?.sheetId === worksheetId &&
        (sheet.properties.sheetType ?? 'GRID') === 'GRID',
    );
    const title = worksheet?.properties?.title?.trim();
    if (!title) throw new Error('Configured Google Sheets worksheet ID was not found');
    return title;
  }

  async readRanges(ranges: readonly string[]): Promise<readonly SheetRangeValues[]> {
    if (ranges.length === 0) return [];

    const response = await this.#api.spreadsheets.values.batchGet({
      spreadsheetId: this.#spreadsheetId,
      ranges: [...ranges],
      majorDimension: 'ROWS',
      valueRenderOption: 'UNFORMATTED_VALUE',
      dateTimeRenderOption: 'FORMATTED_STRING',
    });

    const returnedRanges = response.data.valueRanges ?? [];
    return ranges.map((range, index) => ({
      range,
      values: normalizeRows(returnedRanges[index]?.values),
    }));
  }

  async writeCell(input: { range: string; value: SheetCellValue }): Promise<void> {
    if (this.#access !== 'read-write') {
      throw new Error('Google Sheets writes are disabled for this gateway');
    }

    await this.#api.spreadsheets.values.update({
      spreadsheetId: this.#spreadsheetId,
      range: input.range,
      valueInputOption: 'RAW',
      includeValuesInResponse: false,
      requestBody: {
        majorDimension: 'ROWS',
        values: [[input.value]],
      },
    });
  }

  async inspectMetadata(): Promise<SpreadsheetMetadataSummary> {
    const response = await this.#api.spreadsheets.get({
      spreadsheetId: this.#spreadsheetId,
      includeGridData: false,
      fields:
        'sheets(properties(sheetId,sheetType,gridProperties),protectedRanges(range,warningOnly))',
    });
    const workbookSheets = response.data.sheets ?? [];

    return {
      sheetCount: workbookSheets.length,
      gridSheetCount: workbookSheets.filter(
        (sheet) => (sheet.properties?.sheetType ?? 'GRID') === 'GRID',
      ).length,
      protectedRangeCount: workbookSheets.reduce(
        (count, sheet) => count + (sheet.protectedRanges?.length ?? 0),
        0,
      ),
    };
  }
}

export async function createGoogleSheetsGatewayFromAdc(input: {
  spreadsheetId: string;
  access?: GoogleSheetsAccess;
}): Promise<GoogleSheetsValuesGateway> {
  const access = input.access ?? 'read-only';
  const api = await createGoogleSheetsApiFromAdc(access);

  return new GoogleSheetsValuesGateway({
    api,
    spreadsheetId: input.spreadsheetId,
    access,
  });
}

export async function createGoogleSheetsApiFromAdc(
  access: GoogleSheetsAccess = 'read-only',
): Promise<sheets_v4.Sheets> {
  const authClient = await auth.getClient({
    scopes: [access === 'read-write' ? READ_WRITE_SCOPE : READ_ONLY_SCOPE],
  });
  return sheets({ version: 'v4', auth: authClient });
}
