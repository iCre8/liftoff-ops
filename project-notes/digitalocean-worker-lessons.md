# DigitalOcean UAT worker — eight practical lessons

Status: Developer training and deployment reference
Scope: LiftOff durable UAT worker on DigitalOcean
Audience: Developers and deployment operators

These lessons reproduce the Gate 4 worker boundary without storing provider
identifiers or secrets in Git. Production requires a separate identity,
configuration set, approval, and promotion design.

> **LiftOff rule:** the UAT worker may read the copied workbook and use dev/UAT
> Neon, but `PHASE3_EXTERNAL_EFFECTS` stays `false`. Gate 4 authorizes hosting,
> not live Sheet writes or real outreach.

## The one-picture idea

```text
protected uat commit
        |
        v
read-only GitHub deploy key --> Ubuntu 24.04 droplet
                                      |
                         +------------+------------+
                         |                         |
                 pinned application image    owner-only files
                         |                    database / Google / mapping
                         +------------+------------+
                                      |
                               worker container
                         read-only FS + tmpfs heartbeat
                                      |
                           external effects = false
```

## Lesson 1 — Name the deployment boundary

### Goal

Separate the UAT web, worker, database, and provider responsibilities.

| Component     | UAT home                      | Authority or responsibility                 |
| ------------- | ----------------------------- | ------------------------------------------- |
| Web           | Vercel protected Preview      | OAuth callbacks, forms, dashboards          |
| Worker        | DigitalOcean                  | Durable scheduling and reconciliation       |
| Database      | Approved dev/UAT Neon         | Incident, outreach, sync, and audit history |
| Attendance    | Copied Google workbook        | Attendance truth and staff corrections      |
| Delivery gate | GitHub protected `uat` branch | Reviewed source and verification evidence   |

The DigitalOcean worker is not a second web host and must not start the local
Postgres service.

### Checkpoint

You can identify one source commit, one UAT data target, and one owner for every
credential before provisioning.

## Lesson 2 — Authenticate and preflight without exposing the account

### Goal

Prove that the intended CLI context is usable before creating billable resources.

```sh
nix develop --command doctl auth init --context <uat-context>
nix develop --command doctl auth switch --context <uat-context>
nix develop --command doctl account get --format Status,DropletLimit --no-header
```

Never place the API token in a command, repository file, screenshot, or chat.
Check for an existing droplet and firewall name before creation.

### Checkpoint

The selected context reports an active account, and the intended resource names
do not collide.

## Lesson 3 — Prepare a dedicated administration key

### Goal

Use one key for droplet administration and a different key for repository reads.

Create the administration key outside the worktree:

```sh
ssh-keygen -t ed25519 -f ~/.ssh/<uat-admin-key> -C <uat-key-label>
chmod 600 ~/.ssh/<uat-admin-key>
chmod 644 ~/.ssh/<uat-admin-key>.pub
```

Compare fingerprints before importing the public key into DigitalOcean. Never
upload the private key. The later GitHub deploy key is generated on the droplet
and remains read-only.

### Checkpoint

The registered DigitalOcean fingerprint exactly matches the local public key.

## Lesson 4 — Provision the smallest approved host

### Goal

Create only the reviewed UAT shape.

LiftOff Gate 4 uses:

- Ubuntu 24.04 LTS x64;
- NYC3;
- Basic, two shared vCPUs, 2 GiB RAM;
- monitoring enabled;
- UAT backups disabled;
- tags identifying LiftOff, UAT, and worker scope.

Resolve current image, region, size, and price through read-only CLI calls before
creation. Use explicit slugs and the verified SSH-key fingerprint.

```text
preflight -> explicit approval -> create -> wait for active -> verify features
```

### Checkpoint

The provider reports the expected image, region, memory, vCPUs, monitoring, and
tags, with backups absent.

## Lesson 5 — Harden access before installing the application

### Goal

Remove broad or privileged login paths without locking out the operator.

1. Create a non-root `liftoff` operator.
2. Copy only the approved administration public key.
3. Verify a fresh key-only login and non-interactive sudo.
4. Disable password and keyboard-interactive authentication.
5. Disable root SSH.
6. Validate `sshd` configuration before reload.
7. Verify the operator still connects and root no longer does.
8. Apply a cloud firewall restricting SSH to the approved administrator source.

