# Vercel Preview/UAT and Production — eight practical lessons

Status: Developer training and deployment reference  
Scope: LiftOff SvelteKit web application on Vercel  
Audience: Developers and deployment operators

These lessons explain how to establish a Preview/UAT boundary and a separate
Production boundary without letting provider defaults bypass GitHub approvals.
Examples contain variable names and placeholders only.

> **LiftOff rule:** GitHub Actions is the deployment authority. Developers do not
> deploy directly from laptops, and Vercel Git auto-deployments remain disabled.
> Production stays unconfigured until its repository, reviewer, secrets, rollback,
> and activation gates are approved.

## The one-picture idea

```text
feature branch -> PR checks
                      |
                      v
                 reviewed merge
                      |
          +-----------+-----------+
          |                       |
       uat branch              main branch
          |                       |
   GitHub uat gate       GitHub production gate
          |                       |
 Preview-target build    staged Production build
          |                       |
 protected UAT URL       smoke -> explicit promote
```

Vercel provides Local, Preview, and Production by default. Custom environments
such as a dedicated `uat` target require a supported paid plan. LiftOff currently
uses a persistent protected Preview deployment as its UAT fallback.

## Lesson 1 — Map branches, gates, and Vercel targets

### Goal

Know which source, approval, target, and data boundary belong together.

| Purpose                 | Git source         | GitHub environment | Vercel target               | Data                   |
| ----------------------- | ------------------ | ------------------ | --------------------------- | ---------------------- |
| Pull-request validation | short-lived branch | none or `preview`  | no privileged deployment    | sanitized or ephemeral |
| LiftOff UAT             | protected `uat`    | `uat`              | persistent Preview fallback | dev/UAT Neon           |
| Production              | protected `main`   | `production`       | Production                  | production Neon        |

Vercel Preview variables normally apply to every non-production branch, and
branch-specific Preview variables override the general Preview value. Because
LiftOff disables Vercel Git deployments, the gated workflow selects the target
explicitly.

### Exercise

For a proposed change, identify its Git branch, GitHub environment, Vercel target,
database target, approver, and rollback deployment.

### Checkpoint

No environment is selected merely because a developer ran a command from a
particular branch.

## Lesson 2 — Link a project without creating a deployment

### Goal

Connect repository metadata to the correct Vercel project without shipping code.

Use the repository-pinned CLI:

```sh
pnpm exec vercel --version
pnpm exec vercel whoami
pnpm exec vercel link
```

Review the selected owner and project before accepting the link. Vercel writes
project identifiers beneath the ignored `.vercel/` directory. Do not commit that
directory or copy authentication files into the worktree.

After linking, inspect metadata only:

```sh
pnpm exec vercel project inspect
```

### Exercise

Explain the difference between linking a local directory and deploying it.

### Checkpoint

The project is linked to the intended account, and no deployment was created.

## Lesson 3 — Make GitHub Actions the only deployment authority

### Goal

Prevent a Git push from racing or bypassing the GitHub environment gate.

LiftOff uses this repository configuration:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "git": {
    "deploymentEnabled": false
  }
}
```

The value must be boolean `false` to disable automatic deployments for every
branch. A map disables only the branches named in that map; unspecified branches
still deploy by default.

Create GitHub environments named `preview`, `uat`, and `production`. Restrict
`uat` to the `uat` branch and `production` to `main`. Store the Vercel token,
organization ID, and project ID only in the environment that needs them.

### Exercise

Open a pull request and confirm that it runs CI but does not produce a
Git-triggered Vercel deployment.

### Checkpoint

The only deployment is attributable to a GitHub Actions run that passed the
correct environment boundary.

## Lesson 4 — Configure Preview as LiftOff UAT

### Goal

Configure a persistent, protected non-production deployment.

Required UAT variables:

| Variable                     | Treatment                                        |
| ---------------------------- | ------------------------------------------------ |
| `DATABASE_URL`               | Encrypted Preview value; dev/UAT Neon pooled URL |
| `PROGRAM_TIMEZONE`           | Preview configuration                            |
| `GOOGLE_OAUTH_CLIENT_ID`     | Preview configuration                            |
| `GOOGLE_OAUTH_CLIENT_SECRET` | Sensitive Preview value                          |
| `GOOGLE_OAUTH_REDIRECT_URI`  | Exact UAT callback URL                           |
| `INITIAL_ADMIN_EMAIL`        | Corporate UAT administrator                      |
| `ENABLE_SANITIZED_DEV_AUTH`  | Must be absent or `false`                        |

List names and scopes without retrieving values:

```sh
pnpm exec vercel env ls preview
```

When adding a secret from an owner-only external file, stream it through standard
input. Do not place it in the command or shell history:

```sh
pnpm exec vercel env add GOOGLE_OAUTH_CLIENT_SECRET preview --sensitive \
  < "$LIFTOFF_SECRET_ROOT/uat/google_oauth_client_secret"
