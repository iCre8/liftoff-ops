# Communications opt-out form — implementation contract

Status: Approved and implemented; dev/UAT migration applied, deployment pending
Recorded: 2026-07-20

## Purpose

Provide every authenticated learner a simple way to stop or resume automated attendance email and Slack messages without changing the authoritative attendance record or disabling necessary human follow-up.

## Learner experience

Route: `/learner/communication-preferences`

The signed-in form should show the current state and offer:

- Stop automated email
- Stop automated Slack messages
- Stop both automated channels
- Resume automated email
- Resume automated Slack messages
- Resume both automated channels

The learner identity comes from the authenticated session. The form must not ask the learner to type an email address, Slack ID, or another learner identifier.

Recommended confirmation copy:

> Your request has been recorded. Automated attendance messages on the selected channel are now suppressed. Attendance recording and necessary human program follow-up continue. You can change this preference later.

## Enforcement rules

1. Suppression becomes effective transactionally when the request is accepted; it does not wait for manual approval.
2. Every active delivery path must recheck the current preference immediately before each learner provider call through the preference-aware delivery service.
3. A suppressed operation is recorded as suppressed, not failed, and is never backfilled later.
4. Staff task and Program Director escalation behavior may continue because they are internal staff workflows, but they must not cause an automated learner message through an opted-out channel.
5. An administrator may correct a preference only with a recorded reason. Learner-initiated resumption does not need staff approval.
6. Existing accepted provider requests cannot be recalled. The UI must explain this if a request races with a send.
7. Opt-out does not delete attendance, incidents, audit evidence, or prior delivery metadata.

## Minimum stored evidence

Store only:

- learner relation;
- channel;
- enabled or suppressed state;
- request source (`learner_form`, `admin_recorded_request`, or `learner_resume`);
- effective timestamp;
- actor relation;
- optional bounded administrator reason for a correction.

Do not require a learner to explain why they are opting out.

## Email link

Every automated learner email should include a **Manage attendance communication preferences** link to the stable authenticated LiftOff route. Do not place a bearer token, learner identifier, or email address in the URL. If the learner is signed out, normal Google Workspace authentication returns them to the preference form.

## Acceptance criteria

- An authenticated learner can view and change only their own preferences.
- Email-only, Slack-only, both-channel suppression, and channel resumption are tested.
- A queued job rechecks suppression before provider contact when active delivery wiring is introduced.
- No provider call occurs for a suppressed learner channel.
- Suppressed messages are not sent after resumption.
- Staff workflows remain separate from learner-channel suppression.
- Admin corrections require a reason and create an audit event.
- Every email template renders the stable preference-management link.
- Sanitized tests use fakes and send no real message.

## Activation boundary

The form, durable storage model, preference-aware zero-provider-call service, dry-run channel suppression, and email preference link are implemented and tested. The migration is applied to dev/UAT, while the controls remain intentionally undeployed. Gate 10 must verify the migration and exact deployed active delivery wiring before automated learner outreach is enabled.
