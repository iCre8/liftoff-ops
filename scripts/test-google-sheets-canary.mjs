import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';

import { ConfiguredAttendanceSheetAdapter } from '../src/lib/server/integrations/google-sheets/adapter.ts';
import {
  SheetAuthorityConflictError,
  SheetVersionConflictError,
} from '../src/lib/server/integrations/google-sheets/errors.ts';
import {
  createGoogleSheetsApiFromAdc,
  GoogleSheetsValuesGateway,
} from '../src/lib/server/integrations/google-sheets/google-api-gateway.ts';
import { parseAttendanceSheetMapping } from '../src/lib/server/integrations/google-sheets/mapping.ts';
import { reconcileSheetOutcome } from '../src/lib/server/services/reconcile-sheet-outcome.ts';

const CANARY_OUTCOME = 'contacted';
const CONFLICTING_OUTCOME = 'staff-corrected';

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

function columnNumber(column) {
  return [...column].reduce((value, character) => value * 26 + character.charCodeAt(0) - 64, 0);
}

function rangeContainsCell(range, worksheetId, columnIndex, rowIndex) {
  if (range?.sheetId !== worksheetId) return false;
  const startRow = range.startRowIndex ?? 0;
  const endRow = range.endRowIndex ?? Number.POSITIVE_INFINITY;
  const startColumn = range.startColumnIndex ?? 0;
  const endColumn = range.endColumnIndex ?? Number.POSITIVE_INFINITY;
  return (
    rowIndex >= startRow &&
    rowIndex < endRow &&
    columnIndex >= startColumn &&
    columnIndex < endColumn
  );
}

function scalar(response) {
  return response.data.values?.[0]?.[0] ?? null;
}

const spreadsheetId = requiredEnvironment('GOOGLE_SHEETS_SPREADSHEET_ID');
const worksheetId = numericWorksheetId(requiredEnvironment('GOOGLE_SHEETS_WORKSHEET_ID'));
const mappingPath = resolve(
  process.env.LIFTOFF_SHEETS_MAPPING_FILE?.trim() ||
    resolve(homedir(), '.config/liftoff/attendance-sheet.mapping.json'),
);

let targetRange;
let api;
let cleanupConfirmed = false;
let primaryError;

