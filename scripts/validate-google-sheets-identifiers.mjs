import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';

import { createGoogleSheetsApiFromAdc } from '../src/lib/server/integrations/google-sheets/google-api-gateway.ts';
import { parseAttendanceSheetMapping } from '../src/lib/server/integrations/google-sheets/mapping.ts';

const ALLOWED_DOMAIN = 'launchpadphilly.org';
const LEARNER_EMAIL_COLUMN = 'D';

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

  const mappingPath = resolve(
    process.env.LIFTOFF_SHEETS_MAPPING_FILE?.trim() ||
      resolve(homedir(), '.config/liftoff/attendance-sheet.mapping.json'),
  );
  const mapping = parseAttendanceSheetMapping(JSON.parse(readFileSync(mappingPath, 'utf8')));
  const api = await createGoogleSheetsApiFromAdc('read-only');
  const metadata = await api.spreadsheets.get({
    spreadsheetId,
    includeGridData: false,
    fields: 'sheets(properties(sheetId,title,sheetType))',
  });
  const worksheet = (metadata.data.sheets ?? []).find(
    (sheet) =>
      sheet.properties?.sheetId === worksheetId &&
      (sheet.properties.sheetType ?? 'GRID') === 'GRID',
  );
  const title = worksheet?.properties?.title?.trim();
  if (!title) throw new Error('Configured worksheet was not found');

  const range = `${quoteWorksheet(title)}!${LEARNER_EMAIL_COLUMN}${mapping.dataStartRow}:${LEARNER_EMAIL_COLUMN}${mapping.dataEndRow}`;
  const response = await api.spreadsheets.values.get({
    spreadsheetId,
    range,
    majorDimension: 'COLUMNS',
    valueRenderOption: 'UNFORMATTED_VALUE',
  });
  const rawIdentifiers = response.data.values?.[0] ?? [];
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
    `Learner identifier counts: configured ${mapping.dataEndRow - mapping.dataStartRow + 1}, returned ${identifiers.length}, company-domain ${validCount}, unique ${uniqueCount}, already normalized ${normalizedCount}; raw identifiers logged: no.`,
  );

  if (
    identifiers.length !== mapping.dataEndRow - mapping.dataStartRow + 1 ||
    validCount !== identifiers.length ||
    uniqueCount !== identifiers.length
  ) {
    throw new Error('Learner identifiers failed the bounded domain, presence, or uniqueness check');
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
