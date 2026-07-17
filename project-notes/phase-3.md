# Phase 3: Attendance automation execution

Status: Local implementation complete; external activation validation pending  
Recorded: 2026-07-15  
Initial scope: LiftOff Program Cohort 3

## Purpose

Phase 3 turns the Module 2 forms and audit model into a durable, staff-controlled automation system. It schedules attendance evaluations, reconciles the authoritative attendance Sheet, creates incidents idempotently, prepares or sends approved outreach through typed providers, and exposes operational controls and reporting.

This phase does not itself authorize production deployment, a live Sheet write, or a real Slack/Resend message.

## Locked architecture

- Run a dedicated LiftOff Node/TypeScript worker through pinned Docker Compose on DigitalOcean. Do not use n8n for authoritative attendance state or scheduling.
- Keep the SvelteKit frontend on Vercel and Postgres as the durable job, incident, outreach, and audit store.
- Support cohort automation modes `disabled`, `dry_run`, and `active`.
- Use transactionally claimed durable jobs, database locking, and deterministic idempotency keys. Multiple workers must not duplicate transitions, messages, tasks, or Sheet operations.
- Use typed provider adapters. Local and automated tests use sanitized fakes only.

## Daily schedule

All times use `America/New_York` and apply only to active program days:

- 9:25 AM: evaluate missing morning check-ins and create/advance late incidents.
- 10:45 AM: transition the same unresolved incident to no-call/no-show.
- 11:00 AM: Sheet-to-Postgres reconciliation.
- 3:00 PM: prepare the missing exit-ticket reminder.
- 3:15 PM: final Sheet reconciliation, create incomplete-day incidents, and publish the unresolved dashboard.
- 4:00 PM: instructor/TA unresolved-review annotation cutoff.

The worker performs a bounded Sheet read immediately before the 9:25, 10:45, and 3:15 evaluations because same-day timestamps may arrive through the Sheet. After same-day downtime, overdue evaluations run on restart. Learner messages that became stale after day close are not sent and are routed to staff review.

## Reconciliation and authority

- Pull check-in and exit timestamps from the configured Sheet into Postgres when the corresponding Postgres first-submission timestamp is missing.
- Once stored, an original first-submission timestamp is immutable.
- A later staff correction in the Sheet updates the authoritative attendance state and produces an audit transition without rewriting the original submission timestamp.
- Blank Sheet values do not delete Postgres history.
- Sheet values win attendance-state conflicts. Retry a conflicting operation three times, then create one human-review item.
- Phase 3 Sheet writes remain limited to separately authorized configured cells and are disabled until a bounded non-production activation gate is approved.

## Outreach behavior

- Learner contact uses the preferred approved channel first. Use the other approved channel only after a permanent delivery failure.
- Slack learner messages are private bot DMs resolved through an admin-previewed mapping from provisioned company email to stable Slack member ID.
- A no-call/no-show also creates the approved Program Director email escalation and one staff-channel call task.
- The first eligible staff member to claim a call task in LiftOff becomes the owner. Admins may reassign it.
- A staff-authored configured reaction or thread reply stops unclaimed reminders but does not close the incident. The contact outcome must still be recorded in LiftOff.
- Unclaimed reminders occur three times, one hour apart. After the first hour, prepare the configured team email. After the third reminder, retain the incident on the unresolved dashboard.
- Provider operations are independent. Retry each failed provider operation three times with bounded backoff; never substitute an unapproved channel.

## Templates and personalization

- Initial templates: late, no-call/no-show, exit reminder, team call task, unclaimed escalation, synchronization failure, attendance warning, and attendance concern.
- Templates move from `draft` to `approved`. Approved versions are immutable; editing creates a new draft. Automation continues using the last approved version.
- Admins and facilitators may edit and approve. Other staff have read-only access.
- Messages are concise, supportive, and non-disciplinary. They state the missed action, relevant time, next step, and support path. They do not mention payment consequences.
- Beacon and LLM personalization are excluded from this Phase 3 slice.

## Calendar, pause, correction, and emergency controls

- Preload United States federal holidays. Admins may add or remove cohort blackout dates with a required reason.
- Facilitators may pause a learner or cohort for up to seven calendar days. Longer or open-ended pauses require admin approval.
- Pauses record scope, reason, start, end, and actor. Suppressed actions are audited.
- Do not send accumulated messages after a pause. Re-evaluate only the current state; older incidents go to staff review.
- Instructors/TAs enter authoritative corrections in the Sheet and may request an immediate bounded reconciliation.
- Admins and facilitators may preview and resend failed messages. Resending a successful message requires an admin override and written reason.
- Admins may immediately change a cohort from `active` to `dry_run` or `disabled`. Stop claiming new work. Accepted provider requests cannot be recalled, and Sheet changes are never automatically rolled back.

## Dashboard, reports, baseline, and archival

- At 3:15 PM, expose unresolved incidents to assigned instructors/TAs.
- By 4:00 PM, require owner, status, action taken, disposition, optional follow-up date, and closure note.
- Generate the biweekly report every other Friday at 3:30 PM Eastern, or on the preceding active day when Friday is a blackout.
- Reports include attendance, punctuality, exit completion, warnings/concerns, exclusions, corrections, and trend context.
- Admins see configured cohorts; staff see assigned cohorts. CSV exports exclude form responses, support text, accommodation details, and message bodies.
- Collect two weeks of baseline staff measurements: outreach-coordination minutes, incidents handled, and unresolved items.
- Require five complete active dry-run days and at least one formal staff review before activation. An admin may record an approved exception, but never below one complete day.
- Cohort-end incident archival is transactional and reversible. Three years later, create an administrator review reminder. Permanent deletion remains disabled.

