-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "AttendanceState" AS ENUM ('PENDING', 'ON_TIME', 'LATE', 'NO_CALL_NO_SHOW', 'EXCUSED', 'ACCOMMODATED', 'INCOMPLETE_DAY', 'CORRECTED');

-- CreateEnum
CREATE TYPE "SubmissionType" AS ENUM ('GOALS_CHECK_IN', 'EXIT_TICKET');

-- CreateEnum
CREATE TYPE "IncidentType" AS ENUM ('LATE', 'NO_CALL_NO_SHOW', 'INCOMPLETE_DAY', 'SYNC_CONFLICT');

-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('OPEN', 'CLAIMED', 'RESOLVED', 'ESCALATED');

-- CreateEnum
CREATE TYPE "OutreachChannel" AS ENUM ('SLACK', 'EMAIL', 'HUMAN_CALL');

-- CreateEnum
CREATE TYPE "OutreachStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DELIVERED', 'FAILED', 'CLAIMED', 'CLOSED');

-- CreateEnum
CREATE TYPE "AccommodationStatus" AS ENUM ('REQUESTED', 'TEMPORARILY_PAUSED', 'APPROVED', 'DENIED', 'EXPIRED');

-- CreateTable
CREATE TABLE "Cohort" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
    "startsOn" DATE NOT NULL,
    "endsOn" DATE NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cohort_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Learner" (
    "id" TEXT NOT NULL,
    "cohortId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "preferredChannel" "OutreachChannel",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Learner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramSession" (
    "id" TEXT NOT NULL,
    "cohortId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "sessionDate" DATE NOT NULL,
    "checkInReleasedAt" TIMESTAMP(3) NOT NULL,
    "exitTicketReleasedAt" TIMESTAMP(3) NOT NULL,
    "programDayEndsAt" TIMESTAMP(3) NOT NULL,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProgramSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Submission" (
    "id" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "type" "SubmissionType" NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL,
    "content" JSONB NOT NULL,
    "source" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceRecord" (
    "id" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "state" "AttendanceState" NOT NULL,
    "countsAsAttended" BOOLEAN NOT NULL,
    "countsAsEligible" BOOLEAN NOT NULL,
    "sourceVersion" TEXT,
    "correctedAt" TIMESTAMP(3),
    "correctionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Incident" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "type" "IncidentType" NOT NULL,
    "status" "IncidentStatus" NOT NULL DEFAULT 'OPEN',
    "detectedAt" TIMESTAMP(3) NOT NULL,
    "claimedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "closureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Incident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncidentEvent" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT,
    "payload" JSONB NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IncidentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageTemplate" (
    "id" TEXT NOT NULL,
    "cohortId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutreachAttempt" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "templateId" TEXT,
    "channel" "OutreachChannel" NOT NULL,
    "status" "OutreachStatus" NOT NULL DEFAULT 'PENDING',
    "recipientRef" TEXT NOT NULL,
    "providerMessageId" TEXT,
    "attemptNumber" INTEGER NOT NULL DEFAULT 1,
    "acceptedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutreachAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncAttempt" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "system" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "expectedSourceVersion" TEXT,
    "observedSourceVersion" TEXT,
    "status" TEXT NOT NULL,
    "errorCode" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Accommodation" (
    "id" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "status" "AccommodationStatus" NOT NULL DEFAULT 'REQUESTED',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "ruleOverrides" JSONB,

    CONSTRAINT "Accommodation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationPause" (
    "id" TEXT NOT NULL,
    "cohortId" TEXT NOT NULL,
    "learnerId" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "reasonCode" TEXT NOT NULL,
    "approvedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutomationPause_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArchivedIncident" (
    "id" TEXT NOT NULL,
    "originalId" TEXT NOT NULL,
    "cohortId" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "archivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletionReviewAt" TIMESTAMP(3) NOT NULL,
    "deletionHold" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ArchivedIncident_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Learner_cohortId_idx" ON "Learner"("cohortId");

-- CreateIndex
CREATE UNIQUE INDEX "Learner_cohortId_externalId_key" ON "Learner"("cohortId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramSession_cohortId_externalId_key" ON "ProgramSession"("cohortId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramSession_cohortId_sessionDate_key" ON "ProgramSession"("cohortId", "sessionDate");

-- CreateIndex
CREATE INDEX "Submission_sessionId_type_idx" ON "Submission"("sessionId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "Submission_learnerId_sessionId_type_key" ON "Submission"("learnerId", "sessionId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "Submission_source_sourceId_key" ON "Submission"("source", "sourceId");

-- CreateIndex
CREATE INDEX "AttendanceRecord_sessionId_state_idx" ON "AttendanceRecord"("sessionId", "state");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceRecord_learnerId_sessionId_key" ON "AttendanceRecord"("learnerId", "sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "Incident_idempotencyKey_key" ON "Incident"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Incident_sessionId_status_idx" ON "Incident"("sessionId", "status");

-- CreateIndex
CREATE INDEX "Incident_learnerId_detectedAt_idx" ON "Incident"("learnerId", "detectedAt");

-- CreateIndex
CREATE INDEX "IncidentEvent_incidentId_occurredAt_idx" ON "IncidentEvent"("incidentId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "MessageTemplate_cohortId_key_version_key" ON "MessageTemplate"("cohortId", "key", "version");

-- CreateIndex
CREATE UNIQUE INDEX "OutreachAttempt_idempotencyKey_key" ON "OutreachAttempt"("idempotencyKey");

-- CreateIndex
CREATE INDEX "OutreachAttempt_incidentId_channel_idx" ON "OutreachAttempt"("incidentId", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "SyncAttempt_idempotencyKey_key" ON "SyncAttempt"("idempotencyKey");

-- CreateIndex
CREATE INDEX "SyncAttempt_system_status_occurredAt_idx" ON "SyncAttempt"("system", "status", "occurredAt");

-- CreateIndex
CREATE INDEX "Accommodation_learnerId_status_idx" ON "Accommodation"("learnerId", "status");

-- CreateIndex
CREATE INDEX "AutomationPause_cohortId_startsAt_endsAt_idx" ON "AutomationPause"("cohortId", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "AutomationPause_learnerId_startsAt_endsAt_idx" ON "AutomationPause"("learnerId", "startsAt", "endsAt");

-- CreateIndex
CREATE UNIQUE INDEX "ArchivedIncident_originalId_key" ON "ArchivedIncident"("originalId");

-- CreateIndex
CREATE INDEX "ArchivedIncident_cohortId_deletionReviewAt_idx" ON "ArchivedIncident"("cohortId", "deletionReviewAt");

-- AddForeignKey
ALTER TABLE "Learner" ADD CONSTRAINT "Learner_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramSession" ADD CONSTRAINT "ProgramSession_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "Learner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ProgramSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "Learner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ProgramSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "Learner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ProgramSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentEvent" ADD CONSTRAINT "IncidentEvent_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageTemplate" ADD CONSTRAINT "MessageTemplate_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachAttempt" ADD CONSTRAINT "OutreachAttempt_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachAttempt" ADD CONSTRAINT "OutreachAttempt_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "MessageTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncAttempt" ADD CONSTRAINT "SyncAttempt_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Accommodation" ADD CONSTRAINT "Accommodation_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "Learner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationPause" ADD CONSTRAINT "AutomationPause_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationPause" ADD CONSTRAINT "AutomationPause_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "Learner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
