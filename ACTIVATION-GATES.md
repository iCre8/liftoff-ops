# Activation gates: from local-complete to Cohort 3 production

Recorded: 2026-07-18
Owner: Rob (product owner and gate authorizer)
Scope: LiftOff Program Cohort 3

The application code for Milestones 0–4 is complete and verified locally (53 sanitized tests, zero diagnostics, web and worker builds, validated Compose profiles). Nothing else in the codebase blocks the pilot. What remains is a series of **external activation gates**: real identities, real credentials, real infrastructure, and recorded human authorization. Every gate below exists because the system is designed to **fail closed** — missing configuration disables a capability rather than degrading it — so clearing a gate means supplying verified configuration, not editing code.

This document walks through each gate in dependency order: what it is, why it exists, the exact steps to clear it, and how to verify it without exposing a secret.

## Target timeline

| Date                    | Milestone                                                                |
| ----------------------- | ------------------------------------------------------------------------ |
| Sat Jul 18 – Wed Jul 22 | Clear Gates 1–4 (Sheet identities, OAuth client, Neon, hosting)          |
| Thu Jul 23              | Deploy UAT, run end-to-end verification                                  |
| **Fri Jul 24**          | **Pilot: first full dry-run day (staff-visible, zero external effects)** |
| Aug                     | Clear Gates 5–7 (Slack, Resend, compliance) at low urgency               |
| Mon Sep 7               | Labor Day — a preloaded federal holiday, therefore a blackout day        |
| Tue Sep 8 – Mon Sep 14  | Five complete dry-run days against the live cohort                       |
| ~Tue Sep 15             | Staff review, go/no-go, switch cohort to `active`                        |

Note the holiday: the cohort nominally starts September 7, but that is Labor Day and the scheduler will treat it as a blackout. Plan the first active program day for Tuesday September 8. If a week of dry-run against the live cohort is unacceptable, an admin may record an approved exception, but never below one complete dry-run day.

The Jul 24 pilot uses the **sanitized copied workbook and seeded cohort in `dry_run` mode**. It rehearses the full stack and produces staff-review evidence, but the five formal dry-run days must run against the real Cohort 3 workbook once the cohort exists.

## Three things worth your attention

1. **September 7 is Labor Day.** The cohort's nominal start date is a preloaded federal-holiday blackout. The first active program day is Tuesday September 8, so the five dry-run days land September 8–14 and activation lands ~September 15 unless the admin-exception path (minimum one complete day) is recorded.
2. **The July 24 pilot should run the worker locally.** Web app on Vercel UAT for staff visibility, worker on the development workstation in `dry_run` mode with local ADC and the sanitized workbook. Dry-run performs no external effects either way, so this defers the production credential decision without weakening the pilot. Only Gates 1–3 plus the Vercel half of Gate 4 truly block Friday.
3. **One open decision — production Google Sheets credentials for the worker** (detailed in Gate 4). ADC impersonation is development-only and the DigitalOcean droplet has no Workload Identity Federation path. Recommended: a dedicated service account with a JSON key scoped to only the Sheets API and only the Cohort 3 workbook, stored as an owner-only `0600` mounted file with recorded quarterly rotation, as a documented exception to the no-key rule. Decide before September 8; it does not block the pilot.

## Housekeeping log

