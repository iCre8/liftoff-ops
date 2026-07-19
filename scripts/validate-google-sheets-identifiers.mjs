import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';

import { createGoogleSheetsApiFromAdc } from '../src/lib/server/integrations/google-sheets/google-api-gateway.ts';
import { deriveContiguousLearnerRange } from '../src/lib/server/integrations/google-sheets/mapping.ts';

const ALLOWED_DOMAIN = 'launchpadphilly.org';

function requiredEnvironment(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required in the ignored local .env file`);
  return value;
}

function quoteWorksheet(title) {
  return `'${title.replaceAll("'", "''")}'`;
}

try {
  const spreadsheetId = requiredEnvironment('GOOGLE_SHEETS_SPREADSHEET_ID');
  const worksheetId = Number(requiredEnvironment('GOOGLE_SHEETS_WORKSHEET_ID'));
  if (!Number.isSafeInteger(worksheetId) || worksheetId < 0) {
    throw new Error('GOOGLE_SHEETS_WORKSHEET_ID must be a non-negative integer');
  }

  const inventoryPath = resolve(
    process.env.LIFTOFF_SHEETS_INVENTORY_FILE?.trim() ||
      resolve(homedir(), '.config/liftoff/attendance-sheet.inventory.json'),
  );
  const inventory = JSON.parse(readFileSync(inventoryPath, 'utf8'));
  const sheet = inventory.sheets?.[0];
  const draft = inventory.mappingDraft;
  if (
    inventory.version !== 3 ||
    inventory.sheets?.length !== 1 ||
    !sheet ||
    !draft ||
    sheet.worksheetId !== worksheetId ||
    !sheet.attendanceCandidate
  ) {
    throw new Error('Run the current bounded inventory before validating learner identifiers');
  }

  const api = await createGoogleSheetsApiFromAdc('read-only');
  const metadata = await api.spreadsheets.get({
    spreadsheetId,
    includeGridData: false,
    fields: 'sheets(properties(sheetId,title,sheetType,gridProperties(rowCount)))',
  });
  const worksheet = (metadata.data.sheets ?? []).find(
    (candidate) =>
      candidate.properties?.sheetId === worksheetId &&
      (candidate.properties.sheetType ?? 'GRID') === 'GRID',
  );
  const title = worksheet?.properties?.title?.trim();
  const rowCount = worksheet?.properties?.gridProperties?.rowCount;
  if (!title || !Number.isSafeInteger(rowCount) || rowCount < draft.dataStartRow) {
    throw new Error('Configured worksheet was not found or has an invalid row boundary');
  }

  const range = `${quoteWorksheet(title)}!${draft.learnerExternalIdColumn}${draft.dataStartRow}:${draft.learnerExternalIdColumn}${rowCount}`;
  const response = await api.spreadsheets.values.get({
    spreadsheetId,
    range,
    majorDimension: 'COLUMNS',
    valueRenderOption: 'UNFORMATTED_VALUE',
  });
  const scannedValues = response.data.values?.[0] ?? [];
  const learnerRange = deriveContiguousLearnerRange({
    dataStartRow: draft.dataStartRow,
    learnerExternalIdColumn: draft.learnerExternalIdColumn,
    identifiers: scannedValues,
  });
  const startOffset = learnerRange.dataStartRow - draft.dataStartRow;
  const learnerCount = learnerRange.dataEndRow - learnerRange.dataStartRow + 1;
  const rawIdentifiers = scannedValues.slice(startOffset, startOffset + learnerCount);
  const identifiers = rawIdentifiers.map((value) =>
    String(value ?? '')
      .trim()
      .toLowerCase(),
  );
  const emailPattern = new RegExp(`^[^@\\s]+@${ALLOWED_DOMAIN.replace('.', '\\.')}$`);
  const validCount = identifiers.filter((identifier) => emailPattern.test(identifier)).length;
  const uniqueCount = new Set(identifiers).size;
  const normalizedCount = rawIdentifiers.filter(
    (value, index) => String(value ?? '') === identifiers[index],
  ).length;
  console.log(
    `Learner identifier counts: configured ${learnerCount}, returned ${identifiers.length}, company-domain ${validCount}, unique ${uniqueCount}, already normalized ${normalizedCount}; raw identifiers logged: no.`,
  );

  if (
    identifiers.length !== learnerCount ||
    validCount !== identifiers.length ||
    uniqueCount !== identifiers.length ||
    normalizedCount !== identifiers.length
  ) {
    throw new Error(
      'Learner identifiers failed the bounded domain, presence, uniqueness, or normalization check',
    );
  }

  console.log(
    `Learner identifier validation succeeded: ${validCount} company-domain emails, ${uniqueCount} unique, ${normalizedCount} already normalized; raw identifiers logged: no.`,
  );
} catch {
  console.error(
    'Learner identifier validation failed. No workbook identifier, worksheet title, or learner value was printed.',
  );
  process.exitCode = 1;
}
