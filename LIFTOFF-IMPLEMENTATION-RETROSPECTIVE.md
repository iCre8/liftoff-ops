# LiftOff implementation retrospective — from first sketch to Gate 7

Status: Gates 1–7 cleared; Gate 8 pending
Review date: 2026-07-20
Scope: LiftOff Program Cohort 3 MVP

This document reconstructs the decisions, prompts, operating habits, technical controls, and human approvals that moved LiftOff from an architecture discussion to a functioning UAT system. It records decision rationale and evidence, not private chain-of-thought, credentials, provider identifiers, learner records, or raw logs.

## The one-picture story

```text
discover the real workflow
          |
          v
draw the system simply -----> lock sources of truth and safety rules
          |                                  |
          v                                  v
implement with fakes -----> create one external activation gate at a time
                                             |
                                             v
                                  preflight -> authorize -> canary
                                             |
                                             v
                                   verify -> record -> proceed
```

The project succeeded because it did not treat “the code builds” as equivalent to “the system is safe to activate.” Every real identity, database, deployment target, and messaging provider crossed a separate evidence boundary.

## 1. Where the work began

The initial request was broad: review the project, determine its status and next steps, and explain the architecture using the visual reasoning principles from _The Back of the Napkin_. That led to three foundational artifacts:

- [design-decisions.md](project-notes/design-decisions.md), which converted the discovery interview into approved product rules.
- [phase-2.md](project-notes/phase-2.md) and [phase-3.md](project-notes/phase-3.md), which separated implementation work from external activation.
- [system-architecture.md](project-notes/system-architecture.md), which organized the architecture around who/what, where, why, when, how, and how much.

The early prompts were effective because they moved between four levels:

1. “What problem are we solving?” established the attendance and outreach workflow.
2. “Draw the system” exposed authority, boundaries, timing, and handoffs.
3. “What gate are we on?” turned ambiguity into a bounded acceptance checklist.
4. “Proceed” or an explicit approval allowed one consequential external step without authorizing every later step.

## 2. Decisions that gave the project a stable center

### Authority was explicit

- Google Sheets remains authoritative for attendance and staff corrections.
- Postgres is authoritative for incidents, outreach attempts, synchronization history, and audit evidence.
- Sheet attendance wins a conflict; the system retries three times, preserves evidence, and routes unresolved conflicts to a human.
- The instructor remains accountable for attendance; application roles have distinct powers.

### Time and policy became deterministic code

- The morning form releases at 9:15 AM Eastern.
- Missing check-in becomes late at 9:25 AM and the same unresolved incident becomes no-call/no-show at 10:45 AM.
- The exit ticket releases at 2:45 PM, with a 3:00 PM reminder and later human review.
- Attendance, punctuality, and completion are separate measures.
- Holidays, pauses, accommodations, corrections, retries, and day-close behavior are explicit.

### External effects were separated from planning

The worker supports `DISABLED`, `DRY_RUN`, and `ACTIVE`. Dry-run creates the same planned operations as active mode without sending messages or writing the Sheet. Active effects require later gates. This made it possible to test the hard business logic before credentials or real learners entered the path.

### Providers stayed behind typed boundaries

Google Sheets, Slack, and Resend are adapters rather than embedded business logic. Tests use sanitized fakes. Webhook signatures, timestamps, idempotency keys, and provider event IDs are verified at the boundary.

### Delivery was reproducible

- Vercel hosts the SvelteKit web application.
- A dedicated TypeScript worker runs through pinned Docker Compose on DigitalOcean.
- Neon provides managed Postgres with pooled runtime and direct migration connections.
- GitHub Actions is the deployment authority; provider-side Git deployment is disabled.
- Nix, exact package versions, committed locks, digest-pinned images, and immutable artifacts reduce drift.

## 3. The operating loop that repeatedly worked

| Stage             | Question                                                              | Evidence produced                            |
| ----------------- | --------------------------------------------------------------------- | -------------------------------------------- |
| Discover          | What is true in the real provider or workbook?                        | Bounded inventory, metadata, or owner answer |
| Bound             | What exact environment, row, branch, account, or channel is in scope? | Explicit target and exclusions               |
| Fail closed       | What happens when configuration is missing or wrong?                  | Capability disabled or request rejected      |
| Preflight         | Can configuration be validated without an external effect?            | Counts, modes, domains, and readiness only   |
| Authorize         | Has the owner approved this specific mutation or message?             | A clear, narrow approval                     |
| Canary            | What is the smallest real action that proves the boundary?            | One reversible write or staff-only message   |
| Adversarial check | Do duplicates, stale events, and tampering fail safely?               | Idempotency and rejection evidence           |
| Record            | Can another developer understand and recover the setup?               | Gate log, configuration ledger, and lessons  |

