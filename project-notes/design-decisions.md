# Attendance automation discovery and design decisions

Status: Approved requirements and design baseline  
Recorded: 2026-07-14  
Scope: LiftOff Program Cohort 3 MVP

## Record conventions

- Questions and answers are normalized for clarity rather than presented as a word-for-word transcript.
- Answers that were refined later remain in the interview history and are marked as superseded where appropriate.
- `Approved` means the product owner agreed to the design recommendation. It does not mean an external integration, legal requirement, or production control has been validated.
- The attendance-sheet snapshot was used only to identify its structure. Learner names, email addresses, IDs, links, notes, and other identifying values are intentionally excluded from this record.

## Discovery interview

### Round 1: People, workflow, and incidents

**Question:** Who records attendance, handles follow-up, and is included in the initial release?  
**Answer:** The instructor records attendance and handles follow-up. The initial release covers LiftOff Program Cohort 3.

**Question:** What is the official attendance record and current outreach process?  
**Answer:** Google Sheets is the official attendance record. Learners currently send a Slack message when late. For an absence, staff use Slack, email, and a phone call.

**Question:** Which incidents must be distinguished, and what should each trigger?  
**Answer:** The initial incidents are late, no-call/no-show, and repeated low attendance. Late triggers learner Slack/email outreach and a team Slack task for someone to claim the call. No-call/no-show uses the same flow and adds an email with the Program Director copied. A report of learners with repeated low attendance is sent to the instructor every two weeks.

### Round 2: Initial thresholds, sheet structure, and ownership

**Question:** When do late, no-call/no-show, and repeated low attendance begin?  
**Answer:** Late begins 10 minutes after the timing anchor. No-call/no-show begins 90 minutes after it. Low attendance was initially described as 70%–75% over two weeks; this was superseded in Round 3.

**Question:** How is attendance represented, and should detection be immediate or scheduled?  
**Answer:** The supplied sheet contains program settings, expected start/end times, a learner roster, attendance notes, and date-based check-in/check-out columns. Automation should run on a schedule.

**Question:** Who may claim a call task, and how is the Slack reminder closed?  
**Answer:** Any configured team member may claim it. A thumbs-up, other reaction, or comment closes the Slack reminder; the detailed outcome is recorded separately.

### Round 3: Deterministic status rules

**Question:** Should the late and no-call/no-show checks run at the configured offsets, and should late transition to no-call/no-show?  
**Answer:** Yes. An unresolved late incident transitions to no-call/no-show. Learners may ask staff to correct attendance issues.

**Question:** What are the final low-attendance thresholds?  
**Answer:** Below 80% is a warning and below 75% is a concern. Excused absences do not affect attendance percentage.

**Question:** How many team reminders occur, and what closes the reminder loop?  
**Answer:** Repeat the reminder three times. A Slack reaction or comment may close the reminder loop because the incident form will contain the actual contact log.

### Round 4: Incident records and communication behavior

**Question:** What happens after three unclaimed reminders?  
**Answer:** Add the unclaimed incident to a custom daily dashboard.

**Question:** Where should the incident form and history live?  
**Answer:** Use Postgres and a custom application form, with Google Sheets API access where useful. Selected incident outcomes must also be written to the attendance sheet.

**Question:** Which channels and scheduling constraints apply?  
**Answer:** Late outreach starts with Slack/email and a human call task. National holidays must be configurable, learner preferred channels must be configurable, and an LLM may personalize an approved message using the learner's record.

### Round 5: Record authority, escalation timing, and LLM approval

**Question:** Which system wins a conflict, and how does synchronization operate?  
**Answer:** Google Sheets remains authoritative for attendance because staff may correct it. Updates may flow both ways. Retry a conflict three times, then notify a human agent.

**Question:** What is the reminder cadence and operational owner?  
**Answer:** Reminders occur one hour apart. The primary instructor or TA owns the daily unresolved dashboard. After the first hour, email the configurable whole-team group through Resend.

**Question:** Can LLM-personalized messages send automatically?  
**Answer:** Staff first approve the template; approved templates may then send automatically. Personalization may include missing current/prior-week assignments, upcoming assignments, current attendance percentage, the applicable threshold, and upcoming payment requirements tied to attendance or on-time assignment submission.

### Round 6: External data, permissions, retention, and forms

**Question:** What are the assignment and payment sources, and which details may appear in learner messages?  
**Answer:** The attendance sheet and `beaconlearning.me` are the sources. Messages may contain upcoming payment information and its attendance requirement, missing assignments from the current or previous week, and upcoming assignments. No staff-only message context is currently required.