```

Vercel variable changes affect only new deployments, so redeploy after any change.

When local development doubles as UAT, sanitized seed accounts make the normal
empty-database first-admin bootstrap intentionally fail closed. An authorized
operator must provide the same external `INITIAL_ADMIN_EMAIL` and dev/UAT
`DATABASE_URL_FILE`, preview the bounded change, and apply it explicitly:

```sh
pnpm uat:provision-initial-admin --uat
pnpm uat:provision-initial-admin --uat --apply
```

The command refuses non-company and inactive accounts, creates only an active
global administrator, records audit events, and is idempotent. Never load
Production configuration into this command. A second apply must report
`account=preserve` and `global-admin-role=preserve` without printing the
email or database target.

### Exercise

Compare the expected variable-name list with `vercel env ls preview`. Report names,
scope, and missing entries only.

### Checkpoint

UAT contains no Production database, Production OAuth secret, Slack token, or
Resend key.

## Lesson 5 — Build and deploy an immutable UAT candidate

### Goal

Build in GitHub and upload the prebuilt output to Vercel.

The workflow sequence is:

```text
checkout exact commit
 -> install locked dependencies
 -> generate Prisma Client
 -> pnpm verify
 -> vercel pull --environment=preview
 -> vercel build
 -> vercel deploy --prebuilt
 -> assign stable UAT alias
 -> record URL and commit
```

The repository pins the CLI and GitHub Actions. The workflow uses a non-secret
placeholder database URL only while generating Prisma Client for static analysis;
the Vercel build receives the target environment through `vercel pull`.
The stable UAT alias is environment-scoped configuration and must be reassigned to
the newly verified deployment before OAuth testing.

Never replace the workflow with an unpinned global `vercel` installation or a
laptop deployment.

### Exercise

Trace the deployed URL back to its GitHub run, commit SHA, and UAT environment.

### Checkpoint

The deployed commit is the same commit that passed CI, and stdout from the deploy
step is validated as a Vercel URL before being recorded.

## Lesson 6 — Complete the first-URL and authentication loop

### Goal

Turn the generated deployment URL into a usable corporate UAT application.

1. Add `https://<uat-host>/auth/google/callback` to the corporate Google OAuth
   client's authorized redirect URIs.
2. Add the OAuth client ID, sensitive client secret, exact redirect URI, and
   corporate initial-admin email to Preview.
3. Redeploy through the GitHub `uat` workflow.
4. Confirm an unauthenticated request is redirected to Vercel protection.
5. Use an authorized request to verify `/health`.
6. Complete a real corporate Google sign-in.
7. Verify authenticated access to the operational workspace.

Do not weaken deployment protection merely to simplify a health check. Vercel
supports authenticated access and controlled automation bypasses.

### Exercise

Document the expected status for public `/health`, authorized `/health`, failed
corporate sign-in, and successful corporate sign-in.

### Checkpoint

The protected application is healthy, rejects unauthorized identities, and admits
the provisioned corporate administrator.

## Lesson 7 — Prepare and stage Production

### Goal

Create a Production deployment without immediately assigning live domains.

Production requires:

- an approved `main` branch and separate GitHub `production` environment;
- an independent reviewer who did not create the release;
- Production-only Vercel and provider variables;
- a separate Production Neon target;
- successful UAT evidence for the release candidate;
- a tested rollback target.

Use the Production target when pulling and building configuration. Stage the
Production deployment with domain assignment disabled, smoke-test its generated
URL through the approved protection method, and promote only after authorization:

```text
vercel pull --environment=production
 -> production-target build
 -> deploy --prod --skip-domain
 -> smoke checks
 -> explicit production approval
 -> vercel promote <staged-deployment>
```

These commands belong in the pinned Production workflow, not a developer terminal.
A Preview promotion can cause a Production rebuild with Production variables; a
staged Production deployment is preferable when the requirement is to test the
exact production-target build before domain assignment.

### Exercise

Identify every variable that must differ between UAT and Production and the person
authorized to approve the promotion.

### Checkpoint

Creating a successful Production-target build does not automatically make it
current.

## Lesson 8 — Verify, roll back, and preserve evidence

### Goal

Close a deployment with evidence and recover without rebuilding unknown code.

For each deployment, retain:

- environment and commit SHA;
- immutable artifact or deployment identifier;
- workflow URL and result;
- protected health-check result;
- OAuth sign-in result;
- variable-name/scope comparison;
- approver and promotion decision;
- previous known-good deployment.

If UAT fails, leave the prior UAT deployment in place and correct the release
candidate through a new pull request. If Production fails, reassign domains to a
previous known-good Production deployment, then investigate. Rotation of an
exposed secret requires a new deployment because Vercel variable changes do not
retroactively modify old deployments.

### Exercise

Write a rollback decision for application failure, bad environment configuration,
and exposed OAuth secret.

### Checkpoint

Rollback restores a known-good deployment; it never rebuilds from an unreviewed
worktree.

## Completion checklist

- [ ] Branches, GitHub environments, Vercel targets, and data targets are mapped.
- [ ] Vercel Git automatic deployments are disabled.
- [ ] UAT and Production variables are environment-scoped and separately owned.
- [ ] UAT deploys only after clean CI and the GitHub `uat` boundary.
- [ ] Deployment protection and corporate OAuth are verified.
- [ ] Production is staged and independently approved before promotion.
- [ ] A known-good rollback deployment and evidence record exist.

## References

- [Vercel environments](https://vercel.com/docs/deployments/environments)
- [Vercel environment variables](https://vercel.com/docs/environment-variables)
- [Vercel Git configuration](https://vercel.com/docs/project-configuration/git-configuration)
- [Vercel with GitHub Actions](https://vercel.com/docs/git/vercel-for-github)
- [Vercel deployment protection](https://vercel.com/docs/deployment-protection)
- [Vercel staged deployments](https://vercel.com/docs/cli/deploying-from-cli)
- [Vercel deployment promotion](https://vercel.com/docs/deployments/promoting-a-deployment)
- [LiftOff activation gates](../ACTIVATION-GATES.md)