- 2026-07-18: The stray GitHub SSH connectivity note was removed from `project-notes/design-decisions.md`; the command now lives in Gate 4 where it is actually used.
- 2026-07-18: The unrelated "Deterministic Agentic Fleet" infrastructure plan (`dev-config.md` and its diagram) moved out of `project-notes/` to `~/engineering-projects/agentic-fleet-plan/`. It is a separate initiative and is no longer part of this repository.
- 2026-07-18: Corrected `ENABLE_SANITIZED_DEV_AUTH` from `true` to `false` in `.env.uat` and `.env.production` — it must never be enabled in a deployed environment (Gate 2) and was found enabled in both during Gate 4 setup.
- 2026-07-18: Recorded architecture decision — no dedicated Neon UAT branch; local/dev database doubles as UAT (Gate 3). Production remains a separate branch.
- 2026-07-18: Recorded real Cohort 3 workbook learner row range (D10:D23) in Gate 1, distinct from the sanitized dev workbook's D9:D34, plus the roster-growth procedure via the mapping file's `dataEndRow`.
- 2026-07-18: A Neon database password was inadvertently printed in cleartext during a verification command in an assistant session. Flagged for rotation in the Neon console; treat the `neondb_owner` credential on the dev/UAT branch as compromised until rotated.
- 2026-07-19: Corrected the local worksheet target from the 34-row expanded development tab to the unique 23-row Cohort 3 tab shown by the owner. Gate 1 validation now derives the email boundary from the private inventory independently of full session/outcome mapping.
- 2026-07-19: Configured owner-only pooled runtime and direct migration secrets for dev/UAT and production with full TLS verification. Applied all three committed migrations to the separately verified production database and cleared Gate 3.
- 2026-07-19: Cleared the GitHub/Vercel half of Gate 4. Clean CI now generates Prisma Client before analysis, the pinned Nix container trusts only its read-only mounted workspace, Vercel Git deployments are disabled for every branch, and the GitHub-gated protected UAT deployment returns a healthy response.
- 2026-07-19: Sharing the configured workbook with the owner's personal Google account did not grant the dedicated UAT service account access. The bounded service-account check still receives access denied; the exact service-account address remains the required Viewer principal.
- 2026-07-19: Scoped the corporate OAuth client ID, sensitive client secret, exact stable redirect URI, and initial administrator to Vercel Preview only; Production remains empty. A fresh gated deployment passed and the OAuth initiation route returned the expected redirect without exposing configuration values.

- 2026-07-19: The shared dev/UAT database's three sanitized seed accounts correctly blocked empty-database initial-admin bootstrap. An approved UAT-only command created one active corporate account and global admin role atomically; a second apply was a no-op and logged no identifying value.
- 2026-07-19: Corporate Google Workspace sign-in succeeded through the stable protected UAT alias. Count-only database verification confirmed one linked corporate identity, one completed sign-in, and one active session without logging identity or token values.
- 2026-07-20: The exact copied dev/UAT workbook granted the dedicated UAT service account Viewer access. A bounded read-only proof succeeded without requesting cell values or printing workbook identifiers. The refreshed GitHub UAT Vercel credential also recovered the gated deployment and restored the stable alias.
- 2026-07-20: Replaced the empty sanitized UAT roster with the approved 14-row D10:D23 company-email roster in one fail-closed transaction. The cohort is named Cohort 3, remains disabled, preserves eight template drafts, and contains no development session. Count-only verification found 14 Neon learners, 14 Slack directory matches, zero prewritten Slack mappings, and one audit event.
- 2026-07-20: Cleared Gate 5. The protected Slack webhook, exact 14-learner mapping, one staff-only canary, real reaction/thread events, duplicate suppression, and tampered/stale rejection all passed with automation disabled and zero learner outreach.
- 2026-07-20: Gate 6 UAT configuration reached the hosted-deployment boundary. Corrected the owner-only webhook-secret filename, tightened all four Resend files to mode `0600`, verified public DKIM/SPF/return-path DNS for `uat-mail.liftofflearning.tech`, passed the no-contact two-staff allowlist preflight, and added only the Sensitive branch-scoped webhook secret to Vercel Preview `uat`. No email was sent.

## Gate status checklist

- [x] Gate 1 — Column D learner identities corrected and validated
- [x] Gate 2 — Google Workspace OAuth client created; real organization sign-in verified
- [x] Gate 3 — Neon production database branch and migration authorization
- [x] Gate 4 — Hosting: Vercel web app + worker runtime, GitHub environments
- [x] Gate 5 — Slack non-production validation
- [ ] Gate 6 — Resend non-production validation
- [ ] Gate 7 — Privacy and compliance review recorded
- [ ] Gate 8 — Dry-run evidence: five complete days + formal staff review
- [ ] Gate 9 — Live Sheet-write canary on the production workbook
- [ ] Gate 10 — Written go/no-go activation authorization

