import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

import { assertSheetEmailContract } from '../src/lib/domain/module-2.ts';
import { createGoogleSheetsApiFromAdc } from '../src/lib/server/integrations/google-sheets/google-api-gateway.ts';

const TARGET_COHORT_NAME = 'Cohort 3';
const SEED_COHORT_NAME = 'Sanitized Cohort 3';
const EXPECTED_START = '2026-07-15';
const EXPECTED_END = '2026-09-15';
const EXPECTED_LEARNERS = 14;
const COMPANY_DOMAIN = 'launchpadphilly.org';

export class SafeRosterRepairError extends Error {}

export function validateRosterRepairInvocation(arguments_) {
  if (!arguments_.includes('--uat')) {
    throw new SafeRosterRepairError('Explicit --uat target confirmation is required.');
  }
  return { apply: arguments_.includes('--apply') };
}

export function rosterRepairPlan(input) {
  if (
    input.cohortName === TARGET_COHORT_NAME &&
    input.learnerCount === EXPECTED_LEARNERS &&
    input.sheetEmailLearners === EXPECTED_LEARNERS &&
    input.fixtureAccountCount === 0 &&
    input.sessionCount === 0
  ) {
    return { alreadyApplied: true, disableCohort: false };
  }
  if (input.cohortName !== SEED_COHORT_NAME) {
    throw new SafeRosterRepairError('The active cohort is not the approved sanitized seed.');
  }
  if (!['DISABLED', 'DRY_RUN'].includes(input.automationMode) || input.actionableJobCount !== 0) {
    throw new SafeRosterRepairError(
      'The UAT cohort must be disabled or an empty dry run during roster repair.',
    );
  }
  if (input.startsOn !== EXPECTED_START || input.endsOn !== EXPECTED_END) {
    throw new SafeRosterRepairError('The UAT cohort dates do not match the approved dates.');
  }
  if (
    input.learnerCount !== 1 ||
    input.fixtureLearnerCount !== 1 ||
    input.learnerDependencyCount !== 0
  ) {
    throw new SafeRosterRepairError(
      'The sanitized learner fixture is not in the approved empty state.',
    );
  }
  if (
    input.fixtureAccountCount !== 3 ||
    input.fixtureRoleCount !== 3 ||
    input.fixtureAuthSessionCount !== 0 ||
    input.fixtureAuditEventCount !== 0
  ) {
    throw new SafeRosterRepairError(
      'The sanitized account fixtures are not in the approved empty state.',
    );
  }
  if (input.sessionCount !== 1 || input.sessionDependencyCount !== 0) {
    throw new SafeRosterRepairError(
      'The sanitized session fixture is not in the approved empty state.',
    );
  }
  if (input.templateCount !== 8) {
    throw new SafeRosterRepairError(
      'The reusable template count does not match the approved seed.',
    );
  }
  if (input.activeCorporateAdminCount !== 1) {
    throw new SafeRosterRepairError('Exactly one active corporate administrator is required.');
  }
  if (input.sheetEmailCount !== EXPECTED_LEARNERS || input.sheetEmailLearners !== 0) {
    throw new SafeRosterRepairError(
      'The approved Sheet roster is incomplete or already partially provisioned.',
    );
  }
  return { alreadyApplied: false, disableCohort: input.automationMode === 'DRY_RUN' };
}

function requiredEnvironment(environment, name) {
  const value = environment[name]?.trim();
  if (!value) throw new SafeRosterRepairError(`${name} is required.`);
  return value;
}

