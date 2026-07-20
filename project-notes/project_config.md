# Project configuration ledger

This file records verified, project-specific configuration decisions so implementation agents can reuse them without rediscovering setup details. It must never contain credentials, connection strings, provider identifiers, learner data, or copied environment values.

## Maintenance rules

- Record a configuration only after it has been verified in this project.
- Update an existing entry instead of duplicating it.
- Include the date, scope, decision, implementation, verification, and recovery procedure.
- Use variable names and placeholder paths; never record secret values.
- Keep time-sensitive versions tied to committed lockfiles or immutable image digests.
- Record reusable cross-project patterns in the shared agent operations library as well.

## Local secret-file permissions

- Date: 2026-07-14
- Scope: developer workstations, agent sessions, and worker hosts that use repository-root `.env` or external secret/configuration files.
- Decision: every secret-bearing local file must be readable and writable only by its owning operating-system account (`0600`), with its private parent directory set to `0700`. Mode `0600` allows the owner to rotate credentials and update guarded receipts while denying group and other users both read and write access. This reduces disclosure of bearer credentials and identifying configuration and prevents another local account from replacing a trusted value. Files remain ignored by source control.
- Implementation:

  ```sh
  chmod 700 /path/to/private-directory
  chmod 600 .env /path/to/private-directory/secret-file
  ```

- Verification:

  ```sh
  stat -c '%a %U:%G %n' .env
  ```

  The permission value must be `600`. Verification must print metadata only; never print or source-log the file's values.

- Recovery: rerun `chmod 600 .env`. If the file may have been exposed to another user, build log, image, artifact, or commit, rotate every affected credential rather than relying on the permission correction alone.
- Constraint: file permissions reduce local exposure but do not encrypt the file. Production and shared-environment secrets belong in environment-scoped secret managers, not repository `.env` files.

## Neon and Prisma connection roles

- Date: 2026-07-14
- Scope: Prisma 7.8.0 with the Neon development database.
- Decision: application runtime uses the pooled `DATABASE_URL`; controlled schema operations prefer the same branch's non-pooled `DIRECT_DATABASE_URL`.
- Implementation: `prisma.config.ts` selects a non-empty `DIRECT_DATABASE_URL` and otherwise falls back to `DATABASE_URL` for schema-only CI validation. Runtime database construction continues to use `DATABASE_URL`.
- TLS requirement: both URLs must explicitly request certificate verification with `sslmode=verify-full`.
- Verification:
  - `pnpm db:validate` validates the schema without printing a URL.
  - A read-only `SELECT 1` verified pooled development connectivity.
  - Confirm the intended development branch before applying a migration.
- Recovery: do not substitute a production URL. Restore the correct environment-scoped development URLs, verify connectivity read-only, and run `prisma migrate status` before any approved schema operation.

## Keyless Google development authentication

- Date: 2026-07-14
- Scope: local Google Sheets development access through the dedicated development service account.
- Decision: use short-lived service-account impersonation through Application Default Credentials instead of a user-managed JSON service-account key.
- Implementation:
  - The locked Nix shell supplies Google Cloud SDK 565.0.0; do not require a machine-global installation.
  - Enable the IAM Service Account Credentials API in the organization-owned Google Cloud project.
  - Grant the developer's organization-managed identity `roles/iam.serviceAccountTokenCreator` on the development service account only.
  - From the repository, enter `nix --extra-experimental-features 'nix-command flakes' develop` and run `gcloud auth login` with the organization-managed user identity.
  - Create impersonated ADC with `gcloud auth application-default login --impersonate-service-account="SERVICE_ACCOUNT_EMAIL" --scopes="https://www.googleapis.com/auth/cloud-platform,https://www.googleapis.com/auth/spreadsheets.readonly"`. The Cloud scope supports the impersonation flow and the Sheets read-only scope authorizes the Module 1 metadata proof. This command creates or replaces `$HOME/.config/gcloud/application_default_credentials.json` and records the service-account impersonation configuration and target scopes inside that ADC file; there is no separate project-local impersonation file.
  - The ADC impersonation command does not need to set the separate `gcloud` CLI property `auth/impersonate_service_account`. That property may remain unset because application libraries use the generated ADC file.
  - Keep `$HOME/.config/gcloud/application_default_credentials.json` outside the repository with permission `0600`. Do not open, print, copy, or source-log its contents.
