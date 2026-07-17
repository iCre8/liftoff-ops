<script lang="ts">
  let { data } = $props();
</script>

<svelte:head>
  <title>LiftOff Attendance Operations</title>
  <meta
    name="description"
    content="Operational readiness dashboard for the LiftOff attendance automation MVP"
  />
</svelte:head>

<main>
  <header>
    <div>
      <p class="eyebrow">Attendance operations</p>
      <h1>{data.cohort}</h1>
      <p class="lede">
        The approved attendance rules are executable. Provider writes remain disabled until their
        non-production contracts and identities are verified.
      </p>
    </div>
    <span class="mode">Integration mode: {data.integrationMode}</span>
  </header>

  <section class="workspace-entry" aria-labelledby="workspace-entry">
    <div>
      <p class="eyebrow">Module 2 workspace</p>
      <h2 id="workspace-entry">
        {data.accountName ? `Continue as ${data.accountName}` : 'Open the forms workspace'}
      </h2>
    </div>
    <div class="workspace-links">
      {#each data.workspaces as workspace}
        <a href={workspace.href}>
          <strong>{workspace.label}</strong>
          <span>{workspace.description}</span>
        </a>
      {/each}
      {#if data.workspaces.length === 0 && data.developmentSignInHref}
        <a href={data.developmentSignInHref}>
          <strong>Choose a sanitized development identity</strong>
          <span>Use the learner identity to view and submit today&apos;s forms.</span>
        </a>
      {:else if data.workspaces.length === 0 && data.googleSignInHref}
        <a href={data.googleSignInHref}>
          <strong>Sign in with Google Workspace</strong>
          <span>Use your company-provided @launchpadphilly.org account.</span>
        </a>
      {:else if data.workspaces.length === 0}
        <p>Google Workspace sign-in is not configured in this environment yet.</p>
      {/if}
    </div>
    {#if data.accountName}
      <form method="POST" action="/auth/logout"><button>Sign out</button></form>
    {/if}
  </section>

  <section aria-labelledby="daily-schedule">
    <div class="section-heading">
      <div>
        <p class="eyebrow">America/New_York</p>
        <h2 id="daily-schedule">Daily schedule</h2>
      </div>
      <p>Active program days only</p>
    </div>
    <ol class="timeline">
      {#each data.schedule as event}
        <li>
          <time>{event.time}</time>
          <span>{event.label}</span>
        </li>
      {/each}
    </ol>
  </section>

  <section aria-labelledby="readiness">
    <div class="section-heading">
      <div>
        <p class="eyebrow">Safe implementation boundary</p>
        <h2 id="readiness">Integration readiness</h2>
      </div>
    </div>
    <ul class="readiness-grid">
      {#each data.readiness as item}
        <li>
          <span class:ready={item.state === 'implemented'} class="status-dot"></span>
          <div>
            <strong>{item.label}</strong>
            <span>{item.state}</span>
          </div>
        </li>
      {/each}
    </ul>
  </section>

  <section class="policy" aria-labelledby="thresholds">
    <div>
      <p class="eyebrow">Two-week view</p>
      <h2 id="thresholds">Attendance thresholds</h2>
    </div>
    <div class="threshold healthy">
      <strong>Healthy</strong>
      <span>80% or higher</span>
    </div>
    <div class="threshold warning">
      <strong>Warning</strong>
      <span>75%-79.99%</span>
    </div>
    <div class="threshold concern">
      <strong>Concern</strong>
      <span>Below 75%</span>
    </div>
  </section>
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
    box-shadow: var(--shadow-md);
    backdrop-filter: blur(12px);
    transition:
      transform var(--transition-normal),
      box-shadow var(--transition-normal),
      border-color var(--transition-normal);
  }

  header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 2rem;
    padding: clamp(2rem, 5vw, 3.5rem);
    background: linear-gradient(135deg, var(--color-primary) 0%, hsl(155, 60%, 11%) 100%);
    color: hsl(140, 40%, 96%);
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
  p {
    margin-top: 0;
  }

  h1 {
    max-width: 15ch;
    margin-bottom: 1.25rem;
    font-size: clamp(2.2rem, 5vw, 3.8rem);
    font-weight: 800;
    line-height: 1.05;
    letter-spacing: -0.04em;
    color: white;
  }

  h2 {
    margin-bottom: 0.5rem;
    font-size: clamp(1.3rem, 3vw, 1.8rem);
    font-weight: 700;
    letter-spacing: -0.025em;
  }

  .eyebrow {
    margin-bottom: 0.75rem;
    color: var(--color-text-muted);
    font-size: 0.75rem;
    font-weight: 800;
    letter-spacing: 0.16em;
    text-transform: uppercase;
  }

  header .eyebrow {
    color: hsl(145, 65%, 65%);
  }

  .lede {
    max-width: 60ch;
    margin-bottom: 0;
    color: hsl(140, 20%, 82%);
    line-height: 1.7;
    font-size: 1.05rem;
  }

  .mode {
    flex: none;
    padding: 0.6rem 1.1rem;
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.08);
    color: hsl(140, 100%, 92%);
    font-size: 0.82rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    backdrop-filter: blur(4px);
    box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.1);
  }

  section {
    padding: clamp(1.5rem, 3vw, 2.5rem);
  }

  section:hover {
    border-color: rgba(47, 112, 74, 0.25);
    box-shadow: var(--shadow-lg);
  }

  .section-heading {
    display: flex;
    justify-content: space-between;
    gap: 1.5rem;
    margin-bottom: 2rem;
    border-bottom: 1px solid var(--color-card-border);
    padding-bottom: 1.25rem;
  }

  .section-heading > p {
    align-self: flex-end;
    margin-bottom: 0;
    color: var(--color-text-muted);
    font-size: 0.88rem;
    font-weight: 500;
  }

  .timeline,
  .readiness-grid {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .timeline {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 1.25rem;
  }

  .timeline li {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    min-height: 8.5rem;
    gap: 1.25rem;
    padding: 1.5rem;
    border: 1px solid var(--color-card-border);
    border-radius: var(--radius-md);
    background: rgba(255, 255, 255, 0.4);
    transition: all var(--transition-normal);
  }

  .timeline li:hover {
    transform: translateY(-4px);
    border-color: var(--color-accent);
    background: white;
    box-shadow: var(--shadow-md);
  }

  time {
    color: var(--color-accent);
    font-size: 0.88rem;
    font-weight: 800;
    font-family: var(--font-heading);
    letter-spacing: -0.01em;
  }

  .timeline span {
    font-weight: 700;
    font-size: 1.05rem;
    color: var(--color-primary);
    line-height: 1.3;
  }

  .readiness-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
  }

  .readiness-grid li {
    display: flex;
    align-items: flex-start;
    gap: 0.85rem;
    min-height: 6.5rem;
    padding: 1.25rem;
    border: 1px solid var(--color-card-border);
    border-radius: var(--radius-md);
    background: rgba(255, 255, 255, 0.4);
    transition: all var(--transition-normal);
  }

  .readiness-grid li:hover {
    transform: translateY(-3px);
    border-color: var(--color-accent);
    background: white;
    box-shadow: var(--shadow-md);
  }

  .readiness-grid div {
    display: grid;
    align-content: start;
    gap: 0.35rem;
  }

  .readiness-grid strong {
    font-size: 0.95rem;
    font-weight: 700;
    color: var(--color-primary);
    line-height: 1.3;
  }

  .readiness-grid div span {
    color: var(--color-text-muted);
    font-size: 0.8rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .status-dot {
    width: 0.6rem;
    height: 0.6rem;
    flex: none;
    margin-top: 0.35rem;
    border-radius: 50%;
    background: hsl(38, 90%, 55%);
    box-shadow: 0 0 8px hsla(38, 90%, 55%, 0.4);
    transition: all var(--transition-normal);
  }

  .status-dot.ready {
    background: var(--color-accent);
    box-shadow: 0 0 12px var(--color-accent-glow);
    animation: pulse-green 2.5s infinite alternate ease-in-out;
  }

  @keyframes pulse-green {
    0% {
      box-shadow: 0 0 2px var(--color-accent-glow);
    }
    100% {
      box-shadow: 0 0 12px var(--color-accent);
    }
  }

  .workspace-entry {
    display: grid;
    grid-template-columns: 0.9fr 1.1fr;
    gap: 2rem;
    align-items: center;
  }

  .workspace-links {
    display: grid;
    gap: 1rem;
  }

  .workspace-links a {
    display: grid;
    gap: 0.35rem;
    padding: 1.5rem;
    border: 1px solid var(--color-card-border);
    border-radius: var(--radius-md);
    background: var(--color-accent-light);
    color: var(--color-primary);
    text-decoration: none;
    transition: all var(--transition-normal);
    box-shadow: var(--shadow-sm);
  }

  .workspace-links a:hover,
  .workspace-links a:focus-visible {
    border-color: var(--color-accent);
    background: white;
    transform: translateY(-3px);
    box-shadow: var(--shadow-md);
    outline: 3px solid var(--color-accent-glow);
  }

  .workspace-links a strong {
    font-family: var(--font-heading);
    font-size: 1.15rem;
    font-weight: 700;
  }

  .workspace-links span {
    color: var(--color-text-muted);
    font-size: 0.88rem;
    line-height: 1.4;
  }

  form button {
    padding: 0.75rem 1.5rem;
    border: 1px solid var(--color-card-border);
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--color-text-muted);
    font-weight: 700;
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  form button:hover {
    background: hsl(0, 75%, 97%);
    color: hsl(0, 75%, 45%);
    border-color: hsl(0, 75%, 90%);
  }

  .policy {
    display: grid;
    grid-template-columns: 1.2fr repeat(3, 1fr);
    gap: 1rem;
    align-items: stretch;
  }

  .policy > div:first-child {
    align-self: center;
  }

  .threshold {
    display: grid;
    align-content: center;
    gap: 0.4rem;
    min-height: 7.5rem;
    padding: 1.5rem;
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-sm);
    border: 1px solid transparent;
    transition: all var(--transition-normal);
  }

  .threshold:hover {
    transform: scale(1.03);
    box-shadow: var(--shadow-md);
  }

  .threshold strong {
    font-family: var(--font-heading);
    font-size: 1.25rem;
    font-weight: 700;
  }

  .threshold span {
    font-size: 0.9rem;
    font-weight: 600;
    opacity: 0.85;
  }

  .healthy {
    background: hsl(140, 52%, 94%);
    color: hsl(150, 48%, 16%);
    border-color: hsl(140, 50%, 88%);
  }

  .warning {
    background: hsl(45, 100%, 94%);
    color: hsl(40, 60%, 20%);
    border-color: hsl(45, 90%, 86%);
  }

  .concern {
    background: hsl(3, 100%, 96%);
    color: hsl(3, 60%, 25%);
    border-color: hsl(3, 90%, 90%);
  }

  @media (max-width: 860px) {
    main {
      padding-top: 1rem;
      gap: 1.25rem;
    }

    header,
    .section-heading,
    .workspace-entry {
      flex-direction: column;
      grid-template-columns: 1fr;
      align-items: stretch;
      gap: 1.5rem;
    }

    .mode {
      align-self: flex-start;
    }

    .timeline,
    .readiness-grid {
      grid-template-columns: 1fr;
    }

    .policy {
      grid-template-columns: 1fr;
    }

    .timeline li {
      min-height: auto;
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
      gap: 1.5rem;
      padding: 1.25rem;
    }
  }
</style>