**Question:** Who can change templates, how long are records retained, and how is the dashboard cleared?  
**Answer:** Admins and facilitators may edit templates; other roles have read-only template access. At cohort completion, move active incidents to an archive table and clear the active table. After three years, prompt administrators to consider permanent deletion. The instructor or TA clears the daily dashboard through sheet synchronization or team follow-up and annotates the closure.

**Question:** What is the daily learner workflow, and who may pause it?  
**Answer:** A daily recap/goals form is used as morning attendance; learners describe what they will work on. Missing the form drives late and no-call/no-show rules. Admins or facilitators may pause automation for holidays or individual circumstances. The MVP includes a learner reasonable-accommodation request form.

### Round 7: Final trigger, exit ticket, and measurement decisions

**Question:** Is 9:15 AM the form-release time or should the form be available before 9:00 AM?  
**Answer:** Use 9:15 AM as the form release and timing anchor. Therefore, late detection runs at 9:25 AM and no-call/no-show detection at 10:45 AM.

**Question:** Is checkout part of the MVP?  
**Answer:** Add a 2:45 PM exit ticket to the MVP.

**Question:** Which MVP outcomes should the dashboard measure?  
**Answer:** Track instructor outreach time, outreach completion speed, and automatic detection/logging so the program can increase in-class training time and reduce instructor friction.

### Definition-sprint recommendation approval

**Question:** Should the project adopt the proposed exit-ticket behavior, attendance formula, Vercel/DO hosting split, operating-calendar and accommodation ownership, and provisional success targets?  
**Answer:** Yes; proceed with the recommended defaults. The resulting decisions are recorded below and in [phase-2.md](./phase-2.md).

## Annotated design decisions

### DD-001: MVP boundary and operating owner

**Status:** Approved  
**Decision:** Build first for LiftOff Program Cohort 3. The instructor remains accountable for attendance; the instructor or TA owns daily unresolved review, while the outreach/support team may claim calls.  
**Rationale:** A single cohort limits integration and policy variance while targeting the current manual burden.  
**Consequences:** Multi-cohort configuration and organization-wide rollout remain outside the MVP. Actual staff identities and groups must be mapped during integration.

### DD-002: Attendance and incident sources of truth

**Status:** Approved  
**Decision:** Google Sheets is authoritative for attendance and staff corrections. Postgres is authoritative for the complete incident, outreach, synchronization, and audit history. Selected outcomes are written back to configured Sheet cells.  
**Rationale:** Staff already maintain the sheet, while incident automation requires normalized, queryable, auditable state.  
**Consequences:** Synchronization must be bidirectional, cell-scoped, idempotent, and correction-aware. Sheet attendance values win conflicts.

### DD-003: Synchronization conflict policy

**Status:** Approved  
**Decision:** Retry a synchronization conflict up to three times. If it remains unresolved, preserve both values and attempt history, accept the Sheet attendance value, and notify a human.  
**Rationale:** Temporary API/version conflicts should recover without losing deliberate staff changes.  
**Consequences:** Retries need idempotency keys and must never duplicate incidents, messages, dashboard entries, or sheet writes.

### DD-004: Morning attendance state machine

**Status:** Approved  
**Decision:** Release the goals/check-in form at 9:15 AM. A valid submission by 9:25 is `on_time`; a later submission before 10:45 is `late`; no valid submission at 10:45 transitions the same incident to `no_call_no_show`. Staff correction produces a `corrected` audit transition rather than deleting history.  
**Rationale:** The goals form provides a useful headcount and learning-planning signal while scheduled transitions make outreach deterministic.  
**Consequences:** The scheduler uses `America/New_York`, configured active program days, holidays, pauses, and accommodations.

### DD-005: Attendance, punctuality, and completion calculations

**Status:** Approved  
**Decision:** Attendance is on-time plus late eligible sessions divided by eligible sessions. Exclude holidays, approved accommodations, and excused absences. Track punctuality and exit-ticket completion separately. Attendance from 75% through 79.99% is a warning; below 75% is a concern, which takes precedence.  
**Rationale:** Separating presence, punctuality, and completion avoids treating a late or incomplete administrative action as an absence without review.  
**Consequences:** The biweekly report and dashboard expose all three measures and their denominators.

### DD-006: Exit-ticket behavior