- Verification:
  - `nix develop --command gcloud --version` returned Google Cloud SDK 565.0.0 from the committed flake.
  - Confirm that the expected file exists without reading it: `test -f "$HOME/.config/gcloud/application_default_credentials.json"`.
  - Restrict and verify its metadata with `chmod 600 "$HOME/.config/gcloud/application_default_credentials.json"` followed by `stat -c '%a %U:%G %n' "$HOME/.config/gcloud/application_default_credentials.json"`; the permission value must be `600` and the owner must be the developer, not `root`.
  - Confirm that ADC can mint a short-lived token without printing it: `gcloud auth application-default print-access-token >/dev/null && echo 'ADC refresh succeeded'`.
  - Use a bounded, read-only Sheets metadata request to prove the application is acting as the development service account before any canary write.
- Current status: the invalid target, missing Sheets scope, and missing `iam.serviceAccounts.getAccessToken` permission were corrected. After the Token Creator binding propagated, the metadata-only validator succeeded through impersonated ADC and reported 21 grid sheets and zero API-declared protected ranges. No grid values, workbook identifiers, worksheet titles, or learner records were requested or printed.
- Targeting decision: `GOOGLE_SHEETS_SPREADSHEET_ID` selects the workbook and `GOOGLE_SHEETS_WORKSHEET_ID` selects the one attendance tab by stable numeric ID. The adapter resolves the current title at runtime and fails closed if that tab is missing.
- Next gate: begin Milestone 2 only after confirming the intended disposable development database branch and separately authorizing the initial migration.
- Workbook inventory:
  - `pnpm google:sheets:inventory`, run inside `nix develop`, reads only rows 1–12 and at most 200 columns from the configured numeric tab ID.
  - It stores only allowlisted header kinds, cell positions, dimensions, protection counts, and derived candidate metadata. It discards unrecognized cell content and never logs titles or raw values.
  - The title-bearing report is outside the worktree at `$HOME/.config/liftoff/attendance-sheet.inventory.json`; the directory is owner-only `0700` and the file is `0600`.
  - The verified targeted inventory scanned one grid tab, detected one attendance candidate, and created a private mapping draft with 42 check-in/check-out pairs. No identifier, title, or raw cell value was logged or committed.
  - A bounded read-only structural review confirmed 26 contiguous learner rows from rows 9 through 34 with no internal gaps. Nine formula cells exist only above the learner-data region; rows 9 through 34 contain zero formulas. The API reports zero protected ranges, but operational protection still requires staff confirmation.
  - With explicit product-owner authorization, one atomic structural update expanded each of the 42 session groups from check-in/check-out to check-in/check-out/excused-status/incident-outcome. The resulting tab has 177 columns and retains 34 rows.
  - Final read-only verification found 42 complete four-field groups on the operational header tier, 42 excused/outcome labels on the roster tier, the same nine formulas above the learner region, zero formulas in rows 9 through 34, zero API-declared protected ranges, and a regenerated private mapping draft. No learner values were logged.
  - The finalized owner-only mapping covers all 42 groups and 26 contiguous learner rows. An explicitly authorized single-cell sanitized canary wrote the raw outcome `contacted`, verified stale-version rejection, idempotency, populated-value preservation, three-conflict human escalation, and cleared only the unchanged canary value. A final read confirmed cleanup; no provider or learner identifiers or cell values were logged.
- Recovery: run `gcloud auth application-default revoke`, remove any unintended Sheet sharing, and repeat the impersonation setup with the correct development identity. If authentication was ever run with `sudo`, revoke that unintended root-owned ADC and repeat as the normal developer user; never repair this by copying root credentials.
- Constraints: local ADC is for development only. Never commit it, mount it into an image layer, reuse it as production authentication, or store access tokens in `.env`. Production requires separately approved workload identity federation and environment-scoped authorization.

## Host Nix bootstrap and project-scoped tools

- Date: 2026-07-14
- Scope: local Linux development workstation.
- Decision: install Nix as the single host bootstrap and obtain application tools, including `gcloud`, only through the committed flake. A missing global `gcloud` command is expected and must not be resolved with Snap, apt, or an unpinned installer.
- Implementation:
  - The repository remains compatible with its Nix 2.34.7 validation baseline; the installed default Nix profile currently reports 2.35.1.
  - Enter the repository environment with `nix --extra-experimental-features 'nix-command flakes' develop` before using `gcloud`, pnpm, Docker Compose, or PostgreSQL client tools.
  - The shell hook removes and regenerates only repository-local Corepack shim symlinks so switching between host and container Nix stores cannot leave unusable links.
  - Interactive development shells prefix `PS1` with `[liftOff:nix]` and leave non-interactive commands unchanged. Run `exit` to return to the host shell and its original prompt.
- Verification:
  - The installed default-profile Nix executable successfully evaluated the locked flake.
  - Inside `nix develop`, Google Cloud SDK 565.0.0 and pnpm 11.5.1 both returned their pinned versions without shim errors.
  - An interactive `nix develop` session displayed the `[liftOff:nix]` prompt marker; `nix develop --command` remained suitable for non-interactive validation.
