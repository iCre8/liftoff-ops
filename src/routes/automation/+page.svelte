<script lang="ts">
  let { data, form } = $props();
</script>

<svelte:head><title>Automation controls | LiftOff</title></svelte:head>
<main>
  <header>
    <div>
      <p class="eyebrow">Phase 3</p>
      <h1>Automation controls</h1>
    </div>
    <a href="/">Switch workspace</a>
  </header>
  {#if form?.message}<p class:success={form.success} class="notice">{form.message}</p>{/if}
  <div class="grid">
    <section>
      <h2>Cohort modes</h2>
      {#each data.cohorts as cohort}
        <article>
          <strong>{cohort.name}</strong><span>{cohort.automationMode}</span>
          <p>{cohort._count.automationJobs} queued/review jobs</p>
          {#if data.isAdmin}
            <form method="POST" action="?/mode">
              <input type="hidden" name="cohortId" value={cohort.id} />
              <button name="mode" value="DISABLED">Disable</button>
              <button name="mode" value="DRY_RUN">Dry run</button>
              {#if data.activeModeEnabled}<button name="mode" value="ACTIVE">Activate</button>{/if}
            </form>
          {/if}
        </article>
      {/each}
    </section>
    <section>
      <h2>Job review</h2>
      {#each data.jobs as job}
        <article>
          <strong>{job.type}</strong><span>{job.status}</span><time>{job.runAt}</time>
        </article>
      {:else}<p>No jobs require attention.</p>{/each}
    </section>
    <section>
      <h2>Dry-run operation previews</h2>
      {#each data.dryRunPlans as plan}
        <article>
          <strong>{plan.type}</strong><time>{plan.runAt}</time>
          <pre>{JSON.stringify(plan.payload, null, 2)}</pre>
        </article>
      {:else}<p>No completed dry-run previews yet.</p>{/each}
    </section>
    <section>
      <h2>Templates</h2>
      <ul>
        {#each data.templates as template}<li>
            {template.key} v{template.version} | {template.status}
            {#if data.canManageTemplates && template.status === 'DRAFT'}<form
                method="POST"
                action="?/templateApprove"
              >
                <input type="hidden" name="id" value={template.id} /><button>Approve</button>
              </form>{/if}
          </li>{/each}
      </ul>
      {#if data.canManageTemplates && data.cohorts[0]}
        <form method="POST" action="?/templateDraft">
          <select name="cohortId"
            >{#each data.cohorts as cohort}<option value={cohort.id}>{cohort.name}</option
              >{/each}</select
          >
          <input name="key" placeholder="Template key" required />
          <textarea name="content" placeholder="Supportive approved wording" required></textarea>
          <button>Create new draft version</button>
        </form>
      {/if}
    </section>
    <section>
      <h2>Blackouts and pauses</h2>
      {#if data.isAdmin && data.cohorts[0]}
        <form method="POST" action="?/blackout">
          <select name="cohortId"
            >{#each data.cohorts as cohort}<option value={cohort.id}>{cohort.name}</option
              >{/each}</select
          >
          <input type="date" name="date" required /><input
            name="reason"
            placeholder="Reason"
            required
          />
          <button>Add blackout</button>
        </form>
      {/if}
      {#if data.canManageTemplates && data.cohorts[0]}
        <form method="POST" action="?/pause">
          <select name="cohortId"
            >{#each data.cohorts as cohort}<option value={cohort.id}>{cohort.name}</option
              >{/each}</select
          >
          <label>Starts<input type="datetime-local" name="startsAt" required /></label>
          <label>Ends<input type="datetime-local" name="endsAt" /></label>
          <input name="reason" placeholder="Reason" required /><button>Save pause</button>
        </form>
      {/if}
      <ul>
        {#each data.blackouts as blackout}<li>{blackout.date} | {blackout.reason}</li>{/each}
      </ul>
    </section>
    <section>
      <h2>Recipient mapping readiness</h2>
      {#each data.mappingCounts as mapping}
        <p>
          {mapping.verifiedSlackMappings} of {mapping.learners} learners have a stable Slack mapping.
        </p>
      {:else}<p>No learner mappings are configured.</p>{/each}
      <p>Mappings are counted only; identifiers are not displayed in this preview.</p>
    </section>
    <section>
      <h2>Unresolved review</h2>
      {#each data.unresolvedReviews as review}
        <article>
          <strong>{review.incident.type} · {review.incident.learner.externalId}</strong>
          <span>{review.status} · due {review.dueAt}</span>
          {#if data.canReview}
            <form method="POST" action="?/annotateReview">
              <input type="hidden" name="id" value={review.id} />
              <input name="status" placeholder="Status" required />
              <input name="actionTaken" placeholder="Action taken" required />
              <input name="disposition" placeholder="Disposition" required />
              <textarea name="closureNote" placeholder="Closure note" required></textarea>
              <button>Save annotation</button>
            </form>
          {/if}
        </article>
      {:else}<p>No unresolved incidents require annotation.</p>{/each}
    </section>
    <section>
      <h2>Baseline and dry-run evidence</h2>
      {#if data.canReview && data.cohorts[0]}
        <form method="POST" action="?/baseline">
          <select name="cohortId"
            >{#each data.cohorts as cohort}<option value={cohort.id}>{cohort.name}</option
              >{/each}</select
          >
          <input type="date" name="date" required />
          <input type="number" min="0" name="minutes" placeholder="Coordination minutes" required />
          <input type="number" min="0" name="incidents" placeholder="Incidents handled" required />
          <input type="number" min="0" name="unresolved" placeholder="Unresolved items" required />
          <button>Save baseline</button>
        </form>
        <form method="POST" action="?/dryRunReview">
          <select name="cohortId"
            >{#each data.cohorts as cohort}<option value={cohort.id}>{cohort.name}</option
              >{/each}</select
          >
          <input type="date" name="date" required />
          <input type="number" min="0" name="duplicates" value="0" required />
          <input type="number" min="0" name="mappings" value="0" required />
          <button>Complete and review dry-run day</button>
        </form>
      {/if}
      <p>
        {data.baselines.length} baseline measurements · {data.dryRunDays.length} dry-run records
      </p>
    </section>
    <section>
      <h2>Reconciliation and reports</h2>
      {#if data.canReview && data.sessions[0]}
        <form method="POST" action="?/reconcileNow">
          <select name="sessionId"
            >{#each data.sessions as session}<option value={session.id}
                >{session.sessionDate}</option
              >{/each}</select
          >
          <button>Queue bounded reconciliation</button>
        </form>
      {/if}
      {#each data.cohorts as cohort}
        <p><a href={`/automation/report.csv?cohortId=${cohort.id}`}>Export {cohort.name} CSV</a></p>
      {/each}
    </section>
    <section>
      <h2>Outreach retry controls</h2>
      {#each data.outreach as attempt}
        <form method="POST" action="?/resend">
          <input type="hidden" name="id" value={attempt.id} />
          <span>{attempt.channel} · {attempt.status} · attempt {attempt.attemptNumber}</span>
          <input name="reason" placeholder="Admin reason for successful resend" />
          <button>Queue resend preview</button>
        </form>
      {:else}<p>No attempts are eligible for resend review.</p>{/each}
    </section>
    {#if data.isAdmin && data.cohorts[0]}
      <section>
        <h2>Cohort archival</h2>
        <form method="POST" action="?/archive">
          <select name="cohortId"
            >{#each data.cohorts as cohort}<option value={cohort.id}>{cohort.name}</option
              >{/each}</select
          >
          <input name="confirmation" placeholder="Type ARCHIVE" required />
          <button>Archive with recovery snapshots</button>
        </form>
      </section>
    {/if}
    {#if data.isAdmin && data.archivedCohorts[0]}
      <section>
        <h2>Archival recovery</h2>
        <form method="POST" action="?/restoreArchive">
          <select name="cohortId"
            >{#each data.archivedCohorts as cohort}<option value={cohort.id}>{cohort.name}</option
              >{/each}</select
          >
          <input name="confirmation" placeholder="Type RESTORE" required />
          <button>Restore archived incidents</button>
        </form>
      </section>
    {/if}
  </div>
</main>

<style>
  :global(body) {
    background-color: var(--color-bg);
  }

  main {
    width: min(1200px, calc(100% - 2.5rem));
    margin: 0 auto;
    padding: 3rem 0 6rem;
    display: flex;
    flex-direction: column;
    gap: 1.75rem;
  }

  header,
  section {
    background: var(--color-card-bg);
    border: 1px solid var(--color-card-border);
    border-radius: var(--radius-lg);
    padding: clamp(1.5rem, 3vw, 2.5rem);
    box-shadow: var(--shadow-md);
    backdrop-filter: blur(12px);
    transition:
      border-color var(--transition-normal),
      box-shadow var(--transition-normal);
  }

  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 2rem;
    background: linear-gradient(135deg, var(--color-primary) 0%, hsl(155, 60%, 11%) 100%);
    color: white;
    border: 1px solid rgba(255, 255, 255, 0.08);
    position: relative;
    overflow: hidden;
  }

  header::before {
    content: '';
    position: absolute;
    top: -50%;
    right: -20%;
    width: 60%;
    height: 200%;
    background: radial-gradient(circle, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0) 70%);
    transform: rotate(-15deg);
    pointer-events: none;
  }

  header a {
    color: white;
    font-weight: 700;
    font-size: 0.9rem;
    padding: 0.75rem 1.25rem;
    border: 1.5px solid rgba(255, 255, 255, 0.25);
    border-radius: var(--radius-sm);
    text-decoration: none;
    transition: all var(--transition-fast);
    backdrop-filter: blur(4px);
    z-index: 2;
  }

  header a:hover {
    background: white;
    color: var(--color-primary);
    border-color: white;
    box-shadow: var(--shadow-md);
  }

  h1,
  h2,
  p {
    margin-top: 0;
  }

  h1 {
    font-size: clamp(1.8rem, 3.5vw, 2.6rem);
    font-weight: 800;
    letter-spacing: -0.03em;
    margin-bottom: 0.35rem;
    color: white;
  }

  h2 {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--color-primary);
    margin-bottom: 1.25rem;
    letter-spacing: -0.01em;
  }

  .eyebrow {
    color: var(--color-text-muted);
    font-size: 0.72rem;
    font-weight: 800;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    margin-bottom: 0.5rem;
  }

  header .eyebrow {
    color: hsl(145, 65%, 65%);
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1.5rem;
  }

  section:hover {
    border-color: rgba(47, 112, 74, 0.2);
    box-shadow: var(--shadow-lg);
  }

  article {
    border-top: 1px solid var(--color-card-border);
    padding: 1.25rem 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  article:first-of-type {
    border-top: none;
    padding-top: 0;
  }

  article strong {
    font-size: 1.05rem;
    color: var(--color-primary);
    font-weight: 700;
  }

  article span {
    align-self: flex-start;
    padding: 0.2rem 0.6rem;
    border-radius: 999px;
    background: var(--color-accent-light);
    color: var(--color-accent-hover);
    font-weight: 800;
    font-size: 0.75rem;
    letter-spacing: 0.02em;
    border: 1px solid var(--color-card-border);
  }

  form {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-top: 0.5rem;
  }

  input,
  select,
  textarea,
  button {
    padding: 0.75rem 1rem;
    border: 1.5px solid var(--color-card-border);
    border-radius: var(--radius-sm);
    background: rgba(255, 255, 255, 0.6);
    color: var(--color-text);
    font: inherit;
    font-size: 0.95rem;
    transition: all var(--transition-fast);
  }

  input:focus,
  select:focus,
  textarea:focus,
  button:focus {
    outline: none;
    border-color: var(--color-accent);
    background: white;
    box-shadow: 0 0 0 3px var(--color-accent-glow);
  }

  textarea {
    min-height: 7rem;
    resize: vertical;
    line-height: 1.5;
  }

  pre {
    background: rgba(0, 0, 0, 0.03);
    border: 1px solid var(--color-card-border);
    border-radius: var(--radius-sm);
    padding: 1.25rem;
    overflow: auto;
    white-space: pre-wrap;
    font-size: 0.8rem;
    color: var(--color-primary-light);
    font-family: monospace;
  }

  button {
    background: var(--color-accent);
    color: white;
    font-weight: 800;
    cursor: pointer;
    border: none;
    box-shadow: var(--shadow-sm);
    align-self: flex-start;
  }

  button:hover {
    background: var(--color-accent-hover);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px var(--color-accent-glow);
  }

  button:active {
    transform: translateY(0);
  }

  .notice {
    padding: 1rem 1.5rem;
    border-radius: var(--radius-md);
    background: hsl(3, 100%, 96%);
    color: hsl(3, 60%, 25%);
    border: 1px solid hsl(3, 90%, 90%);
    font-weight: 600;
    font-size: 0.95rem;
    line-height: 1.5;
    margin: 0;
  }

  .notice.success {
    background: hsl(140, 52%, 94%);
    color: hsl(150, 48%, 16%);
    border-color: hsl(140, 50%, 88%);
  }

  ul {
    margin: 0.75rem 0;
    padding-left: 1.25rem;
    display: grid;
    gap: 0.5rem;
  }

  li {
    color: var(--color-text);
    font-size: 0.95rem;
    line-height: 1.4;
  }

  label {
    display: grid;
    gap: 0.35rem;
    font-weight: 700;
    font-size: 0.9rem;
    color: var(--color-primary);
  }

  @media (max-width: 860px) {
    .grid {
      grid-template-columns: 1fr;
      gap: 1.25rem;
    }

    header {
      flex-direction: column;
      align-items: stretch;
      gap: 1.5rem;
    }

    header a {
      align-self: flex-start;
    }
  }
</style>
