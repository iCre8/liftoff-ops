# Gate 8 dry-run rehearsal runbook

- Status: Prepared locally; timed UAT evidence pending
- Prepared: 2026-07-20
- Owner: LiftOff administrator
- Safety boundary: zero provider sends and zero Google Sheet writes

## One-picture goal

```text
UAT Sheet (read only) ──> worker ──> planned operations ──> staff review
                              │                │
                              ├── Slack sends: 0
                              ├── email sends: 0
                              └── Sheet writes: 0
```

A dry-run day is evidence, not a demo. It passes only when the worker completes
the nine scheduled jobs, performs the bounded authoritative Sheet reads, records
one zero-effect audit for every job, and staff resolve every duplicate or mapping
issue before certifying the day.

## Before the July 24 rehearsal

The reviewed Gate 8 artifact must first be merged into `uat` and deployed to
both Vercel UAT and the DigitalOcean UAT worker at the exact same commit. Keep
`PHASE3_EXTERNAL_EFFECTS=false`; do not add provider sending credentials to the
worker.

In the authenticated UAT automation workspace, verify without copying learner
values into notes or logs:

- Cohort 3 contains the expected count of provisioned learners.
- The July 24 program session exists. If it does not, preview and confirm the
  already-discovered session catalog through the administrator workflow.
- The `late`, `no_call_no_show`, and `exit_reminder` template versions used
  by the rehearsal are approved.
- The copied UAT workbook is still shared Viewer-only with the UAT service
  account.
- The private Sheet mapping and Google credential files remain nonempty and mode
  `0600`.
- The UAT worker is healthy, has a current heartbeat, runs no local Postgres, and
  reports the external-effects lock as `false`.
- Cohort mode is `DISABLED` until the administrator intentionally changes it
  to `DRY_RUN`.

Stop if the web and worker commits differ, a secret file is missing, the Sheet
adapter is not read-only, or the cohort/session/template checks do not pass.

## Rehearsal-day sequence

All times are America/New_York.

| Time        | Expected job                                | Staff evidence                                       |
| ----------- | ------------------------------------------- | ---------------------------------------------------- |
| Before 9:15 | Administrator changes Cohort 3 to `DRY_RUN` | Audited mode change; active mode remains unavailable |
| 9:24        | Pre-trigger reconciliation                  | Bounded Sheet read recorded; no write                |
| 9:25        | Late evaluation                             | Planned learner/channel/template operations visible  |
| 10:44       | Pre-trigger reconciliation                  | Bounded Sheet read recorded; no write                |
| 10:45       | No-call/no-show evaluation                  | Planned transition and escalation categories visible |
| 11:00       | Sheet reconciliation                        | Read-only correction preview visible                 |
| 15:00       | Exit reminder                               | Planned reminder visible; no provider request        |
| 15:14       | Pre-trigger reconciliation                  | Bounded Sheet read recorded; no write                |
| 15:15       | Sheet reconciliation                        | Final read-only correction preview visible           |
| 15:15       | Incomplete-day evaluation                   | Planned review items visible                         |
| By 16:00    | Staff annotation and review                 | Issues resolved or the day is not certified          |

The worker may write jobs, previews, audits, and staff review evidence to
dev/UAT Postgres. Those are internal rehearsal records, not external effects.

## Certifying the day

In the automation workspace, choose the session date and record staff-observed
duplicate and unresolved-mapping counts. The server independently verifies:

1. Exactly nine required daily jobs exist.
2. Every required job completed in `DRY_RUN` mode.
3. Every job has exactly one `automation.dry_run.planned` audit.
4. Every audit records `externalMessages=0` and `externalWrites=0`.
5. Reconciliation previews report no unresolved Sheet mappings.
6. Staff-observed duplicate and unresolved-mapping counts are both zero.

The completion action fails closed if any check is missing. It writes a
count-only formal-review audit; it does not store learner values in the project
notes.

## Evidence to retain

Record only bounded metadata in the configuration ledger:

- date and environment;
- exact reviewed commit;
- worker/web commit match;
- nine completed jobs;
- zero duplicate jobs;
- zero unresolved mappings;
- zero provider messages;
- zero Sheet writes;
- reviewer role;
- defects found and the non-identifying resolution;
- baseline outreach-coordination minutes, incidents handled, and unresolved
  items.

Do not paste workbook IDs, cell values, learner references, provider IDs,
credentials, message bodies, or raw logs into Git.

## Pass, fail, and recovery

A day passes only after the server accepts the certification and staff complete
the review. A failed or partial day does not count toward the five-day gate.

For any unexpected behavior:

1. Change the cohort to `DISABLED`.
2. Stop the UAT worker if jobs continue to be claimed.
3. Confirm no provider request and no Sheet write occurred.
4. Inspect bounded job status, error codes, and counts.
5. Fix and verify on a short-lived branch from `uat`.
6. Repeat a complete day; never edit a partial day into a pass.

After the rehearsal, return the cohort to `DISABLED` unless the next approved
dry-run day begins immediately. Gate 8 remains pending until five complete days
and at least one formal staff review are recorded, or the administrator records
the approved minimum-one-day exception. The exception is not assumed by this
runbook.