try {
  const mapping = parseAttendanceSheetMapping(JSON.parse(readFileSync(mappingPath, 'utf8')));
  const sessionExternalId = Object.keys(mapping.sessions)[0];
  if (!sessionExternalId) throw new Error('The private mapping has no sessions');

  api = await createGoogleSheetsApiFromAdc('read-write');
  const gateway = new GoogleSheetsValuesGateway({ api, spreadsheetId, access: 'read-write' });
  const adapter = new ConfiguredAttendanceSheetAdapter(gateway, mapping, worksheetId);
  const records = await adapter.readSession(sessionExternalId);
  const record = records.find((candidate) => candidate.outcome === null);
  if (!record) throw new Error('No blank mapped outcome cell is available for the canary');

  const worksheetTitle = await gateway.resolveWorksheetTitle(worksheetId);
  const outcomeColumn = mapping.sessions[sessionExternalId].outcomeColumn;
  targetRange = `${quoteWorksheet(worksheetTitle)}!${outcomeColumn}${record.sourceRow}`;
  const metadata = await api.spreadsheets.get({
    spreadsheetId,
    includeGridData: false,
    fields: 'sheets(properties(sheetId),protectedRanges(range,warningOnly))',
  });
  const worksheet = (metadata.data.sheets ?? []).find(
    (sheet) => sheet.properties?.sheetId === worksheetId,
  );
  if (!worksheet) throw new Error('The configured attendance tab disappeared during preflight');
  const targetColumnIndex = columnNumber(outcomeColumn) - 1;
  const targetRowIndex = record.sourceRow - 1;
  if (
    (worksheet.protectedRanges ?? []).some((protectedRange) =>
      rangeContainsCell(protectedRange.range, worksheetId, targetColumnIndex, targetRowIndex),
    )
  ) {
    throw new Error('The canary target is protected');
  }
  const preflight = await api.spreadsheets.values.get({
    spreadsheetId,
    range: targetRange,
    valueRenderOption: 'FORMULA',
  });
  if (scalar(preflight) !== null) throw new Error('The canary target is not blank');

  const originalWrite = {
    learnerExternalId: record.learnerExternalId,
    sessionExternalId,
    expectedSourceVersion: record.sourceVersion,
    outcome: CANARY_OUTCOME,
  };
  const written = await adapter.writeOutcome(originalWrite);
  if (!written.changed) throw new Error('The canary write did not change the blank target');

  let staleVersionRejected = false;
  try {
    await adapter.writeOutcome(originalWrite);
  } catch (error) {
    staleVersionRejected = error instanceof SheetVersionConflictError;
  }
  if (!staleVersionRejected) throw new Error('A stale source version was not rejected');

  const latest = (await adapter.readSession(sessionExternalId)).find(
    (candidate) => candidate.learnerExternalId === record.learnerExternalId,
  );
  if (!latest || latest.outcome !== CANARY_OUTCOME) {
    throw new Error('The canary value could not be verified');
  }
  const idempotent = await adapter.writeOutcome({
    ...originalWrite,
    expectedSourceVersion: latest.sourceVersion,
  });
  if (idempotent.changed) throw new Error('The repeated canary write was not idempotent');

  let staffValuePreserved = false;
  try {
    await adapter.writeOutcome({
      ...originalWrite,
      expectedSourceVersion: latest.sourceVersion,
      outcome: CONFLICTING_OUTCOME,
    });
  } catch (error) {
    staffValuePreserved = error instanceof SheetAuthorityConflictError;
  }
  if (!staffValuePreserved) throw new Error('A populated Sheet outcome was not preserved');

  const attempts = [];
  const reviews = [];
  const reconciliation = await reconcileSheetOutcome({
    sheet: adapter,
    idempotencyKey: 'sanitized-canary:outcome',
    write: {
      ...originalWrite,
      expectedSourceVersion: latest.sourceVersion,
      outcome: CONFLICTING_OUTCOME,
    },
    audit: {
      async recordAttempt(input) {
        attempts.push({ attemptNumber: input.attemptNumber, status: input.status });
      },
      async requestHumanReview(input) {
        reviews.push({ attempts: input.attempts, reason: input.reason });
      },
    },
  });
  if (
    reconciliation.status !== 'human_review' ||
    reconciliation.attempts !== 3 ||
    reconciliation.reason !== 'sheet_value_preserved' ||
    attempts.length !== 3 ||
    reviews.length !== 1
  ) {
    throw new Error('Conflict retry and human-review behavior did not match the approved contract');
  }
} catch (error) {
  primaryError = error;
} finally {
  if (api && targetRange) {
    try {
      const current = await api.spreadsheets.values.get({
        spreadsheetId,
        range: targetRange,
        valueRenderOption: 'UNFORMATTED_VALUE',
      });
      const currentValue = scalar(current);
      if (currentValue === CANARY_OUTCOME) {
        await api.spreadsheets.values.clear({ spreadsheetId, range: targetRange });
      } else if (currentValue !== null) {
        throw new Error('Canary cleanup stopped because the target contains a different value');
      }
      const afterCleanup = await api.spreadsheets.values.get({
        spreadsheetId,
        range: targetRange,
        valueRenderOption: 'FORMULA',
      });
      cleanupConfirmed = scalar(afterCleanup) === null;
      if (!cleanupConfirmed) throw new Error('Canary cleanup verification failed');
    } catch (cleanupError) {
      primaryError = primaryError ?? cleanupError;
    }
  }
}

if (primaryError || !cleanupConfirmed) {
  console.error(
    'Sanitized Sheet canary failed or cleanup was not confirmed. No workbook identifier, worksheet title, learner identifier, or cell value was printed.',
  );
  process.exitCode = 1;
} else {
  console.log(
    'Sanitized Sheet canary passed: restricted write verified, stale version rejected, repeat was idempotent, populated value preserved, three conflicts routed to human review, and cleanup verified.',
  );
  console.log(
    'Raw workbook identifiers, worksheet titles, learner identifiers, and cell values logged: no.',
  );
}
