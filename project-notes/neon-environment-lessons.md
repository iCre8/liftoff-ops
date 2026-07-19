# Neon Postgres UAT and Production — eight practical lessons

Status: Developer training and database operations reference  
Scope: LiftOff Prisma/Postgres environments hosted on Neon  
Audience: Developers, migration operators, and deployment reviewers

These lessons teach safe environment creation and migration without printing or
committing a connection string.

> **LiftOff exception:** The approved LiftOff architecture uses the existing
> development database as UAT. It does not create a third long-lived UAT branch.
> Production is a separate Neon branch/database with different credentials. Other
> projects should normally create a dedicated UAT branch unless an equivalent
> decision is approved and recorded.

## The one-picture idea

```text
local + UAT web + UAT worker              Production web + worker
              |                                      |
       pooled runtime URL                         pooled runtime URL
              |                                      |
      dev/UAT Neon target        !=        Production Neon target
              |                                      |
       direct migration URL                     direct migration URL
              |                                      |
         controlled UAT gate              controlled Production gate
```

The pooled and direct URLs within one environment target the same database. The
UAT and Production pairs target different databases and use different credentials.

## Lesson 1 — Model projects, branches, databases, roles, and computes

### Goal

Understand what must be compared before calling two configurations separate.

A Neon project can contain multiple branches. Each branch has its own databases,
roles, and compute endpoints. A branch is an isolated copy-on-write database
history, not a Git branch and not merely a different connection-string label.

For each application environment, record privately:

- Neon project and branch;
- database and runtime role;
- pooled compute hostname;
- direct compute hostname;
- migration role;
- restore-window and protection decision.

Do not record provider identifiers or connection strings in the repository.

### Exercise

Draw the UAT and Production targets and identify which resources are shared and
which must differ.

### Checkpoint

You can prove environment separation using target metadata without displaying a
password or full URL.

## Lesson 2 — Choose the UAT topology

### Goal

Decide whether UAT is dedicated or shares an approved development target.

Default pattern:

1. Create an empty, schema-only, or sanitized UAT branch.
2. Give it independent compute and credentials.
3. Do not branch learner-identifying Production data into developer-accessible
   environments without an approved anonymization and privacy process.

LiftOff pattern:

1. Local development and UAT intentionally use the same non-production target.
2. Only sanitized application fixtures may be seeded.
3. UAT provider effects remain disabled until their activation gates pass.
4. Production stays fully separate.

Neon supports branch-per-preview workflows, but automatic preview branches are not
required for LiftOff's current persistent UAT model.

### Exercise

State whether your project uses dedicated UAT or the documented LiftOff exception,
and identify the approved decision record.

### Checkpoint

Sharing development and UAT is deliberate and documented—not an accidental copied
connection string.

## Lesson 3 — Create or identify the Production boundary

### Goal

Establish a Production target that cannot be confused with development/UAT.

In the Neon Console:

1. Select the approved project.
2. Open **Branches**.
3. Identify or create the intended Production branch.
4. Confirm its database, roles, compute, region, restore window, and protection
   options.
5. Create Production-specific credentials.
6. Restrict console membership and network access according to the approved plan.
7. Record secret-safe target metadata in the private deployment evidence.

If a protected-branch feature is unavailable on the current Neon plan, compensate
with least-privilege project membership, separate credentials, explicit migration
authorization, target comparison, and tested restore procedures.

### Exercise

List three independent facts that prove Production is not the dev/UAT target.

### Checkpoint

No developer seed command, UAT deployment, or local default can reach Production.

## Lesson 4 — Separate pooled runtime and direct migration connections

### Goal

Use the correct connection role for each workload.

| Setting                                            | Purpose                            | Expected endpoint                    |
| -------------------------------------------------- | ---------------------------------- | ------------------------------------ |
| `DATABASE_URL` / `DATABASE_URL_FILE`               | web and worker runtime             | pooled hostname containing `-pooler` |
| `DIRECT_DATABASE_URL` / `DIRECT_DATABASE_URL_FILE` | Prisma schema status and migration | non-pooled hostname                  |

LiftOff's `prisma.config.ts` prefers the direct migration connection for schema
commands. Runtime construction continues to use the pooled connection.

Both URLs must use full TLS verification and required channel binding under the
approved LiftOff configuration. Copy connection information from Neon's **Connect**
dialog; never construct or guess credentials.

### Exercise

For one environment, verify privately that pooled and direct hosts differ only in
their pooling endpoint while project, branch, database, and credential role are the
approved pair.

### Checkpoint

Application instances do not run migrations through their pooled runtime URL.

## Lesson 5 — Store URLs in owner-only external files

### Goal

Keep database credentials outside Git, shell history, logs, and image layers.

Follow the
[local external-secret management lessons](./local-secret-management-lessons.md)
to create:

```text
~/.config/liftoff/secrets/
|-- uat/
|   |-- database_url
|   `-- direct_database_url
`-- production/
    |-- database_url
    `-- direct_database_url