---

## Gate 1 — Column D learner identity validation [CLEARED]

**Why this gate exists.** Hidden column D of the attendance tab maps each Sheet row to a provisioned `@launchpadphilly.org` account. The system never fuzzy-matches or infers a learner identity, because a wrong guess would route one learner's attendance data or outreach to another learner.

**Steps.**

1. Run the bounded workbook inventory against the intended worksheet.
2. Require exactly one recognized email header; derive the contiguous learner boundary beneath it.
3. Confirm every derived learner row is populated with a unique, normalized company-domain email.
4. Re-run inventory and validation whenever the roster grows.

**Verification** (metadata and counts only; never prints an address):

```sh
nix --extra-experimental-features 'nix-command flakes' develop
pnpm google:sheets:inventory
pnpm google:sheets:validate-identifiers
```

**Cleared 2026-07-19.** The uniquely resolved Cohort 3 worksheet has its email header at D8, a blank metadata row at D9, and 14 contiguous learner rows at **D10:D23**. Count-only validation reported 14 configured, 14 returned, 14 company-domain, 14 unique, and 14 already normalized values. No learner value, worksheet title, or provider identifier was logged.

Identity validation derives its boundary from the owner-only inventory file and does not depend on the full attendance session/outcome mapping. If the roster grows, append learners contiguously below D23, then rerun inventory and validation. Full session/outcome mapping and the live write canary remain separately required by Gate 9.

**Unblocks:** learner identity readiness, learner form attribution, and downstream outreach identity mapping.

---

## Gate 2 — Google Workspace OAuth client and real sign-in [CLEARED]

**Why this gate exists.** Staff and learner sign-in uses the Google OpenID Connect authorization-code flow with PKCE, one-time state/nonce, verified signed ID tokens, and a provisioned-account check. The code is complete and contract-tested, but no real OAuth client has ever been created, so no organization account has ever signed in. Production authentication fails closed until `GOOGLE_OAUTH_CLIENT_ID`, the client secret, and the redirect URI are configured. The sanitized `example.test` login path exists only when `ENABLE_SANITIZED_DEV_AUTH=true` in a development build and must never be enabled in a deployed environment.

**Steps.**

1. In the organization-owned Google Cloud project: **APIs & Services → OAuth consent screen**. Set user type **Internal** (restricts the client to `launchpadphilly.org` accounts at Google's layer, before the app's own `hd`-claim and provisioning checks).
2. **APIs & Services → Credentials → Create credentials → OAuth client ID → Web application.**
3. Add authorized redirect URIs for each environment, path `/auth/google/callback`:
   - `http://127.0.0.1:5173/auth/google/callback` (local)
   - `https://<uat-domain>/auth/google/callback`
   - `https://<production-domain>/auth/google/callback`
4. Store the client secret outside the worktree (Vercel encrypted env var per environment; owner-only `0600` file for local/worker use via `GOOGLE_OAUTH_CLIENT_SECRET_FILE`). Every secret in this project accepts either `<NAME>` directly or `<NAME>_FILE` pointing at a mounted file.
5. Configure `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET_FILE` (or `GOOGLE_OAUTH_CLIENT_SECRET` on Vercel), `GOOGLE_OAUTH_REDIRECT_URI`, and `INITIAL_ADMIN_EMAIL` (your admin account; the initial admin is created only while the account table is empty and only on an exact verified-email match).
6. Sign in with your real organization account and confirm the admin workspace loads.

**Verification.** A successful login, an `AuthSession` row storing only a SHA-256 token hash, and an eight-hour expiry. Confirm a personal Gmail account is rejected.