The pattern prevented a successful local preflight from being mistaken for successful provider behavior.

## 4. Gate-by-gate path

### Gate 1 — Google Sheet learner identity

Initial mapping assumptions did not match the real workbook. Screenshots showed rows 1–9 as metadata/header rows and the current learner roster as D10:D23. Merged cells, hidden columns, and new date columns made positional assumptions fragile.

The solution recognized the Email header semantically, used it as `learnerExternalIdColumn`, derived the contiguous populated range independently from session mapping, kept the end row refreshable, and added D10:D23 regression coverage. Inventory and validation retained no raw learner values.

Lesson: screenshots explain shape, but API-derived owner-only inventory is the machine contract.

### Gate 2 — Google Workspace authentication

The first callback looked like an OAuth state failure. Runtime evidence identified the real cause: the Workspace identity was valid but not provisioned as an active application account.

The solution separated authentication from authorization; used PKCE, one-time state/nonce, verified ID tokens, and hashed eight-hour sessions; scoped variables to UAT; maintained a stable callback alias; and provisioned the first administrator through a dry-run-first, UAT-only, idempotent command.

Lesson: diagnose from the server-side boundary, not only the browser symptom.

### Gate 3 — Neon database environments

This gate exposed the largest configuration burden: local development also served as UAT, production needed a distinct boundary, and runtime and migration connections had different purposes.

The solution recorded local/dev as UAT, kept production separate, used pooled URLs for runtime and direct URLs for migrations, required full TLS verification and channel binding, stored values externally, validated targets without printing them, required explicit migration approval, and independently checked migration status.

One verification command exposed a database password. The project treated it as compromised and required rotation.

Lesson: prove database identity with sanitized metadata; do not infer it from a filename.

### Gate 4 — GitHub, Vercel, and DigitalOcean UAT

Vercel UAT operates as a persistent branch-scoped Preview. GitHub environments and Actions became the deployment authority, Vercel Git deployments were disabled, a stable protected alias preserved OAuth callbacks, and Production stayed unconfigured. The worker ran on a hardened non-root DigitalOcean host with a read-only deploy key, external owner-only files, a mostly read-only filesystem, and `PHASE3_EXTERNAL_EFFECTS=false`.

Sharing the workbook with a personal account did not grant the dedicated service account access; that principal required its own Viewer grant.

Lesson: environment labels are not isolation. Branch restrictions, secret scope, stable URLs, deployment authority, and runtime evidence create isolation.

### Gate 5 — Slack UAT

Slack exposed three boundaries: URL verification rejected a mismatched signing secret, directory lookup used unexpected UAT database state, and learner mappings required human confirmation.

The solution kept signature validation strict, corrected the exact app secret, created a branch-specific UAT database override, resolved normalized organization emails, rejected bots/inactive users/duplicates, required administrator preview and atomic confirmation, sent one learner-free staff canary, and verified real reaction/thread events plus duplicate, stale, and tampered behavior.

Lesson: a provider lookup error can originate in application environment selection, not provider permissions.

### Gate 6 — Resend UAT

UAT and production use separate sending subdomains, keys, endpoints, and signing secrets. The sender required an allowlisted staff recipient and monitored Reply-To, reserved a private receipt before contact, and repeated the exact request under one idempotency key. Exactly one email arrived, real sent/delivered callbacks were recorded, and SPF, DKIM, and DMARC passed.

The message landed in spam. That did not invalidate authentication or Gate 6, but it remains a production inbox-placement risk.

Lesson: delivery, authentication, idempotency, and inbox placement are four different assertions.

## 5. Prompts and collaboration habits that helped

The strongest prompts supplied an exact observed result, corrected assumptions with concrete facts, asked how to close one gate, explicitly approved one consequential action, requested lessons after difficult setup, and used “resume” or “proceed” to preserve the current boundary.

The primary implementation agent was most effective when it inspected before changing, distinguished diagnosis from authorization, used count-only evidence, stopped before consequential actions, preserved unrelated worktree changes, documented recurring setup problems, and never copied secrets or learner data into Git.

## 6. Agents and responsibilities