- Recovery: exit the shell, repair ownership of the ignored repository-local `.nix/` cache if a container created it as another user, then re-enter the shell. The `.nix/` directory contains generated caches and shims only; never place credentials there.
- Constraints: `gcloud auth` writes ADC under the user's external `$HOME/.config/gcloud` directory. Do not run authentication commands with `sudo` or store ADC inside the worktree.

## Entry template

Copy this section for future verified configuration changes:

```md
## Configuration name

- Date: YYYY-MM-DD
- Scope: affected component and environments.
- Decision: the configuration that agents must preserve.
- Implementation: files, variable names, or safe commands; no values.
- Verification: evidence or commands that do not expose secrets.
- Recovery: how to return to a safe state.
- Constraints: known limitations or required approvals.
```

## Module 2 local database and sanitized authentication

- Date: 2026-07-15
- Scope: local Module 2 development and tests.
- Decision: use the digest-pinned local PostgreSQL service and an owner-only external `DATABASE_URL_FILE`. Sanitized development identities use `example.test` and are enabled only when `ENABLE_SANITIZED_DEV_AUTH=true` in a development build. Production authentication fails closed until Google Workspace OAuth is configured.
- Implementation: migrations `20260714123000_init` and `20260715105500_module_2_persistence` are applied locally. `pnpm dev:seed` creates only sanitized accounts and one current-day session. It never creates learner-identifying fixtures.
- Verification: local migrations applied successfully; the sanitized seed reported three accounts and one session without logging records. Svelte/TypeScript diagnostics passed after the persistence and workspace routes were added.
- Recovery: stop the app, unset `ENABLE_SANITIZED_DEV_AUTH`, revoke local sessions, and use `docker compose down` without `-v` to preserve the local database. Destroy the named volume only with explicit authorization.
- Constraints: do not point the local seed at Neon or production. Google OAuth provider creation, live Sheet writes, external messages, and deployment remain separately authorized gates.

## Column D learner email contract and deferred synchronization

- Date: 2026-07-19
- Scope: the configured Cohort 3 attendance worksheet, local UAT, and the Module 2/3 boundary.
- Decision: hidden column D stores normalized `@launchpadphilly.org` learner emails. Count-only identity validation derives the contiguous learner boundary from the private inventory and remains independent of full session/outcome mapping. Session/account synchronization still fails closed unless every derived learner row is populated and unique.
- Verification: the uniquely resolved 23-row worksheet has its email header at D8, a blank metadata row at D9, and 14 learner rows at D10:D23. Bounded read-only validation reported 14 returned, 14 company-domain, 14 unique, and 14 already normalized values. No raw learner value, worksheet title, or provider identifier was logged.
- Recovery: after any worksheet-target or roster change, rerun `pnpm google:sheets:inventory` followed by `pnpm google:sheets:validate-identifiers`. Do not infer or fuzzy-match learner identities.
- Constraints: full session/outcome mapping, live Sheet writes, external messages, and deployment remain separately authorized gates; this entry authorizes none.

## Google Workspace web authentication

- Date: 2026-07-15
- Scope: Module 2 web sign-in and application sessions.
- Decision: use Google OpenID Connect authorization code flow with `google-auth-library` 10.9.0, PKCE S256, one-time state and nonce values, verified signed ID tokens, and an active provisioned `@launchpadphilly.org` account. Store only a SHA-256 session-token hash in Postgres and expire browser/database sessions after eight hours.
- Implementation: configure `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET_FILE`, `GOOGLE_OAUTH_REDIRECT_URI`, and `INITIAL_ADMIN_EMAIL` outside source control. The initial admin is created only when the account table is empty and the verified email exactly matches the configured address. When the approved shared dev/UAT database already contains sanitized seed accounts, `pnpm uat:provision-initial-admin --uat` performs a read-only plan and the separately authorized `--apply` form atomically creates only the configured active corporate account and global admin role. It refuses a non-company or inactive account and never reactivates or logs one.
- Verification: local contract tests cover domain/account authorization, token hashing, one-time token comparison, PKCE output, eight-hour expiry, and seven UAT provisioning guards. The approved UAT apply created one account and role without logging identifying values; a second apply returned preserve/preserve. A real organization sign-in then succeeded through the protected stable alias. Count-only database verification confirmed one linked corporate identity, one completed sign-in, and one active hashed session without logging identity, provider-subject, or token values.
- Recovery: revoke active `AuthSession` rows, rotate the OAuth client secret if exposed, and remove or correct the provider redirect URI. The app fails closed when OAuth configuration is absent.
- Constraints: never store the OAuth secret in the worktree. The `hd` request parameter is only a user-interface hint; access depends on the verified ID-token `hd` claim plus the provisioned account.

