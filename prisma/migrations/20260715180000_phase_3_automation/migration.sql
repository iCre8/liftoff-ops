-- CreateEnum
CREATE TYPE "AutomationMode" AS ENUM ('DISABLED', 'DRY_RUN', 'ACTIVE');

-- CreateEnum
CREATE TYPE "AutomationJobType" AS ENUM ('PRE_TRIGGER_RECONCILIATION', 'LATE_EVALUATION', 'NO_CALL_NO_SHOW_EVALUATION', 'SHEET_RECONCILIATION', 'EXIT_REMINDER', 'INCOMPLETE_DAY_EVALUATION', 'UNCLAIMED_REMINDER', 'BIWEEKLY_REPORT', 'RETENTION_REVIEW');

-- CreateEnum
CREATE TYPE "AutomationJobStatus" AS ENUM ('PENDING', 'CLAIMED', 'COMPLETED', 'FAILED', 'HUMAN_REVIEW', 'SUPPRESSED');

-- CreateEnum
CREATE TYPE "TemplateStatus" AS ENUM ('DRAFT', 'APPROVED', 'RETIRED');

-- AlterTable
ALTER TABLE "Cohort" ADD COLUMN     "activatedAt" TIMESTAMP(3),
ADD COLUMN     "automationMode" "AutomationMode" NOT NULL DEFAULT 'DISABLED',
ADD COLUMN     "modeChangedAt" TIMESTAMP(3),
ADD COLUMN     "modeChangedBy" TEXT;

-- AlterTable
ALTER TABLE "Learner" ADD COLUMN     "slackMappingVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "slackMappingVerifiedBy" TEXT,
ADD COLUMN     "slackMemberId" TEXT;

-- AlterTable
ALTER TABLE "MessageTemplate" ADD COLUMN     "status" "TemplateStatus" NOT NULL DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE "OutreachAttempt" ADD COLUMN     "errorCode" TEXT,
ADD COLUMN     "executionMode" "AutomationMode" NOT NULL DEFAULT 'DRY_RUN',
ADD COLUMN     "nextAttemptAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ProviderEvent" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerEventId" TEXT NOT NULL,
    "outreachAttemptId" TEXT,
    "eventType" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationJob" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "cohortId" TEXT NOT NULL,
    "sessionId" TEXT,
    "learnerId" TEXT,
    "type" "AutomationJobType" NOT NULL,
    "status" "AutomationJobStatus" NOT NULL DEFAULT 'PENDING',
    "runAt" TIMESTAMP(3) NOT NULL,
    "attemptNumber" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "claimedAt" TIMESTAMP(3),
    "claimedBy" TEXT,
    "completedAt" TIMESTAMP(3),
    "nextAttemptAt" TIMESTAMP(3),
    "errorCode" TEXT,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlackoutDate" (
    "id" TEXT NOT NULL,
    "cohortId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "reason" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedBy" TEXT,
    "removedAt" TIMESTAMP(3),

    CONSTRAINT "BlackoutDate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DryRunDay" (
    "id" TEXT NOT NULL,
    "cohortId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "completedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "exceptionReason" TEXT,
    "duplicateCount" INTEGER NOT NULL DEFAULT 0,
    "unresolvedMappings" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DryRunDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnresolvedReview" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "ownerAccountId" TEXT,
    "status" TEXT NOT NULL,
    "actionTaken" TEXT,
    "disposition" TEXT,
    "followUpDate" DATE,
    "closureNote" TEXT,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "annotatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UnresolvedReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BaselineMeasurement" (
    "id" TEXT NOT NULL,
    "cohortId" TEXT NOT NULL,
    "measurementDate" DATE NOT NULL,
    "recordedBy" TEXT NOT NULL,
    "outreachCoordinationMinutes" INTEGER NOT NULL,
    "incidentsHandled" INTEGER NOT NULL,
    "unresolvedItems" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BaselineMeasurement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProviderEvent_outreachAttemptId_occurredAt_idx" ON "ProviderEvent"("outreachAttemptId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderEvent_provider_providerEventId_key" ON "ProviderEvent"("provider", "providerEventId");

-- CreateIndex
CREATE UNIQUE INDEX "AutomationJob_idempotencyKey_key" ON "AutomationJob"("idempotencyKey");

-- CreateIndex
CREATE INDEX "AutomationJob_status_runAt_nextAttemptAt_idx" ON "AutomationJob"("status", "runAt", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "AutomationJob_cohortId_type_runAt_idx" ON "AutomationJob"("cohortId", "type", "runAt");

-- CreateIndex
CREATE INDEX "AutomationJob_learnerId_type_status_idx" ON "AutomationJob"("learnerId", "type", "status");

-- CreateIndex
CREATE INDEX "BlackoutDate_cohortId_removedAt_date_idx" ON "BlackoutDate"("cohortId", "removedAt", "date");

-- CreateIndex
CREATE UNIQUE INDEX "BlackoutDate_cohortId_date_key" ON "BlackoutDate"("cohortId", "date");

-- CreateIndex
CREATE INDEX "DryRunDay_cohortId_completedAt_reviewedAt_idx" ON "DryRunDay"("cohortId", "completedAt", "reviewedAt");

-- CreateIndex
CREATE UNIQUE INDEX "DryRunDay_cohortId_date_key" ON "DryRunDay"("cohortId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "UnresolvedReview_incidentId_key" ON "UnresolvedReview"("incidentId");

-- CreateIndex
CREATE INDEX "UnresolvedReview_status_dueAt_idx" ON "UnresolvedReview"("status", "dueAt");

-- CreateIndex
CREATE INDEX "UnresolvedReview_ownerAccountId_status_idx" ON "UnresolvedReview"("ownerAccountId", "status");

-- CreateIndex
CREATE INDEX "BaselineMeasurement_cohortId_measurementDate_idx" ON "BaselineMeasurement"("cohortId", "measurementDate");

-- CreateIndex
CREATE UNIQUE INDEX "BaselineMeasurement_cohortId_measurementDate_recordedBy_key" ON "BaselineMeasurement"("cohortId", "measurementDate", "recordedBy");

-- CreateIndex
CREATE UNIQUE INDEX "Learner_slackMemberId_key" ON "Learner"("slackMemberId");

-- CreateIndex
CREATE INDEX "OutreachAttempt_status_nextAttemptAt_idx" ON "OutreachAttempt"("status", "nextAttemptAt");

-- AddForeignKey
ALTER TABLE "ProviderEvent" ADD CONSTRAINT "ProviderEvent_outreachAttemptId_fkey" FOREIGN KEY ("outreachAttemptId") REFERENCES "OutreachAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationJob" ADD CONSTRAINT "AutomationJob_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationJob" ADD CONSTRAINT "AutomationJob_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ProgramSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationJob" ADD CONSTRAINT "AutomationJob_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "Learner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlackoutDate" ADD CONSTRAINT "BlackoutDate_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DryRunDay" ADD CONSTRAINT "DryRunDay_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnresolvedReview" ADD CONSTRAINT "UnresolvedReview_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BaselineMeasurement" ADD CONSTRAINT "BaselineMeasurement_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
