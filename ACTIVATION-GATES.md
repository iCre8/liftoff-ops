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

## Gate status checklist

- [ ] Gate 1 — Column D learner identities corrected and validated
- [ ] Gate 2 — Google Workspace OAuth client created; real organization sign-in verified
- [ ] Gate 3 — Neon production database branch and migration authorization
- [ ] Gate 4 — Hosting: Vercel web app + worker runtime, GitHub environments
- [ ] Gate 5 — Slack non-production validation
- [ ] Gate 6 — Resend non-production validation
- [ ] Gate 7 — Privacy and compliance review recorded
- [ ] Gate 8 — Dry-run evidence: five complete days + formal staff review
- [ ] Gate 9 — Live Sheet-write canary on the production workbook
- [ ] Gate 10 — Written go/no-go activation authorization

---

## Gate 1 — Column D learner identity cleanup

**Why this gate exists.** Hidden column D of the attendance tab maps each Sheet row to a provisioned `@launchpadphilly.org` account. Session/account synchronization refuses to run unless **every** bounded learner row (rows 9–34) holds a populated, unique, company-domain email. The system never fuzzy-matches or infers a learner identity, because a wrong guess would route one learner's attendance data or outreach to another learner. The last bounded validation found 26 values but only 22 company-domain matches and 23 unique values — roughly four rows are missing, malformed, or duplicated.

**Steps.**

1. Open the development workbook's attendance tab and unhide column D.
2. For each learner row 9–34, enter the learner's exact provisioned email, copied from the Google Workspace admin directory — never typed from memory.
3. Confirm no duplicates and no personal/non-company addresses.
4. Re-hide column D.

**Verification** (metadata and counts only; never prints an address):

```sh
nix --extra-experimental-features 'nix-command flakes' develop
pnpm google:sheets:validate-identifiers
```

Expected: 26 returned values, 26 company-domain matches, 26 unique normalized values.

**Unblocks:** session/account synchronization readiness, learner form attribution, and every outreach feature downstream. Repeat this gate against the real Cohort 3 workbook before September 8.

---

## Gate 2 — Google Workspace OAuth client and real sign-in

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

## Gate 3 — Neon production database and migration authorization

**Why this gate exists.** All three migrations (`init`, `module_2_persistence`, `phase_3_automation`) have only ever been applied to local PostgreSQL. The ledger forbids applying a migration without first confirming the target branch, because Postgres is the durable incident, outreach, and audit store — a migration applied to the wrong branch is unrecoverable history damage. The decision (2026-07-18) is Neon for both app and worker in production, avoiding a stateful database on the droplet.

**Steps.**

1. In Neon, create a dedicated **production** branch/database, separate from the development branch. Create a UAT branch as well; UAT must never share a database with production.
2. For each environment record both URLs, each with `sslmode=verify-full`:
   - pooled `DATABASE_URL` for app/worker runtime;
   - non-pooled `DIRECT_DATABASE_URL` for schema operations only.
3. Verify connectivity read-only (`SELECT 1`), then check migration state before applying anything:

   ```sh
   npx prisma migrate status
   ```

4. With the target branch confirmed, apply the committed migrations to UAT first, verify, then production:

   ```sh
   npx prisma migrate deploy
   ```

**Verification.** `prisma migrate status` reports all three migrations applied and no drift, on both branches.

**Recovery.** Never substitute a production URL into a development environment or seed script. `pnpm dev:seed` is local-only. If the wrong branch is touched, stop and restore from Neon's branch history before continuing.

**Unblocks:** any deployed environment with persistence — required for the Jul 24 pilot.

---

## Gate 4 — Hosting: Vercel web, worker runtime, GitHub environments

**Why this gate exists.** No deployment has ever occurred and none is authorized until this gate is deliberately cleared. The locked architecture is: SvelteKit web app on Vercel (`svelte.config.js` already selects the Vercel adapter by default; `DEPLOY_TARGET=node` selects the Node adapter for containers), the durable worker under pinned Docker Compose on a DigitalOcean droplet, and Postgres on Neon (Gate 3). CI already runs on pushes to `uat` and `main`, anticipating a Preview → UAT → Production promotion flow where the same artifact is promoted, not rebuilt.

**Steps — GitHub and Vercel.**

1. Verify repository push access over SSH (metadata-only, no agent forwarding):

   ```sh
   ssh -T -o BatchMode=yes -o StrictHostKeyChecking=yes git@github.com
   ```