async function readSheetEmails(environment) {
  const spreadsheetId = requiredEnvironment(environment, 'GOOGLE_SHEETS_SPREADSHEET_ID');
  const worksheetId = Number(requiredEnvironment(environment, 'GOOGLE_SHEETS_WORKSHEET_ID'));
  if (!Number.isSafeInteger(worksheetId) || worksheetId < 0) {
    throw new SafeRosterRepairError('The configured worksheet ID is invalid.');
  }
  const api = await createGoogleSheetsApiFromAdc('read-only');
  const metadata = await api.spreadsheets.get({
    spreadsheetId,
    includeGridData: false,
    fields: 'sheets(properties(sheetId,title,sheetType))',
  });
  const title = (metadata.data.sheets ?? []).find(
    (sheet) =>
      sheet.properties?.sheetId === worksheetId &&
      (sheet.properties.sheetType ?? 'GRID') === 'GRID',
  )?.properties?.title;
  if (!title) throw new SafeRosterRepairError('The configured worksheet was not found.');
  const range = `'${title.replaceAll("'", "''")}'!D10:D23`;
  const response = await api.spreadsheets.values.get({
    spreadsheetId,
    range,
    majorDimension: 'COLUMNS',
    valueRenderOption: 'UNFORMATTED_VALUE',
  });
  return assertSheetEmailContract(response.data.values?.[0] ?? [], EXPECTED_LEARNERS);
}

function readDatabaseUrl(environment) {
  const path = resolve(
    environment.LIFTOFF_UAT_DATABASE_URL_FILE?.trim() ||
      resolve(homedir(), '.config/liftoff/neon-uat-database-url'),
  );
  const value = readFileSync(path, 'utf8').trim();
  if (!value) throw new SafeRosterRepairError('The UAT database connection file is empty.');
  return value;
}

async function inspect(database, sheetEmails) {
  const cohorts = await database.cohort.findMany({
    where: { archivedAt: null },
    include: {
      learners: {
        include: {
          account: { select: { email: true } },
          _count: {
            select: {
              submissions: true,
              attendanceRecords: true,
              incidents: true,
              accommodations: true,
              individualPauses: true,
              supportItems: true,
              automationJobs: true,
            },
          },
        },
      },
      sessions: {
        include: {
          _count: {
            select: {
              submissions: true,
              attendanceRecords: true,
              incidents: true,
              automationJobs: true,
            },
          },
        },
      },
      automationJobs: {
        where: { status: { in: ['PENDING', 'CLAIMED', 'HUMAN_REVIEW'] } },
        select: { id: true },
      },
      _count: { select: { messageTemplates: true } },
    },
  });
  if (cohorts.length !== 1) {
    throw new SafeRosterRepairError('Exactly one active UAT cohort is required.');
  }
  const cohort = cohorts[0];
  const fixtureAccounts = await database.account.findMany({
    where: { email: { endsWith: '@example.test', mode: 'insensitive' } },
    include: {
      roles: { select: { id: true } },
      _count: { select: { authSessions: true, auditEvents: true } },
    },
  });
  const corporateAdmins = await database.account.findMany({
    where: {
      email: { endsWith: '@' + COMPANY_DOMAIN, mode: 'insensitive' },
      status: 'ACTIVE',
      roles: { some: { role: 'ADMIN', cohortId: null } },
    },
    select: { id: true },
  });
  const sheetEmailSet = new Set(sheetEmails);
  const learnerDependencyCount = cohort.learners.reduce(
    (sum, learner) =>
      sum + Object.values(learner._count).reduce((count, value) => count + Number(value), 0),
    0,
  );
  const sessionDependencyCount = cohort.sessions.reduce(
    (sum, session) =>
      sum + Object.values(session._count).reduce((count, value) => count + Number(value), 0),
    0,
  );
  const state = {
    cohortName: cohort.name,
    automationMode: cohort.automationMode,
    actionableJobCount: cohort.automationJobs.length,
    startsOn: cohort.startsOn.toISOString().slice(0, 10),
    endsOn: cohort.endsOn.toISOString().slice(0, 10),
    learnerCount: cohort.learners.length,
    fixtureLearnerCount: cohort.learners.filter((learner) =>
      learner.externalId.toLowerCase().endsWith('@example.test'),
    ).length,
    learnerDependencyCount,
    fixtureAccountCount: fixtureAccounts.length,
    fixtureRoleCount: fixtureAccounts.reduce((sum, account) => sum + account.roles.length, 0),
    fixtureAuthSessionCount: fixtureAccounts.reduce(
      (sum, account) => sum + account._count.authSessions,
      0,
    ),
    fixtureAuditEventCount: fixtureAccounts.reduce(
      (sum, account) => sum + account._count.auditEvents,
      0,
    ),
    sessionCount: cohort.sessions.length,
    sessionDependencyCount,
    templateCount: cohort._count.messageTemplates,
    activeCorporateAdminCount: corporateAdmins.length,
    sheetEmailCount: sheetEmails.length,
    sheetEmailLearners: cohort.learners.filter((learner) =>
      sheetEmailSet.has(learner.externalId.trim().toLowerCase()),
    ).length,
  };
  return {
    cohort,
    fixtureAccounts,
    corporateAdminId: corporateAdmins[0]?.id,
    plan: rosterRepairPlan(state),
  };
}

