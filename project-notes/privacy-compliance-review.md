# Gate 7 privacy and compliance review

Status: Cleared — administrator review recorded; local controls verified  
Review completed: 2026-07-20  
Scope: LiftOff Program Cohort 3 attendance automation

This is an implementation and governance record, not legal advice. It records the administrator's supplied facts and decisions, implemented safeguards, verification evidence, and the deployment conditions that remain before learner outreach can be activated.

## One-picture data boundary

```text
learner + staff inputs
        |
        +--> Google Sheet (attendance authority)
        |
        +--> LiftOff / Postgres
                 | identities, forms, accommodations
                 | incidents, outreach metadata, audit history
                 |
                 +--> restricted staff dashboards and audited minimized CSV
                 +--> Slack / Resend only after Gate 10
```

## Administrator decisions

| Area                     | Approved decision                                                                                                                             |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Learners                 | All Cohort 3 learners are at least 18                                                                                                         |
| FERPA relationship       | On facts supplied, no applicable Department of Education funding or covered-institution relationship; reassess if funding or contracts change |
| Notice                   | Fresh notice approved for enrollment materials, the authenticated learner workspace, and every automated learner email                        |
| Contact window           | 9:25 AM–approximately 4:00 PM Eastern on active program days                                                                                  |
| Communication choice     | Authenticated, immediate per-channel email/Slack stop and resume before activation; no reason required                                        |
| Retention                | Administrator review after three calendar years across all learner-data categories; no automatic deletion                                     |
| Holds                    | Administrator-only, category-specific hold with bounded reason, owner, placement date, and future review date                                 |
| Accommodation access     | Administrators, facilitators, and assigned instructors/TAs; outreach/support and read-only roles excluded from detailed request content       |
| Exports                  | Every learner-level CSV export audited with count-only metadata                                                                               |
| Vendor/security response | Administrator owns vendor review and security-event coordination                                                                              |

Approved artifacts:

- `project-notes/learner-privacy-communications-notice.md`
- `project-notes/communications-opt-out-form.md`
- `project-notes/privacy-operations-procedure.md`

## Verified control matrix

| Area                             | Evidence                                                                                               | Result                  |
| -------------------------------- | ------------------------------------------------------------------------------------------------------ | ----------------------- |
| Record authority                 | Sheet controls attendance; Postgres controls incident/outreach history                                 | Pass                    |
| Authentication and authorization | Corporate Google identity, provisioned active account, role and cohort checks                          | Pass                    |
| Sessions and logging             | Hashed session tokens; bounded metadata and count-only logs                                            | Pass                    |
| Learner choice                   | Durable per-channel model, authenticated form, transactional both-channel updates                      | Pass locally            |
| Pre-send enforcement             | Preference-aware delivery returns `SUPPRESSED`, audits it, and makes zero provider calls               | Pass locally            |
| Email notice                     | Stable HTTPS preference route required; URL cannot contain credentials, query, or fragment             | Pass locally            |
| Dry-run planning                 | Disabled channels are removed; no eligible channel is explicitly marked suppressed                     | Pass locally            |
| Export minimization              | Sensitive narrative fields excluded; each CSV export adds actor/cohort/format/row-count audit evidence | Pass locally            |
| Retention                        | Cohort archive creates 12 category reviews due three calendar years later                              | Pass locally            |
| Holds                            | Bounded reason and future review date required; action is audited                                      | Pass locally            |
| Provider events                  | Signature checked; only bounded event metadata retained                                                | Pass                    |
| External effects                 | Cohort remains disabled; migration unapplied; controls undeployed                                      | Safe boundary preserved |

## Data categories under three-year review

1. Accounts and authentication sessions
2. Learner identifiers and provider mappings
3. Submissions and revisions
4. Attendance records
5. Incidents and outreach
6. Support items
7. Accommodations and pauses
8. Synchronization history
9. Audit history
10. Provider metadata
11. Reporting and baselines
12. Automation jobs

Permanent deletion remains disabled. A later deletion workflow must refuse deletion while a category hold is active and must record the administrator's review decision.

## Verification evidence

- Prisma schema formatting, generation, and validation passed.
- Svelte/TypeScript reported zero errors and zero warnings.
- All 25 test files and 100 sanitized tests passed.
- Tests prove both-channel preference expansion, channel fallback/suppression, zero provider contact for an opted-out channel, enabled delivery, email preference-link validation, CSV row counting, and all 12 retention categories.
- No real provider message, Sheet write, database migration, deployment, learner contact, or provider configuration change occurred during Gate 7 implementation.

## Deployment conditions carried to Gate 10

Gate 7 is the recorded privacy/compliance review and is cleared. Clearance does not authorize external effects. Before active learner outreach:

1. Apply the committed Gate 7 migration to the confirmed dev/UAT target under separate migration authorization.
2. Deploy the reviewed artifact to UAT and verify the authenticated notice and preference route.
3. Prove a stored opt-out suppresses the exact active delivery path immediately before provider contact.
4. Configure the stable environment-specific `LEARNER_COMMUNICATION_PREFERENCES_URL`.
5. Publish the approved notice in all three locations and retain count-only approval/publication evidence.
6. Repeat the enforcement proof in the production release candidate before Gate 10 approval.

## Decision record

- Reviewer role: Administrator
- Review and approval date: 2026-07-20
- Applicable basis recorded: adult learners; no covered Department of Education relationship reported; program, contract, security, and Pennsylvania obligations remain subject to ongoing administrator review
- Review cadence: annually and on material changes
- Decision: Gate 7 cleared
- Technical control confidence: **98%**
- Policy-evidence confidence: **95%**
- Overall Gate 7 confidence: **96%**

The residual uncertainty reflects the stated legal-scope assumptions and the intentionally unapplied/undeployed controls, not a known defect in the local implementation.

## Authoritative starting references

- [U.S. Department of Education — FERPA](https://studentprivacy.ed.gov/ferpa)
- [FTC — CAN-SPAM compliance guide](https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business)
- [Pennsylvania General Assembly — Breach of Personal Information Notification Act](https://www.legis.state.pa.us/WU01/LI/LI/CT/HTM/73/00.023..HTM)
- [NIST Privacy Framework](https://www.nist.gov/privacy-framework)
