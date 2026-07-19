~~# LiftOff attendance automation

LiftOff attendance automation reduces instructor toil by detecting attendance incidents, coordinating learner outreach, preserving staff corrections, and tracking follow-up. The initial MVP is scoped to LiftOff Program Cohort 3.

The repository currently includes:

- The approved attendance, punctuality, exit-ticket, and incident rules.
- A SvelteKit operational-readiness dashboard and health endpoint.
- A Prisma/PostgreSQL incident and audit model.
- A restricted Google Sheets adapter contract with conflict protection and fake-gateway tests.
- Pinned Nix, pnpm, Node, Docker, PostgreSQL, and GitHub Actions inputs.
- Docker Compose services with external file-mounted secrets.

Google, Slack, Resend, and Beacon calls remain disabled until their non-production identities, scopes, mappings, and fixtures are validated.

## Prerequisites

Preferred:

- Nix 2.34.7 or a compatible Nix installation with flakes enabled.
- Docker with the Compose plugin for local infrastructure and container validation.

Host-tool fallback:

- Node.js 24.x. The current repository target is 24.14.1.
- Corepack and pnpm 11.5.1.
- Docker Compose 5.x.

Do not install application dependencies globally. The repository pins package versions through `package.json`, `pnpm-lock.yaml`, `flake.lock`, and immutable container digests.

## Nix, NixOS, and container model

NixOS is not the application runtime and this repository does not define a NixOS system image. The environments currently have separate responsibilities:

- `nix develop` provides pinned development tools on the developer's host. It creates a shell; it does not boot a NixOS virtual machine or container.
- The application container runs on the digest-pinned `node:24.14.1-bookworm-slim` Debian image.
- The database container runs on the digest-pinned `postgres:18-bookworm` Debian image.
- CI runs the digest-pinned `nixos/nix:2.34.7` utility image only to evaluate `flake.nix`. That validation container is not deployed with the application.

Running the entire stack on NixOS would require an explicit `nixosConfigurations` output and a NixOS image or host deployment design; neither is currently part of the MVP.

## Run locally with Nix

From the repository root:

```sh
nix develop
pnpm install --frozen-lockfile
pnpm dev --host 127.0.0.1
```

The Nix shell creates ignored, repository-local Corepack and pnpm directories under `.nix/`. It also provides the pinned Google Cloud CLI for keyless development authentication and does not modify the machine-global package configuration.

An interactive project shell prefixes the terminal prompt with `[liftOff:nix]`. Run `exit` to leave the environment and restore the original prompt.

`gcloud` is intentionally unavailable outside `nix develop`. Do not install it globally with Snap or apt; enter the project shell first.

Open:

- Application: `http://127.0.0.1:5173`
- Health check: `http://127.0.0.1:5173/health`

The current dashboard and domain engine run without provider credentials or a database connection.

### Configure keyless Google development authentication

After an administrator grants your organization-managed Google identity `roles/iam.serviceAccountTokenCreator` on the development service account and enables the IAM Service Account Credentials API, enter the Nix shell and create impersonated Application Default Credentials:

```sh
nix develop
gcloud auth login
gcloud auth application-default login \
  --impersonate-service-account="SERVICE_ACCOUNT_EMAIL" \
  --scopes="https://www.googleapis.com/auth/cloud-platform,https://www.googleapis.com/auth/spreadsheets.readonly"
chmod 600 "$HOME/.config/gcloud/application_default_credentials.json"
```

Copy `SERVICE_ACCOUNT_EMAIL` exactly from **Google Cloud Console → IAM & Admin → Service Accounts** in the organization-owned development project. Do not construct or guess this address from a project display name. Do not commit, copy into the repository, or bake the generated ADC file into a container image. Revoke the local credentials when they are no longer required:

```sh
gcloud auth application-default revoke
```

## Run locally without Nix

Confirm Node 24 and activate the exact package manager:

```sh
node --version
corepack enable
corepack prepare pnpm@11.5.1 --activate
pnpm install --frozen-lockfile
pnpm dev --host 127.0.0.1
```