| Agent or authority                     | Role in the successful path                                                                                     |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Product owner/gate authorizer          | Supplied facts, chose boundaries, approved consequential actions, and confirmed human-observed canaries         |
| Primary Codex implementation/FDE agent | Reviewed evidence, implemented safeguards, diagnosed failures, proposed bounded actions, and maintained records |
| `AGENTS.md`                            | Supplied standing rules for authority, privacy, adapters, tooling, secrets, verification, and approvals         |
| GitHub Actions                         | Became the mechanical deployment and reproducibility authority                                                  |
| LiftOff worker                         | Became the durable scheduling agent with deterministic jobs and an external-effects lock                        |
| Staff administrators                   | Retain authority for provisioning, mappings, templates, accommodations, activation, and rollback                |
| Shared operations-knowledge skill      | Preserved sanitized, verified troubleshooting and configuration patterns                                        |

The documented outcome does not depend on unsupervised multi-agent decisions. Accountability stayed with the product owner and primary implementation agent; CI and the worker execute constrained, testable roles.

## 7. How _The Back of the Napkin_ influenced the work

The documentation asked six visual questions:

- **Who/what:** learners, staff, web app, worker, Sheet, Postgres, and providers.
- **Where:** local/UAT, Vercel, DigitalOcean, Neon, and external providers.
- **Why:** which system or person has authority.
- **When:** the program day and promotion sequence.
- **How:** sign-in, evaluation, reconciliation, messaging, and rollback.
- **How much:** gate completion, counts, and confidence.

When Mermaid rendering was unreliable, compatible diagrams and text preserved the meaning.

## 8. Practices that should remain non-negotiable

1. Never infer a production target from a filename or UI label.
2. Keep secrets outside the worktree in owner-only locations.
3. Never print secrets, addresses, workbook IDs, or raw provider payloads during verification.
4. Keep learner-identifying fixtures and production records out of Git.
5. Require explicit authorization for migrations, deployments, provider changes, real messages, and live Sheet writes.
6. Use dry-run by default and gate external effects separately.
7. Reserve receipts before ambiguous provider calls.
8. Test duplicates, retries, stale events, wrong signatures, wrong environments, and rollback.
9. Promote the tested artifact rather than rebuilding production bits.
10. Record only verified, sanitized configuration evidence.

## 9. Friction worth improving

- Re-baseline historical activation dates before Gate 8.
- Synchronize older Phase 2 checklist items with later Gate 4–6 evidence.
- Keep provider lessons centered on invariant concepts rather than changing UI screenshots.
- Add a compact evidence index because proof is currently distributed.
- Carry the approved Gate 7 controls through migration, UAT deployment, notice publication, and exact active-path enforcement proof.
- Recheck spam placement with a production staff-only canary.

## 10. Status at this review

| Gate | Status  | Core proof                                                 |
| ---- | ------- | ---------------------------------------------------------- |
| 1    | Cleared | D10:D23 identities and growth procedure                    |
| 2    | Cleared | Corporate OAuth sign-in and provisioning                   |
| 3    | Cleared | Separated Neon targets and current migrations              |
| 4    | Cleared | GitHub-gated Vercel UAT and locked-down DO worker          |
| 5    | Cleared | Slack mapping, canary, real events, and adversarial checks |
| 6    | Cleared | One authenticated/idempotent staff email and callbacks     |
| 7    | Cleared | Approved review and locally verified privacy controls      |
| 8    | Pending | Dry-run days and formal review                             |
| 9    | Pending | Production Sheet-write canary                              |
| 10   | Pending | Written go/no-go and activation                            |

The next pending activation work is Gate 8 dry-run evidence; Gate 7 migration/deployment conditions must be completed before active outreach.

## References

- [Repository guidance](AGENTS.md)
- [Activation gates](ACTIVATION-GATES.md)
- [Design decisions](project-notes/design-decisions.md)
- [Phase 2 backlog](project-notes/phase-2.md)
- [Phase 3 execution](project-notes/phase-3.md)
- [System architecture](project-notes/system-architecture.md)
- [Project configuration ledger](project-notes/project_config.md)
- [Local secret-management lessons](project-notes/local-secret-management-lessons.md)
- [Neon environment lessons](project-notes/neon-environment-lessons.md)
- [Vercel environment lessons](project-notes/vercel-environment-lessons.md)
- [DigitalOcean worker lessons](project-notes/digitalocean-worker-lessons.md)