2. Push this repository to the private GitHub remote; create the `uat` branch.
3. In GitHub, create **Preview / UAT / Production** environments with required reviewers on Production.
4. Import the repo into Vercel. Map Vercel Preview ↔ `uat` and Production ↔ `main`. Configure per-environment env vars: `DATABASE_URL`, `GOOGLE_OAUTH_*`, `INITIAL_ADMIN_EMAIL`, `PROGRAM_TIMEZONE=America/New_York`. Do **not** set `ENABLE_SANITIZED_DEV_AUTH` in any Vercel environment and do not set `NODE_ENV` manually.
5. Enable Vercel's deployment protection for the UAT preview domain so the pilot dashboard is not publicly reachable.

**Steps — worker.**

1. Provision a small DigitalOcean droplet with Docker and the Compose plugin; restrict SSH to key auth.
2. Copy nothing from the worktree except what `git clone` of the pinned commit provides. Create owner-only secret files under `~/.config/liftoff/secrets/` (mode `0600`, directory `0700`): the Neon pooled `DATABASE_URL` for the target environment.
3. Start the worker profile exactly as validated locally:

   ```sh
   export DATABASE_URL_FILE="$HOME/.config/liftoff/secrets/database_url"
   docker compose --profile worker up -d --build
   ```

   The profile mounts only the database secret, runs a read-only filesystem with a tmpfs heartbeat, and keeps `PHASE3_EXTERNAL_EFFECTS=false` until activation is separately authorized.

**Open decision — production Google Sheets credentials for the worker.** Local development uses keyless ADC impersonation, which is explicitly development-only. A DigitalOcean droplet has no native GCP identity, and Workload Identity Federation requires an OIDC/SAML issuer the droplet does not provide. Options:

- **(a) Recommended:** a dedicated production service account with a JSON key, granted **only** the Sheets scope on **only** the Cohort 3 workbook, stored as an owner-only `0600` file mounted like every other secret, with a recorded quarterly rotation. This is a documented exception to the no-key rule, justified because the blast radius is one workbook and the alternative (c) reintroduces a human bottleneck at 9:25 AM daily.
- (b) Move the worker to a GCP e2-micro where ADC is ambient — cleaner auth, but adds a second cloud provider against the locked DigitalOcean decision.
- (c) Keep impersonation from an interactive machine — unacceptable for unattended scheduled operation.

**For the Jul 24 pilot,** the worker may simply run locally on your workstation inside the existing dev environment (dry-run mode, local ADC, sanitized workbook) while the web app runs on Vercel UAT. That defers the credential decision without weakening the pilot, because dry-run performs no external effects either way.

**Verification.** `/health` returns healthy on the deployed web app; the worker heartbeat file updates; a real organization sign-in succeeds on UAT; the automation workspace renders controls, unresolved-review, and reporting sections.

**Unblocks:** the Jul 24 pilot (web on UAT, worker local) and everything after it.

---

## Gate 5 — Slack non-production validation

**Why this gate exists.** Learner Slack outreach is a private bot DM resolved through an admin-previewed mapping from provisioned company email to stable Slack member ID. Webhooks are verified against the unmodified raw body with a five-minute replay window and constant-time comparison, and provider event IDs are deduplicated in Postgres. All of this is implemented and tested against fakes; no real Slack app exists. The adapter fails closed while `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`, and `SLACK_STAFF_MEMBER_IDS` (each also accepted as `<NAME>_FILE`) are absent — so simply not configuring them keeps Slack off.

**Steps.**

1. Create a Slack app in the workspace (or a sandbox workspace first). Grant least-privilege bot scopes only: `chat:write`, `im:write`, `users:read.email` (for the email → member-ID preview), `reactions:read`, and event subscriptions for `reaction_added` and `message` in the staff channel thread context. Do not grant workspace-wide read scopes.
2. Record the signing secret and bot token in owner-only secret files.
3. Point the app's event subscription URL at `https://<uat-domain>/webhooks/slack` and complete Slack's URL verification.
4. Build the staff member-ID list (`SLACK_STAFF_MEMBER_IDS_FILE`): stable member IDs, not display names, because display names change and IDs do not.
5. Create the non-production team channel; add the bot.
6. In the admin workspace, preview the email → member-ID learner mapping and confirm each resolution before it is used.
7. With the cohort still in `dry_run`, verify signed event delivery, dedup on redelivery, and staff-reaction acknowledgment handling. Send real DMs only to staff test accounts, never to a learner, until Gate 10.

**Verification.** Signed webhook accepted, tampered/stale webhook rejected, duplicate event ID ignored, and a staff-authored reaction recorded as an acknowledgment.

