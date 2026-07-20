# Project configuration ledger

This file records verified, project-specific configuration decisions so implementation agents can reuse them without rediscovering setup details. It must never contain credentials, connection strings, provider identifiers, learner data, or copied environment values.

## Maintenance rules

- Record a configuration only after it has been verified in this project.
- Update an existing entry instead of duplicating it.
- Include the date, scope, decision, implementation, verification, and recovery procedure.
- Use variable names and placeholder paths; never record secret values.
- Keep time-sensitive versions tied to committed lockfiles or immutable image digests.
- Record reusable cross-project patterns in the shared agent operations library as well.

## Local environment-file permissions

- Date: 2026-07-14
- Scope: developer workstations and agent sessions that use the repository-root `.env` file.
- Decision: `.env` must be readable and writable only by its owner (`0600`). It remains ignored by source control.
- Implementation:

  ```sh
  chmod 600 .env
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
- Implementation: configure `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET_FILE`, `GOOGLE_OAUTH_REDIRECT_URI`, and `INITIAL_ADMIN_EMAIL` outside source control. The initial admin is created only when the account table is empty and the verified email exactly matches the configured address.
- Verification: local contract tests cover domain/account authorization, token hashing, one-time token comparison, PKCE output, and eight-hour expiry. The production build passed. A real organization-account login remains pending until the external OAuth client is created.
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
- Implementation: the personal Vercel project is linked to the private repository and Preview contains only the dev/UAT pooled database secret, timezone, corporate OAuth client ID and sensitive secret, exact stable redirect URI, and corporate initial administrator. Production remains secret-free. GitHub `preview`, `uat`, and `production` environments exist; UAT and Production are restricted to their matching branches, and Vercel deployment credentials are scoped to UAT. Boolean `git.deploymentEnabled: false` disables every Git-triggered Vercel deployment. A GitHub UAT environment variable stores the stable protected alias; every gated deployment validates and reassigns that alias so OAuth does not depend on a commit-specific URL. Clean CI explicitly generates Prisma Client and evaluates the pinned Nix image against a read-only trusted workspace. The Nix shell includes `doctl` from the locked nixpkgs input. Compose no longer gives the worker a local database dependency and mounts the database URL, Google credential, and Sheet mapping as external files. A dedicated UAT Google service account and owner-only key exist outside the worktree; Viewer sharing remains pending at the workbook-owner boundary.
- Verification: `pnpm verify` passed with 15 test files and 69 tests, zero diagnostics, and successful web/worker builds. Nix evaluation, Compose rendering, clean GitHub CI, a fresh GitHub-gated Vercel Preview prebuild/deploy with the OAuth configuration, deployment protection, the stable alias, authenticated `/health`, the OAuth initiation redirect, and the immutable container build passed. The container connected to dev/UAT Neon with external effects disabled, wrote a non-empty heartbeat under tmpfs, and was removed. A bounded check confirmed that sharing the workbook with a personal Google account does not grant the dedicated service account access. No external message or Sheet write occurred.
- Recovery: disconnect the Vercel Git link or roll back to the previous deployment; set the cohort to `DISABLED`; stop the worker; remove droplet access and revoke/delete the UAT service-account key if compromised. Recreate the droplet from the pinned commit rather than repairing an unknown host state.
- Constraints: Gate 4 remains in progress until corporate OAuth succeeds, the authenticated workspace is verified, the exact UAT workbook grants the dedicated service account Viewer access, DigitalOcean has a usable CLI token, and the droplet worker heartbeat is healthy. Never enable sanitized dev auth or set `NODE_ENV` manually on Vercel.
