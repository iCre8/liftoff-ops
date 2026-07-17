import { createGoogleSheetsGatewayFromAdc } from '../src/lib/server/integrations/google-sheets/google-api-gateway.ts';

const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim();

if (!spreadsheetId) {
  throw new Error('GOOGLE_SHEETS_SPREADSHEET_ID is required in the ignored local .env file');
}

function providerFailure(error) {
  const responseError = error?.response?.data?.error;
  const requestUrl = String(error?.config?.url ?? error?.response?.config?.url ?? '');
  const providerMessage = String(responseError?.message ?? error?.message ?? '').toLowerCase();
  const providerDetails = JSON.stringify(responseError?.details ?? []).toLowerCase();

  return {
    status: Number(error?.code ?? error?.status ?? responseError?.code),
    duringImpersonation: requestUrl.includes('iamcredentials.googleapis.com'),
    duringSheetsRequest: requestUrl.includes('sheets.googleapis.com'),
    serviceDisabled:
      providerMessage.includes('has not been used') ||
      providerMessage.includes('is disabled') ||
      providerDetails.includes('service_disabled'),
    insufficientScope:
      providerMessage.includes('insufficient authentication scopes') ||
      providerDetails.includes('access_token_scope_insufficient'),
    tokenCreatorDenied:
      providerMessage.includes('iam.serviceaccounts.getaccesstoken') ||
      providerDetails.includes('iam.serviceaccounts.getaccesstoken'),
  };
}

try {
  const gateway = await createGoogleSheetsGatewayFromAdc({
    spreadsheetId,
    access: 'read-only',
  });
  const summary = await gateway.inspectMetadata();

  console.log(
    `Google Sheets read-only proof succeeded: ${summary.sheetCount} sheets, ` +
      `${summary.gridSheetCount} grid sheets, ${summary.protectedRangeCount} protected ranges. ` +
      'No cell values or workbook identifiers were printed.',
  );
} catch (error) {
  const failure = providerFailure(error);

  if (failure.status === 404 && failure.duringImpersonation) {
    console.error(
      'Google authentication failed: the service account recorded in ADC was not found. ' +
        'Recreate ADC with the exact development service-account email copied from Google Cloud.',
    );
  } else if (failure.status === 403 && failure.serviceDisabled) {
    console.error(
      failure.duringImpersonation
        ? 'IAM Service Account Credentials API is disabled for the impersonation request project.'
        : 'Google Sheets API is disabled for the request quota project. Enable Sheets API in that project, ' +
            'then set the same project as the local ADC quota project.',
    );
  } else if (failure.status === 403 && failure.insufficientScope) {
    console.error(
      failure.duringImpersonation
        ? 'The source user credential lacks the OAuth scope required to call the IAM Credentials API.'
        : 'The impersonated access token lacks the Google Sheets read-only scope. Recreate ADC with the ' +
            'documented scopes and retry.',
    );
  } else if (failure.status === 403 && failure.duringImpersonation && failure.tokenCreatorDenied) {
    console.error(
      'The source user is missing iam.serviceAccounts.getAccessToken on the target service account. ' +
        'Grant that user Service Account Token Creator on the exact development service account.',
    );
  } else if (failure.status === 403 && failure.duringImpersonation) {
    console.error(
      'Google impersonation was forbidden for an unclassified IAM reason. Verify the source user, target ' +
        'service account, Token Creator binding, and organization deny policies.',
    );
  } else if (failure.status === 403 && failure.duringSheetsRequest) {
    console.error(
      'ADC impersonation succeeded, but the configured spreadsheet denied access. Verify that .env points ' +
        'to the sanitized copy and share that exact copy with the impersonated service account.',
    );
  } else {
    console.error(
      'Google Sheets read-only verification failed. No workbook identifiers or cell values were printed.',
    );
  }

  process.exitCode = 1;
}