async function applyRepair(database, sheetEmails) {
  return database.$transaction(
    async (transaction) => {
      const current = await inspect(transaction, sheetEmails);
      if (current.plan.alreadyApplied) return current.plan;
      if (!current.corporateAdminId) {
        throw new SafeRosterRepairError('The corporate audit owner is missing.');
      }

      await transaction.programSession.deleteMany({ where: { cohortId: current.cohort.id } });
      await transaction.learner.deleteMany({ where: { cohortId: current.cohort.id } });
      const fixtureAccountIds = current.fixtureAccounts.map((account) => account.id);
      await transaction.roleAssignment.deleteMany({
        where: { accountId: { in: fixtureAccountIds } },
      });
      await transaction.account.deleteMany({ where: { id: { in: fixtureAccountIds } } });
      await transaction.cohort.update({
        where: { id: current.cohort.id },
        data: { name: TARGET_COHORT_NAME, automationMode: 'DISABLED' },
      });

      for (const email of sheetEmails) {
        const account = await transaction.account.create({
          data: { email, status: 'ACTIVE' },
        });
        await transaction.roleAssignment.create({
          data: {
            accountId: account.id,
            cohortId: current.cohort.id,
            role: 'LEARNER',
          },
        });
        await transaction.learner.create({
          data: {
            accountId: account.id,
            cohortId: current.cohort.id,
            externalId: email,
          },
        });
      }
      await transaction.auditEvent.create({
        data: {
          accountId: current.corporateAdminId,
          eventType: 'cohort.uat_roster_repaired',
          entityType: 'Cohort',
          entityId: current.cohort.id,
          payload: {
            removedFixtureAccounts: current.fixtureAccounts.length,
            removedFixtureLearners: current.cohort.learners.length,
            removedFixtureSessions: current.cohort.sessions.length,
            provisionedLearners: sheetEmails.length,
            automationDisabled: current.plan.disableCohort,
          },
        },
      });
      return { alreadyApplied: false };
    },
    { isolationLevel: 'Serializable' },
  );
}

export async function runRosterRepair({ environment = process.env, apply = false } = {}) {
  const sheetEmails = await readSheetEmails(environment);
  const database = new PrismaClient({
    adapter: new PrismaPg({ connectionString: readDatabaseUrl(environment) }),
  });
  try {
    const current = await inspect(database, sheetEmails);
    if (!apply) return { mode: 'dry-run', ...current.plan };
    return { mode: 'applied', ...(await applyRepair(database, sheetEmails)) };
  } finally {
    await database.$disconnect();
  }
}

async function main() {
  try {
    const invocation = validateRosterRepairInvocation(process.argv.slice(2));
    const result = await runRosterRepair(invocation);
    console.log(
      `UAT roster repair ${result.mode} succeeded: ${result.alreadyApplied ? 'preserved existing 14-learner roster' : 'replaced empty sanitized fixtures with 14 learners'}; identifying values logged: no.`,
    );
  } catch (error) {
    if (error instanceof SafeRosterRepairError) console.error(error.message);
    else console.error('UAT roster repair failed. No identifying value was printed.');
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