**Status:** Approved  
**Decision:** Release the exit ticket at 2:45 PM and send one reminder at 3:00 PM. At the end of the program day, a missing ticket becomes or updates one `incomplete_day` incident. Staff resolve it as completed late, technical issue, approved early departure, accommodation, or unresolved.  
**Rationale:** Missing an exit ticket does not prove absence or early departure. Human review prevents an unsupported attendance or payment consequence.  
**Consequences:** During the MVP, it does not automatically change attendance, escalate to the Program Director, or impose payment consequences.

### DD-007: Outreach and escalation workflow

**Status:** Approved  
**Decision:** Late sends an approved learner Slack message, approved email, and team Slack call task. No-call/no-show performs the same actions and adds a Program Director CC email. Unclaimed tasks receive three reminders one hour apart; after one hour the configured team is emailed through Resend, and after the third reminder the incident enters the daily unresolved dashboard.  
**Rationale:** Automation handles repetitive coordination while calls and ambiguous outcomes remain human work.  
**Consequences:** Any Slack reaction/comment closes the reminder loop, but only the incident form records the contact outcome and operational closure.

### DD-008: Message templates and LLM personalization

**Status:** Approved with pre-production validation  
**Decision:** Admins or facilitators approve templates before automation. The LLM may personalize an approved template only with configured records for the intended learner: attendance percentage/threshold, missing current/prior-week assignments, upcoming assignments, and upcoming payment requirements.  
**Rationale:** Personalization can make outreach useful without allowing unconstrained automated decisions or invented facts.  
**Consequences:** Log template version, allowed inputs, generated content, recipient, channel, and result. Missing data is omitted or routed for staff review. Cross-learner context, disciplinary conclusions, and automated payment/accommodation decisions are prohibited.

### DD-009: Calendar, channels, and accommodation controls

**Status:** Approved; Gate 7 compliance review completed 2026-07-20
**Decision:** Use `America/New_York`, the United States federal holiday calendar, and admin-configured blackout dates. MVP channels are program-provided Slack/email and human calls; SMS and automated calling are excluded. Facilitators may apply audited temporary pauses, while admins approve continuing accommodations or lasting rule changes.  
**Rationale:** A configurable calendar and pause mechanism prevents inappropriate outreach and supports reasonable learner circumstances.  
**Consequences:** Learner consent, contact hours, privacy duties, and jurisdiction-specific requirements must be confirmed before production. Accommodation requests do not change rules until authorized.

### DD-010: Access and retention

**Status:** Approved; Gate 7 policy validation completed 2026-07-20
**Decision:** Admins and facilitators may edit templates; other users have read-only template access. At cohort completion, transactionally archive active incident records and clear the active table. Three years later, prompt admins to review permanent deletion; never delete automatically.  
**Rationale:** Operational data stays manageable while audit history is retained for an agreed review period.  
**Consequences:** Preserve identifiers and relationships during archival. Access, archive, review, holds, and deletion decisions require audit records and applicable-policy validation.

### DD-011: Dashboard and provisional success measures

**Status:** Approved as provisional  
**Decision:** Collect a two-week baseline, then assess: 95% automatic incident detection/logging, automated outreach within five minutes, 90% sync without human intervention, zero retry duplicates, 80% call claims within one hour, 95% same-day dashboard annotation, 50% reduction in instructor outreach coordination time, and zero cross-learner or unapproved-LLM disclosures.  
**Rationale:** The MVP must demonstrate recovered instructional time and reliable follow-up, not merely ship features.  
**Consequences:** Targets may be revised after baseline collection, with the original baseline and rationale retained.

### DD-012: Deployment and reproducibility

**Status:** Approved target; implementation pending  
**Decision:** Deploy the SvelteKit frontend to Vercel. Keep AWS/DO Docker Compose portability as a separately approved fallback. Deploy Hermes only to DigitalOcean through its pinned Compose service. Use pinned Nix inputs, dependency lockfiles, immutable images/artifacts, GitHub environment gates, and secret-safe configuration.  
**Rationale:** Vercel fits the managed frontend while Hermes requires the persistent DigitalOcean environment; pinned repository-owned tooling preserves reproducibility.  
**Consequences:** Preview/UAT/Production gates must mirror the target platform, and Production promotes the UAT-tested artifact rather than rebuilding it.

## Open validation register

These items are not unresolved product decisions; they are evidence still required before implementation or production:

