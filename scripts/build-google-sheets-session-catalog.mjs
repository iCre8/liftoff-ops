import { chmodSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, isAbsolute, relative, resolve } from 'node:path';

import { createGoogleSheetsApiFromAdc } from '../src/lib/server/integrations/google-sheets/google-api-gateway.ts';
import { parseAttendanceSheetMapping } from '../src/lib/server/integrations/google-sheets/mapping.ts';

const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim();
const worksheetId = Number(process.env.GOOGLE_SHEETS_WORKSHEET_ID);
if (!spreadsheetId || !Number.isSafeInteger(worksheetId))
  throw new Error('Sheet configuration is required');
const mappingPath = resolve(
  process.env.LIFTOFF_SHEETS_MAPPING_FILE?.trim() ||
    resolve(homedir(), '.config/liftoff/attendance-sheet.mapping.json'),
);
const outputPath = resolve(
  process.env.LIFTOFF_SESSION_CATALOG_FILE?.trim() ||
    resolve(homedir(), '.config/liftoff/attendance-sheet.sessions.json'),
);
const outputRelative = relative(resolve(process.cwd()), outputPath);
if (outputRelative === '' || (!outputRelative.startsWith('..') && !isAbsolute(outputRelative))) {
  throw new Error('The private session catalog must be stored outside the worktree');
}
const mapping = parseAttendanceSheetMapping(JSON.parse(readFileSync(mappingPath, 'utf8')));

function columnNumber(column) {
  return [...column].reduce((value, character) => value * 26 + character.charCodeAt(0) - 64, 0);
}
function columnName(index) {
  let value = index;
  let result = '';
  while (value > 0) {
    value -= 1;
    result = String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26);
  }
  return result;
}
function quoteWorksheet(title) {
  return `'${title.replaceAll("'", "''")}'`;
}
function serialDate(value) {
  return new Date(Date.UTC(1899, 11, 30) + value * 86_400_000).toISOString().slice(0, 10);
}

try {
  const api = await createGoogleSheetsApiFromAdc('read-only');
  const metadata = await api.spreadsheets.get({
    spreadsheetId,
    includeGridData: false,
    fields: 'sheets(properties(sheetId,title,sheetType))',
  });
  const sheet = (metadata.data.sheets ?? []).find(
    (candidate) =>
      candidate.properties?.sheetId === worksheetId &&
      (candidate.properties?.sheetType ?? 'GRID') === 'GRID',
  );
  const title = sheet?.properties?.title;
  if (!title) throw new Error('Configured worksheet was not found');
  const lastColumn = Math.max(
    ...Object.values(mapping.sessions).map((session) => columnNumber(session.outcomeColumn)),
  );
  const response = await api.spreadsheets.get({
    spreadsheetId,
    ranges: [`${quoteWorksheet(title)}!A1:${columnName(lastColumn)}12`],
    includeGridData: true,
    fields:
      'sheets(data(startRow,startColumn,rowData(values(effectiveValue(numberValue),effectiveFormat(numberFormat(type))))))',
  });
  const rows = response.data.sheets?.[0]?.data?.[0]?.rowData ?? [];
  const sessions = Object.entries(mapping.sessions).map(([externalId, session]) => {
    const columnIndex = columnNumber(session.checkInColumn) - 1;
    const dates = rows.flatMap((row) => {
      const cell = row.values?.[columnIndex];
      return cell?.effectiveFormat?.numberFormat?.type?.includes('DATE') &&
        typeof cell.effectiveValue?.numberValue === 'number'
        ? [serialDate(cell.effectiveValue.numberValue)]
        : [];
    });
    if (dates.length !== 1)
      throw new Error('Each Sheet session group must contain exactly one date-formatted header');
    return { externalId, sessionDate: dates[0] };
  });
  if (
    sessions.length !== 42 ||
    new Set(sessions.map((session) => session.sessionDate)).size !== 42
  ) {
    throw new Error('The Sheet must provide 42 unique session dates');
  }
  mkdirSync(dirname(outputPath), { recursive: true, mode: 0o700 });
  const temporaryPath = `${outputPath}.tmp`;
  writeFileSync(temporaryPath, `${JSON.stringify({ version: 1, sessions }, null, 2)}\n`, {
    mode: 0o600,
  });
  chmodSync(temporaryPath, 0o600);
  renameSync(temporaryPath, outputPath);
  chmodSync(outputPath, 0o600);
  console.log(
    'Private read-only session catalog created: 42 unique dates, raw header values logged: no.',
  );
} catch {
  console.error(
    'Session catalog creation failed. No workbook identifiers, titles, dates, or cell values were printed.',
  );
  process.exitCode = 1;
}