**Unblocks:** Slack half of Milestone 4 activation evidence. Not needed for the Jul 24 pilot — dry-run plans messages without sending.

---

## Gate 6 — Resend non-production validation

**Why this gate exists.** Escalation and team email goes through Resend with the same fail-closed posture: no `RESEND_API_KEY` / `RESEND_WEBHOOK_SECRET`, no email. Webhooks are Svix-signed and replay-protected; delivery outcomes are stored under idempotency keys so a retry can never double-send.

**Steps.**

1. Create the Resend account/team; verify the sending domain (SPF + DKIM records on `launchpadphilly.org` or a dedicated subdomain such as `mail.launchpadphilly.org` — a subdomain isolates deliverability reputation and is recommended).
2. Create separate API keys for UAT and production; store as owner-only secret files.
3. Register the webhook endpoint `https://<uat-domain>/webhooks/resend`; store the Svix signing secret.
4. Configure the team recipient list as environment configuration, not code.
5. From UAT, send test messages to staff addresses only; confirm delivery events arrive signed and are deduplicated.

**Verification.** DKIM-aligned delivery to a staff inbox, signed delivery events recorded, duplicate events ignored, and environment separation confirmed (UAT key cannot appear in production config).

**Unblocks:** email half of Milestone 4 activation evidence. Not needed for the Jul 24 pilot.

---

## Gate 7 — Privacy and compliance review

**Why this gate exists.** The design decisions defer, but do not waive, confirmation of learner consent, contact-hour boundaries, privacy duties, retention, and deletion obligations. Automation that messages learners about attendance touches consent and expectations directly; the review must be recorded before real learner messages, not after.

**Steps.**

1. Confirm learner consent language in Cohort 3 enrollment covers automated attendance tracking and outreach on the approved channels.
2. Confirm outreach windows (9:25 AM – ~4:00 PM Eastern on program days) satisfy contact-hour expectations.
3. Confirm the retention posture: cohort-end archival is reversible, permanent deletion stays disabled, and the three-year administrator review reminder satisfies policy.
4. Confirm CSV export exclusions (form responses, support text, accommodation details, message bodies) satisfy the data-minimization intent.
5. Record the review outcome and reviewer in `project-notes/project_config.md` using the entry template.

**Unblocks:** Gate 10. Independent of the pilot; schedule it during August.

---

## Gate 8 — Dry-run evidence

**Why this gate exists.** Activation requires five complete active dry-run days and at least one formal staff review, because dry-run is the only way to observe the exact planned operations — trigger, learner reference, channel, template version, recipient category, proposed Sheet change — with zero external effects. An admin may record an approved exception, but never below one complete day.

**Steps.**

1. **Jul 24 pilot (rehearsal):** cohort in `dry_run` on UAT + local worker, sanitized workbook, staff observing. Walk the full day: 9:25 late evaluation, 10:45 no-call/no-show transition, 11:00 reconciliation, 3:00 exit reminder, 3:15 final reconciliation and unresolved dashboard, 4:00 annotation cutoff. Record observations in the automation workspace's dry-run review.
2. Fix anything the pilot surfaces; repeat locally as needed.
3. **Sep 8–14:** five complete dry-run days against the real Cohort 3 workbook and roster (Gates 1–4 re-verified against production identifiers first).
4. Hold the formal staff review; record baseline staff measurements (outreach-coordination minutes, incidents handled, unresolved items) for the before/after comparison.

**Verification.** Dry-run produces the same planned operations active mode would execute, with no provider call and no Sheet write, across all five days.

---

## Gate 9 — Live Sheet-write canary on the production workbook

**Why this gate exists.** The only cell the system ever writes is the dedicated incident-outcome column, and Google Sheets has no compare-and-set, so the adapter uses content hashes, write verification, three attempts, Sheet-authority preservation, and human escalation. That protocol was proven on the sanitized workbook (Milestone 1); it must be proven once on the real Cohort 3 workbook before `active` mode, because column layout, protections, or formulas may differ.

**Steps.** With explicit per-run authorization, inside `nix develop`:

```sh
pnpm google:sheets:test-canary
```

The canary writes `contacted` to one blank configured outcome cell, validates stale-version rejection, idempotency, populated-value preservation, and three-conflict escalation, then clears only that exact value. It fails closed if the cell is protected, formula-backed, or pre-populated.

**Verification.** The canary reports success and a final read confirms cleanup. Nothing is logged that identifies the workbook or a learner.

---

## Gate 10 — Go/no-go activation authorization

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