**Recovery.** If the secret is ever exposed: rotate the client secret in the console, replace the stored copies, and revoke active `AuthSession` rows.

**Unblocks:** every deployed environment; the Jul 24 pilot requires it.

---

## Gate 3 — Neon production database and migration authorization [CLEARED]

**Why this gate exists.** The ledger forbids applying a migration without first confirming the target branch, because Postgres is the durable incident, outreach, and audit store — a migration applied to the wrong branch is unrecoverable history damage. The decision (2026-07-18) is Neon for both app and worker in production, avoiding a stateful database on the droplet.

**Architecture decision (recorded 2026-07-18, Rob).** No dedicated Neon UAT branch will be created. The existing development branch/database doubles as the UAT database — Vercel's UAT deployment points at the same Neon connection string as local development. This still satisfies the gate's core safety property: **production remains a fully separate Neon branch and must never share a database with dev/UAT.** `.env.uat`'s `DATABASE_URL` intentionally matches `.env`'s for this reason — it is not a misconfiguration.

**Steps.**

1. ~~In Neon, create a dedicated UAT branch, separate from development.~~ Superseded by the decision above — skip.
2. **Complete:** confirm the **production** branch/database is dedicated and separate from development. A secret-safe comparison verified distinct runtime targets and credentials.
3. **Complete:** each environment uses owner-only external secret files for both URLs, each with `sslmode=verify-full` and required channel binding:
   - pooled `DATABASE_URL` for app/worker runtime;
   - non-pooled `DIRECT_DATABASE_URL` for schema operations only.
     Secret-safe validation confirmed that each pooled/direct pair targets the same database, production remains distinct from dev/UAT, and all environment and secret files are mode `0600`.
4. **Complete (read-only, 2026-07-19):** check migration state before applying anything:

   ```sh
   npx prisma migrate status
   ```

   Sanitized pre-deployment results through direct connections: dev/UAT found three migrations and was up to date; production found the same three migrations pending.

5. **Complete (explicitly authorized, 2026-07-19):** apply the already-verified artifact to production through its direct connection:

   ```sh
   npx prisma migrate deploy
   ```

**Verification.** `prisma migrate deploy` applied all three committed migrations to production without error. Independent post-deployment `prisma migrate status` checks through each environment's direct connection found three migrations, no pending migration, and an up-to-date schema on both dev/UAT and production. Gate status confidence: **100%**.

**Recovery.** Never substitute a production URL into a development environment or seed script. `pnpm dev:seed` is local-only. If the wrong branch is touched, stop and restore from Neon's branch history before continuing.

**Unblocks:** any deployed environment with persistence — required for the Jul 24 pilot.

---

## Gate 4 — Hosting: Vercel web, worker runtime, GitHub environments [CLEARED]

**Why this gate exists.** The locked architecture is: SvelteKit web app on Vercel (`svelte.config.js` selects the Vercel adapter by default; `DEPLOY_TARGET=node` selects the Node adapter for containers), the durable worker under pinned Docker Compose on a DigitalOcean droplet, and Postgres on Neon (Gate 3). CI runs on pushes to `uat` and `main`; the deployment workflow must preserve the Preview → UAT → Production promotion path.

**Steps — GitHub and Vercel.**

1. Verify repository push access over SSH (metadata-only, no agent forwarding):

   ```sh
   ssh -T -o BatchMode=yes -o StrictHostKeyChecking=yes git@github.com
   ```

