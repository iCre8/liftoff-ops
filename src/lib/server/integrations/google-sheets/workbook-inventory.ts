import type { sheets_v4 } from '@googleapis/sheets';

export const INVENTORY_HEADER_ROW_LIMIT = 12;
export const INVENTORY_COLUMN_LIMIT = 200;

export type RecognizedHeaderKind =
  | 'learner_id'
  | 'name'
  | 'email'
  | 'attendance_notes'
  | 'check_in'
  | 'check_out'
  | 'excused'
  | 'incident_outcome';

export interface RecognizedHeader {
  kind: RecognizedHeaderKind;
  row: number;
  column: string;
}

export interface DetectedSessionGroup {
  headerRow: number;
  checkInColumn: string;
  checkOutColumn: string;
  excusedColumn: string;
  outcomeColumn: string;
}

export interface WorkbookSheetInventory {
  worksheetId: number;
  worksheetTitle: string;
  sheetIndex: number;
  rowCount: number;
  columnCount: number;
  protectedRangeCount: number;
  recognizedHeaders: readonly RecognizedHeader[];
  detectedCheckPairs: readonly { checkInColumn: string; checkOutColumn: string }[];
  detectedSessionGroups: readonly DetectedSessionGroup[];
  attendanceCandidate: boolean;
  candidateScore: number;
}

export interface WorkbookInventoryReport {
  version: 3;
  generatedAt: string;
  safety: {
    headerRowsRead: number;
    maximumColumnsRead: number;
    rawCellValuesStored: false;
  };
  sheets: readonly WorkbookSheetInventory[];
  mappingDraft: {
    dataStartRow: number;
    dataEndRow: null;
    learnerExternalIdColumn: string;
    detectedCheckPairs: readonly { checkInColumn: string; checkOutColumn: string }[];
    detectedSessionGroups: readonly DetectedSessionGroup[];
    excusedColumn: string | null;
    outcomeColumn: string | null;
    requiresReview: readonly string[];
  } | null;
}

interface SheetMetadata {
  worksheetId: number;
  worksheetTitle: string;
  sheetIndex: number;
  rowCount: number;
  columnCount: number;
  protectedRangeCount: number;
}

function quoteWorksheet(title: string): string {
  return `'${title.replaceAll("'", "''")}'`;
}

function columnName(index: number): string {
  let value = index;
  let result = '';

  while (value > 0) {
    value -= 1;
    result = String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26);
  }

  return result;
}

function normalizedLabel(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, ' ')
    .trim();
}

function recognizedKind(value: unknown): RecognizedHeaderKind | null {
  const label = normalizedLabel(value);
  if (['student number', 'student id', 'learner id'].includes(label)) return 'learner_id';
  if (['name', 'student name', 'learner name'].includes(label)) return 'name';
  if (['email', 'email address', 'student email', 'learner email'].includes(label)) return 'email';
  if (label === 'attendance notes') return 'attendance_notes';
  if (label.startsWith('check in')) return 'check_in';
  if (label.startsWith('check out')) return 'check_out';
  if (['excused', 'excused absence', 'excused status'].includes(label)) return 'excused';
  if (['incident outcome', 'outreach outcome', 'contact outcome'].includes(label)) {
    return 'incident_outcome';
  }
  return null;
}

export function analyzeSheetHeaders(
  metadata: SheetMetadata,
  rows: readonly (readonly unknown[])[],
): WorkbookSheetInventory {
  const recognizedHeaders: RecognizedHeader[] = [];

  rows.slice(0, INVENTORY_HEADER_ROW_LIMIT).forEach((row, rowIndex) => {
    row.slice(0, INVENTORY_COLUMN_LIMIT).forEach((value, columnIndex) => {
      const kind = recognizedKind(value);
      if (kind) {
        recognizedHeaders.push({ kind, row: rowIndex + 1, column: columnName(columnIndex + 1) });
      }
    });
  });

  const byKind = (kind: RecognizedHeaderKind) =>
    recognizedHeaders.filter((header) => header.kind === kind);
  const checkIns = byKind('check_in');
  const checkOuts = byKind('check_out');
  const usedCheckOutColumns = new Set<string>();
  const detectedCheckPairsWithRows = checkIns.flatMap((checkIn) => {
    const checkInIndex = columnNumber(checkIn.column);
    const checkOut = checkOuts.find(
      (candidate) =>
        !usedCheckOutColumns.has(candidate.column) &&
        candidate.row === checkIn.row &&
        columnNumber(candidate.column) > checkInIndex &&
        columnNumber(candidate.column) - checkInIndex <= 2,
    );
    if (!checkOut) return [];
    usedCheckOutColumns.add(checkOut.column);
    return [
      { headerRow: checkIn.row, checkInColumn: checkIn.column, checkOutColumn: checkOut.column },
    ];
  });
  const detectedCheckPairs = detectedCheckPairsWithRows.map(
    ({ checkInColumn, checkOutColumn }) => ({ checkInColumn, checkOutColumn }),
  );
  const excusedHeaders = byKind('excused');
  const outcomeHeaders = byKind('incident_outcome');
  const detectedSessionGroups = detectedCheckPairsWithRows.flatMap((pair) => {
    const expectedExcusedColumn = columnName(columnNumber(pair.checkOutColumn) + 1);
    const expectedOutcomeColumn = columnName(columnNumber(pair.checkOutColumn) + 2);
    const excused = excusedHeaders.find(
      (header) => header.row === pair.headerRow && header.column === expectedExcusedColumn,
    );
    const outcome = outcomeHeaders.find(
      (header) => header.row === pair.headerRow && header.column === expectedOutcomeColumn,
    );
    if (!excused || !outcome) return [];
    return [{ ...pair, excusedColumn: excused.column, outcomeColumn: outcome.column }];
  });

  const hasLearnerId = byKind('learner_id').length > 0;
  const candidateScore =
    (hasLearnerId ? 5 : 0) +
    (checkIns.length > 0 ? 2 : 0) +
    (checkOuts.length > 0 ? 2 : 0) +
    (byKind('email').length > 0 ? 1 : 0) +
    (byKind('attendance_notes').length > 0 ? 1 : 0);

  return {
    ...metadata,
    recognizedHeaders,
    detectedCheckPairs,
    detectedSessionGroups,
    attendanceCandidate: hasLearnerId && checkIns.length > 0 && checkOuts.length > 0,
    candidateScore,
  };
}

