<svelte:head><title>Attendance Privacy Notice | LiftOff</title></svelte:head>

<main>
  <p class="eyebrow">Learner notice</p>
  <h1>Attendance and communications notice</h1>
  <p>
    LiftOff uses an attendance-support system for Cohort 3 to record check-ins and exit tickets,
    identify missed attendance actions, and coordinate timely support.
  </p>

  <h2>Information used</h2>
  <p>
    The system may use your organization account, program schedule, form submissions, attendance
    status and corrections, communication choices, submitted support or accommodation requests,
    attendance incidents, staff follow-up status, and limited delivery metadata.
  </p>

  <h2>How it is used</h2>
  <p>
    Google Sheets remains the official attendance record. LiftOff stores related incident, outreach,
    correction, and audit history in its program database. The system does not make disciplinary,
    payment, or accommodation decisions automatically. A missing exit ticket does not automatically
    mark you absent.
  </p>

  <h2>Communication window and choices</h2>
  <p>
    When enabled, automated attendance messages may be sent through approved program Slack or
    organization email between approximately 9:25 AM and 4:00 PM Eastern on active program days. You
    may stop or resume automated email, Slack, or both. This does not alter attendance records or
    prevent necessary human staff follow-up.
  </p>
  <p>
    <a href="/learner/communication-preferences">Manage attendance communication preferences</a>
  </p>

  <h2>Access, exports, and retention</h2>
  <p>
    Access is limited by staff role and cohort. Accommodation information has narrower access.
    Attendance exports exclude form responses, support text, accommodation details, and message
    bodies, but remain restricted program data. An administrator reviews retained learner-related
    data after three years; permanent deletion is never automatic and active holds prevent deletion.
  </p>

  <h2>Corrections and questions</h2>
  <p>
    Ask the program administrator to correct attendance, explain your records, or help with
    communication preferences. Do not send sensitive accommodation details through ordinary email
    unless staff direct you to an approved method.
  </p>

  <nav>
    <a href="/learner">Return to My Day</a><a href="/learner/communication-preferences"
      >Communication preferences</a
    >
  </nav>
</main>

<style>
  main {
    width: min(800px, calc(100% - 2rem));
    margin: 0 auto;
    padding: 3rem 0 6rem;
  }
  h1 {
    margin-top: 0;
  }
  h2 {
    margin-top: 2rem;
  }
  p {
    line-height: 1.7;
  }
  .eyebrow {
    color: var(--color-text-muted);
    font-size: 0.75rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.12em;
  }
  nav {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    margin-top: 2rem;
  }
</style>