## Read-only Sheet session catalog

- Date: 2026-07-15
- Scope: copied development attendance workbook and local Module 2 program-session import.
- Decision: derive session dates only from date-formatted numeric header cells in the 42 configured Sheet groups. Store stable group IDs and ISO dates in an external `0600` catalog. Require admin preview and atomic confirmation before writing sessions to Postgres.
- Implementation: `pnpm google:sheets:build-session-catalog` uses read-only ADC and writes to `LIFTOFF_SESSION_CATALOG_FILE` or the owner-only default under the local LiftOff configuration directory. It does not retain or print other header content.
- Verification: the copied workbook produced 42 unique session dates; raw values, dates, titles, and provider identifiers were not logged. The catalog file is `0600`. Local admin preview and confirmation succeeded.
- Recovery: remove the private catalog, rerun the bounded read-only command after Sheet corrections, and preview again. Existing Postgres sessions are not changed until an admin confirms.
- Constraints: catalog creation and import authorize no Sheet write, provider configuration change, migration, deployment, or scheduler activation.

## Phase 3 local worker

- Date: 2026-07-15
- Scope: local durable scheduling and the future DigitalOcean Compose worker.
- Decision: use a dedicated bundled TypeScript worker, not n8n, for authoritative attendance automation. The worker creates deterministic jobs, conditionally claims due work, recovers stale claims, sleeps until the next due job with a bounded fifteen-minute configuration refresh, and writes only a `0600` heartbeat under tmpfs.
- Implementation: migration `20260715180000_phase_3_automation` was initially applied only to local PostgreSQL and is now applied to dev/UAT and production under Gate 3. `vite.worker.config.ts` emits `worker-build/worker.js`; the Compose `worker` profile mounts external database, Google credential, and Sheet-mapping files, uses a read-only filesystem, and sets `PHASE3_EXTERNAL_EFFECTS=false`. Worker startup now rejects a missing/non-false external-effects lock and partial Sheet configuration.
- Verification: the local worker created nine deterministic jobs for the current sanitized session, suppressed five due jobs while the cohort was disabled, retained four future jobs, and created the owner-only heartbeat. `pnpm verify` passed with 8 test files and 41 tests, both web and worker builds, and zero diagnostics. `docker compose --profile worker config` passed.
- Recovery: set the cohort to `DISABLED`, stop the worker, inspect only bounded status/error metadata, and restart. Claims older than fifteen minutes return to pending. Do not manually delete audit or job rows.
- Constraints: active provider execution, live Sheet writes, real messages, and deployment remain unauthorized and fail closed.

## Phase 3 provider events and runtime image

- Date: 2026-07-15
- Scope: local provider-contract verification and the Node runtime image.
- Decision: verify Slack and Resend webhooks against the unmodified raw body, reject timestamps outside five minutes, deduplicate provider event IDs in Postgres, and retain bounded event metadata only. Generate Prisma Client in the Docker build stage before application analysis, then prune that same generated dependency tree for runtime packaging.
- Implementation: webhook secrets use `SLACK_SIGNING_SECRET_FILE` and `RESEND_WEBHOOK_SECRET_FILE` outside the worktree. The image build uses a non-secret validation-only database URL for client generation and never opens a database connection during generation.
- Verification: 48 sanitized tests passed; `pnpm verify`, worker Compose validation, the runtime image build, and a no-secret runtime Prisma import smoke test passed.
- Recovery: leave webhook secret files absent to fail closed, set cohorts to `DISABLED`, and rebuild the previous pinned source artifact if runtime validation fails.
- Constraints: no webhook registration, provider configuration, real event delivery, external message, Sheet write, deployment, or production migration is authorized by this entry.

## Phase 3 completed local integration boundary

- Date: 2026-07-15
- Scope: local worker, provider contracts, reporting, and operational controls.
- Decision: the worker may construct the bounded attendance adapter only when `GOOGLE_SHEETS_MAPPING_FILE`, `GOOGLE_SHEETS_SPREADSHEET_ID`, and `GOOGLE_SHEETS_WORKSHEET_ID` are all externally configured. It always uses read-only access. Slack acknowledgments require both `SLACK_SIGNING_SECRET_FILE` and an external `SLACK_STAFF_MEMBER_IDS_FILE`; Resend uses `RESEND_WEBHOOK_SECRET_FILE`. Typed send adapters accept credentials only through constructor injection and are not activated by local Compose.
- Verification: 53 sanitized tests and zero Svelte/TypeScript diagnostics passed; web and worker production builds completed. An authenticated local automation-workspace smoke test returned HTTP 200 and rendered the controls, unresolved-review, and reporting sections.
- Recovery: remove external integration configuration, set the cohort to `DISABLED`, and restart the worker. Missing configuration fails closed and active external effects remain disabled.
- Constraints: identifier cleanup, organization OAuth, provider canaries, dry-run evidence collection, compliance approval, deployment, production migration, live Sheet writes, and real messages remain external activation gates.