If global Corepack activation is not permitted, run pnpm through Corepack:

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm dev --host 127.0.0.1
```

## Start local PostgreSQL

PostgreSQL requires a secret file outside the repository. The following creates one with restrictive permissions and a URL-safe random value:

```sh
install -d -m 700 "$HOME/.config/liftoff/secrets"
umask 077
openssl rand -hex 32 > "$HOME/.config/liftoff/secrets/postgres_password"
```

Start the digest-pinned PostgreSQL 18 service:

```sh
export POSTGRES_PASSWORD_FILE="$HOME/.config/liftoff/secrets/postgres_password"
docker compose up -d db
docker compose ps
```

Stop it without deleting its named volume:

```sh
docker compose down
```

Do not use `docker compose down -v` unless destroying the local database is intentional.

## Run the containerized application profile

The application profile expects the PostgreSQL password and database URL as separate mounted secret files. Because the generated password is hexadecimal, it can be placed safely in the URL without additional encoding:

```sh
export POSTGRES_PASSWORD_FILE="$HOME/.config/liftoff/secrets/postgres_password"
export DATABASE_URL_FILE="$HOME/.config/liftoff/secrets/database_url"
umask 077
printf 'postgresql://liftoff_app:%s@db:5432/liftoff_attendance\n' \
  "$(tr -d '\n' < "$POSTGRES_PASSWORD_FILE")" > "$DATABASE_URL_FILE"
docker compose --profile app up --build
```

The containerized application is available at `http://127.0.0.1:3000`, with its health endpoint at `/health`.

Secrets must stay outside the worktree. Never commit them, place them in `.env.example`, pass them as Docker build arguments, or print them in logs.

For a guided introduction, complete the
[seven local external-secret management lessons](project-notes/local-secret-management-lessons.md).
Continue with the
[Vercel Preview/UAT and Production lessons](project-notes/vercel-environment-lessons.md)
and the
[Neon Postgres UAT and Production lessons](project-notes/neon-environment-lessons.md).

## Validation commands

| Command                                      | Purpose                                                     |
| -------------------------------------------- | ----------------------------------------------------------- |
| `pnpm format:check`                          | Verify repository formatting.                               |
| `pnpm check`                                 | Run Svelte and TypeScript diagnostics.                      |
| `pnpm test`                                  | Run Vitest domain and integration-contract tests.           |
| `pnpm build`                                 | Build the Vercel-targeted SvelteKit application.            |
| `pnpm verify`                                | Run formatting, diagnostics, tests, and build together.     |
| `pnpm db:generate`                           | Generate the pinned Prisma client. Requires `DATABASE_URL`. |
| `pnpm db:validate`                           | Validate the Prisma schema. Requires `DATABASE_URL`.        |
| `docker compose --profile app config`        | Validate all Compose profiles and secret mounts.            |
| `docker build -t liftoff-attendance:local .` | Build the Node container fallback.                          |

For schema-only validation, use a non-secret placeholder URL; the command does not connect to the database:

```sh
DATABASE_URL='postgresql://validation:validation@localhost:5432/validation' pnpm db:validate
```

## Google Sheets mapping

The current adapter reads and writes only explicitly configured columns. The ignored environment config supplies the workbook ID and numeric worksheet/tab ID; the adapter resolves the tab's current title from that stable ID before building A1 ranges, so a tab rename does not change the target.

Start from [the sanitized mapping example](config/attendance-sheet.mapping.example.json), but do not replace its placeholders with production identifiers in a commit.

Before live writes are enabled, validate these values with a sanitized non-production workbook:

- Configured workbook/tab IDs and learner-row bounds.
- Stable learner identifier column.
- Check-in, exit-ticket, and excused-status columns for each session.
- Protected and formula cells.
- A dedicated incident-outcome column that does not overlap an attendance input.

