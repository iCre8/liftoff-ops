-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "AppRole" AS ENUM ('LEARNER', 'ADMIN', 'FACILITATOR', 'INSTRUCTOR_TA', 'OUTREACH_SUPPORT', 'READ_ONLY');

-- CreateEnum
CREATE TYPE "SupportItemStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "SyncOperationStatus" AS ENUM ('PENDING', 'COMPLETED', 'HUMAN_REVIEW');

-- CreateEnum
CREATE TYPE "AccommodationCategory" AS ENUM ('SCHEDULE_TIMING', 'ATTENDANCE_CHECK_IN_METHOD', 'COMMUNICATION', 'ACCESSIBILITY_TECHNOLOGY', 'TEMPORARY_PERSONAL_CIRCUMSTANCE', 'OTHER');

-- AlterTable
ALTER TABLE "Accommodation" ADD COLUMN     "category" "AccommodationCategory" NOT NULL,
ADD COLUMN     "expectedBenefit" TEXT NOT NULL,
ADD COLUMN     "preferredFollowUp" TEXT NOT NULL,
ADD COLUMN     "requestedAdjustment" TEXT NOT NULL,
ADD COLUMN     "reviewNote" TEXT;

-- AlterTable
ALTER TABLE "Learner" ADD COLUMN     "accountId" TEXT;

-- AlterTable
ALTER TABLE "Submission" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "googleSubject" TEXT,
    "displayName" TEXT,
    "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastSignedInAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoleAssignment" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "cohortId" TEXT,
    "role" "AppRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoleAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthSession" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubmissionRevision" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "content" JSONB NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL,
    "actorId" TEXT NOT NULL,

    CONSTRAINT "SubmissionRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PendingSyncOperation" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "status" "SyncOperationStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "PendingSyncOperation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportItem" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "status" "SupportItemStatus" NOT NULL DEFAULT 'OPEN',
    "acknowledgedBy" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "accountId" TEXT,
    "eventType" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_email_key" ON "Account"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Account_googleSubject_key" ON "Account"("googleSubject");

-- CreateIndex
CREATE INDEX "RoleAssignment_cohortId_role_idx" ON "RoleAssignment"("cohortId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "RoleAssignment_accountId_cohortId_role_key" ON "RoleAssignment"("accountId", "cohortId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "AuthSession_tokenHash_key" ON "AuthSession"("tokenHash");

-- CreateIndex
CREATE INDEX "AuthSession_accountId_expiresAt_idx" ON "AuthSession"("accountId", "expiresAt");

-- CreateIndex
CREATE INDEX "SubmissionRevision_submissionId_submittedAt_idx" ON "SubmissionRevision"("submissionId", "submittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SubmissionRevision_submissionId_revision_key" ON "SubmissionRevision"("submissionId", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "PendingSyncOperation_idempotencyKey_key" ON "PendingSyncOperation"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "SupportItem_idempotencyKey_key" ON "SupportItem"("idempotencyKey");

-- CreateIndex
CREATE INDEX "SupportItem_learnerId_status_createdAt_idx" ON "SupportItem"("learnerId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_entityType_entityId_occurredAt_idx" ON "AuditEvent"("entityType", "entityId", "occurredAt");

-- CreateIndex
CREATE INDEX "AuditEvent_accountId_occurredAt_idx" ON "AuditEvent"("accountId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "Learner_accountId_key" ON "Learner"("accountId");

-- AddForeignKey
ALTER TABLE "RoleAssignment" ADD CONSTRAINT "RoleAssignment_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleAssignment" ADD CONSTRAINT "RoleAssignment_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Learner" ADD CONSTRAINT "Learner_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionRevision" ADD CONSTRAINT "SubmissionRevision_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PendingSyncOperation" ADD CONSTRAINT "PendingSyncOperation_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportItem" ADD CONSTRAINT "SupportItem_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "Learner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