## Prisma file-mounted schema connections and Gate 3 status

- Date: 2026-07-19
- Scope: Prisma schema commands for local dev/UAT and production Neon environments.
- Decision: schema commands prefer `DIRECT_DATABASE_URL_FILE`, then `DIRECT_DATABASE_URL`, and fall back to `DATABASE_URL_FILE` or `DATABASE_URL` only for validation and read-only status checks. Application runtime continues to use the pooled `DATABASE_URL` secret role.
- Implementation: the shared secret loader now supports optional values with file-first precedence; `prisma.config.ts` uses it for both direct and fallback connection roles. `.env.example` documents `DIRECT_DATABASE_URL_FILE`. Production platforms must inject secrets through their environment-scoped secret manager or an owner-only mounted file rather than copying `.env.production` into an image or repository artifact.
- Verification: 65 sanitized tests passed, including five secret-loader regression cases; `pnpm db:validate` passed. Secret-safe validation confirmed matching pooled/direct targets within each environment, separation between dev/UAT and production, `sslmode=verify-full`, required channel binding, and mode `0600` on all related files. After explicit authorization, `prisma migrate deploy` applied all three committed migrations to production without error. Independent direct-connection status checks found all three migrations applied and no pending migration in either environment. No provider identifier or connection value was recorded.
- Recovery: remove `DIRECT_DATABASE_URL_FILE` to return schema commands to the direct environment variable, or remove both direct settings to use the pooled fallback for non-mutating validation only. Never run deployment through the pooled fallback when the direct migration connection is required.
- Constraints: preserve the pooled runtime/direct schema-operation split and full TLS verification. Production platforms must use their environment-scoped secret manager or owner-only mounted files; never copy local secret files into an image, artifact, or repository commit. Any future migration requires fresh target confirmation, status review, and explicit authorization.

## Gate 4 UAT deployment boundary

- Date: 2026-07-19
- Scope: private GitHub repository, Vercel Preview/UAT web, and DigitalOcean UAT worker.
- Decision: deploy UAT before Production. Vercel Git deployments remain disabled; a GitHub `uat` environment workflow uses pinned Vercel CLI 56.3.2 to verify, build, and deploy a prebuilt artifact. The DigitalOcean worker uses Ubuntu 24.04 LTS in NYC3, a dedicated SSH identity, dev/UAT Neon, read-only access to the copied dev/UAT workbook, and an enforced external-effects lock. Production promotion and independent approval wait for the organization repository transfer.
- Implementation: the personal Vercel project is linked to the private repository and Preview contains only the dev/UAT pooled database secret, timezone, corporate OAuth client ID and sensitive secret, exact stable redirect URI, and corporate initial administrator. Production remains secret-free. GitHub `preview`, `uat`, and `production` environments exist; UAT and Production are restricted to their matching branches, and Vercel deployment credentials are scoped to UAT. Boolean `git.deploymentEnabled: false` disables every Git-triggered Vercel deployment. A GitHub UAT environment variable stores the stable protected alias; every gated deployment validates and reassigns that alias so OAuth does not depend on a commit-specific URL. The UAT-only administrator command resolves the approved seeded-database bootstrap exception through an explicit `--uat` target, dry-run default, separate `--apply` authorization, one atomic transaction, and value-free output. Clean CI explicitly generates Prisma Client and evaluates the pinned Nix image against a read-only trusted workspace. The Nix shell includes `doctl` from the locked nixpkgs input. Compose no longer gives the worker a local database dependency and mounts the database URL, Google credential, and Sheet mapping as external files. A dedicated UAT Google service account and owner-only key exist outside the worktree, and the exact copied dev/UAT workbook grants that identity Viewer access.
- Verification: `pnpm verify` passed with 16 test files and 76 tests, zero diagnostics, and successful web/worker builds. Seven provisioning tests cover target confirmation, company-domain validation, inactive-account refusal, creation, role addition, and idempotency. The approved UAT apply created one active corporate global admin without logging identifying values; a second apply preserved both records. Nix evaluation, Compose rendering, clean GitHub CI, a fresh GitHub-gated Vercel Preview prebuild/deploy with the OAuth configuration, deployment protection, the stable alias, authenticated `/health`, the OAuth initiation redirect, a real corporate sign-in, and the immutable container build passed. A refreshed GitHub UAT Vercel credential recovered a failed settings pull; the rerun rebuilt the immutable artifact, deployed it, reassigned the stable alias, and passed health and OAuth-entry smoke checks. Count-only database verification confirmed one linked corporate identity, one completed sign-in, and one active hashed session. The dedicated UAT service account completed a bounded metadata-only proof against the exact copied workbook without requesting cell values or printing workbook identifiers. The container connected to dev/UAT Neon with external effects disabled, wrote a non-empty heartbeat under tmpfs, and was removed. No external message or Sheet write occurred.
- Recovery: disconnect the Vercel Git link or roll back to the previous deployment; set the cohort to `DISABLED`; stop the worker; remove droplet access and revoke/delete the UAT service-account key if compromised. Recreate the droplet from the pinned commit rather than repairing an unknown host state.
- Constraints: Gate 4 is cleared for UAT with external effects locked off. Never enable sanitized dev auth or set `NODE_ENV` manually on Vercel. Production promotion, live Sheet writes, and real outreach remain separately gated.

