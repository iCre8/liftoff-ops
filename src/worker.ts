import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

import { validateWorkerConfiguration } from './lib/server/config/worker';
import { getDatabase } from './lib/server/db';
import { ConfiguredAttendanceSheetAdapter } from './lib/server/integrations/google-sheets/adapter';
import { createGoogleSheetsGatewayFromAdc } from './lib/server/integrations/google-sheets/google-api-gateway';
import {
  claimDueJobs,
  ensureAutomationJobs,
  executeAutomationJob,
  failAutomationJob,
  nextPendingRunAt,
  nextWakeDelay,
  recoverStaleClaims,
} from './lib/server/services/phase-3-scheduler';

const workerConfiguration = validateWorkerConfiguration();
const database = getDatabase();
const workerId = `phase3-${randomUUID()}`;
const heartbeatFile = process.env.HEARTBEAT_FILE?.trim();
let stopping = false;

async function configuredAttendanceSheet() {
  const { mappingFile, spreadsheetId, worksheetId } = workerConfiguration;
  if (!mappingFile || !spreadsheetId || !worksheetId) return undefined;
  const mapping = JSON.parse(await readFile(mappingFile, 'utf8')) as unknown;
  const gateway = await createGoogleSheetsGatewayFromAdc({ spreadsheetId, access: 'read-only' });
  return new ConfiguredAttendanceSheetAdapter(gateway, mapping, worksheetId);
}

const dependencies = { attendanceSheet: await configuredAttendanceSheet() };

process.on('SIGTERM', () => {
  stopping = true;
});
process.on('SIGINT', () => {
  stopping = true;
});

function sleep(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

while (!stopping) {
  const now = new Date();
  const from = new Date(now);
  from.setUTCDate(from.getUTCDate() - 1);
  const through = new Date(now);
  through.setUTCDate(through.getUTCDate() + 45);
  await ensureAutomationJobs(database, { from, through });
  await recoverStaleClaims(database, now);
  const jobs = await claimDueJobs(database, { now, workerId });
  for (const job of jobs) {
    try {
      await executeAutomationJob(database, job, new Date(), dependencies);
    } catch {
      await failAutomationJob(database, job, new Date(), 'bounded_worker_failure');
    }
  }
  if (heartbeatFile) await writeFile(heartbeatFile, new Date().toISOString(), { mode: 0o600 });
  await sleep(nextWakeDelay(new Date(), await nextPendingRunAt(database)));
}

await database.$disconnect();