function columnNumber(column: string): number {
  return [...column].reduce((value, character) => value * 26 + character.charCodeAt(0) - 64, 0);
}

function mappingDraft(
  sheets: readonly WorkbookSheetInventory[],
): WorkbookInventoryReport['mappingDraft'] {
  const candidates = sheets.filter((sheet) => sheet.attendanceCandidate);
  if (candidates.length !== 1) return null;

  const candidate = candidates[0];
  const learnerId = candidate.recognizedHeaders.find((header) => header.kind === 'learner_id');
  if (!learnerId) return null;
  const excused = candidate.recognizedHeaders.find((header) => header.kind === 'excused');
  const outcome = candidate.recognizedHeaders.find((header) => header.kind === 'incident_outcome');

  const requiresReview = ['Confirm the final learner data row'];
  if (!excused) requiresReview.push('Select or add a dedicated excused-status column');
  if (!outcome) requiresReview.push('Select or add a dedicated incident-outcome column');
  requiresReview.push('Verify formulas and operationally protected columns before any write');

  return {
    dataStartRow: learnerId.row + 1,
    dataEndRow: null,
    learnerExternalIdColumn: learnerId.column,
    detectedCheckPairs: candidate.detectedCheckPairs,
    detectedSessionGroups: candidate.detectedSessionGroups,
    excusedColumn: excused?.column ?? null,
    outcomeColumn: outcome?.column ?? null,
    requiresReview,
  };
}

export async function inventoryAttendanceWorkbook(input: {
  api: sheets_v4.Sheets;
  spreadsheetId: string;
  worksheetId: number;
  generatedAt?: string;
}): Promise<WorkbookInventoryReport> {
  const metadataResponse = await input.api.spreadsheets.get({
    spreadsheetId: input.spreadsheetId,
    includeGridData: false,
    fields:
      'sheets(properties(sheetId,title,index,sheetType,gridProperties(rowCount,columnCount)),protectedRanges(range,warningOnly))',
  });
  const metadata: SheetMetadata[] = (metadataResponse.data.sheets ?? [])
    .filter((sheet) => sheet.properties?.sheetId === input.worksheetId)
    .filter((sheet) => (sheet.properties?.sheetType ?? 'GRID') === 'GRID')
    .map((sheet) => ({
      worksheetId: sheet.properties?.sheetId ?? -1,
      worksheetTitle: sheet.properties?.title ?? '',
      sheetIndex: sheet.properties?.index ?? 0,
      rowCount: sheet.properties?.gridProperties?.rowCount ?? 0,
      columnCount: sheet.properties?.gridProperties?.columnCount ?? 0,
      protectedRangeCount: sheet.protectedRanges?.length ?? 0,
    }))
    .filter((sheet) => sheet.worksheetTitle.length > 0)
    .sort((left, right) => left.sheetIndex - right.sheetIndex);

  if (metadata.length !== 1) {
    throw new Error('Configured Google Sheets worksheet ID was not found');
  }

  const ranges = metadata.map((sheet) => {
    const lastColumn = columnName(Math.max(1, Math.min(sheet.columnCount, INVENTORY_COLUMN_LIMIT)));
    return `${quoteWorksheet(sheet.worksheetTitle)}!A1:${lastColumn}${INVENTORY_HEADER_ROW_LIMIT}`;
  });
  const headerResponse = await input.api.spreadsheets.values.batchGet({
    spreadsheetId: input.spreadsheetId,
    ranges,
    majorDimension: 'ROWS',
    valueRenderOption: 'FORMATTED_VALUE',
    dateTimeRenderOption: 'FORMATTED_STRING',
  });
  const valueRanges = headerResponse.data.valueRanges ?? [];
  const sheets = metadata.map((sheet, index) =>
    analyzeSheetHeaders(sheet, valueRanges[index]?.values ?? []),
  );

  return {
    version: 3,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    safety: {
      headerRowsRead: INVENTORY_HEADER_ROW_LIMIT,
      maximumColumnsRead: INVENTORY_COLUMN_LIMIT,
      rawCellValuesStored: false,
    },
    sheets,
    mappingDraft: mappingDraft(sheets),
  };
}
