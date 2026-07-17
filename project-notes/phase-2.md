# Phase 2: Attendance automation backlog

Status: Definition-sprint defaults approved; integration and compliance validation pending  
Recorded: 2026-07-14  
Decisions approved: 2026-07-14  
Initial scope: LiftOff Program Cohort 3

## Purpose

Phase 2 converts the approved business requirements into an implementation-ready plan. The outcome is a validated architecture, prioritized backlog, integration proof, security model, and testable delivery plan. No production deployment is authorized by this note.

The sanitized interview history, rationale, and approved design decisions are recorded in [design-decisions.md](./design-decisions.md).

## Locked baseline

- Google Sheets is the attendance source of truth; Postgres is the incident and outreach audit store.
- Release the morning goals/check-in form at 9:15 AM. Mark a missing submission late at 9:25 AM and transition the same incident to no-call/no-show at 10:45 AM.
- Release and record an exit ticket at 2:45 PM.
- A missing exit ticket creates an `incomplete_day` incident for review but does not automatically mark the learner absent.
- Attendance is attended eligible sessions divided by eligible sessions. Late counts as attended; holidays, approved accommodations, and excused absences are excluded. Punctuality and exit-ticket completion are reported separately.
- Attendance from 75% through 79.99% is a warning; below 75% is a concern. Concern takes precedence.
- Late outreach uses approved learner Slack and email messages plus a team Slack call task.
- No-call/no-show adds an escalation email with the Program Director copied.
- Unclaimed tasks receive three reminders one hour apart. After the first hour, email the configured team through Resend. After the third reminder, add the incident to the daily unresolved dashboard.
- Google Sheet corrections win conflicts. Retry synchronization three times, then notify a human while preserving the audit history.
- Admins and facilitators can edit templates, configure pauses, and manage accommodations; other users have read-only template access.
- At cohort completion, archive active incidents. After three years, prompt administrators to review permanent deletion; never delete automatically.
- Vercel is the selected SvelteKit frontend target. Hermes remains fixed to DigitalOcean through Docker Compose.

## Approved definition-sprint defaults

### Attendance states and calculations

- `on_time`: goals form submitted by 9:25 AM.
- `late`: submitted after 9:25 AM but before 10:45 AM.
- `no_call_no_show`: no valid submission by 10:45 AM.
- `excused`: excluded from the attendance denominator.
- `accommodated`: evaluated against the learner's approved schedule or rule adjustment.
- `incomplete_day`: morning check-in exists but the exit ticket is missing.
- `corrected`: staff updated the authoritative Google Sheet record.
- Attendance percentage: on-time plus late eligible sessions divided by eligible sessions.
- Punctuality percentage: on-time sessions divided by attended sessions.
- Completion percentage: completed exit tickets divided by attended sessions.

### Exit-ticket workflow

- Release the exit ticket at 2:45 PM.
- Send one learner reminder at 3:00 PM when it is incomplete.
- At the end of the program day, create or update one `incomplete_day` incident and place unresolved cases on the daily dashboard.
- Staff can resolve it as completed late, technical issue, approved early departure, accommodation, or unresolved.
- During the MVP, a missing exit ticket does not trigger Program Director escalation or an automatic attendance/payment penalty.

### Operating calendar and communications

- Use `America/New_York` as the program timezone.
- Start with the United States federal holiday calendar and permit admins to manage additional blackout dates.
- Limit MVP outreach to program-provided Slack and email plus human-initiated calls. SMS and automated calling remain out of scope.
- Honor configured preferred channels and suppress scheduled automation on blackout dates.
- External consent, contact-hour, privacy, and retention obligations still require validation before production.

### Accommodation and role ownership