2. **Complete:** the private GitHub remote and distinct `uat` branch exist. The local release-candidate branch is prepared from `main`; remote push and PR into `uat` remain explicit approval boundaries.
3. **Complete for the current personal repository:** GitHub **preview / uat / production** environments exist. UAT is branch-restricted to `uat`, Production is branch-restricted to `main`, and the Vercel token/project identifiers exist only as encrypted UAT environment secrets. Production remains intentionally secret-free and must gain an independent reviewer after the repository moves to the organization.
4. **Complete:** the personal-scope Vercel project is connected to the private repository, and `git.deploymentEnabled: false` disables automatic Vercel deployments for every branch. The pinned GitHub UAT workflow generates Prisma Client, verifies the clean checkout, builds a prebuilt Vercel artifact, and deploys only through the `uat` environment. Preview contains only the dev/UAT pooled database secret, `America/New_York`, and the four required OAuth/admin values; Production remains empty.
5. **Complete:** the first and subsequent GitHub-gated UAT deployments succeeded, Vercel deployment protection is active, and an authenticated `/health` request returned `status=ok` with integrations inactive. The protected stable alias is stored as a GitHub UAT environment variable and reassigned by every gated deployment so OAuth never depends on a changing commit URL. The corporate client callback and four Preview-only OAuth/admin values are configured, the configured corporate administrator is an active global admin in dev/UAT Postgres, and a real organization sign-in successfully returned to the authenticated application with an active hashed session.

**Steps — worker.**

1. **Complete:** an Ubuntu 24.04 LTS Basic droplet runs in NYC3 with two shared vCPUs, 2 GiB RAM, monitoring, no UAT backups, and the dedicated LiftOff SSH key. A cloud firewall restricts SSH to the approved administrator source, key-only authentication is enforced, root SSH is disabled, and the non-root `liftoff` operator has verified sudo access.
2. Copy nothing from the worktree except what `git clone` of the pinned release commit provides. Create owner-only secret files under `~/.config/liftoff/secrets/` (directory `0700`, files `0600`) for the dev/UAT pooled database URL, Google service-account JSON key, and private Sheet mapping. Store workbook/worksheet identifiers only in the owner-only deployment environment file.
3. Start only the worker service; it must not start local PostgreSQL:

   ```sh
   docker compose --profile worker up -d --build worker
   ```

   The profile mounts only external secrets/configuration, runs a read-only filesystem with a tmpfs heartbeat, and hard-locks `PHASE3_EXTERNAL_EFFECTS=false`. Startup rejects any other value and rejects partial Sheet configuration.

**Google Sheets credential decision — approved and verified for UAT.** A dedicated UAT service account and owner-only JSON key have been created, and the exact copied dev/UAT workbook grants that identity Viewer access. A bounded read-only proof scanned workbook metadata without requesting cell values or printing workbook identifiers. The key must rotate quarterly. Production requires a separately scoped identity and approval.

**Verification.** Local and hosted web evidence is complete: 76 tests, zero diagnostics, web and worker builds, Nix flake evaluation, Compose rendering, immutable container build, clean GitHub CI, GitHub-gated Vercel prebuild/deploy, active deployment protection, protected `/health`, the configured OAuth initiation redirect, and a real corporate sign-in all passed. The UAT-only administrator command passed seven fail-closed/idempotency tests, created the approved active corporate global admin atomically without logging an identifying value, and returned preserve/preserve on a second apply. Count-only database verification confirmed one linked corporate identity, one completed sign-in, and one active hashed session. The dedicated UAT service account passed a bounded metadata-only read proof against the exact copied workbook. The DigitalOcean worker was cloned at the exact protected UAT commit through a read-only deploy key, built from the digest-pinned image, and reached healthy with a non-empty tmpfs heartbeat, zero restarts, readable mounted files, and `PHASE3_EXTERNAL_EFFECTS=false`. No local PostgreSQL service, external message, or Sheet write was started. Gate status confidence: **100%**.

**Unblocks:** the Jul 24 UAT pilot and everything after it.

---

## Gate 5 — Slack non-production validation [CLEARED]

**Why this gate exists.** Learner Slack outreach is a private bot DM resolved through an admin-previewed mapping from provisioned company email to stable Slack member ID. Webhooks are verified against the unmodified raw body with a five-minute replay window and constant-time comparison, and provider event IDs are deduplicated in Postgres. The admin workflow now re-resolves every email before an atomic, individually confirmed mapping update. Acknowledgments must come from an allowlisted staff member in one configured staff channel. A dedicated UAT Slack app and private staff channel are configured, but mapping and canary evidence are not yet complete. The integration fails closed while `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`, `SLACK_STAFF_MEMBER_IDS`, or `SLACK_STAFF_CHANNEL_ID` (each also accepted as `<NAME>_FILE`) is absent.

