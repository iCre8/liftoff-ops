import { chmodSync, mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, isAbsolute, relative, resolve } from 'node:path';

import { createGoogleSheetsApiFromAdc } from '../src/lib/server/integrations/google-sheets/google-api-gateway.ts';
import { inventoryAttendanceWorkbook } from '../src/lib/server/integrations/google-sheets/workbook-inventory.ts';

const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim();
if (!spreadsheetId) {
  throw new Error('GOOGLE_SHEETS_SPREADSHEET_ID is required in the ignored local .env file');
}

const worksheetIdValue = process.env.GOOGLE_SHEETS_WORKSHEET_ID?.trim();
if (!worksheetIdValue || !/^\d+$/.test(worksheetIdValue)) {
  throw new Error(
    'GOOGLE_SHEETS_WORKSHEET_ID must be a numeric tab ID in the ignored local .env file',
  );
}
const worksheetId = Number(worksheetIdValue);
if (!Number.isSafeInteger(worksheetId)) {
  throw new Error('GOOGLE_SHEETS_WORKSHEET_ID must be a safe integer');
}

const outputPath = resolve(
  process.env.LIFTOFF_SHEETS_INVENTORY_FILE?.trim() ||
    resolve(homedir(), '.config/liftoff/attendance-sheet.inventory.json'),
);
const worktreePath = resolve(process.cwd());
const relativeToWorktree = relative(worktreePath, outputPath);
if (
  relativeToWorktree === '' ||
  (!relativeToWorktree.startsWith('..') && !isAbsolute(relativeToWorktree))
) {
  throw new Error('The inventory file must be stored outside the repository worktree');
}

try {
  const api = await createGoogleSheetsApiFromAdc('read-only');
  const report = await inventoryAttendanceWorkbook({ api, spreadsheetId, worksheetId });
  const outputDirectory = dirname(outputPath);
  const temporaryPath = `${outputPath}.tmp`;

  mkdirSync(outputDirectory, { recursive: true, mode: 0o700 });
  chmodSync(outputDirectory, 0o700);
  writeFileSync(temporaryPath, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  chmodSync(temporaryPath, 0o600);
  renameSync(temporaryPath, outputPath);
  chmodSync(outputPath, 0o600);

  const candidateCount = report.sheets.filter((sheet) => sheet.attendanceCandidate).length;
  console.log(
    `Workbook inventory succeeded: ${report.sheets.length} grid sheets scanned, ` +
      `${candidateCount} attendance candidates, raw cell values stored: no.`,
  );
  console.log(`Private inventory written with mode 0600: ${outputPath}`);
  console.log(
    report.mappingDraft
      ? `Mapping draft created with ${report.mappingDraft.detectedCheckPairs.length} check-in/check-out pairs.`
      : 'Mapping draft not created because exactly one attendance candidate was not detected.',
  );
} catch {
  console.error(
    'Workbook inventory failed. No workbook identifiers, worksheet titles, or cell values were printed.',
  );
  process.exitCode = 1;
}