- Facilitators may place an audited temporary pause while an accommodation is reviewed.
- Admin approval is required for continuing accommodations or lasting rule changes.
- Instructor/TA owns daily attendance corrections and unresolved-dashboard review.
- Facilitator owns templates, operational pauses, accommodation review, and follow-up coordination.
- Admin owns system configuration, access, retention, continuing accommodations, and deletion approval.
- Outreach/support staff claim calls and document outcomes.
- Program Director receives no-call/no-show escalation and owns related policy oversight.

### Provisional success targets

Collect a two-week pre-automation baseline, then assess these provisional MVP targets:

- At least 95% of qualifying incidents are automatically detected and logged.
- Automated Slack/email outreach starts within five minutes of the applicable trigger.
- At least 90% of synchronization operations succeed without human intervention.
- Retries create zero duplicate incidents or duplicate outreach.
- At least 80% of call tasks are claimed within one hour.
- At least 95% of daily dashboard incidents are annotated by the end of the program day.
- Instructor time spent coordinating outreach is reduced by at least 50%.
- There are zero cross-learner disclosures and zero unapproved LLM messages.

## Implementation progress

### 2026-07-14: Foundation and attendance-domain slice

Completed:

- Added the pinned SvelteKit 2.69.3, Svelte 5.56.5, Prisma 7.8.0, Vitest 4.1.10, Node 24.14.1, and pnpm 11.5.1 application foundation with a committed dependency lock.
- Added a Nix 2.34.7-compatible flake and lock pinned to `nixpkgs` revision `8eeec934ae0dbeca3d7868c059568a65c08b2fc3` from the `nixos-26.05` nixpkgs branch.
- Added digest-pinned Node and PostgreSQL 18 containers, Docker Compose profiles, read-only application runtime controls, health checks, and external file-mounted secrets.
- Implemented and tested morning attendance classification, late-to-no-call/no-show incident planning, attendance/punctuality/completion metrics, and exit-ticket classification.
- Added the initial Prisma incident/audit schema, adapter-based database boundary, and typed provider contracts without enabling external calls.
- Added an operational-readiness dashboard and a health endpoint. Learner submission writes remain intentionally disabled until identity and Sheet contracts are verified.
- Added a GitHub Actions CI gate with full-SHA action pins for formatting, type checks, tests, builds, schema validation, Compose validation, container build, and Nix evaluation.

Verification evidence:

- `pnpm verify`: passed; formatting matched, Svelte/TypeScript reported zero errors and warnings, 9 tests passed, and the Vercel production build completed.
- `prisma validate` and `prisma generate`: passed with the PostgreSQL adapter-based client engine.
- `docker compose --profile app config`: passed with `/dev/null` fail-closed defaults for missing local secret files.
- Docker image build: passed; the temporary runtime returned HTTP 200 from `/health` and was stopped afterward.
- Nix 2.34.7 `flake check --no-build`: passed for `x86_64-linux`; the host has no local Nix installation and the immutable Nix container was used.

Safety boundary:

- No database migration, external API call, real message, provider configuration change, deployment, or production-data access occurred.
- Google Sheets, Slack, Resend, and Beacon adapters remain contracts only. Their implementation requires sanitized/non-production identifiers, scopes, and fixtures.
- The next implementation slice is the Google Sheets inventory and contract proof, followed by an idempotent fake-adapter synchronization test.

### 2026-07-14: Google Sheets contract and conflict-proofing slice

Completed:

- Added a validated, sanitized mapping format for roster bounds, learner-ID column, and per-session check-in, exit-ticket, excused, and dedicated outcome columns. Workbook and stable numeric tab IDs are supplied separately through ignored environment configuration.
- Added a restricted adapter that reads only configured columns and writes only the configured outcome cell. Mapping validation rejects an outcome column that overlaps learner ID or attendance inputs.
- Added SHA-256 content versions over the configured row values, stale-read detection, idempotent already-applied handling, and a post-write re-read verification.
- Added Sheet-authority protection: a different staff-entered outcome is never overwritten.
- Added three-attempt reconciliation with auditable attempt results and one idempotent human-review request when a staff value persists or retryable conflicts are exhausted.
- Added sanitized in-memory gateway tests; no Google SDK, credential, spreadsheet ID, learner record, or live API call was introduced.

