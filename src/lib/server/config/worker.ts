export interface WorkerConfiguration {
  mappingFile?: string;
  spreadsheetId?: string;
  worksheetId?: string;
}

export function validateWorkerConfiguration(
  environment: NodeJS.ProcessEnv = process.env,
): WorkerConfiguration {
  if (environment.PHASE3_EXTERNAL_EFFECTS?.trim().toLowerCase() !== 'false') {
    throw new Error('PHASE3_EXTERNAL_EFFECTS must be explicitly false');
  }

  const mappingFile = environment.GOOGLE_SHEETS_MAPPING_FILE?.trim();
  const spreadsheetId = environment.GOOGLE_SHEETS_SPREADSHEET_ID?.trim();
  const worksheetId = environment.GOOGLE_SHEETS_WORKSHEET_ID?.trim();
  const configuredCount = [mappingFile, spreadsheetId, worksheetId].filter(Boolean).length;

  if (configuredCount !== 0 && configuredCount !== 3) {
    throw new Error('Google Sheets worker configuration must be complete or absent');
  }

  return configuredCount === 3 ? { mappingFile, spreadsheetId, worksheetId } : {};
}