**Steps.**

1. Create a Slack app in the workspace. Grant least-privilege bot scopes only: `chat:write`, `users:read`, `users:read.email`, `reactions:read`, and `groups:history`. Subscribe only to `reaction_added` and `message.groups`. Slack requires `users:read` with `users:read.email`, and a private-channel thread reply requires `groups:history`. Invite the bot only to the dedicated private UAT staff channel; do not grant public-channel or workspace-wide message-history scopes.
2. Record the signing secret and bot token in owner-only secret files.
3. Create a dedicated Vercel Protection Bypass for Automation secret for Slack. Point the app's event subscription URL at `https://<uat-domain>/webhooks/slack?x-vercel-protection-bypass=<secret>` and complete URL verification. Treat the complete URL as sensitive because the query parameter bypasses Vercel Authentication; Slack request signatures still protect the application endpoint.
4. Build the staff member-ID list (`SLACK_STAFF_MEMBER_IDS_FILE`) and record the private staff channel ID (`SLACK_STAFF_CHANNEL_ID_FILE`). Use stable IDs, not names.
5. Create the non-production team channel; add the bot.
6. In the admin workspace, preview the email → member-ID learner mapping and confirm each resolution before it is used.
7. Run `pnpm slack:validate-uat` for a read-only authentication and allowlist preflight. After explicit authorization, run `pnpm slack:validate-uat -- --send-staff-canary` once; it refuses a second send while its owner-only receipt exists. With the cohort still in `dry_run`, add one staff reaction and one thread reply, then verify signed delivery and deduplication. Never send to a learner until Gate 10.

**Cleared 2026-07-20.** Local checks pass with sanitized tests covering signature freshness/tampering, directory normalization and inactive/bot/mismatch rejection, staff/channel acknowledgment boundaries, command loading, dynamic Sheet session-group validation, and the fail-closed UAT roster repair. The owner-only Slack files and canary receipt have mode `0600`. The real bot passed read-only authentication, and exactly one active human staff account matched the allowlist. All four Slack settings and the corrected pooled/TLS-verified database URL are encrypted Vercel Preview values restricted to the `uat` branch; production remains untouched. Gated runs `29745803454`, `29748815000`, and `29750970270` successively deployed the corrected signing secret, bot token, and database override while preserving the stable protected alias. Slack's real URL-verification request returned HTTP 200. The approved idempotent roster transaction provisioned the 14 D10:D23 learners, preserved eight templates, and left Cohort 3 disabled. An administrator reviewed and atomically confirmed 14 unique Slack mappings; one count-only audit event records all 14. The single learner-free staff canary produced one reaction and one thread reply; three real signed provider events returned HTTP 200. A repeated synthetic event returned HTTP 200 twice but produced exactly one database row, while tampered and stale variants returned HTTP 401. Final count-only verification found 14 confirmed mappings, four unique stored Slack events including the deduplication proof, zero linked outreach events, and zero outreach attempts. No learner message was sent. Gate status confidence: **100%**.

**Verification.** Signed webhook accepted, tampered/stale webhook rejected, duplicate event ID ignored, and staff-authored reaction/thread events recorded without learner outreach.

**Unblocks:** Slack half of Milestone 4 activation evidence. Not needed for the Jul 24 pilot — dry-run plans messages without sending.

---

## Gate 6 — Resend non-production validation [IN PROGRESS — UAT CONFIG READY]

**Why this gate exists.** Escalation and team email goes through Resend with the same fail-closed posture: no `RESEND_API_KEY` / `RESEND_WEBHOOK_SECRET`, no email. Webhooks are Svix-signed and replay-protected; delivery outcomes are stored under idempotency keys so a retry can never double-send.