## Gate 4 DigitalOcean UAT worker closure

- Date: 2026-07-20
- Scope: DigitalOcean UAT worker host and its private-repository delivery boundary.
- Decision: run only the LiftOff worker on one Ubuntu 24.04 LTS Basic droplet in NYC3 with two shared vCPUs, 2 GiB RAM, monitoring enabled, UAT backups disabled, and `PHASE3_EXTERNAL_EFFECTS=false`. The UAT worker uses dev/UAT Neon and Viewer-only access to the copied workbook; it cannot send real outreach or write the Sheet.
- Implementation: a dedicated DigitalOcean context and SSH key provisioned the host. A cloud firewall restricts inbound SSH to the approved administrator source and permits only required outbound protocols. Password and keyboard-interactive authentication are disabled, root SSH is disabled, and the non-root `liftoff` operator has verified sudo access. Docker Engine 29.1.3 and Compose 2.40.3 are installed from exact Ubuntu 24.04 package versions and held against silent drift. A separate read-only GitHub deploy key clones the protected UAT commit into `/srv/liftoff`. Owner-only files under `~/.config/liftoff/` provide only the pooled dev/UAT database URL, UAT Google service-account JSON, private Sheet mapping, and allowlisted worker identifiers; no secret is stored in Git or an image.
- Verification: the provider reports the expected active region, image, memory, vCPU, monitoring, and tags, with backups absent. The firewall reached `succeeded`; hardened non-root SSH remained reachable and root SSH was rejected. Repository access and the detached release commit were verified without printing provider identifiers. Remote Compose rendering passed, the digest-pinned application image built, and the worker reached `healthy` with a non-empty `0600` tmpfs heartbeat, readable mounted files, zero restarts, and the external-effects lock set to false. No local database service, message, or Sheet write started.
- Recovery: set the cohort to `DISABLED`, stop the worker Compose service, revoke the repository deploy key and DigitalOcean SSH key, remove the droplet from the firewall, then destroy the droplet only with explicit authorization. Recreate from the protected commit and external files instead of repairing an unknown host state.
- Constraints: the administrator-source firewall rule must be updated when the trusted workstation public address changes. The UAT service-account key must rotate quarterly. Gate 5 and later gates remain closed; this worker must stay external-effects-disabled until their separate evidence and approvals are complete.

## Gate 5 Slack UAT safeguards

- Date: 2026-07-20
- Scope: Slack directory mapping, signed event ingestion, and the staff-only UAT canary boundary.
- Decision: use one dedicated private UAT staff channel. Accept an acknowledgment only when the event actor is in the external staff-member allowlist and the reaction or thread reply targets that configured channel. Resolve learner Slack IDs by exact normalized email, require an administrator to check every preview row, re-resolve before confirmation, reject duplicate member IDs, and save the entire mapping atomically.
- Implementation: the web runtime accepts the bot token, signing secret, staff member IDs, and staff channel ID through file-first secret settings. The one-shot `pnpm slack:validate-uat` command performs only authenticated read checks by default. Its explicit `--send-staff-canary` mode reserves an owner-only receipt before sending one fixed, learner-free message and refuses another send while that receipt exists. The `.mjs` command calls the Slack Web API directly instead of importing the TypeScript provider class because Node 24 strip-only execution does not support constructor parameter properties.
- Verification: 19 test files and 81 sanitized tests passed with zero Svelte/TypeScript diagnostics. New coverage proves directory normalization and inactive/bot/mismatched-account rejection, staff/channel/thread acknowledgment boundaries, and command loading under the pinned Node runtime. All four local Slack files are non-empty and mode `0600`. The installed bot passed a real read-only authentication check, and exactly one active human staff account passed the allowlist check; no provider identifier was logged and no message was sent. All four Slack settings are encrypted Vercel Preview values restricted to the `uat` branch, with production untouched. Merge commit `9174b7d` passed the gated UAT deployment and post-merge CI. An initial Slack URL-verification request reached the application but returned HTTP 401 because the configured signing secret belonged to a different app credential. After the owner-only file and branch-scoped Vercel value were corrected, gated workflow run `29745803454` passed and reassigned the stable alias; a synthetic signed challenge and Slack's real request both returned HTTP 200. The health route's static `integrations=inactive` value is not a secret-validation signal. Subscribed-event delivery, learner mapping, deduplication evidence, and the staff-only canary remain unconfigured.
- Recovery: remove the four Slack settings to make the integration fail closed. Revoke the bot token and signing secret, remove the event subscription and Vercel automation bypass, and remove the app from the private channel. If a pending canary receipt remains after an ambiguous failure, inspect Slack before explicitly authorizing its removal or a retry.
- Constraints: Gate 5 remains open until hosted URL verification, real directory preview/confirmation, signed event evidence, duplicate-event evidence, and one explicitly authorized staff-only canary reaction/thread reply succeed. Learner messaging and active automation remain prohibited.

