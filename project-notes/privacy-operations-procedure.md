# Privacy operations procedure

Status: Approved by administrator
Approved: 2026-07-20
Scope: LiftOff Program Cohort 3

## Access and exports

- Accommodation request text, review notes, and rule overrides are limited to administrators, facilitators, and instructors/TAs assigned to the cohort. Outreach/support and read-only roles do not receive this detail.
- Learner-level CSV exports are restricted program data. Every export creates a count-only audit event containing the actor, cohort, format, timestamp, and row count—not learner values or CSV content.
- Export recipients must keep files in an approved restricted location and remove local copies when the operational purpose ends.

## Three-year review and holds

- Archiving a cohort creates one review due three calendar years later for each approved learner-data category.
- Permanent deletion is never automatic. An administrator records `retain` or `delete` only after checking operational, contractual, audit, and legal/policy needs.
- An administrator may place a category-specific hold only with a bounded reason, owner, placement date, and future review date. The hold blocks a deletion decision until it is explicitly released and audited.
- Review categories cover accounts/sessions, identifiers/mappings, submissions/revisions, attendance, incidents/outreach, support, accommodations/pauses, synchronization, audits, provider metadata, reporting/baselines, and automation jobs.

## Vendors and security events

The administrator owns the inventory and response for Google Workspace/Sheets, Neon, Vercel, DigitalOcean, Slack, and Resend.

For an onboarding or annual review, record only the vendor, system function, data category, environment, access scope, contractual/security review date, and owner. Do not copy contracts, credentials, learner values, or provider identifiers into the repository.

For a suspected event:

1. Set affected cohorts to `DISABLED`, stop new worker claims, and remove or revoke the affected credential or integration.
2. Preserve bounded audit/provider metadata and infrastructure evidence; do not paste raw learner or message content into tickets or logs.
3. Determine systems, time window, data categories, and approximate record count with the vendor as needed.
4. The administrator decides escalation, legal review, and learner or authority notification under applicable contracts and law.
5. Record the decision, recovery action, credential rotation, validation evidence, and follow-up owner without sensitive values.

## Communication preferences

- Learners can stop or resume automated email, Slack, or both from the authenticated preference page. No reason is required.
- The current choice is checked immediately before provider contact. A disabled channel produces a count-only `suppressed` audit outcome and zero provider calls.
- Administrator corrections require a bounded reason and audit event. Human program follow-up remains available and must not masquerade as automated outreach.
- Every automated learner email includes the stable authenticated preference URL; the URL contains no learner identifier or bearer token.

## Review cadence

Review this procedure at least annually and whenever a data use, role, vendor, channel, retention rule, or legal relationship materially changes.