The adapter uses content hashes, write verification, three attempts, Sheet-authority preservation, and human escalation. Google Sheets does not offer database-style compare-and-set semantics, so UAT conflict testing remains mandatory.

To verify ADC and bounded metadata access, first enter the project shell. The following commands must run **inside `nix develop`**:

```sh
nix --extra-experimental-features 'nix-command flakes' develop
gcloud auth application-default print-access-token >/dev/null \
  && echo "ADC refresh succeeded"
pnpm google:sheets:verify-readonly
```

The verification uses the read-only Sheets scope, requests metadata without grid values, and prints counts only. It never prints the spreadsheet ID, worksheet titles, or cell contents. It does not authorize a canary write.

If verification reports that the ADC service account was not found, copy the exact email from Google Cloud and recreate ADC. These commands must run **inside `nix develop`**:

```sh
gcloud auth application-default revoke
gcloud auth application-default login \
  --impersonate-service-account="SERVICE_ACCOUNT_EMAIL" \
  --scopes="https://www.googleapis.com/auth/cloud-platform,https://www.googleapis.com/auth/spreadsheets.readonly"
chmod 600 "$HOME/.config/gcloud/application_default_credentials.json"
pnpm google:sheets:verify-readonly
```

If verification reports that the source user lacks `iam.serviceAccounts.getAccessToken`, identify the organization-managed user privately with the following command **inside `nix develop`**:

```sh
gcloud auth list --filter=status:ACTIVE --format='value(account)'
```

Do not paste that identity into logs or the repository. The service-account owner or Cloud administrator must open **Google Cloud Console → IAM & Admin → Service Accounts → development service account → Permissions → Grant access**, add that user as the principal, and grant **Service Account Token Creator** (`roles/iam.serviceAccountTokenCreator`) on the development service account itself. A project-wide grant is broader than this MVP requires. After the binding propagates, rerun `pnpm google:sheets:verify-readonly` inside `nix develop`; recreating ADC is not required when its target and scopes are already correct.

After read-only connectivity succeeds, run the bounded workbook inventory **inside `nix develop`**:

```sh
pnpm google:sheets:inventory
```

The command resolves only the configured numeric tab ID, then reads rows 1–12 and at most 200 columns from that tab. It retains only recognized attendance-header positions and derived structural metadata; unrecognized cell content is discarded. The title-bearing report and mapping draft are stored outside the repository at `$HOME/.config/liftoff/attendance-sheet.inventory.json` with directory mode `0700` and file mode `0600`. Do not copy that file into the worktree or commit its contents.

After inventory review, finalize the private mapping with `pnpm google:sheets:finalize-mapping`. The command reads only the configured learner-identifier column to prove contiguous row bounds, discards those values, and writes the identifier-free mapping to `$HOME/.config/liftoff/attendance-sheet.mapping.json` with mode `0600`.

`pnpm google:sheets:test-canary` requires explicit authorization for each run. It selects one blank configured outcome cell in the sanitized workbook, writes `contacted`, validates conflict and retry behavior, and clears only that exact canary value. It fails closed if the cell is protected, formula-backed, populated before the run, changed to another value, or cannot be verified as blank after cleanup.

## MVP roadmap

### Milestone 0 — Reproducible foundation: complete

- Pinned SvelteKit, Prisma, Vitest, Nix, pnpm, Node, PostgreSQL, and container inputs.
- Attendance state machine, exit-ticket rules, metrics, and incident planning.
- Initial Postgres schema, provider contracts, CI gate, dashboard shell, and health checks.
- Restricted Sheets contract, version/conflict handling, and sanitized fake tests.

Exit evidence: 17 tests pass, Svelte/TypeScript report zero diagnostics, Prisma and Compose validate, and Vercel/container builds succeed.

### Milestone 1 — Sanitized Google Sheets proof: complete

- Inventory workbook tabs, ranges, formulas, protected cells, form outputs, and stable identifiers.
- Finalize the approved mapping without committing workbook or learner identifiers.
- Exercise read, restricted write, staff correction, race/conflict, retry, and human-review flows against a non-production copy.
- Confirm the dedicated outcome field and exact values written back.