## UAT Cohort 3 roster repair

- Date: 2026-07-20
- Scope: dev/UAT Neon roster readiness for the Slack mapping preview.
- Decision: replace only the dependency-free sanitized seed identities with the approved 14 company-email learners from the bounded D10:D23 Sheet range. Preserve the existing cohort dates and eight template drafts, rename the cohort to Cohort 3, remove the single development session, and leave automation disabled.
- Implementation: `pnpm uat:repair-roster -- --uat` is dry-run by default and requires both `--uat` and `--apply` for mutation. It reads the database connection and Sheet configuration from external owner-only files/settings, validates the exact seed shape and one corporate audit owner, refuses active mode or actionable jobs, and applies the repair in one serializable transaction. An empty `DRY_RUN` cohort is atomically changed to `DISABLED`; partial or historically linked state fails closed.
- Verification: targeted guardrail tests passed. The real dry-run matched the approved empty seed, the apply completed without logging identifying values, and a second dry-run preserved the completed state. Count-only checks found one active Cohort 3, mode `DISABLED`, 14 learners, 14 successful Slack directory resolutions, zero prewritten Slack mappings, zero program sessions, eight preserved templates, and one repair audit event.
- Recovery: keep automation disabled. If the UAT roster must be reverted, restore the dev/UAT Neon branch from an approved pre-repair recovery point or run a separately reviewed reset transaction; do not run the sanitized seed alone because it would not remove the 14 provisioned learners.
- Constraints: this repair authorizes no learner message, Slack mapping confirmation, active automation, session import, or Sheet write. The current workbook's session/outcome mapping remains separate: fresh inventory recognizes the D email column and six check-in/check-out pairs, but finalization still requires an approved excused/outcome-column design.

## Gate 5 Slack UAT closure

- Date: 2026-07-20
- Scope: branch-scoped UAT database/Slack configuration, learner mapping confirmation, and signed canary-event evidence.
- Decision: UAT must override the generic Vercel Preview database with its own sensitive `DATABASE_URL` restricted to branch `uat`. The runtime URL uses the pooled Neon host, `sslmode=verify-full`, and required channel binding. Keep Cohort 3 disabled throughout Slack validation.
- Implementation: the branch override points at the repaired 14-learner dev/UAT database; the generic Preview database remains unchanged. The administrator mapping action re-resolved all learners through Slack, required individual confirmation, saved 14 unique member IDs atomically, and emitted one count-only audit event. The guarded canary command sent one fixed learner-free message and wrote an owner-only receipt that prevents a duplicate send.
- Verification: gated deployment `29750970270` passed and reassigned the stable alias. The hosted UI then showed Cohort 3 with 14 learners. Count-only database evidence found 14 confirmed unique mappings. Slack delivered the canary message event, one staff reaction, and one staff thread reply as three signed HTTP 200 webhook requests. A deterministic synthetic event replay returned HTTP 200 twice but stored exactly one provider-event row; tampered and stale variants returned HTTP 401. Final evidence found four unique Slack provider events including the proof event, zero linked outreach events, zero outreach attempts, and automation mode `DISABLED`.
- Recovery: remove the branch-scoped Slack settings and `DATABASE_URL`, revoke the Slack app credentials and Vercel automation bypass if exposed, and redeploy to fail closed. Keep the canary receipt after an ambiguous provider response; inspect Slack before any separately authorized retry. Restore the dev/UAT Neon branch from an approved recovery point for roster rollback.
- Constraints: Gate 5 authorizes no learner message, active automation, Resend traffic, live Sheet write, or production promotion. Production Vercel settings remain untouched.

