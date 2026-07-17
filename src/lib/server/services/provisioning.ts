import type { PrismaClient } from '@prisma/client';

import { parseAccountImportCsv } from '$lib/domain/module-2';

const roleMap = {
  learner: 'LEARNER',
  admin: 'ADMIN',
  facilitator: 'FACILITATOR',
  instructor_ta: 'INSTRUCTOR_TA',
  outreach_support: 'OUTREACH_SUPPORT',
  read_only: 'READ_ONLY',
} as const;

export interface AccountImportPreview {
  total: number;
  creates: number;
  updates: number;
  unchanged: number;
}

export async function previewAccountImport(
  database: PrismaClient,
  csv: string,
): Promise<AccountImportPreview> {
  const rows = parseAccountImportCsv(csv);
  const cohorts = await database.cohort.findMany({
    where: { name: { in: [...new Set(rows.flatMap((row) => (row.cohort ? [row.cohort] : [])))] } },
    select: { name: true },
  });
  const knownCohorts = new Set(cohorts.map((cohort) => cohort.name));
  for (const row of rows) {
    if (row.cohort && !knownCohorts.has(row.cohort)) {
      throw new Error(`Row ${row.rowNumber} references an unknown cohort`);
    }
  }
  const existing = await database.account.findMany({
    where: { email: { in: rows.map((row) => row.email) } },
    include: { roles: { include: { cohort: { select: { name: true } } } } },
  });
  const accounts = new Map(existing.map((account) => [account.email, account]));
  let creates = 0;
  let updates = 0;
  let unchanged = 0;
  for (const row of rows) {
    const account = accounts.get(row.email);
    if (!account) {
      creates += 1;
      continue;
    }
    const current = account.roles
      .map((assignment) => `${assignment.role.toLowerCase()}:${assignment.cohort?.name ?? ''}`)
      .sort();
    const desired = row.roles
      .map((role) => `${role}:${role === 'admin' ? '' : (row.cohort ?? '')}`)
      .sort();
    if (account.status.toLowerCase() === row.status && current.join('|') === desired.join('|')) {
      unchanged += 1;
    } else {
      updates += 1;
    }
  }
  return { total: rows.length, creates, updates, unchanged };
}

export async function applyAccountImport(
  database: PrismaClient,
  csv: string,
  adminAccountId: string,
): Promise<AccountImportPreview> {
  const rows = parseAccountImportCsv(csv);
  const preview = await previewAccountImport(database, csv);
  await database.$transaction(
    async (transaction) => {
      const cohorts = await transaction.cohort.findMany({
        where: {
          name: { in: [...new Set(rows.flatMap((row) => (row.cohort ? [row.cohort] : [])))] },
        },
      });
      const cohortByName = new Map(cohorts.map((cohort) => [cohort.name, cohort]));
      for (const row of rows) {
        const cohort = row.cohort ? cohortByName.get(row.cohort) : undefined;
        const account = await transaction.account.upsert({
          where: { email: row.email },
          create: { email: row.email, status: row.status.toUpperCase() as never },
          update: { status: row.status.toUpperCase() as never },
        });
        await transaction.roleAssignment.deleteMany({ where: { accountId: account.id } });
        await transaction.roleAssignment.createMany({
          data: row.roles.map((role) => ({
            accountId: account.id,
            cohortId: role === 'admin' ? null : cohort?.id,
            role: roleMap[role],
          })),
        });
        if (row.roles.includes('learner')) {
          if (!cohort) throw new Error(`Row ${row.rowNumber} requires a known learner cohort`);
          await transaction.learner.upsert({
            where: { cohortId_externalId: { cohortId: cohort.id, externalId: row.email } },
            create: { accountId: account.id, cohortId: cohort.id, externalId: row.email },
            update: { accountId: account.id },
          });
        }
        if (row.status === 'inactive') {
          await transaction.authSession.updateMany({
            where: { accountId: account.id, revokedAt: null },
            data: { revokedAt: new Date() },
          });
        }
      }
      await transaction.auditEvent.create({
        data: {
          accountId: adminAccountId,
          eventType: 'accounts.csv_imported',
          entityType: 'AccountImport',
          entityId: crypto.randomUUID(),
          payload: {
            total: preview.total,
            creates: preview.creates,
            updates: preview.updates,
            unchanged: preview.unchanged,
          },
        },
      });
    },
    { isolationLevel: 'Serializable' },
  );
  return preview;
}
