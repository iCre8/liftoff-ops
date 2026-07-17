<script lang="ts">
  let { data, form } = $props();
</script>

<svelte:head><title>Operations | LiftOff</title></svelte:head>
<main>
  <header>
    <p class="eyebrow">Attendance operations</p>
    <h1>{data.displayName}</h1>
    <p>Support, incidents, accommodations, and access</p>
    <nav><a href="/">Switch workspace</a> <a href="/learner-preview">Learner preview</a></nav>
  </header>
  {#if form?.message}<p class:success={form.success} class="notice">{form.message}</p>{/if}
  {#if form?.preview}<section>
      <h2>Import preview</h2>
      <p>
        {form.preview.total} rows | {form.preview.creates} creates | {form.preview.updates} updates |
        {form.preview.unchanged} unchanged
      </p>
      {#if form.accountImport}
        <form method="POST" action="?/importAccounts">
          <textarea name="csv" class="hidden-input">{form.accountImport.csv}</textarea>
          <button name="confirm" value="yes">Confirm atomic account import</button>
        </form>
      {/if}
    </section>{/if}
  {#if form?.sessionPreview}<section>
      <h2>Session preview</h2>
      <p>
        {form.sessionPreview.total} Sheet groups | {form.sessionPreview.creates} creates |
        {form.sessionPreview.updates} updates | {form.sessionPreview.unchanged} unchanged
      </p>
      <ul>
        {#each form.sessionPreview.sessions as session}
          <li>{session.sessionDate} | {session.change}</li>
        {/each}
      </ul>
      {#if form.sessionImport}
        <form method="POST" action="?/importSessions">
          <input type="hidden" name="cohortId" value={form.sessionImport.cohortId} />
          <button name="confirm" value="yes">Confirm atomic session import</button>
        </form>
      {/if}
    </section>{/if}
  <div class="grid">
    <section>
      <h2>Support queue</h2>
      {#each data.supportItems as item}<article>
          <span>{item.status}</span>
          <p>{item.summary}</p>
          <form method="POST" action="?/support">
            <input type="hidden" name="id" value={item.id} /><button name="mode" value="acknowledge"
              >Acknowledge</button
            ><button name="mode" value="resolve">Resolve</button>
          </form>
        </article>{:else}<p>Nothing needs attention.</p>{/each}
    </section>
    <section>
      <h2>Incident claims and outcomes</h2>
      {#each data.incidents as incident}<article>
          <strong>{incident.type}</strong><span>{incident.status}</span>
          <form method="POST" action="?/incident">
            <input
              type="hidden"
              name="id"
              value={incident.id}
            />{#if incident.status === 'OPEN'}<button name="mode" value="claim">Claim</button
              >{:else}<select name="result" required
                ><option value="">Contact result</option><option value="reached">Reached</option
                ><option value="left_message">Left message</option><option value="no_answer"
                  >No answer</option
                ><option value="learner_replied">Learner replied</option><option value="other"
                  >Other</option
                ></select
              ><select name="disposition" required
                ><option value="">Attendance disposition</option><option value="unchanged"
                  >Unchanged</option
                ><option value="excused">Excused</option><option value="corrected">Corrected</option
                ><option value="accommodation_review">Accommodation review</option><option
                  value="unresolved">Unresolved</option
                ></select
              ><input name="closureReason" placeholder="Closure reason" required /><input
                type="date"
                name="followUpDate"
              /><button name="mode" value="close">Save outcome</button>{/if}
          </form>
        </article>{:else}<p>No open incidents.</p>{/each}
    </section>
    <section>
      <h2>Accommodation review</h2>
      {#each data.accommodations as request}<article>
          <strong>{request.category}</strong>
          <p>{request.requestedAdjustment}</p>
          <p>{request.expectedBenefit}</p>
          <form method="POST" action="?/accommodation">
            <input type="hidden" name="id" value={request.id} /><select name="decision"
              ><option value="TEMPORARILY_PAUSED">Temporary pause</option>{#if data.isAdmin}<option
                  value="APPROVED">Approve</option
                ><option value="DENIED">Deny</option>{/if}</select
            ><button>Save review</button>
          </form>
        </article>{:else}<p>No requests awaiting review.</p>{/each}
    </section>
    {#if data.isAdmin}<section>
        <h2>Program sessions</h2>
        <p>
          The source is the read-only 42-group Sheet catalog. Confirmation changes Postgres only.
        </p>
        {#if data.sessionCatalogConfigured}
          <form method="POST" action="?/importSessions">
            <label
              >Cohort<select name="cohortId" required>
                <option value="">Select a cohort</option>
                {#each data.cohorts as cohort}<option value={cohort.id}>{cohort.name}</option
                  >{/each}
              </select></label
            >
            <button>Preview</button>
          </form>
        {:else}
          <p>Generate and configure the private Sheet session catalog to enable preview.</p>
        {/if}
        <h2>Account CSV</h2>
        <p>Headers: email, cohort, status, roles</p>
        <form method="POST" action="?/importAccounts">
          <textarea name="csv" required></textarea><button>Preview</button>
        </form>
        <h3>Directory</h3>
        <ul>
          {#each data.accounts as account}<li>{account.email} | {account.status}</li>{/each}
        </ul>
      </section>{/if}
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

  h1,
  h2,
  h3,
  p {
    margin-top: 0;
  }

  h1 {
    font-size: clamp(1.8rem, 4vw, 2.6rem);
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

  h3 {
    font-size: 1.05rem;
    font-weight: 700;
    margin: 1.75rem 0 1rem;
    color: var(--color-primary);
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

  nav {
    display: flex;
    gap: 0.75rem;
    margin-top: 1.5rem;
    position: relative;
    z-index: 2;
  }

  nav a {
    color: white;
    font-weight: 700;
    font-size: 0.85rem;
    padding: 0.6rem 1.1rem;
    border: 1.5px solid rgba(255, 255, 255, 0.2);
    border-radius: var(--radius-sm);
    text-decoration: none;
    transition: all var(--transition-fast);
    backdrop-filter: blur(4px);
  }

  nav a:hover {
    background: white;
    color: var(--color-primary);
    border-color: white;
    box-shadow: var(--shadow-md);
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
    gap: 0.6rem;
  }

  article:first-of-type {
    border-top: none;
    padding-top: 0;
  }

  article span {
    align-self: flex-start;
    padding: 0.25rem 0.65rem;
    border-radius: 999px;
    background: var(--color-accent-light);
    color: var(--color-accent-hover);
    font-weight: 800;
    font-size: 0.75rem;
    letter-spacing: 0.02em;
    border: 1px solid var(--color-card-border);
  }

  article strong {
    font-size: 1.05rem;
    color: var(--color-primary);
    font-weight: 700;
  }

  form {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }

  button,
  select,
  input,
  textarea {
    padding: 0.7rem 0.9rem;
    border: 1.5px solid var(--color-card-border);
    border-radius: var(--radius-sm);
    background: rgba(255, 255, 255, 0.6);
    color: var(--color-text);
    font: inherit;
    font-size: 0.9rem;
    transition: all var(--transition-fast);
  }

  button:focus,
  select:focus,
  input:focus,
  textarea:focus {
    outline: none;
    border-color: var(--color-accent);
    background: white;
    box-shadow: 0 0 0 3px var(--color-accent-glow);
  }

  button {
    background: var(--color-accent);
    color: white;
    font-weight: 700;
    cursor: pointer;
    border: none;
    box-shadow: var(--shadow-sm);
  }

  button:hover {
    background: var(--color-accent-hover);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px var(--color-accent-glow);
  }

  button:active {
    transform: translateY(0);
  }

  textarea {
    width: 100%;
    min-height: 8rem;
    resize: vertical;
    line-height: 1.5;
  }

  .hidden-input {
    display: none;
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

  @media (max-width: 860px) {
    .grid {
      grid-template-columns: 1fr;
      gap: 1.25rem;
    }

    header {
      flex-direction: column;
      align-items: stretch;
      gap: 1rem;
    }

    nav {
      align-self: flex-start;
    }
  }
</style>