```

Directories use mode `0700`; files use mode `0600`. Environment configuration
contains only paths:

```sh
export DATABASE_URL_FILE="$LIFTOFF_SECRET_ROOT/uat/database_url"
export DIRECT_DATABASE_URL_FILE="$LIFTOFF_SECRET_ROOT/uat/direct_database_url"
```

Do not copy a UAT folder to make Production. Create each Production credential from
the authoritative Production target after approval.

### Exercise

Verify file ownership, mode, and non-empty status without displaying contents.

### Checkpoint

No connection string appears in `.env.example`, Git status, process arguments,
logs, screenshots, or Docker layers.

## Lesson 6 — Prove environment separation before connecting

### Goal

Fail closed before a status, migration, seed, or deployment command.

Perform a secret-safe preflight:

1. Confirm the intended environment and authorized task.
2. Confirm both `_FILE` paths contain the expected environment directory.
3. Confirm each file exists, is non-empty, and is mode `0600`.
4. Parse privately and compare host, database, and role metadata.
5. Confirm pooled and direct connections belong to the same environment.
6. Confirm UAT and Production do not resolve to the same target or credential.
7. Confirm TLS verification and channel binding are present.
8. Stop on ambiguity; never infer a target from a display name.

Do not print a redacted URL as a shortcut. Even provider identifiers can disclose
private architecture; report assertions and counts instead.

### Exercise

Produce a result containing only booleans such as `same_environment_pair=true`,
`production_distinct=true`, `tls_verified=true`, and `files_mode_0600=true`.

### Checkpoint

The operator can name the target from approved provider metadata while command
output contains no provider identifier or credential.

## Lesson 7 — Apply migrations through gates

### Goal

Apply committed migrations once, in order, and to the intended direct connection.

For UAT:

1. Select the UAT `DATABASE_URL_FILE` and `DIRECT_DATABASE_URL_FILE`.
2. Run the secret-safe target preflight.
3. Generate Prisma Client.
4. Run tests and builds.
5. Run `pnpm exec prisma migrate status`.
6. Apply `pnpm exec prisma migrate deploy` only when UAT migration is authorized.
7. Run status again and smoke-test the application.

For Production:

1. Promote the exact reviewed migration files that passed UAT.
2. Select the Production file paths.
3. Repeat the target preflight.
4. Review pending migrations and recovery readiness.
5. Obtain explicit Production migration authorization.
6. Run one `prisma migrate deploy` job through the direct connection.
7. Verify status independently before deploying application traffic.

`prisma migrate deploy` applies pending migrations but does not detect schema
drift, reset data, or generate Prisma Client. Those are separate checks.

Never run `prisma migrate dev`, `db push`, a seed, or concurrent migration jobs
against Production.

### Exercise

Write the evidence required before and after a Production migration without
including database identifiers or SQL containing customer data.

### Checkpoint

The migration job is single-run, directly connected, explicitly approved, and
independently verified.

## Lesson 8 — Rotate, restore, and recover

### Goal

Respond safely to credential exposure or an incorrect database change.

Credential exposure:

1. Disable the affected application capability when practical.
2. Rotate the role password in Neon.
3. Replace the relevant external secret and platform secret.
4. Redeploy affected runtimes.
5. Verify old credentials fail and health checks pass.
6. Record evidence without recording the credential.

Incorrect migration or data change:

1. Stop writers and migrations.
2. Record the time and affected environment.
3. Preserve current state for investigation.
4. Use Neon's restore window and branch-based recovery to create or inspect a
   recovery point.
5. Test recovery away from Production traffic.
6. Switch or repair Production only after explicit recovery authorization.

Do not assume a down migration exists, and never edit an already-applied migration
to hide history.

### Exercise

Write separate runbooks for leaked UAT credentials, leaked Production credentials,
and a destructive Production migration.

### Checkpoint

Recovery restores a known state and preserves migration/audit history.

## Completion checklist

- [ ] The UAT topology is explicitly approved and documented.
- [ ] Production is a distinct Neon target with separate credentials.
- [ ] Runtime uses pooled URLs and migrations use direct URLs.
- [ ] All URL files are external, owner-only, non-empty, and environment-scoped.
- [ ] Target separation and TLS requirements are proven without printing values.
- [ ] UAT migrations pass before separately authorized Production migrations.
- [ ] Rotation and point-in-time recovery procedures are documented and tested.

## References

- [Neon projects and default branches](https://neon.com/docs/manage/projects)
- [Neon branching introduction](https://neon.com/docs/guides/branching-intro)
- [Neon connection pooling](https://neon.com/docs/connect/connection-pooling)
- [Neon database workflow primer](https://neon.com/docs/get-started-with-neon/workflow-primer)
- [Prisma with Neon](https://docs.prisma.io/docs/orm/v6/overview/databases/neon)
- [Prisma migrate deploy](https://docs.prisma.io/docs/cli/migrate/deploy)
- [LiftOff activation gates](../ACTIVATION-GATES.md)
