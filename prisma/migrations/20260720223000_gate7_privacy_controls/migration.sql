-- Approved Gate 7 communication-choice and retention-review controls.
ALTER TYPE "OutreachStatus" ADD VALUE 'SUPPRESSED';

CREATE TYPE "CommunicationPreferenceSource" AS ENUM ('LEARNER_FORM', 'ADMIN_RECORDED_REQUEST', 'LEARNER_RESUME', 'ADMIN_CORRECTION');
CREATE TYPE "RetentionDataCategory" AS ENUM ('ACCOUNTS_AND_SESSIONS', 'LEARNER_IDENTIFIERS_AND_MAPPINGS', 'SUBMISSIONS_AND_REVISIONS', 'ATTENDANCE_RECORDS', 'INCIDENTS_AND_OUTREACH', 'SUPPORT_ITEMS', 'ACCOMMODATIONS_AND_PAUSES', 'SYNCHRONIZATION_HISTORY', 'AUDIT_HISTORY', 'PROVIDER_METADATA', 'REPORTING_AND_BASELINES', 'AUTOMATION_JOBS');
CREATE TYPE "RetentionReviewStatus" AS ENUM ('PENDING', 'REVIEWED_RETAIN', 'REVIEWED_DELETE');

CREATE TABLE "LearnerCommunicationPreference" (
    "id" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "channel" "OutreachChannel" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "source" "CommunicationPreferenceSource" NOT NULL,
    "effectiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changedByAccountId" TEXT NOT NULL,
    "adminReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LearnerCommunicationPreference_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DataRetentionReview" (
    "id" TEXT NOT NULL,
    "cohortId" TEXT NOT NULL,
    "category" "RetentionDataCategory" NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "status" "RetentionReviewStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "decisionNote" TEXT,
    "holdPlacedAt" TIMESTAMP(3),
    "holdPlacedBy" TEXT,
    "holdReason" TEXT,
    "holdReviewAt" TIMESTAMP(3),
    "holdReleasedAt" TIMESTAMP(3),
    "holdReleasedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataRetentionReview_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LearnerCommunicationPreference_learnerId_channel_key" ON "LearnerCommunicationPreference"("learnerId", "channel");
CREATE INDEX "LearnerCommunicationPreference_changedByAccountId_effectiveAt_idx" ON "LearnerCommunicationPreference"("changedByAccountId", "effectiveAt");
CREATE UNIQUE INDEX "DataRetentionReview_cohortId_category_key" ON "DataRetentionReview"("cohortId", "category");
CREATE INDEX "DataRetentionReview_status_dueAt_idx" ON "DataRetentionReview"("status", "dueAt");
CREATE INDEX "DataRetentionReview_cohortId_holdReleasedAt_holdReviewAt_idx" ON "DataRetentionReview"("cohortId", "holdReleasedAt", "holdReviewAt");

ALTER TABLE "LearnerCommunicationPreference" ADD CONSTRAINT "LearnerCommunicationPreference_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "Learner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LearnerCommunicationPreference" ADD CONSTRAINT "LearnerCommunicationPreference_changedByAccountId_fkey" FOREIGN KEY ("changedByAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DataRetentionReview" ADD CONSTRAINT "DataRetentionReview_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
