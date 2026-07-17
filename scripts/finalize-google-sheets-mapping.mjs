import { chmodSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, isAbsolute, relative, resolve } from 'node:path';

import { createGoogleSheetsApiFromAdc } from '../src/lib/server/integrations/google-sheets/google-api-gateway.ts';
import { parseAttendanceSheetMapping } from '../src/lib/server/integrations/google-sheets/mapping.ts';

const EXPECTED_SESSION_GROUP_COUNT = 42;

function requiredEnvironment(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required in the ignored local .env file`);
  return value;
}

function numericWorksheetId(value) {
  if (!/^\d+$/.test(value)) throw new Error('GOOGLE_SHEETS_WORKSHEET_ID must be numeric');
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new Error('GOOGLE_SHEETS_WORKSHEET_ID is invalid');
  return parsed;
}

function quoteWorksheet(title) {
  return `'${title.replaceAll("'", "''")}'`;
}

function assertOutsideWorktree(outputPath) {
  const relativePath = relative(resolve(process.cwd()), outputPath);
  if (relativePath === '' || (!relativePath.startsWith('..') && !isAbsolute(relativePath))) {
    throw new Error('The finalized mapping must be stored outside the repository worktree');
  }
}

const spreadsheetId = requiredEnvironment('GOOGLE_SHEETS_SPREADSHEET_ID');
const worksheetId = numericWorksheetId(requiredEnvironment('GOOGLE_SHEETS_WORKSHEET_ID'));
const inventoryPath = resolve(
  process.env.LIFTOFF_SHEETS_INVENTORY_FILE?.trim() ||
    resolve(homedir(), '.config/liftoff/attendance-sheet.inventory.json'),
);
const outputPath = resolve(
  process.env.LIFTOFF_SHEETS_MAPPING_FILE?.trim() ||
    resolve(homedir(), '.config/liftoff/attendance-sheet.mapping.json'),
);
assertOutsideWorktree(outputPath);

try {
  const inventory = JSON.parse(readFileSync(inventoryPath, 'utf8'));
  const sheet = inventory.sheets?.[0];
  const draft = inventory.mappingDraft;
  if (inventory.version !== 3 || inventory.sheets?.length !== 1 || !sheet || !draft) {
    throw new Error('Run the current bounded inventory before finalizing the mapping');
  }
  if (sheet.worksheetId !== worksheetId || !sheet.attendanceCandidate) {
    throw new Error('The private inventory does not match the configured attendance tab');
  }
  const groups = draft.detectedSessionGroups;
  if (
    !Array.isArray(groups) ||
    groups.length !== EXPECTED_SESSION_GROUP_COUNT ||
    groups.length !== draft.detectedCheckPairs?.length
  ) {
    throw new Error('The private inventory does not contain 42 complete session groups');
  }
  const usedColumns = new Set();
  for (const group of groups) {
    for (const column of [
      group.checkInColumn,
      group.checkOutColumn,
      group.excusedColumn,
      group.outcomeColumn,
    ]) {
      if (usedColumns.has(column)) throw new Error('Session-group columns overlap');
      usedColumns.add(column);
    }
  }

  const api = await createGoogleSheetsApiFromAdc('read-only');
  const range = `${quoteWorksheet(sheet.worksheetTitle)}!${draft.learnerExternalIdColumn}${draft.dataStartRow}:${draft.learnerExternalIdColumn}${sheet.rowCount}`;
  const response = await api.spreadsheets.values.get({
    spreadsheetId,
    range,
    majorDimension: 'COLUMNS',
    valueRenderOption: 'UNFORMATTED_VALUE',
    dateTimeRenderOption: 'FORMATTED_STRING',
  });
  const identifiers = response.data.values?.[0] ?? [];
  const populated = identifiers.map((value) => String(value ?? '').trim().length > 0);
  const lastPopulatedIndex = populated.lastIndexOf(true);
  if (lastPopulatedIndex < 0 || !populated.slice(0, lastPopulatedIndex + 1).every(Boolean)) {
    throw new Error('Stable learner identifier rows are empty or non-contiguous');
  }
  if (populated.slice(lastPopulatedIndex + 1).some(Boolean)) {
    throw new Error('Stable learner identifier rows are not bounded contiguously');
  }

  const mapping = parseAttendanceSheetMapping({
    dataStartRow: draft.dataStartRow,
    dataEndRow: draft.dataStartRow + lastPopulatedIndex,
    learnerExternalIdColumn: draft.learnerExternalIdColumn,
    sessions: Object.fromEntries(
      groups.map((group, index) => [
        `session-${String(index + 1).padStart(3, '0')}`,
        {
          checkInColumn: group.checkInColumn,
          exitTicketColumn: group.checkOutColumn,
          excusedColumn: group.excusedColumn,
          outcomeColumn: group.outcomeColumn,
        },
      ]),
    ),
  });

  const outputDirectory = dirname(outputPath);
  const temporaryPath = `${outputPath}.tmp`;
  mkdirSync(outputDirectory, { recursive: true, mode: 0o700 });
  chmodSync(outputDirectory, 0o700);
  writeFileSync(temporaryPath, `${JSON.stringify(mapping, null, 2)}\n`, { mode: 0o600 });
  chmodSync(temporaryPath, 0o600);
  renameSync(temporaryPath, outputPath);
  chmodSync(outputPath, 0o600);

  console.log(
    `Private mapping finalized: ${groups.length} session groups, ${lastPopulatedIndex + 1} contiguous learner rows, raw learner values logged: no.`,
  );
  console.log(`Private mapping written with mode 0600: ${outputPath}`);
} catch {
  console.error(
    'Private mapping finalization failed. No workbook identifier, worksheet title, or learner value was printed.',
  );
  process.exitCode = 1;
}