Exit evidence: the private mapping covers 42 complete session groups and 26 contiguous learner rows. A single-cell sanitized canary verified restricted write, stale-version rejection, idempotency, populated-value preservation, three-conflict human escalation, and guarded cleanup without logging provider or learner identifiers.

### Milestone 2 — Postgres persistence and learner forms

- Create and review the initial migration against local PostgreSQL.
- Persist cohorts, sessions, submissions, attendance, incidents, events, sync attempts, and outcomes.
- Implement authenticated morning goals, 2:45 PM exit-ticket, incident-outcome, and accommodation-request forms.
- Add accessible validation, duplicate-submission protection, and audit events.

Exit criterion: a sanitized learner can complete both forms and produce one idempotent attendance record and audit trail.

### Milestone 3 — Scheduler, incidents, and daily operations

- Run active-day checks at 9:25 AM, 10:45 AM, 3:00 PM, and program-day close in `America/New_York`.
- Transition one late incident to no-call/no-show without duplication.
- Add the daily unresolved dashboard, claim/closure flow, corrections, pauses, holidays, and accommodations.
- Generate the biweekly warning/concern report.

Exit criterion: deterministic time-based acceptance tests cover normal, corrected, excused, paused, accommodated, and failure paths.

### Milestone 4 — Slack and Resend outreach

- Validate Slack identities, least-privilege scopes, event delivery, reactions/comments, team channel, and escalation groups.
- Validate Resend domains, senders, delivery events, environment separation, and configurable team recipients.
- Implement approved late and no-call/no-show messages, hourly reminders, team email after one hour, and Program Director escalation.
- Store provider IDs and outcomes under idempotency keys.

Exit criterion: dry-run and non-production messages demonstrate no duplicates, correct recipients, reaction-based reminder closure, and complete audit history.

### Milestone 5 — Beacon context and guarded personalization

- Validate `beaconlearning.me` assignment, payment, and stable learner-mapping capabilities.
- Implement the permitted learner-context adapter.
- Add versioned, staff-approved message templates and constrained LLM personalization.
- Reject cross-learner data, invented facts, unapproved templates, and unsupported decisions.

Exit criterion: sanitized tests prove that generated messages use only approved template fields for the intended learner.

### Milestone 6 — Governance, reporting, and retention

- Implement least-privilege application roles and map them to actual identity groups.
- Complete accommodation review, temporary/continuing pause controls, and policy audit trails.
- Add baseline and MVP success metrics to the dashboard.
- Implement reversible cohort archival and the three-year administrator deletion review.
- Confirm privacy, consent, contact-hour, retention, and deletion obligations.

Exit criterion: role, audit, archival, restoration, and policy acceptance tests pass.

### Milestone 7 — Cohort 3 UAT and gated release

- Run staff-visible dry-run mode before enabling learner messages.
- Complete secret, dependency, image, smoke, rollback, and operational-readiness checks.
- Configure GitHub Preview/UAT/Production environments and mirror Vercel gates.
- Promote the UAT-tested artifact to Production without rebuilding different bits.
- Train instructors/TAs and document monitoring, support ownership, incident response, and rollback.

Exit criterion: Cohort 3 owners approve the UAT evidence and production go/no-go checklist.

## Current safety boundary

- No production migrations or external messages are authorized.
- No Google, Slack, Resend, Beacon, or learner credentials belong in the repository.
- The operational dashboard is currently a readiness view, not a live incident dashboard.
- Provider adapters remain disabled until their milestone exit criteria are satisfied.

See the [Phase 2 backlog](project-notes/phase-2.md), [annotated design decisions](project-notes/design-decisions.md), and [project configuration ledger](project-notes/project_config.md) for the authoritative requirements, decision history, and verified configuration guidance. The [activation gates walkthrough](ACTIVATION-GATES.md) documents the ordered external steps, verification commands, and rationale required to move from local-complete to Cohort 3 production.