## Gate 6 Resend UAT validation boundary

- Date: 2026-07-20
- Scope: Resend sender, staff-recipient allowlist, API idempotency, and signed UAT delivery events.
- Decision: outbound UAT email uses the isolated `uat-mail.liftofflearning.tech` sender domain; production reserves `mail.liftofflearning.tech`. `pnpm resend:validate-uat` rejects any other sender domain and validates the external UAT API key, webhook secret, monitored corporate Reply-To, staff-recipient allowlist, and canary-recipient configuration without contacting Resend. Provider contact requires both explicit authorization and `--send-staff-canary`.
- Safety: Reply-To and the canary recipient must be `@launchpadphilly.org` members of the external staff allowlist. The command creates an owner-only pending receipt before contact, refuses a second run while any receipt exists, sends learner-free content, and repeats the exact request with the same bounded idempotency key. A successful repeat must return the original provider message reference. Signed delivery events update an outreach attempt only when the event is the latest provider occurrence, preventing an older `email.sent` event from regressing `DELIVERED`.
- Deployment: use separate Resend teams and domain-restricted sending-only keys for UAT and production. Use a dedicated Resend Vercel Protection Bypass in the sensitive UAT webhook URL. Configure branch-scoped `RESEND_WEBHOOK_SECRET` in Vercel Preview for `uat`; retain the UAT API key outside Vercel until an authorized runtime actually needs to send. Production receives an independent key, domain, webhook, and secret only at the production gate.
- Verification: Gate 6 cleared on 2026-07-20. Twenty-two test files and 92 sanitized tests passed, including UAT sender-domain rejection, corporate Reply-To/canary allowlisting, adapter Reply-To output, command loading, and out-of-order delivery protection. Svelte/TypeScript checks reported zero diagnostics; web and worker builds and Compose validation passed. The corrected four owner-only files are nonempty and mode `0600`; public DKIM, SPF, and return-path records resolve for the exact UAT subdomain; and the no-contact preflight passed with two staff allowlist entries. Only the webhook secret is a Sensitive Vercel Preview value restricted to branch `uat`; the sending key and addresses remain local. Corrective PR #12 deployed the reviewed artifact to a fresh healthy UAT alias. A valid learner-free signed event and its duplicate returned HTTP `200` and stored exactly one unlinked row; tampered and stale requests returned `401`. The authorized real canary produced exactly one received staff email and the idempotent retry returned the original provider message reference. Genuine signed `email.sent` and `email.delivered` callbacks were recorded with zero linked Resend events, zero outreach attempts, and automation `DISABLED`. The received message had the correct monitored Reply-To and passed SPF, DKIM, and DMARC. It landed in spam, which is retained as a production deliverability risk rather than an authentication failure.
- Constraints: Gate 6 authorizes no learner message, active automation, or production credential promotion. Cohort 3 stays `DISABLED`. Repeat a staff-only deliverability canary at the production gate and investigate or remediate spam placement if it persists before learner activation.

## Gate 7 privacy controls and review closure

- Date: 2026-07-20
- Scope: Cohort 3 privacy notice, learner communication preferences, exports, retention reviews, policy holds, and vendor/security response.
- Decision: the administrator approved the fresh notice for enrollment, the authenticated workspace, and every automated learner email; the existing accommodation-access matrix; count-only auditing for every learner CSV export; immediate authenticated email/Slack suppression; twelve-category review after three calendar years; administrator-owned holds; and administrator-owned vendor/security response.
- Implementation: the local schema adds durable per-channel preferences and category retention reviews. The authenticated preference page changes only the signed-in learner, both-channel changes are transactional, email delivery requires a stable preference URL, preference-aware delivery makes no provider call for a disabled channel, dry-run output explicitly marks suppression, every CSV export emits bounded audit metadata, cohort archival schedules all category reviews, and holds require a bounded reason and future review date. The approved operating procedure and notice contain no learner or provider values.
- Verification: Prisma formatting, generation, and schema validation passed; Svelte/TypeScript reported zero diagnostics; 25 test files and 100 sanitized tests passed. No real message, Sheet write, database migration, deployment, learner contact, or provider configuration change occurred.
- Recovery: keep cohorts DISABLED; omit the preference URL to make email delivery fail closed; roll back the application artifact if a deployed route fails; and reverse the Gate 7 migration only through a separately reviewed recovery plan that preserves existing preference/audit evidence.
- Constraints: the migration is committed but intentionally unapplied, and the artifact is intentionally undeployed. Before Gate 10, apply it to the confirmed environment under separate authorization, publish the notice, configure the environment-specific stable URL, and prove the deployed active send path rechecks preferences immediately before provider contact. Gate 7 clearance authorizes none of those external actions.
