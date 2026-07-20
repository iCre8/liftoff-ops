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
  <header class="hero-banner">
    <div class="hero-content">
      <p class="eyebrow">Attendance Operations Engine</p>
      <h1>{data.cohort}</h1>
      <p class="lede">
        The approved attendance rules and multi-role operations pipeline are fully executable.
        Provider writes remain safe-gated in dry-run mode.
      </p>
    </div>
    <div class="hero-status">
      <span class="mode-chip">Mode: {data.integrationMode}</span>
      <span class="time-chip">America/New_York (EST)</span>
    </div>
  </header>

  <!-- Workspace Entry Cards -->
  <section class="panel workspace-panel" aria-labelledby="workspace-entry">
    <div class="panel-top">
      <div>
        <p class="eyebrow">Module 2 Workspace</p>
        <h2 id="workspace-entry">
          {data.accountName ? `Logged in as ${data.accountName}` : 'Available Workspaces'}
        </h2>
      </div>
      {#if data.accountName}
        <form method="POST" action="/auth/logout">
          <button class="btn-logout">Sign out</button>
        </form>
      {/if}
    </div>

    <div class="workspace-grid">
      {#each data.workspaces as workspace}
        <a href={workspace.href} class="workspace-card">
          <div class="card-icon">
            {#if workspace.href.includes('learner')}
              🌅
            {:else if workspace.href.includes('operations')}
              📥
            {:else if workspace.href.includes('automation')}
              ⚡
            {:else}
              🚀
            {/if}
          </div>
          <div class="card-text">
            <strong>{workspace.label}</strong>
            <p>{workspace.description}</p>
          </div>
          <div class="arrow">→</div>
        </a>
      {/each}

      {#if data.workspaces.length === 0 && data.developmentSignInHref}
        <a href={data.developmentSignInHref} class="workspace-card dev-card">
          <div class="card-icon">🔑</div>
          <div class="card-text">
            <strong>Choose a Sanitized Development Identity</strong>
            <p>Use the learner or staff identity to test forms and operations.</p>
          </div>
          <div class="arrow">→</div>
        </a>
      {:else if data.workspaces.length === 0 && data.googleSignInHref}
        <a href={data.googleSignInHref} class="workspace-card google-card">
          <div class="card-icon">🌐</div>
          <div class="card-text">
            <strong>Sign in with Google Workspace</strong>
            <p>Use your company-provided @launchpadphilly.org account.</p>
          </div>
          <div class="arrow">→</div>
        </a>
      {:else if data.workspaces.length === 0}
        <div class="info-card">
          <p>Google Workspace sign-in is not configured in this environment yet.</p>
        </div>
      {/if}
    </div>
  </section>

  <!-- Daily Program Schedule -->
  <section class="panel" aria-labelledby="daily-schedule">
    <div class="panel-top">
      <div>
        <p class="eyebrow">Cohort Routine</p>
        <h2 id="daily-schedule">Daily Attendance Schedule</h2>
      </div>
      <span class="pill-badge">Active Program Days Only</span>
    </div>

    <ol class="schedule-timeline">
      {#each data.schedule as event}
        <li class="timeline-step">
          <div class="step-time">{event.time}</div>
          <div class="step-line">
            <span class="step-dot"></span>
          </div>
          <div class="step-label">{event.label}</div>
        </li>
      {/each}
    </ol>
  </section>

  <!-- Integration Readiness Boundary -->
  <section class="panel" aria-labelledby="readiness">
    <div class="panel-top">
      <div>
        <p class="eyebrow">Safe Implementation Boundary</p>
        <h2 id="readiness">Integration Readiness Status</h2>
      </div>
    </div>

    <ul class="readiness-grid">
      {#each data.readiness as item}
        <li class="readiness-card">
          <span class="status-dot" class:ready={item.state === 'implemented'}></span>
          <div class="readiness-text">
            <strong>{item.label}</strong>
            <span class="state-lbl">{item.state}</span>
          </div>
        </li>
      {/each}
    </ul>
  </section>

  <!-- Attendance Policy Thresholds -->
  <section class="panel policy-panel" aria-labelledby="thresholds">
    <div class="panel-top">
      <div>
        <p class="eyebrow">Two-Week View</p>
        <h2 id="thresholds">Attendance Rate Thresholds</h2>
      </div>
    </div>

    <div class="threshold-grid">
      <div class="threshold-card healthy">
        <span class="t-badge">Healthy</span>
        <strong class="t-val">80% or higher</strong>
        <p class="t-desc">On-track attendance status with standard support</p>
      </div>

      <div class="threshold-card warning">
        <span class="t-badge">Warning</span>
        <strong class="t-val">75% – 79.99%</strong>
        <p class="t-desc">Early warning state requiring TA/Instructor outreach</p>
      </div>

      <div class="threshold-card concern">
        <span class="t-badge">Concern</span>
        <strong class="t-val">Below 75%</strong>
        <p class="t-desc">Escalated concern state with mandatory action plan</p>
      </div>
    </div>
  </section>
</main>

<style>
  main {
    width: min(1280px, calc(100% - 2.5rem));
    margin: 0 auto;
    padding: 2.5rem 0 6rem;
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  .hero-banner {
    background: linear-gradient(135deg, var(--color-primary) 0%, hsl(155, 60%, 11%) 100%);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: var(--radius-lg);
    padding: clamp(2.5rem, 5vw, 3.5rem);
    color: white;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 2rem;
    box-shadow: var(--shadow-md);
    position: relative;
    overflow: hidden;
  }

  .hero-banner::before {
    content: '';
    position: absolute;
    top: -50%;
    right: -20%;
    width: 60%;
    height: 200%;
    background: radial-gradient(circle, rgba(255, 255, 255, 0.06) 0%, rgba(255, 255, 255, 0) 70%);
    transform: rotate(-15deg);
    pointer-events: none;
  }

  .eyebrow {
    color: hsl(145, 65%, 65%);
    font-size: 0.75rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    margin: 0 0 0.4rem;
  }

  h1 {
    font-size: clamp(2.2rem, 4.5vw, 3.2rem);
    font-weight: 800;
    letter-spacing: -0.04em;
    margin: 0 0 0.85rem;
    color: white;
  }

  .lede {
    max-width: 65ch;
    color: hsl(140, 20%, 85%);
    line-height: 1.6;
    margin: 0;
    font-size: 1rem;
  }

  .hero-status {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.5rem;
  }

  .mode-chip,
  .time-chip {
    padding: 0.4rem 0.9rem;
    border-radius: 999px;
    font-size: 0.75rem;
    font-weight: 800;
    letter-spacing: 0.04em;
  }

  .mode-chip {
    background: var(--color-accent);
    color: white;
  }

  .time-chip {
    background: rgba(255, 255, 255, 0.12);
    color: white;
    border: 1px solid rgba(255, 255, 255, 0.2);
  }

  .panel {
    background: var(--color-card-bg);
    border: 1px solid var(--color-card-border);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-md);
    backdrop-filter: blur(12px);
    overflow: hidden;
  }

  .panel-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem 1.75rem;
    border-bottom: 1px solid var(--color-card-border);
    background: rgba(255, 255, 255, 0.4);
  }

  .panel-top h2 {
    font-size: 1.25rem;
    font-weight: 800;
    margin: 0;
    color: var(--color-primary);
  }

  .pill-badge {
    padding: 0.35rem 0.85rem;
    border-radius: 999px;
    background: var(--color-accent-light);
    color: var(--color-accent-hover);
    font-size: 0.78rem;
    font-weight: 800;
  }

  .workspace-grid {
    padding: 1.5rem 1.75rem;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 1.25rem;
  }

  .workspace-card {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1.25rem;
    background: white;
    border: 1px solid var(--color-card-border);
    border-radius: var(--radius-md);
    text-decoration: none;
    transition: all var(--transition-normal);
  }

  .workspace-card:hover {
    transform: translateY(-2px);
    border-color: var(--color-accent);
    box-shadow: var(--shadow-md);
  }

  .card-icon {
    font-size: 1.75rem;
    width: 3rem;
    height: 3rem;
    border-radius: var(--radius-sm);
    background: var(--color-accent-light);
    display: grid;
    place-items: center;
    flex-shrink: 0;
  }

  .card-text {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    flex-grow: 1;
  }

  .card-text strong {
    font-size: 1rem;
    color: var(--color-primary);
  }

  .card-text p {
    font-size: 0.82rem;
    color: var(--color-text-muted);
    margin: 0;
  }

  .arrow {
    font-size: 1.25rem;
    color: var(--color-accent);
    transition: transform var(--transition-fast);
  }

  .workspace-card:hover .arrow {
    transform: translateX(4px);
  }

  .btn-logout {
    padding: 0.5rem 1rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--color-card-border);
    background: white;
    color: hsl(0, 70%, 45%);
    font-weight: 700;
    font-size: 0.82rem;
    cursor: pointer;
  }

  .schedule-timeline {
    padding: 2rem 1.75rem;
    margin: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .timeline-step {
    display: flex;
    align-items: center;
    gap: 1.5rem;
  }

  .step-time {
    font-family: var(--font-heading);
    font-weight: 800;
    font-size: 0.95rem;
    color: var(--color-accent);
    width: 6ch;
  }

  .step-line {
    position: relative;
    display: grid;
    place-items: center;
  }

  .step-dot {
    width: 0.65rem;
    height: 0.65rem;
    border-radius: 50%;
    background: var(--color-accent);
    box-shadow: 0 0 8px var(--color-accent-glow);
  }

  .step-label {
    font-weight: 600;
    font-size: 0.95rem;
    color: var(--color-primary);
  }

  .readiness-grid {
    padding: 1.5rem 1.75rem;
    margin: 0;
    list-style: none;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 1rem;
  }

  .readiness-card {
    display: flex;
    align-items: center;
    gap: 0.85rem;
    padding: 1rem;
    background: white;
    border: 1px solid var(--color-card-border);
    border-radius: var(--radius-md);
  }

  .status-dot {
    width: 0.75rem;
    height: 0.75rem;
    border-radius: 50%;
    background: hsl(45, 90%, 50%);
  }

  .status-dot.ready {
    background: hsl(145, 65%, 45%);
    box-shadow: 0 0 8px hsl(145, 65%, 45%);
  }

  .readiness-text {
    display: flex;
    flex-direction: column;
  }

  .readiness-text strong {
    font-size: 0.9rem;
    color: var(--color-primary);
  }

  .state-lbl {
    font-size: 0.78rem;
    color: var(--color-text-muted);
    text-transform: capitalize;
  }

  .threshold-grid {
    padding: 1.5rem 1.75rem;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 1.25rem;
  }

  .threshold-card {
    padding: 1.5rem;
    border-radius: var(--radius-md);
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    border: 1px solid var(--color-card-border);
  }

  .threshold-card.healthy {
    background: hsl(140, 50%, 96%);
    border-color: hsl(140, 50%, 85%);
  }

  .threshold-card.warning {
    background: hsl(45, 100%, 96%);
    border-color: hsl(45, 90%, 85%);
  }

  .threshold-card.concern {
    background: hsl(3, 100%, 96%);
    border-color: hsl(3, 90%, 88%);
  }

  .t-badge {
    font-size: 0.75rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .healthy .t-badge {
    color: hsl(145, 75%, 28%);
  }
  .warning .t-badge {
    color: hsl(40, 80%, 30%);
  }
  .concern .t-badge {
    color: hsl(3, 75%, 38%);
  }

  .t-val {
    font-size: 1.5rem;
    font-weight: 800;
    font-family: var(--font-heading);
    color: var(--color-primary);
  }

  .t-desc {
    font-size: 0.82rem;
    color: var(--color-text-muted);
    margin: 0;
  }

  @media (max-width: 860px) {
    .hero-banner {
      flex-direction: column;
    }
    .hero-status {
      align-items: flex-start;
    }
  }
</style>
