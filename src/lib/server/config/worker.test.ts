import { describe, expect, it } from 'vitest';
import { validateWorkerConfiguration } from './worker';

describe('worker configuration', () => {
  it('requires the external-effects lock to be explicitly false', () => {
    expect(() => validateWorkerConfiguration({})).toThrow(
      'PHASE3_EXTERNAL_EFFECTS must be explicitly false',
    );
    expect(() => validateWorkerConfiguration({ PHASE3_EXTERNAL_EFFECTS: 'true' })).toThrow(
      'PHASE3_EXTERNAL_EFFECTS must be explicitly false',
    );
  });

  it('allows a database-only dry-run worker', () => {
    expect(validateWorkerConfiguration({ PHASE3_EXTERNAL_EFFECTS: 'false' })).toEqual({});
  });

  it('accepts complete Google Sheets read configuration', () => {
    expect(
      validateWorkerConfiguration({
        PHASE3_EXTERNAL_EFFECTS: 'false',
        GOOGLE_SHEETS_MAPPING_FILE: '/run/secrets/google_sheets_mapping',
        GOOGLE_SHEETS_SPREADSHEET_ID: 'sanitized-workbook',
        GOOGLE_SHEETS_WORKSHEET_ID: '123',
      }),
    ).toEqual({
      mappingFile: '/run/secrets/google_sheets_mapping',
      spreadsheetId: 'sanitized-workbook',
      worksheetId: '123',
    });
  });

  it('rejects partial Google Sheets configuration', () => {
    expect(() =>
      validateWorkerConfiguration({
        PHASE3_EXTERNAL_EFFECTS: 'false',
        GOOGLE_SHEETS_MAPPING_FILE: '/run/secrets/google_sheets_mapping',
      }),
    ).toThrow('Google Sheets worker configuration must be complete or absent');
  });
});
