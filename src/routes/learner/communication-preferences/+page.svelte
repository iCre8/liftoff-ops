<script lang="ts">
  let { data, form } = $props();
</script>

<svelte:head><title>Communication Preferences | LiftOff</title></svelte:head>

<main>
  <header>
    <p class="eyebrow">Learner controls</p>
    <h1>Attendance communication preferences</h1>
    <p>
      Stop or resume automated attendance messages. These choices do not change your attendance
      record and do not prevent necessary human staff follow-up.
    </p>
  </header>

  {#if form?.message}
    <p class:success={form.success} class="notice">{form.message}</p>
  {/if}

  <section class="status-grid" aria-label="Current automated communication status">
    <article>
      <h2>Organization email</h2>
      <strong>{data.emailEnabled ? 'Enabled' : 'Suppressed'}</strong>
      {#if data.emailEffectiveAt}<small
          >Updated {new Date(data.emailEffectiveAt).toLocaleString()}</small
        >{/if}
    </article>
    <article>
      <h2>Slack</h2>
      <strong>{data.slackEnabled ? 'Enabled' : 'Suppressed'}</strong>
      {#if data.slackEffectiveAt}<small
          >Updated {new Date(data.slackEffectiveAt).toLocaleString()}</small
        >{/if}
    </article>
  </section>

  <section>
    <h2>Change automated messages</h2>
    <p>You do not need to provide a reason. A new request replaces your current choice.</p>
    <div class="actions">
      <form method="POST" action="?/update">
        <input type="hidden" name="preferenceAction" value="STOP_EMAIL" />
        <button>Stop email</button>
      </form>
      <form method="POST" action="?/update">
        <input type="hidden" name="preferenceAction" value="STOP_SLACK" />
        <button>Stop Slack</button>
      </form>
      <form method="POST" action="?/update">
        <input type="hidden" name="preferenceAction" value="STOP_BOTH" />
        <button>Stop both</button>
      </form>
      <form method="POST" action="?/update">
        <input type="hidden" name="preferenceAction" value="RESUME_EMAIL" />
        <button class="secondary">Resume email</button>
      </form>
      <form method="POST" action="?/update">
        <input type="hidden" name="preferenceAction" value="RESUME_SLACK" />
        <button class="secondary">Resume Slack</button>
      </form>
      <form method="POST" action="?/update">
        <input type="hidden" name="preferenceAction" value="RESUME_BOTH" />
        <button class="secondary">Resume both</button>
      </form>
    </div>
  </section>

  <nav>
    <a href="/learner">Return to My Day</a><a href="/learner/privacy">Read the privacy notice</a>
  </nav>
</main>

<style>
  main {
    width: min(900px, calc(100% - 2rem));
    margin: 0 auto;
    padding: 3rem 0 6rem;
    display: grid;
    gap: 1.5rem;
  }
  header,
  section {
    padding: 1.5rem;
    border: 1px solid var(--color-card-border);
    border-radius: var(--radius-lg);
    background: var(--color-card-bg);
  }
  h1,
  h2,
  p {
    margin-top: 0;
  }
  .eyebrow {
    color: var(--color-text-muted);
    font-size: 0.75rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.12em;
  }
  .status-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
  }
  article {
    padding: 1rem;
    border-radius: var(--radius-md);
    background: var(--color-accent-light);
    display: grid;
    gap: 0.4rem;
  }
  article h2 {
    font-size: 1rem;
    margin: 0;
  }
  small {
    color: var(--color-text-muted);
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
  }
  button {
    border: 0;
    border-radius: var(--radius-sm);
    padding: 0.75rem 1rem;
    background: #9f2f2f;
    color: white;
    font-weight: 750;
    cursor: pointer;
  }
  button.secondary {
    background: var(--color-accent);
  }
  .notice {
    padding: 1rem;
    border-radius: var(--radius-md);
    background: hsl(3, 100%, 96%);
  }
  .notice.success {
    background: hsl(140, 52%, 94%);
  }
  nav {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
  }
  @media (max-width: 640px) {
    .status-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