**Steps.**

1. Create separate Resend teams for UAT and production. Verify `uat-mail.liftofflearning.tech` for UAT and reserve `mail.liftofflearning.tech` for the later production gate; copy only the exact SPF, DKIM, and return-path records Resend generates for each subdomain without changing the root domain's existing mail records.
2. Create separate sending-only API keys restricted to their exact environment domains; store as owner-only secret files and never promote a UAT credential into production.
3. Register the webhook endpoint `https://<uat-domain>/webhooks/resend?x-vercel-protection-bypass=<dedicated-resend-bypass-secret>` for `email.sent`, `email.delivered`, `email.bounced`, and `email.failed`; store the Svix signing secret. Treat the complete URL as sensitive. Resend signatures remain the application-level authentication boundary after the dedicated bypass passes Vercel Authentication.
4. Configure `RESEND_SENDER` as `LiftOff UAT <notifications@uat-mail.liftofflearning.tech>`, set `RESEND_REPLY_TO` to a monitored `@launchpadphilly.org` staff address, and configure the external `RESEND_STAFF_RECIPIENTS_FILE` and `RESEND_UAT_CANARY_RECIPIENT_FILE`. Both Reply-To and canary recipient must be members of the staff allowlist; never put addresses in the repository.
5. Run `pnpm resend:validate-uat` for a no-contact local configuration preflight. After explicit authorization, run `pnpm resend:validate-uat -- --send-staff-canary` once. It writes an owner-only receipt before provider contact, sends one learner-free staff message, and repeats the identical request with the same idempotency key to prove that Resend returns the same message reference instead of sending twice.
6. Confirm DKIM-aligned delivery in the staff inbox, signed `email.sent` and `email.delivered` events in UAT Postgres, replay one event to prove deduplication, and verify that malformed/stale signatures fail closed. Keep Cohort 3 automation `DISABLED` and verify zero learner outreach attempts.

**Current evidence.** Local safeguards are complete: 22 test files and 92 sanitized tests pass, Svelte/TypeScript reports zero diagnostics, web and worker production builds pass, and Compose renders successfully. The validator enforces the exact UAT sending subdomain, corporate staff-only Reply-To/canary allowlists, a pre-contact receipt, and provider idempotency. The application adapter emits Reply-To, while delivery ingestion prevents older out-of-order events from regressing state. All four nonempty Resend files are mode `0600`; the UAT DKIM, SPF, and return-path records resolve publicly; and the no-contact preflight passed with two staff allowlist entries. Only `RESEND_WEBHOOK_SECRET` is a Sensitive Vercel Preview value restricted to branch `uat`; the sending key and addresses remain local. A gated redeployment, hosted signed-webhook proof, and the separately approved staff canary remain pending. No email has been sent. Gate status confidence: **70%**.

**Verification.** DKIM-aligned delivery from the exact UAT subdomain to a staff inbox, monitored corporate Reply-To, signed delivery events recorded without out-of-order status regression, duplicate events ignored, and environment separation confirmed. The UAT key and webhook secret must not appear in production configuration.

**Unblocks:** email half of Milestone 4 activation evidence. Not needed for the Jul 24 pilot.

---

## Gate 7 — Privacy and compliance review [PENDING]

**Why this gate exists.** The design decisions defer, but do not waive, confirmation of learner consent, contact-hour boundaries, privacy duties, retention, and deletion obligations. Automation that messages learners about attendance touches consent and expectations directly; the review must be recorded before real learner messages, not after.

**Steps.**

1. Confirm learner consent language in Cohort 3 enrollment covers automated attendance tracking and outreach on the approved channels.
2. Confirm outreach windows (9:25 AM – ~4:00 PM Eastern on program days) satisfy contact-hour expectations.
3. Confirm the retention posture: cohort-end archival is reversible, permanent deletion stays disabled, and the three-year administrator review reminder satisfies policy.
4. Confirm CSV export exclusions (form responses, support text, accommodation details, message bodies) satisfy the data-minimization intent.
5. Record the review outcome and reviewer in `project-notes/project_config.md` using the entry template.