Verification evidence:

- `pnpm verify`: passed; formatting matched, Svelte/TypeScript reported zero errors and warnings, 17 tests passed, and the Vercel build completed.
- Tests cover approved-column mapping, blank-row filtering, content hashes, restricted-cell writes, stale versions, staff-value preservation, already-applied outcomes, retry refresh, and human escalation after three attempts.

Known constraint:

- Google Sheets value writes do not provide the database-style atomic compare-and-set assumed by a transactional store. The adapter therefore uses read/hash/write/re-read verification and fails to human review after conflicts. This behavior must be exercised against a sanitized non-production workbook before enabling writes.
- The example in `config/attendance-sheet.mapping.example.json` contains placeholders only. The configured tab resolves by stable numeric ID, and the finalized owner-only mapping covers 42 per-session check-in/check-out/excused-status/incident-outcome groups and 26 contiguous learner rows. The authorized single-cell sanitized canary verified restricted write, stale-version rejection, idempotency, populated-value preservation, three-conflict human escalation, and guarded cleanup without logging identifiers or cell values.

### 2026-07-14: Neon development database preparation

Completed:

- Restricted the ignored local `.env` file to owner-only permissions without reading or recording its values.
- Verified the configured pooled Neon endpoint with a read-only query; the development branch currently has zero tables in its public schema.
- Updated Prisma schema operations to prefer `DIRECT_DATABASE_URL`, with `DATABASE_URL` retained as the runtime pooled URL and CI fallback.
- Generated the initial PostgreSQL migration locally in `prisma/migrations/20260714123000_init`; it has not been applied to Neon.
- Scanned the migration for connection strings and credential markers, then reran formatting, diagnostics, tests, build, and schema validation successfully.

Remaining gate:

- Add the same development branch's non-pooled connection string as `DIRECT_DATABASE_URL` with explicit certificate verification (`sslmode=verify-full`), then confirm the branch is the intended disposable migration target before applying the initial migration.

### 2026-07-14: Host Nix and keyless Google CLI preparation

Completed:

- Installed a working host Nix bootstrap and verified the locked development flake from the host installation.
- Added Google Cloud SDK 565.0.0 to the flake instead of installing an unpinned global CLI.
- Made the shell hook regenerate repository-local Corepack shim links after switching between container and host Nix stores.
- Verified `gcloud --version` and pnpm 11.5.1 inside the host `nix develop` environment.

Remaining gate:

- Complete the interactive organization-account login and development service-account ADC impersonation, then validate bounded read-only access to the sanitized workbook.

## 1. Close remaining policy decisions

- [x] Define the missing-exit-ticket incident, reminder, review, and no-automatic-penalty behavior.
- [x] Define the attendance, punctuality, and completion calculations and partial-day review behavior.
- [x] Establish a two-week baseline period and provisional MVP success targets.
- [x] Select the United States federal holiday calendar, `America/New_York`, and admin-managed blackout dates.
- [x] Select MVP channels and preferred-channel/blackout behavior. Production consent and contact-hour compliance remain a validation task.
- [x] Assign temporary accommodation pauses to facilitators and continuing approval to admins.
- [x] Map logical ownership for instructors/TAs, facilitators, admins, outreach/support, and the Program Director. Named identity groups remain an integration task.

## 2. Validate integrations and data ownership

