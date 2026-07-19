# Local external secret management — seven practical lessons

Status: Developer training and local operations reference  
Scope: LiftOff local development, local integration, and preparation for UAT/Production  
Audience: Developers and deployment operators

These lessons teach the repository's file-first secret pattern without using real
credentials. Complete Lessons 1–5 before configuring a provider locally. Lessons
6–7 cover verification and incident recovery.

> **Safety boundary:** Secret values never belong in this repository, `.env`, shell
> history, command arguments, logs, Docker build arguments, images, fixtures, or
> screenshots. This guide uses placeholders only. Do not create a local Production
> secret folder unless an approved task genuinely requires Production access.

## The one-picture idea

```text
developer                    host boundary                    runtime
   |                              |                              |
   | sets NAME_FILE=path -------->|                              |
   |                              |  mounts file read-only ----->|
   |                              |                              | reads value
   |                              |<------ owner-only file ------|
   |
   +-- repository: code + variable names only
       external folder: secret values, mode 0700/0600
```

The repository describes **which** secret is required. The external folder stores
the value. The runtime receives only the files needed by that service.

## Lesson 1 — Recognize the boundary

### Goal

Distinguish secret values, private configuration, and safe configuration before
creating files.

| Kind                            | Examples                                                                          | Correct home                                                                  |
| ------------------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Secret                          | database URL, OAuth client secret, API token, signing secret, service-account key | Approved secret manager or owner-only external file                           |
| Private configuration           | Sheet mapping or session catalog that may reveal workbook structure               | Owner-only external file                                                      |
| Safe configuration              | timezone, local port, feature lock set to `false`                                 | Environment config or repository example when approved                        |
| Identifier requiring discretion | workbook, worksheet, cloud project, or provider identifiers                       | Environment-scoped configuration; never include it in public examples or logs |

LiftOff supports `NAME_FILE` for secrets. For example,
`DATABASE_URL_FILE=/external/path/database_url` tells the application where to
read the value. It does **not** contain the database URL.

### Exercise

Review [.env.example](../.env.example) and classify every entry. Do not add any
values. Confirm that credentials use a `_FILE` variable where the application
supports it.

### Checkpoint

You can explain why `DATABASE_URL_FILE` is safe to place in an ignored local
environment file while the contents of `database_url` are not.

## Lesson 2 — Create an external directory tree

### Goal

Create an owner-only directory outside the Git worktree and separate each
environment.

Run from any Bash shell on the developer workstation:

```sh
LIFTOFF_SECRET_ROOT="${XDG_CONFIG_HOME:-$HOME/.config}/liftoff/secrets"
install -d -m 700 "$LIFTOFF_SECRET_ROOT"
install -d -m 700 "$LIFTOFF_SECRET_ROOT/local"
install -d -m 700 "$LIFTOFF_SECRET_ROOT/uat"
```

Do not create `production/` by habit. If Production access is explicitly approved,
create it separately at that time:

```sh
install -d -m 700 "$LIFTOFF_SECRET_ROOT/production"
```

Expected layout:

```text
~/.config/liftoff/
`-- secrets/                 0700
    |-- local/               0700
    |-- uat/                 0700
    `-- production/          0700; only when explicitly authorized
```

`0700` gives the current operating-system user read, write, and traversal access;
group and other users receive none.

### Exercise

Verify paths and directory permissions without listing file contents:

```sh
find "$LIFTOFF_SECRET_ROOT" -type d -printf '%m %p\n'
```

### Checkpoint

Every reported directory is outside the repository and has mode `700`.

## Lesson 3 — Create secret files without leaking values

### Goal

Create an owner-only file while avoiding command-line arguments and shell history.

Create an empty training file first:

```sh
LIFTOFF_TRAINING_FILE="$LIFTOFF_SECRET_ROOT/local/training_secret"
install -m 600 /dev/null "$LIFTOFF_TRAINING_FILE"
```

For an approved real value, disable command tracing, read without terminal echo,
write it through standard input, and clear the temporary shell variable:

```sh
set +x
read -rsp 'Secret value: ' LIFTOFF_SECRET_VALUE
printf '\n'
printf '%s\n' "$LIFTOFF_SECRET_VALUE" > "$LIFTOFF_TRAINING_FILE"
unset LIFTOFF_SECRET_VALUE
chmod 600 "$LIFTOFF_TRAINING_FILE"
```

Do not use the training filename for a real provider secret. Use the exact
configuration name documented for the service, such as `database_url` or
`google_oauth_client_secret`.

### Exercise

Check metadata only:

```sh
stat -c 'mode=%a owner=%U file=%n' "$LIFTOFF_TRAINING_FILE"
test -s "$LIFTOFF_TRAINING_FILE" && echo 'file is non-empty' || echo 'file is empty'
```

Never validate a secret with `cat`, `echo`, `env`, or a command that prints the
value.

### Checkpoint

The file is owned by the expected user, has mode `600`, and its value never appears
in terminal output.

## Lesson 4 — Connect files to local processes

### Goal

Pass file paths—not secret values—to application and database commands.

```sh
export DATABASE_URL_FILE="$LIFTOFF_SECRET_ROOT/local/database_url"
export DIRECT_DATABASE_URL_FILE="$LIFTOFF_SECRET_ROOT/local/direct_database_url"
```

LiftOff resolves file-backed values before direct environment values. If both
`DATABASE_URL_FILE` and `DATABASE_URL` exist, the file wins. Empty required files
fail closed.