The firewall should permit only required outbound protocols: DNS, NTP, HTTP/HTTPS,
Git SSH when used, Neon PostgreSQL TLS, and bounded diagnostic ICMP. When the
administrator's public address changes, update the rule through an authenticated,
reviewed provider session.

### Checkpoint

Non-root SSH works, root SSH fails, and the firewall reaches its successful state.

## Lesson 6 — Install and pin the host runtime

### Goal

Avoid an undocumented or silently drifting Docker installation.

Refresh Ubuntu package metadata, record candidate versions, and install exact
versions of Docker Engine, the Compose plugin, Git, and CA certificates. Hold the
Docker and Compose packages until a reviewed upgrade.

Verify only versions and service state:

```sh
docker version --format 'server={{.Server.Version}}'
docker compose version
systemctl is-active docker
```

The application base image, Node version, pnpm version, and dependencies remain
pinned by the repository Dockerfile and lockfiles.

### Checkpoint

Docker is enabled across reboot, Compose is available, and the installed versions
are recorded in the configuration ledger.

## Lesson 7 — Clone and configure without copying personal credentials

### Goal

Deliver one protected commit and only its required runtime files.

1. Generate a second Ed25519 key on the droplet for GitHub.
2. Add only its public key to the private repository as a read-only deploy key.
3. Install a previously trusted GitHub host key and require strict checking.
4. Clone the protected `uat` branch into `/srv/liftoff`.
5. Detach at the exact commit that passed the UAT gate.
6. Create `~/.config/liftoff/secrets/` with mode `0700`.
7. Install only these `0600` files:
   - pooled dev/UAT database URL;
   - UAT Google service-account JSON;
   - private Sheet mapping;
   - allowlisted worker environment file containing paths and private identifiers.
8. Do not copy OAuth secrets, production files, a personal GitHub key, or a local
   `.env`.

### Checkpoint

The checked-out commit matches the protected release, the deploy key cannot write,
and every runtime file is owner-only and outside Git.

## Lesson 8 — Start, verify, operate, and recover

### Goal

Prove the worker is useful and fail-closed before clearing the gate.

```text
render Compose
   -> build digest-pinned image
      -> start worker only
         -> wait for healthy
            -> verify heartbeat + mounts + zero restarts
               -> confirm external effects false
```

The bounded launch command is:

```sh
docker compose --env-file ~/.config/liftoff/worker.env \
  --profile worker up -d --build worker
```

Do not start `db` or `app`. Verification must confirm:

- worker health is `healthy`;
- the tmpfs heartbeat exists and is non-empty;
- restart count is zero;
- required mounted files are readable;
- `PHASE3_EXTERNAL_EFFECTS=false`;
- no real message or Sheet write occurred.

Recovery order:

1. set the cohort to `DISABLED`;
2. stop the worker;
3. preserve bounded status and audit evidence;
4. revoke the repository deploy key or UAT provider key if compromised;
5. remove the host from the firewall;
6. destroy the droplet only with explicit authorization;
7. recreate from the protected commit instead of repairing unknown state.

### Gate checklist

- [x] Account context validated without identity output.
- [x] Dedicated administration key registered.
- [x] Approved droplet active with monitoring and no backups.
- [x] Non-root key-only SSH verified; root SSH blocked.
- [x] Cloud firewall active.
- [x] Exact runtime versions installed and recorded.
- [x] Read-only repository deploy key verified.
- [x] Exact protected UAT commit checked out.
- [x] Owner-only runtime files installed.
- [x] Worker healthy with heartbeat, zero restarts, and external effects locked off.
- [ ] Production identity, configuration, and promotion separately approved.

## Related references

- [Activation gates](../ACTIVATION-GATES.md)
- [System architecture](./system-architecture.md)
- [Local secret-management lessons](./local-secret-management-lessons.md)
- [Vercel environment lessons](./vercel-environment-lessons.md)
- [Neon environment lessons](./neon-environment-lessons.md)
- [Configuration ledger](./project_config.md)