- [x] Inventory the configured Cohort 3 attendance tab, bounded ranges, stable learner-identifier location, session fields, formulas, and API-declared protected ranges without retaining learner values.
- [x] Validate the implemented restricted read/write adapter against a sanitized non-production workbook without exposing learner data or overwriting staff corrections.
- [x] Specify and test the bidirectional Sheet contract, idempotency key, content-version conflict detection, three attempts, Sheet-authority behavior, and human-escalation payload.
- [ ] Validate `beaconlearning.me` access for missing assignments, upcoming assignments, payments, and attendance-related payment requirements.
- [ ] Confirm how learners map to Slack identities and how the system observes reactions/comments without granting unnecessary workspace access.
- [ ] Validate Resend domain configuration, sender identities, recipient groups, deliverability events, and environment separation.
- [ ] Define failure behavior for unavailable Google, Slack, Resend, and Beacon services, including retry limits and staff notification.

## 3. Design the MVP workflows

- [x] Design the mobile- and keyboard-accessible morning goals form and its 9:15 AM release workflow.
- [x] Design the 2:45 PM exit ticket and completion record.
- [x] Design the incident outcome form with claimed owner, contact attempt, result, learner response, excused/corrected state, notes, and closure reason.
- [x] Design the learner accommodation request, staff review, decision, effective dates, audit history, and automation pause/adjustment flow.
- [ ] Design the daily unresolved dashboard and require annotated closure by the instructor or TA each day.
- [ ] Design the biweekly instructor report with warning, concern, exclusions, corrections, and trend context.
- [ ] Define manual pause, resume, override, correction, resend, and rollback controls.

## 4. Specify messaging and LLM safeguards

- [ ] Create staff-approved templates for late, no-call/no-show, team call tasks, team escalation, sync failure, and attendance warning/concern messages.
- [ ] Define the permitted personalization fields: attendance percentage and threshold, current/prior-week missing assignments, upcoming assignments, and upcoming payment requirements.
- [ ] Require template versioning and log the approved template, permitted source records, generated text, recipient, channel, and result.
- [ ] Prevent cross-learner context, invented facts, unsupported conclusions, disciplinary language, and automated payment or accommodation decisions.
- [ ] Omit unavailable personalization data or route the draft for staff review; never guess.
- [ ] Decide whether materially changed generated text requires renewed staff approval before automation resumes.

## 5. Define data, access, retention, and security

- [x] Add the initial reviewed-in-code model for learners, cohorts, sessions, submissions, attendance, incidents/events, outreach, corrections, accommodations, pauses, templates, synchronization, and archival. Database migration remains gated on integration review.
- [ ] Define the exact fields written back to Google Sheets while keeping Postgres as the complete incident audit history.
- [x] Implement least-privilege role-based access for admins, facilitators, instructors/TAs, support staff, and read-only users.
- [ ] Confirm applicable student-data, privacy, communication-consent, and retention obligations before production use.
- [ ] Define cohort-end archival as a transactional, reversible operation that preserves identifiers and audit relationships.
- [ ] Define the three-year administrator deletion review, legal/policy holds, authorization, and deletion audit.
- [x] Add fail-closed file-mounted Compose secret wiring, ignored secret paths, value-free environment examples, and no build-time credentials. GitHub environment secrets remain a deployment-stage task.

## 6. Prepare reproducible delivery

- [x] Select Vercel as the SvelteKit frontend target. Preserve AWS/DO Compose portability as a fallback requiring a separately approved target change.
- [x] Keep Hermes fixed to DigitalOcean through its pinned Docker Compose service; Vercel is not a Hermes target.
- [x] Create and validate the pinned Nix flake/lock, package lock, digest-pinned Dockerfile, Compose profiles, and value-free environment example.
- [ ] Define Preview, UAT, and Production GitHub environments and mirror the target-platform gates.
- [ ] Promote the same tested artifact or image digest from UAT to Production; do not rebuild different bits after approval.
- [ ] Add secret scanning, dependency/image scanning, audit-safe logs, health checks, smoke tests, rollback, and environment concurrency controls.

## 7. Build the acceptance and rollout plan