Validate presence and permissions before starting a process:

```sh
test -s "$DATABASE_URL_FILE"
test "$(stat -c '%a' "$DATABASE_URL_FILE")" = 600
```

Avoid `env`, `set`, `printenv`, or shell tracing in a session that may contain
credentials. Although LiftOff prefers file paths, inherited environments can
still contain unrelated sensitive values.

### Exercise

Using placeholder files only, point `DATABASE_URL_FILE` at an empty training file
and observe that the secret loader rejects it. Do not point validation exercises
at Neon or another live service.

### Checkpoint

You understand that `_FILE` is an indirection contract: the path can be configured;
the value remains in the protected file.

## Lesson 5 — Mount the minimum files with Docker Compose

### Goal

Understand how an external host file becomes a read-only runtime secret.

LiftOff's [compose.yaml](../compose.yaml) maps a host path to a named Compose secret:

```text
host: $DATABASE_URL_FILE
  -> Compose secret: database_url
    -> container: /run/secrets/database_url
      -> app: DATABASE_URL_FILE=/run/secrets/database_url
```

Configure paths, render the model, and inspect only filenames/mount definitions:

```sh
export DATABASE_URL_FILE="$LIFTOFF_SECRET_ROOT/local/database_url"
export POSTGRES_PASSWORD_FILE="$LIFTOFF_SECRET_ROOT/local/postgres_password"
docker compose --profile app config
```

`docker compose config` validates the resolved Compose model. Do not use
`docker compose config --environment` in shared output because it can expose other
environment values. Never use `ARG`, `ENV`, or `COPY` to place credentials into an
image layer.

### Exercise

Identify which secrets are granted to `db`, `app`, and `worker` in
[compose.yaml](../compose.yaml). Confirm that each service receives only what it
needs.

### Checkpoint

You can trace a secret path from the host to `/run/secrets/...` without reading or
printing its value.

## Lesson 6 — Keep Local, UAT, and Production separate

### Goal

Prevent a valid credential from being used in the wrong environment.

```text
local/       sanitized/local services; developer-owned
uat/         non-production cloud resources; UAT-scoped identity
production/  production resources; separate approval and identity
```

Use the same filename in different environment directories when the application
contract is the same:

```text
secrets/local/database_url
secrets/uat/database_url
secrets/production/database_url
```

The files must contain different environment-scoped credentials. Never copy a UAT
folder to create Production. Create each Production value from its authoritative
provider after approval. Local development must not require Production access.

Before running a consequential command, verify the **path and target metadata**,
not the value:

1. Confirm the intended environment and authorized task.
2. Confirm `_FILE` paths contain `/local/`, `/uat/`, or `/production/` as expected.
3. Use a secret-safe provider status command to confirm the target.
4. Stop if pooled and direct database roles do not resolve to the same database
   within one environment.
5. Stop if UAT and Production resolve to the same resource.

### Exercise

Create empty `local/training_secret` and `uat/training_secret` files. Point a
training-only variable at each in turn and verify the path changes. Do not put a
real value in either file.

### Checkpoint

Changing environments means selecting another scoped path and passing the relevant
gate; it never means replacing a value inside a shared file.

## Lesson 7 — Audit, rotate, and recover

### Goal

Operate secrets without disclosing them and respond safely to suspected exposure.

Safe local audit:

```sh
find "$LIFTOFF_SECRET_ROOT" -type d -printf 'directory mode=%m path=%p\n'
find "$LIFTOFF_SECRET_ROOT" -type f -printf 'file mode=%m path=%p\n'
git status --short
```

Expected results:

- Secret directories report `700`.
- Secret files report `600`.
- No secret file appears in Git status.
- Filenames identify purpose and environment but contain no secret value or learner
  information.

If a secret may have been exposed:

1. Stop the affected capability; keep external effects disabled when applicable.
2. Revoke or rotate the credential at its authoritative provider first.
3. Create a replacement owner-only file without printing the value.
4. Restart only the affected service and run its secret-safe health check.
5. Revoke sessions or dependent credentials when the provider requires it.
6. Record the incident and verification evidence without recording the value.
7. Removing a value from the current file is not enough if it entered Git history,
   an image layer, an artifact, or a log; use an explicitly approved remediation.

### Exercise

Practice rotation using two empty training files. Change the training `_FILE` path
to the replacement, verify metadata, then remove the obsolete empty training file.
Do not practice with a live credential.

### Checkpoint

You can describe recovery in the correct order: contain, revoke/rotate, replace,
verify, document.

## Completion checklist

- [ ] I can classify secret, private, safe, and identifier configuration.
- [ ] My external directories are outside the repository and mode `0700`.
- [ ] Secret files are mode `0600` and owned by the expected account.
- [ ] I use `_FILE` variables and never export secret values when file input exists.
- [ ] Local, UAT, and Production use separate paths, credentials, and approvals.
- [ ] I can validate Compose mounts without displaying a secret.
- [ ] I know how to contain and rotate a suspected exposure.

## References

- [LiftOff activation gates](../ACTIVATION-GATES.md)
- [LiftOff system architecture](./system-architecture.md)
- [Docker Compose secrets](https://docs.docker.com/compose/how-tos/use-secrets/)
- [Docker build secrets](https://docs.docker.com/build/building/secrets/)
- [GitHub Actions secrets](https://docs.github.com/en/actions/security-guides/using-secrets-in-github-actions)
- [Vercel environment variables](https://vercel.com/docs/environment-variables)
