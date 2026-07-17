import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { isAbsolute, relative, resolve } from 'node:path';

import type { PrismaClient } from '@prisma/client';

import {
  parseSessionCatalog,
  programSessionTimes,
  type SessionCatalog,
} from '$lib/domain/module-2';

export function readSessionCatalog(): SessionCatalog {
  const fileName = sessionCatalogPath();
  if (!existsSync(fileName))
    throw new Error('The read-only Sheet session catalog is not configured');
  return parseSessionCatalog(JSON.parse(readFileSync(fileName, 'utf8')));
}

export function sessionCatalogPath(): string {
  const fileName = resolve(
    process.env.LIFTOFF_SESSION_CATALOG_FILE?.trim() ||
      resolve(homedir(), '.config/liftoff/attendance-sheet.sessions.json'),
  );
  const fromWorktree = relative(resolve(process.cwd()), fileName);
  if (fromWorktree === '' || (!fromWorktree.startsWith('..') && !isAbsolute(fromWorktree))) {
    throw new Error('The private Sheet session catalog must be stored outside the worktree');
  }
  return fileName;
}

export function sessionCatalogConfigured(): boolean {
  return existsSync(sessionCatalogPath());
}

export async function previewProgramSessions(
  database: PrismaClient,
  cohortId: string,
  catalog: SessionCatalog,
) {
  const existing = await database.programSession.findMany({ where: { cohortId } });
  const byExternalId = new Map(existing.map((session) => [session.externalId, session]));
  let creates = 0;
  let updates = 0;
  let unchanged = 0;
  const sessions = catalog.sessions.map((source) => {
    const times = programSessionTimes(source.sessionDate);
    const current = byExternalId.get(source.externalId);
    const changed =
      current &&
      (current.sessionDate.getTime() !== times.sessionDate.getTime() ||
        current.checkInReleasedAt.getTime() !== times.checkInReleasedAt.getTime() ||
        current.exitTicketReleasedAt.getTime() !== times.exitTicketReleasedAt.getTime() ||
        current.programDayEndsAt.getTime() !== times.programDayEndsAt.getTime());
    if (!current) creates += 1;
    else if (changed) updates += 1;
    else unchanged += 1;
    return {
      externalId: source.externalId,
      sessionDate: source.sessionDate,
      change: !current ? 'create' : changed ? 'update' : 'unchanged',
    };
  });
  return { total: sessions.length, creates, updates, unchanged, sessions };
}

export async function applyProgramSessions(
  database: PrismaClient,
  cohortId: string,
  catalog: SessionCatalog,
  actorAccountId: string,
) {
  const preview = await previewProgramSessions(database, cohortId, catalog);
  await database.$transaction(async (transaction) => {
    for (const source of catalog.sessions) {
      const times = programSessionTimes(source.sessionDate);
      await transaction.programSession.upsert({
        where: { cohortId_externalId: { cohortId, externalId: source.externalId } },
        create: { cohortId, externalId: source.externalId, ...times },
        update: { ...times },
      });
    }
    await transaction.auditEvent.create({
      data: {
        accountId: actorAccountId,
        eventType: 'program_sessions.sheet_catalog_applied',
        entityType: 'Cohort',
        entityId: cohortId,
        payload: {
          total: preview.total,
          creates: preview.creates,
          updates: preview.updates,
          unchanged: preview.unchanged,
        },
      },
    });
  });
  return preview;
}