- [ ] Convert every timing, threshold, transition, correction, reminder, pause, accommodation, sync, and archival rule into an acceptance test.
- [ ] Test that retries never duplicate incidents, outreach, dashboard entries, or sheet writes.
- [x] Test warning-versus-concern boundaries and exclusion through the eligible-session calculation contract.
- [x] Test staff-value preservation, conflict refresh/retries, already-applied idempotency, and human escalation through sanitized fake adapters. Postgres audit persistence and live Sheet validation remain open.
- [ ] Test LLM messages against approved templates and the intended learner's records only.
- [ ] Collect the pre-MVP operational baseline before enabling automation.
- [ ] Run a Cohort 3 UAT pilot with staff-visible dry-run messages before enabling external sends.
- [ ] Document support ownership, monitoring, incident response, rollback, training, and the production go/no-go checklist.

## Phase 2 exit criteria

Phase 2 is complete when the open policy decisions are approved, integrations are proven with non-production data, data and role models are reviewed, privacy and messaging constraints are confirmed, acceptance tests are traceable to requirements, numeric MVP targets are recorded, and the Cohort 3 UAT plan is approved.

### 2026-07-15: Milestone 2 local persistence and learner/staff workflows

Completed:

- Approved Google Workspace authentication and active-account authorization contracts, cohort-scoped multi-role access, eight-hour sessions, and a fail-closed sanitized development identity selector.
- Added atomic account CSV parsing, preview, import, deactivation/session revocation, and audit behavior.
- Added local Postgres persistence for immutable submission revisions, first-valid-submission attendance classification, pending idempotent sync operations, support items, accommodation requests/reviews, incident claims/outcomes, and audit events.
- Added responsive learner morning-goals, exit-ticket goal recap, and accommodation-request forms plus the staff operations workspace.
- Applied the initial and Module 2 migrations only to local PostgreSQL. Neon, production, provider configuration, live Sheet writes, external messages, and deployment remain untouched.
- Bounded read-only validation confirmed column D is the intended email mapping. It currently contains 22 matching company-domain values across 26 bounded rows and only 23 unique normalized values; no raw values were logged.

Remaining gates:

- Correct the four nonmatching/duplicate column-D entries, then rerun `pnpm google:sheets:validate-identifiers`.
- Create and authorize the Google Workspace OAuth client outside the repository before production authentication can activate.
- Review and separately authorize Module 3 scheduler-driven Sheet synchronization. Module 2 stores pending operations only.

### 2026-07-15: Milestone 2 completion candidate

Completed locally:

- Added Google Workspace authorization-code authentication with PKCE, one-time state and nonce checks, signed ID-token verification, company-domain and active-provisioned-account enforcement, external first-admin bootstrap, hashed eight-hour database sessions, revocation-aware logout, and same-origin mutation checks. The real OAuth client remains unconfigured and therefore fails closed.
- Enforced cohort scope on staff reads and mutations. Added an intuitive workspace chooser plus a read-only learner-perspective sample that never selects a learner record.
- Enforced separate 9:15 AM morning and 2:45 PM exit releases, a 3:15 PM close, revision preservation, first-valid-submission punctuality, current-week learner history, and accommodation requests outside the daily session window.
- Added a bounded read-only Sheet header extractor that produced a private owner-only catalog containing 42 unique session dates from the copied workbook. Admins can preview and atomically confirm those sessions into Postgres; the workflow performs no Sheet write.
- Local smoke testing passed the admin session preview/confirmation, staff learner preview, and forms discovery paths. `pnpm verify` passed with 7 test files and 36 tests, zero Svelte/TypeScript diagnostics, and a successful production build. `docker compose config` also passed.

External activation gates:

- Correct the four nonmatching/duplicate column-D entries and rerun the bounded identifier validator.
- Create the Google Workspace OAuth client and complete a real organization-account sign-in test.
- Complete privacy/compliance review before production and keep live Sheet writes, scheduling, outreach, and deployment behind the separately authorized Module 3 gate.

Assessment: the Module 2 local implementation is complete. Production activation is not complete until the external gates above pass.
