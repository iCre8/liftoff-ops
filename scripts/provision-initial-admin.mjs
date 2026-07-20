import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const COMPANY_DOMAIN = 'launchpadphilly.org';

export class SafeProvisioningError extends Error {}
export function validateProvisioningInvocation(arguments_) {
  if (!arguments_.includes('--uat')) {
    throw new SafeProvisioningError('Explicit --uat target confirmation is required.');
  }
  return { apply: arguments_.includes('--apply') };
}

export function normalizeInitialAdminEmail(value) {
  const email = value?.trim().toLowerCase();
  if (!email || !email.endsWith('@' + COMPANY_DOMAIN)) {
    throw new SafeProvisioningError('Configured initial administrator is not a company account.');
  }
  return email;
}

export function adminProvisioningPlan(input) {
  if (!input.accountExists) return { createAccount: true, addAdminRole: true };
  if (input.accountStatus !== 'ACTIVE') {
    throw new SafeProvisioningError('Configured initial administrator exists but is inactive.');
  }
  return { createAccount: false, addAdminRole: !input.hasGlobalAdminRole };
}

function readDatabaseUrl(environment) {
  const file = environment.DATABASE_URL_FILE?.trim();
  const value = file ? readFileSync(file, 'utf8').trim() : environment.DATABASE_URL?.trim();
  if (!value) throw new SafeProvisioningError('UAT database configuration is missing.');
  return value;
}

async function inspect(database, email) {
  const account = await database.account.findUnique({ where: { email } });
  const hasGlobalAdminRole = account
    ? Boolean(
        await database.roleAssignment.findFirst({
          where: { accountId: account.id, cohortId: null, role: 'ADMIN' },
          select: { id: true },
        }),
      )
    : false;
  return {
    account,
    plan: adminProvisioningPlan({
      accountExists: Boolean(account),
      accountStatus: account?.status,
      hasGlobalAdminRole,
    }),
  };
}

async function applyPlan(database, email) {
  return database.$transaction(async (transaction) => {
    const current = await inspect(transaction, email);
    let account = current.account;

    if (current.plan.createAccount) {
      account = await transaction.account.create({
        data: {
          email,
          status: 'ACTIVE',
          auditEvents: {
            create: {
              eventType: 'account.uat_initial_admin_provisioned',
              entityType: 'Account',
              entityId: 'self',
              payload: {},
            },
          },
        },
      });
    }

    if (!account) throw new SafeProvisioningError('Administrator account provisioning failed.');
    if (current.plan.addAdminRole) {
      await transaction.roleAssignment.create({
        data: { accountId: account.id, cohortId: null, role: 'ADMIN' },
      });
      await transaction.auditEvent.create({
        data: {
          accountId: account.id,
          eventType: 'account.uat_global_admin_granted',
          entityType: 'Account',
          entityId: 'self',
          payload: {},
        },
      });
    }

    return current.plan;
  });
}

export async function runProvisioning({ environment = process.env, apply = false } = {}) {
  const email = normalizeInitialAdminEmail(environment.INITIAL_ADMIN_EMAIL);
  const database = new PrismaClient({
    adapter: new PrismaPg({ connectionString: readDatabaseUrl(environment) }),
  });

  try {
    const current = await inspect(database, email);
    if (!apply) return { mode: 'dry-run', ...current.plan };
    return { mode: 'applied', ...(await applyPlan(database, email)) };
  } finally {
    await database.$disconnect();
  }
}

function summarize(result) {
  const accountAction = result.createAccount ? 'create' : 'preserve';
  const roleAction = result.addAdminRole ? 'add' : 'preserve';
  return (
    'UAT administrator provisioning ' +
    result.mode +
    ' succeeded: account=' +
    accountAction +
    ', global-admin-role=' +
    roleAction +
    ', identifying values logged: no.'
  );
}

async function main() {
  try {
    const invocation = validateProvisioningInvocation(process.argv.slice(2));
    console.log(summarize(await runProvisioning(invocation)));
  } catch (error) {
    if (error instanceof SafeProvisioningError) console.error(error.message);
    else console.error('UAT administrator provisioning failed. No identifying value was printed.');
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