**Unblocks:** Gate 10. Independent of the pilot; schedule it during August.

---

## Gate 8 — Dry-run evidence [PENDING]

**Why this gate exists.** Activation requires five complete active dry-run days and at least one formal staff review, because dry-run is the only way to observe the exact planned operations — trigger, learner reference, channel, template version, recipient category, proposed Sheet change — with zero external effects. An admin may record an approved exception, but never below one complete day.

**Steps.**

1. **Jul 24 pilot (rehearsal):** cohort in `dry_run` on UAT + local worker, sanitized workbook, staff observing. Walk the full day: 9:25 late evaluation, 10:45 no-call/no-show transition, 11:00 reconciliation, 3:00 exit reminder, 3:15 final reconciliation and unresolved dashboard, 4:00 annotation cutoff. Record observations in the automation workspace's dry-run review.
2. Fix anything the pilot surfaces; repeat locally as needed.
3. **Sep 8–14:** five complete dry-run days against the real Cohort 3 workbook and roster (Gates 1–4 re-verified against production identifiers first).
4. Hold the formal staff review; record baseline staff measurements (outreach-coordination minutes, incidents handled, unresolved items) for the before/after comparison.

**Verification.** Dry-run produces the same planned operations active mode would execute, with no provider call and no Sheet write, across all five days.

---

## Gate 9 — Live Sheet-write canary on the production workbook [PENDING]

**Why this gate exists.** The only cell the system ever writes is the dedicated incident-outcome column, and Google Sheets has no compare-and-set, so the adapter uses content hashes, write verification, three attempts, Sheet-authority preservation, and human escalation. That protocol was proven on the sanitized workbook (Milestone 1); it must be proven once on the real Cohort 3 workbook before `active` mode, because column layout, protections, or formulas may differ.

**Steps.** With explicit per-run authorization, inside `nix develop`:

```sh
pnpm google:sheets:test-canary
```

The canary writes `contacted` to one blank configured outcome cell, validates stale-version rejection, idempotency, populated-value preservation, and three-conflict escalation, then clears only that exact value. It fails closed if the cell is protected, formula-backed, or pre-populated.

**Verification.** The canary reports success and a final read confirms cleanup. Nothing is logged that identifies the workbook or a learner.

---

## Gate 10 — Go/no-go activation authorization [PENDING]

**Why this gate exists.** Switching the cohort to `active` enables real learner messages and live Sheet writes. Every prior gate produces evidence; this gate is the recorded human decision on that evidence, so responsibility is explicit and reversible actions stay distinguishable from irreversible ones (accepted provider requests cannot be recalled).

**Steps.**

1. Review the checklist above — every box checked, with evidence linked in the automation workspace and `project_config.md`.
2. Confirm rollback posture: an admin can flip `active → dry_run/disabled` immediately; the worker stops claiming new work; Sheet changes are never auto-rolled back.
3. Confirm monitoring and support ownership for the first active week, and that instructors/TAs have been walked through the unresolved dashboard and 4:00 PM annotation flow.
4. Record the go/no-go decision, date, and approver in `project_config.md`.
5. Set Cohort 3 to `active` in the automation workspace.

---

## Standing safety rules while clearing gates

- Secrets live outside the worktree: `0600` files under `~/.config/liftoff/secrets/` or environment-scoped Vercel variables. Never in `.env.example`, a commit, a build arg, or a log.
- Every provider capability fails closed when its configuration is absent; leaving a secret file missing is the off switch.
- No learner receives a real message and no live Sheet write occurs before Gate 10, except the bounded, explicitly authorized Gate 9 canary.
- Verification commands print counts and metadata only — if a step would print an identifier, token, or cell value, stop.