## Safety and activation gates

- Provider credentials and recipient/channel identifiers remain outside the worktree and are environment-specific.
- Verify signed Slack and Resend webhooks and deduplicate provider event IDs.
- Store delivery metadata and bounded error codes, not raw provider payloads or message content in operational logs.
- Dry-run displays the planned trigger, learner reference, channel, template/version, recipient category, and proposed Sheet-cell change without external effects.
- Production activation requires clean column-D identity validation, real Google OAuth verification, provider integration validation, privacy/compliance review, five dry-run days or an approved exception, and explicit deployment/activation authorization.

## Acceptance criteria

- Exact-time transitions are DST-safe and active-day aware.
- Restart catch-up never sends stale after-day learner outreach.
- Concurrent workers create zero duplicate incidents, outreach attempts, reminders, dashboard entries, or Sheet operations.
- Pauses and blackouts suppress actions without later message backfill.
- Original event timestamps remain immutable while authoritative corrections remain auditable.
- Provider retries are bounded and independent; exhausted failures create one human-review item.
- Only approved immutable template versions can enter active delivery.
- Role and cohort boundaries apply to every read, control, claim, correction request, report, and export.
- Dry-run produces the same planned operations as active mode without provider or Sheet writes.
- Local verification uses sanitized fakes and performs no real message or live Sheet write.

## Implementation progress

### 2026-07-15: Durable local worker and controls

Completed:

- Added the Phase 3 persistence model and applied its migration only to local PostgreSQL.
- Added exact DST-safe daily job planning, deterministic job keys, conditional claims, stale-claim recovery, bounded retry scheduling, pause/blackout suppression, stale-outreach review, and dry-run audit planning.
- Added a separately bundled worker artifact and pinned Compose worker profile with a read-only filesystem, file-mounted database secret, tmpfs heartbeat, and active provider effects disabled.
- Added cohort-scoped automation controls for disabled/dry-run modes, fail-closed active mode, immutable template approval, new template versions, blackout dates, and audited pause limits.
- Added eight sanitized template drafts to the local seed.
- Verified the automation workspace, dry-run/disable controls, disabled-cohort job suppression, and worker heartbeat locally.
- `pnpm verify` passed with 8 test files and 41 tests; web and worker builds completed with zero Svelte/TypeScript diagnostics. The worker Compose profile validated successfully.

External activation gates still required:

- Correct and revalidate all bounded column-D identities.
- Complete real Google Workspace sign-in, Slack/Resend non-production provider validation, privacy/compliance review, and five actual staff-reviewed dry-run days or the approved exception path.
- Obtain separate authorization for provider configuration, non-production canaries, deployment, production migration, live Sheet writes, and active external messages.

### 2026-07-15: Reconciliation and provider safety slice

Completed:

- Added a bounded Sheet record reconciliation planner and persistence service. Missing timestamps may initialize Postgres submissions, existing first timestamps remain immutable, blank Sheet cells do not delete history, approved corrections update attendance state, and invalid values create bounded human-review metadata.
- Added idempotent sanitized learner-message and staff-call-task fakes with explicit permanent/retryable failure metadata.
- Added raw-body Slack and Resend/Svix signature verification with five-minute replay protection, constant-time comparison, provider event deduplication, bounded delivery status updates, and fail-closed webhook endpoints.
- Corrected the Docker build so Prisma Client is generated before SvelteKit analysis and preserved while development dependencies are pruned.
- `pnpm verify` passed with 10 test files and 48 tests. Worker Compose validation, the final runtime image build, and a no-secret Prisma runtime import smoke test passed.

Safety boundary:

- The reconciliation service is wired only through optional external read-only configuration; no live adapter or provider secret was configured. No webhook was registered, no real message was sent, and no Sheet write, deployment, or production migration occurred.

### 2026-07-15: Local implementation completion

Completed:

- Wired the worker to an optional external read-only Sheet mapping and ADC adapter. Missing configuration fails closed; dry-run records the proposed read and never imports or writes Sheet data.
- Added detailed deterministic dry-run operation previews with learner reference, trigger, preferred channel, recipient category, approved template version, team task/escalation flags, and proposed Sheet change.
- Added typed Slack and Resend HTTP adapters with bounded approved content, provider idempotency, permanent/retryable failure classification, and injected fake-HTTP tests. External execution remains gated off.
- Added staff-authorized Slack reaction/thread acknowledgment handling, provider event deduplication, three hourly unclaimed reminder plans, first-hour team email evidence, and third-reminder dashboard evidence.
- Added the federal holiday calendar and biweekly Friday 3:30 PM report scheduling with preceding-active-day selection, plus cohort-scoped CSV exports that exclude form/support/accommodation/message content.
- Completed the automation workspace for mapping readiness, unresolved annotations, baseline entry, dry-run review, activation evidence, bounded reconciliation requests, guarded resend previews, and reversible cohort incident archive/restore.
- Sanitized authenticated FDE smoke testing passed for the automation workspace. No production or provider state changed.

Assessment: Module 3 is complete for local development and sanitized testing. Production activation is a separate gated rollout, not unfinished application implementation.