- Validate the Cohort 3 Sheet ranges, protected cells, form links, identifiers, formulas, and API behavior using sanitized/non-production data.
- Validate `beaconlearning.me` assignment/payment access and stable learner mapping.
- Validate Slack app scopes, student identity mapping, event delivery, reactions/comments, and team/Program Director groups.
- Validate Resend domain, sender, recipient groups, environment separation, and delivery events.
- Publish and validate the approved privacy notice and communication-preference enforcement in the deployed release candidate before Gate 10.
- Map logical roles to actual identity-provider users and groups.
- Collect the two-week operational baseline and review provisional numeric targets.
- Verify integration failure, retry, reconciliation, monitoring, and rollback behavior in UAT.

### DD-013: Module 2 identity, forms, and synchronization boundary

**Status:** Approved 2026-07-15  
**Decision:** Authenticate production users with verified Google Workspace identities from `launchpadphilly.org`, then require a separately provisioned active account with cohort-scoped roles. Hidden attendance-sheet column D is the authoritative learner email mapping and synchronization fails closed unless all 26 bounded learner rows contain unique normalized company emails. Morning goals, exit tickets, revisions, support items, accommodations, incident outcomes, and audit history persist in Postgres. Module 2 creates pending idempotent synchronization operations but performs no live Sheet writes; activation is a separately authorized Module 3 gate.  
**Rationale:** Workspace authentication proves identity while provisioning controls authorization. Deferring provider writes preserves the validated safety boundary until the roster mapping is clean and scheduler behavior is reviewed.  
**Consequences:** The current sanitized workbook has 22 company-domain matches across 26 rows and only 23 unique normalized values; staff must correct column D before synchronization can activate. Development uses `example.test` identities only, and the selector is unavailable outside development.

### DD-014: Session catalog and staff learner preview

**Status:** Approved requirements implemented 2026-07-15  
**Decision:** Derive the 42 program-session dates from date-formatted cells in the configured copied Sheet header, store only stable group IDs and ISO dates in an owner-only external catalog, and require an admin preview plus atomic confirmation before changing Postgres. Staff may inspect a separate read-only learner-perspective sample, but it never loads a specific learner's records.  
**Rationale:** Sheet-derived dates preserve the approved operational source while preview/confirmation prevents silent schedule changes. A record-free sample gives facilitators the learner perspective without cross-learner disclosure.  
**Consequences:** Catalog generation is read-only and fails unless every configured group has exactly one unique date. Confirmation changes Postgres only. Live Sheet writes and automated scheduling remain Module 3 work.

### DD-015: Phase 3 durable worker and activation boundary

**Status:** Approved 2026-07-15  
**Decision:** Run authoritative scheduling and synchronization in a dedicated LiftOff TypeScript worker under pinned Docker Compose, not n8n. Use durable idempotent jobs and cohort modes `disabled`, `dry_run`, and `active`. Evaluate attendance at the approved exact times, reconcile the Sheet at 11:00 AM and 3:15 PM, and use bounded pre-trigger reads when same-day Sheet submissions are possible.  
**Rationale:** The project already contains the typed attendance rules, adapters, Prisma model, and tests. Keeping authoritative workflow logic in the same codebase avoids duplicating policy in a second workflow runtime while preserving restart recovery and testability.  
**Consequences:** n8n may be evaluated later for non-authoritative operational workflows only. No production deployment, provider activation, real message, or live Sheet write is authorized by this decision.

### DD-016: Learner automated-communications choice

**Status:** Approved and implemented locally 2026-07-20; migration and deployment pending
**Decision:** Cohort 3 learners may stop or resume automated attendance email, automated Slack messages, or both through an authenticated form. Suppression takes effect when recorded, is rechecked immediately before provider contact, does not change attendance records, and does not suppress necessary human staff follow-up or internal staff workflows. Automated learner email includes a stable authenticated preference-management link without a bearer token or learner identifier in the URL. An administrator may record an equivalent learner request and may correct a preference only with a reason and audit event.
**Rationale:** Communication choice should be easy to exercise without weakening attendance authority, requiring sensitive explanations, or conflating automated outreach with human program support.
**Consequences:** Add durable per-channel preference storage, learner self-service, worker pre-send enforcement, email-template links, admin correction auditing, and sanitized acceptance tests before active learner outreach. Suppressed messages are not failures and are never backfilled after resumption. The Gate 7 learner notice is approved. Gate 10 requires the committed migration, published notice, and deployed exact pre-send enforcement proof before active outreach.
