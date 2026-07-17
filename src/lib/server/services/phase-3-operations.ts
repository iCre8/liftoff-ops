import type { Prisma, PrismaClient } from '@prisma/client';

export function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export async function buildCohortReportCsv(
  database: PrismaClient,
  cohortId: string,
): Promise<string> {
  const learners = await database.learner.findMany({
    where: { cohortId },
    select: {
      externalId: true,
      attendanceRecords: {
        select: { state: true, countsAsAttended: true, countsAsEligible: true, correctedAt: true },
      },
      submissions: { select: { type: true } },
    },
    orderBy: { externalId: 'asc' },
  });
  const rows = learners.map((learner) => {
    const eligible = learner.attendanceRecords.filter((record) => record.countsAsEligible);
    const attended = eligible.filter((record) => record.countsAsAttended);
    const onTime = attended.filter((record) => record.state === 'ON_TIME');
    const exits = learner.submissions.filter((submission) => submission.type === 'EXIT_TICKET');
    const rate = (part: number, whole: number) => (whole === 0 ? '' : (part / whole).toFixed(4));
    const attendanceRate = eligible.length === 0 ? null : attended.length / eligible.length;
    const band =
      attendanceRate === null
        ? 'insufficient_data'
        : attendanceRate < 0.75
          ? 'concern'
          : attendanceRate < 0.8
            ? 'warning'
            : 'healthy';
    return [
      learner.externalId,
      eligible.length,
      attended.length,
      rate(attended.length, eligible.length),
      rate(onTime.length, attended.length),
      rate(exits.length, attended.length),
      band,
      learner.attendanceRecords.filter((record) => record.correctedAt).length,
      learner.attendanceRecords.filter((record) => !record.countsAsEligible).length,
    ];
  });
  return [
    [
      'learner_reference',
      'eligible_sessions',
      'attended_sessions',
      'attendance_rate',
      'punctuality_rate',
      'exit_completion_rate',
      'attendance_band',
      'corrections',
      'exclusions',
    ],
    ...rows,
  ]
    .map((row) => row.map(csvCell).join(','))
    .join('\r\n');
}

export async function archiveCohortIncidents(
  database: PrismaClient,
  input: { cohortId: string; actorId: string; now?: Date },
): Promise<number> {
  const now = input.now ?? new Date();
  return database.$transaction(async (transaction) => {
    const incidents = await transaction.incident.findMany({
      where: { learner: { cohortId: input.cohortId } },
      include: {
        events: true,
        outreach: { include: { providerEvents: true } },
        syncAttempts: true,
        unresolvedReview: true,
      },
    });
    for (const incident of incidents) {
      const snapshot = JSON.parse(JSON.stringify(incident)) as Prisma.InputJsonValue;
      await transaction.archivedIncident.upsert({
        where: { originalId: incident.id },
        create: {
          originalId: incident.id,
          cohortId: input.cohortId,
          snapshot,
          archivedAt: now,
          deletionReviewAt: new Date(now.getTime() + 3 * 365 * 24 * 60 * 60_000),
        },
        update: {},
      });
    }
    const incidentIds = incidents.map((incident) => incident.id);
    if (incidentIds.length) {
      await transaction.providerEvent.deleteMany({
        where: { outreachAttempt: { incidentId: { in: incidentIds } } },
      });
      await transaction.unresolvedReview.deleteMany({ where: { incidentId: { in: incidentIds } } });
      await transaction.outreachAttempt.deleteMany({ where: { incidentId: { in: incidentIds } } });
      await transaction.incidentEvent.deleteMany({ where: { incidentId: { in: incidentIds } } });
      await transaction.syncAttempt.deleteMany({ where: { incidentId: { in: incidentIds } } });
      await transaction.incident.deleteMany({ where: { id: { in: incidentIds } } });
    }
    await transaction.cohort.update({ where: { id: input.cohortId }, data: { archivedAt: now } });
    await transaction.auditEvent.create({
      data: {
        accountId: input.actorId,
        eventType: 'cohort.incidents_archived',
        entityType: 'Cohort',
        entityId: input.cohortId,
        payload: { incidentCount: incidents.length, reversible: true },
      },
    });
    return incidents.length;
  });
}

type IncidentSnapshot = Prisma.IncidentUncheckedCreateInput & {
  events: Prisma.IncidentEventUncheckedCreateInput[];
  outreach: Array<
    Prisma.OutreachAttemptUncheckedCreateInput & {
      providerEvents: Prisma.ProviderEventUncheckedCreateInput[];
    }
  >;
  syncAttempts: Prisma.SyncAttemptUncheckedCreateInput[];
  unresolvedReview: Prisma.UnresolvedReviewUncheckedCreateInput | null;
};

export async function restoreCohortIncidents(
  database: PrismaClient,
  input: { cohortId: string; actorId: string },
): Promise<number> {
  return database.$transaction(async (transaction) => {
    const archives = await transaction.archivedIncident.findMany({
      where: { cohortId: input.cohortId },
      orderBy: { archivedAt: 'asc' },
    });
    for (const archive of archives) {
      const snapshot = archive.snapshot as unknown as IncidentSnapshot;
      const { events, outreach, syncAttempts, unresolvedReview, ...incident } = snapshot;
      await transaction.incident.create({ data: incident });
      if (events.length) await transaction.incidentEvent.createMany({ data: events });
      if (syncAttempts.length) await transaction.syncAttempt.createMany({ data: syncAttempts });
      for (const item of outreach) {
        const { providerEvents, ...attempt } = item;
        await transaction.outreachAttempt.create({ data: attempt });
        if (providerEvents.length)
          await transaction.providerEvent.createMany({ data: providerEvents });
      }
      if (unresolvedReview) await transaction.unresolvedReview.create({ data: unresolvedReview });
    }
    await transaction.archivedIncident.deleteMany({ where: { cohortId: input.cohortId } });
    await transaction.cohort.update({
      where: { id: input.cohortId },
      data: { archivedAt: null },
    });
    await transaction.auditEvent.create({
      data: {
        accountId: input.actorId,
        eventType: 'cohort.incidents_restored',
        entityType: 'Cohort',
        entityId: input.cohortId,
        payload: { incidentCount: archives.length },
      },
    });
    return archives.length;
  });
}
