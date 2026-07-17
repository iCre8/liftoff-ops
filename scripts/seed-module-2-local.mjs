import { readFileSync } from 'node:fs';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { SANITIZED_TEMPLATE_DRAFTS } from '../src/lib/domain/phase-3.ts';

process.env.TZ = 'America/New_York';

const connectionString = process.env.DATABASE_URL_FILE
  ? readFileSync(process.env.DATABASE_URL_FILE, 'utf8').trim()
  : process.env.DATABASE_URL?.trim();
if (!connectionString) throw new Error('DATABASE_URL or DATABASE_URL_FILE is required');

const database = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
const now = new Date();
const year = now.getFullYear();
const month = now.getMonth();
const day = now.getDate();
const dateOnly = new Date(Date.UTC(year, month, day));
const cohort = await database.cohort.upsert({
  where: { id: 'dev-cohort-3' },
  create: {
    id: 'dev-cohort-3',
    name: 'Sanitized Cohort 3',
    startsOn: dateOnly,
    endsOn: new Date(Date.UTC(year, month + 2, day)),
  },
  update: {},
});
const session = await database.programSession.upsert({
  where: { cohortId_sessionDate: { cohortId: cohort.id, sessionDate: dateOnly } },
  create: {
    cohortId: cohort.id,
    externalId: `dev-${dateOnly.toISOString().slice(0, 10)}`,
    sessionDate: dateOnly,
    checkInReleasedAt: new Date(year, month, day, 9, 15),
    exitTicketReleasedAt: new Date(year, month, day, 14, 45),
    programDayEndsAt: new Date(year, month, day, 15, 15),
  },
  update: {},
});
for (const [key, content] of Object.entries(SANITIZED_TEMPLATE_DRAFTS)) {
  await database.messageTemplate.upsert({
    where: { cohortId_key_version: { cohortId: cohort.id, key, version: 1 } },
    create: { cohortId: cohort.id, key, version: 1, content, status: 'DRAFT' },
    update: {},
  });
}
const accounts = [
  { email: 'admin@example.test', displayName: 'Sanitized Admin', roles: ['ADMIN'] },
  {
    email: 'facilitator@example.test',
    displayName: 'Sanitized Facilitator',
    roles: ['FACILITATOR'],
  },
  { email: 'learner@example.test', displayName: 'Sanitized Learner', roles: ['LEARNER'] },
];
for (const definition of accounts) {
  const account = await database.account.upsert({
    where: { email: definition.email },
    create: { email: definition.email, displayName: definition.displayName },
    update: { displayName: definition.displayName, status: 'ACTIVE' },
  });
  for (const role of definition.roles) {
    await database.roleAssignment.upsert({
      where: {
        accountId_cohortId_role: {
          accountId: account.id,
          cohortId: cohort.id,
          role,
        },
      },
      create: { accountId: account.id, cohortId: cohort.id, role },
      update: {},
    });
  }
  if (definition.roles.includes('LEARNER')) {
    await database.learner.upsert({
      where: { cohortId_externalId: { cohortId: cohort.id, externalId: definition.email } },
      create: { accountId: account.id, cohortId: cohort.id, externalId: definition.email },
      update: { accountId: account.id },
    });
  }
}
console.log(
  `Sanitized Module 2 seed ready: ${accounts.length} accounts, one active session, learner records logged: no.`,
);
await database.$disconnect();
