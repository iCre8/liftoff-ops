<script lang="ts">
  let { data, form } = $props();

  let activeTab = $state<'incidents' | 'accommodations' | 'roster'>('incidents');
</script>

<svelte:head><title>Operations | LiftOff</title></svelte:head>

<main>
  <header class="page-header">
    <div class="header-content">
      <p class="eyebrow">Attendance Operations</p>
      <h1>{data.displayName}</h1>
      <p class="lede">
        Manage support requests, open attendance incidents, accommodations, program sessions, and
        learner accounts.
      </p>
    </div>
    <div class="header-badges">
      <span class="cohort-pill">Cohort 3</span>
      <span class="role-pill">{data.isAdmin ? 'Administrator' : 'Operations Staff'}</span>
    </div>
  </header>

  {#if form?.message}
    <div class="notice-banner" class:success={form.success}>
      <span class="notice-icon">{form.success ? '✓' : 'ℹ'}</span>
      <p>{form.message}</p>
    </div>
  {/if}

  {#if form?.preview}
    <section class="preview-card">
      <div class="card-header">
        <h2>Account Import Preview</h2>
        <span class="pill-badge">{form.preview.total} Rows Analyzed</span>
      </div>
      <div class="stats-row">
        <div class="stat-box create">
          <span class="stat-num">{form.preview.creates}</span>
          <span class="stat-lbl">Creates</span>
        </div>
        <div class="stat-box update">
          <span class="stat-num">{form.preview.updates}</span>
          <span class="stat-lbl">Updates</span>
        </div>
        <div class="stat-box unchanged">
          <span class="stat-num">{form.preview.unchanged}</span>
          <span class="stat-lbl">Unchanged</span>
        </div>
      </div>
      {#if form.accountImport}
        <form method="POST" action="?/importAccounts" class="confirm-form">
          <textarea name="csv" class="hidden-input">{form.accountImport.csv}</textarea>
          <button name="confirm" value="yes" class="btn-primary"
            >Confirm Atomic Account Import</button
          >
        </form>
      {/if}
    </section>
  {/if}

  {#if form?.sessionPreview}
    <section class="preview-card">
      <div class="card-header">
        <h2>Session Catalog Import Preview</h2>
        <span class="pill-badge">{form.sessionPreview.total} Sheet Groups</span>
      </div>
      <div class="stats-row">
        <div class="stat-box create">
          <span class="stat-num">{form.sessionPreview.creates}</span>
          <span class="stat-lbl">Creates</span>
        </div>
        <div class="stat-box update">
          <span class="stat-num">{form.sessionPreview.updates}</span>
          <span class="stat-lbl">Updates</span>
        </div>
        <div class="stat-box unchanged">
          <span class="stat-num">{form.sessionPreview.unchanged}</span>
          <span class="stat-lbl">Unchanged</span>
        </div>
      </div>
      <ul class="preview-list">
        {#each form.sessionPreview.sessions as session}
          <li>
            <strong>{session.sessionDate}</strong>
            <span class="tag-change">{session.change}</span>
          </li>
        {/each}
      </ul>
      {#if form.sessionImport}
        <form method="POST" action="?/importSessions" class="confirm-form">
          <input type="hidden" name="cohortId" value={form.sessionImport.cohortId} />
          <button name="confirm" value="yes" class="btn-primary"
            >Confirm Atomic Session Import</button
          >
        </form>
      {/if}
    </section>
  {/if}

  <!-- Tab Navigation -->
  <div class="tab-navigation">
    <button
      class="tab-btn"
      class:active={activeTab === 'incidents'}
      onclick={() => (activeTab = 'incidents')}
    >
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor">
        <path
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
      Support & Incidents
      {#if data.supportItems.length + data.incidents.length > 0}
        <span class="tab-count">{data.supportItems.length + data.incidents.length}</span>
      {/if}
    </button>

    <button
      class="tab-btn"
      class:active={activeTab === 'accommodations'}
      onclick={() => (activeTab = 'accommodations')}
    >
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor">
        <path
          d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
      Accommodations
      {#if data.accommodations.length > 0}
        <span class="tab-count">{data.accommodations.length}</span>
      {/if}
    </button>

    {#if data.isAdmin}
      <button
        class="tab-btn"
        class:active={activeTab === 'roster'}
        onclick={() => (activeTab = 'roster')}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor">
          <path
            d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        Sessions & Roster
      </button>
    {/if}
  </div>

  <!-- TAB 1: Support & Incidents -->
  {#if activeTab === 'incidents'}
    <div class="grid-layout">
      <!-- Support Queue Section -->
      <section class="panel">
        <div class="panel-header">
          <div>
            <h2>Support Queue</h2>
            <p class="subtitle">Learner assistance and check-in blockers</p>
          </div>
          <span class="counter-badge">{data.supportItems.length} Pending</span>
        </div>

        <div class="panel-body">
          {#each data.supportItems as item}
            <article class="card-item">
              <div class="item-top">
                <span class="status-chip {item.status.toLowerCase()}">{item.status}</span>
              </div>
              <p class="summary-text">{item.summary}</p>
              <form method="POST" action="?/support" class="action-row">
                <input type="hidden" name="id" value={item.id} />
                <button name="mode" value="acknowledge" class="btn-sm secondary">Acknowledge</button
                >
                <button name="mode" value="resolve" class="btn-sm primary">Resolve</button>
              </form>
            </article>
          {:else}
            <div class="empty-state">
              <span class="icon">✨</span>
              <p>Support queue is empty. Everything looks great!</p>
            </div>
          {/each}
        </div>
      </section>

      <!-- Incident Claims Section -->
      <section class="panel">
        <div class="panel-header">
          <div>
            <h2>Incident Claims & Outcomes</h2>
            <p class="subtitle">Late and No-Call/No-Show outreach tracking</p>
          </div>
          <span class="counter-badge warning">{data.incidents.length} Active</span>
        </div>

        <div class="panel-body">
          {#each data.incidents as incident}
            <article class="card-item incident-card">
              <div class="item-top">
                <strong class="incident-title">{incident.type.replaceAll('_', ' ')}</strong>
                <span class="status-chip {incident.status.toLowerCase()}">{incident.status}</span>
              </div>

              <form method="POST" action="?/incident" class="incident-form">
                <input type="hidden" name="id" value={incident.id} />

                {#if incident.status === 'OPEN'}
                  <button name="mode" value="claim" class="btn-primary full-width"
                    >Claim Incident Call</button
                  >
                {:else}
                  <div class="form-grid">
                    <label>
                      <span>Contact Result</span>
                      <select name="result" required>
                        <option value="">Choose result</option>
                        <option value="reached">Reached Learner</option>
                        <option value="left_message">Left Message</option>
                        <option value="no_answer">No Answer</option>
                        <option value="learner_replied">Learner Replied</option>
                        <option value="other">Other</option>
                      </select>
                    </label>

                    <label>
                      <span>Attendance Disposition</span>
                      <select name="disposition" required>
                        <option value="">Choose disposition</option>
                        <option value="unchanged">Unchanged</option>
                        <option value="excused">Excused</option>
                        <option value="corrected">Corrected</option>
                        <option value="accommodation_review">Accommodation Review</option>
                        <option value="unresolved">Unresolved</option>
                      </select>
                    </label>

                    <label class="full-col">
                      <span>Closure Reason & Notes</span>
                      <input name="closureReason" placeholder="Describe the outcome..." required />
                    </label>

                    <label>
                      <span>Follow-up Date</span>
                      <input type="date" name="followUpDate" />
                    </label>
                  </div>
                  <button name="mode" value="close" class="btn-primary">Save Outcome & Close</button
                  >
                {/if}
              </form>
            </article>
          {:else}
            <div class="empty-state">
              <span class="icon">🛡️</span>
              <p>No active incidents requiring outreach at this time.</p>
            </div>
          {/each}
        </div>
      </section>
    </div>
  {/if}

  <!-- TAB 2: Accommodations -->
  {#if activeTab === 'accommodations'}
    <section class="panel full-width-panel">
      <div class="panel-header">
        <div>
          <h2>Accommodation Reviews</h2>
          <p class="subtitle">Learner schedule adjustments and support accommodation requests</p>
        </div>
        <span class="counter-badge">{data.accommodations.length} Pending Requests</span>
      </div>

      <div class="panel-body grid-cards">
        {#each data.accommodations as request}
          <article class="card-item accommodation-card">
            <div class="item-top">
              <strong class="category-title">{request.category.replaceAll('_', ' ')}</strong>
              <span class="status-chip warning">Pending Review</span>
            </div>

            <div class="request-details">
              <div class="detail-block">
                <span class="detail-label">Requested Adjustment</span>
                <p>{request.requestedAdjustment}</p>
              </div>

              <div class="detail-block">
                <span class="detail-label">Expected Benefit</span>
                <p>{request.expectedBenefit}</p>
              </div>
            </div>

            <form method="POST" action="?/accommodation" class="review-form">
              <input type="hidden" name="id" value={request.id} />
              <label>
                <span>Select Decision</span>
                <select name="decision" required>
                  <option value="TEMPORARILY_PAUSED">Apply Temporary Pause</option>
                  {#if data.isAdmin}
                    <option value="APPROVED">Approve Accommodation</option>
                    <option value="DENIED">Deny Request</option>
                  {/if}
                </select>
              </label>
              <button class="btn-primary">Save Decision</button>
            </form>
          </article>
        {:else}
          <div class="empty-state">
            <span class="icon">🤝</span>
            <p>No accommodation requests awaiting staff review.</p>
          </div>
        {/each}
      </div>
    </section>
  {/if}

  <!-- TAB 3: Sessions & Roster (Admin Only) -->
  {#if activeTab === 'roster' && data.isAdmin}
    <div class="grid-layout">
      <!-- Session Catalog Import Section -->
      <section class="panel">
        <div class="panel-header">
          <div>
            <h2>Program Session Catalog</h2>
            <p class="subtitle">Sheet header catalog import into Postgres</p>
          </div>
        </div>

        <div class="panel-body">
          {#if data.sessionCatalogConfigured}
            <form method="POST" action="?/importSessions" class="standard-form">
              <label>
                <span>Select Target Cohort</span>
                <select name="cohortId" required>
                  <option value="">Select a cohort</option>
                  {#each data.cohorts as cohort}
                    <option value={cohort.id}>{cohort.name}</option>
                  {/each}
                </select>
              </label>
              <button class="btn-primary">Preview Sheet Sessions</button>
            </form>
          {:else}
            <div class="info-box">
              <p>
                Configure the private Sheet session catalog file (`LIFTOFF_SESSION_CATALOG_FILE`) to
                enable session import previews.
              </p>
            </div>
          {/if}

          <div class="directory-list">
            <h3>Registered Cohorts</h3>
            <ul>
              {#each data.cohorts as cohort}
                <li>
                  <strong>{cohort.name}</strong>
                  <span>Active Cohort</span>
                </li>
              {/each}
            </ul>
          </div>
        </div>
      </section>

      <!-- Roster CSV Import & Accounts Directory -->
      <section class="panel">
        <div class="panel-header">
          <div>
            <h2>Account Roster Management</h2>
            <p class="subtitle">CSV import & account provisioning</p>
          </div>
          <span class="counter-badge">{data.accounts.length} Accounts</span>
        </div>

        <div class="panel-body">
          <form method="POST" action="?/importAccounts" class="standard-form">
            <label>
              <span>Account CSV Payload</span>
              <p class="input-hint">Headers: email, cohort, status, roles</p>
              <textarea
                name="csv"
                placeholder="email,cohort,status,roles&#10;user@launchpadphilly.org,Cohort 3,ACTIVE,LEARNER"
                required></textarea>
            </label>
            <button class="btn-primary">Preview Account Import</button>
          </form>

          <div class="directory-list">
            <h3>Provisioned Accounts Directory</h3>
            <ul class="account-scroll-list">
              {#each data.accounts as account}
                <li>
                  <div class="acc-info">
                    <strong>{account.displayName || account.email}</strong>
                    <span class="acc-email">{account.email}</span>
                  </div>
                  <span class="status-chip {account.status.toLowerCase()}">{account.status}</span>
                </li>
              {/each}
            </ul>
          </div>
        </div>
      </section>
    </div>
  {/if}
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

  .page-header {
    background: linear-gradient(135deg, var(--color-primary) 0%, hsl(155, 60%, 11%) 100%);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: var(--radius-lg);
    padding: clamp(2rem, 4vw, 3rem);
    color: white;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 2rem;
    box-shadow: var(--shadow-md);
    position: relative;
    overflow: hidden;
  }

  .page-header::before {
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
    font-size: clamp(2rem, 4vw, 3rem);
    font-weight: 800;
    letter-spacing: -0.04em;
    margin: 0 0 0.75rem;
    color: white;
  }

  .lede {
    max-width: 60ch;
    color: hsl(140, 20%, 85%);
    line-height: 1.6;
    margin: 0;
    font-size: 1rem;
  }

  .header-badges {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.5rem;
  }

  .cohort-pill,
  .role-pill {
    padding: 0.4rem 0.9rem;
    border-radius: 999px;
    font-size: 0.75rem;
    font-weight: 800;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .cohort-pill {
    background: rgba(255, 255, 255, 0.12);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: white;
  }

  .role-pill {
    background: hsl(145, 65%, 38%);
    color: white;
  }

  .notice-banner {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1.1rem 1.5rem;
    border-radius: var(--radius-md);
    background: hsl(3, 100%, 96%);
    color: hsl(3, 60%, 25%);
    border: 1px solid hsl(3, 90%, 88%);
    font-weight: 600;
  }

  .notice-banner.success {
    background: hsl(140, 52%, 94%);
    color: hsl(150, 48%, 16%);
    border-color: hsl(140, 50%, 85%);
  }

  .notice-icon {
    width: 1.75rem;
    height: 1.75rem;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: rgba(0, 0, 0, 0.06);
    font-weight: 800;
  }

  /* Tabbed Header */
  .tab-navigation {
    display: flex;
    gap: 0.5rem;
    border-bottom: 2px solid var(--color-card-border);
    padding-bottom: 0.25rem;
  }

  .tab-btn {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.85rem 1.4rem;
    border: none;
    border-radius: var(--radius-md) var(--radius-md) 0 0;
    background: transparent;
    color: var(--color-text-muted);
    font-family: var(--font-heading);
    font-size: 1rem;
    font-weight: 700;
    cursor: pointer;
    transition: all var(--transition-fast);
    position: relative;
  }

  .tab-btn:hover {
    color: var(--color-primary);
    background: rgba(255, 255, 255, 0.5);
  }

  .tab-btn.active {
    color: var(--color-accent);
    background: white;
    box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.03);
  }

  .tab-btn.active::after {
    content: '';
    position: absolute;
    bottom: -2.5px;
    left: 0;
    right: 0;
    height: 3px;
    background: var(--color-accent);
    border-radius: 3px 3px 0 0;
  }

  .tab-count {
    padding: 0.15rem 0.5rem;
    border-radius: 999px;
    background: var(--color-accent-light);
    color: var(--color-accent-hover);
    font-size: 0.75rem;
    font-weight: 800;
  }

  /* Grid Layout */
  .grid-layout {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1.75rem;
  }

  .full-width-panel {
    grid-column: 1 / -1;
  }

  .panel {
    background: var(--color-card-bg);
    border: 1px solid var(--color-card-border);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-md);
    backdrop-filter: blur(12px);
    overflow: hidden;
  }

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem 1.75rem;
    border-bottom: 1px solid var(--color-card-border);
    background: rgba(255, 255, 255, 0.4);
  }

  .panel-header h2 {
    font-size: 1.25rem;
    font-weight: 800;
    margin: 0 0 0.2rem;
    color: var(--color-primary);
  }

  .subtitle {
    font-size: 0.85rem;
    color: var(--color-text-muted);
    margin: 0;
  }

  .counter-badge {
    padding: 0.35rem 0.85rem;
    border-radius: 999px;
    background: var(--color-accent-light);
    color: var(--color-accent-hover);
    font-size: 0.78rem;
    font-weight: 800;
    border: 1px solid var(--color-card-border);
  }

  .counter-badge.warning {
    background: hsl(45, 100%, 94%);
    color: hsl(40, 80%, 25%);
    border-color: hsl(45, 90%, 82%);
  }

  .panel-body {
    padding: 1.5rem 1.75rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .grid-cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    gap: 1.5rem;
  }

  .card-item {
    padding: 1.25rem;
    border: 1px solid var(--color-card-border);
    border-radius: var(--radius-md);
    background: rgba(255, 255, 255, 0.6);
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
    transition: all var(--transition-normal);
  }

  .card-item:hover {
    background: white;
    box-shadow: var(--shadow-sm);
    border-color: var(--color-accent);
  }

  .item-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .status-chip {
    padding: 0.2rem 0.65rem;
    border-radius: 999px;
    font-size: 0.72rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    background: var(--color-accent-light);
    color: var(--color-accent-hover);
  }

  .status-chip.open {
    background: hsl(3, 100%, 96%);
    color: hsl(3, 75%, 40%);
  }

  .status-chip.claimed {
    background: hsl(45, 100%, 94%);
    color: hsl(40, 75%, 30%);
  }

  .summary-text {
    font-size: 0.95rem;
    line-height: 1.5;
    margin: 0;
    color: var(--color-text);
  }

  .action-row {
    display: flex;
    gap: 0.6rem;
    justify-content: flex-end;
  }

  /* Form controls */
  .form-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .full-col {
    grid-column: 1 / -1;
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    font-size: 0.85rem;
    font-weight: 700;
    color: var(--color-primary);
  }

  input,
  select,
  textarea {
    padding: 0.75rem 0.9rem;
    border: 1.5px solid var(--color-card-border);
    border-radius: var(--radius-sm);
    background: white;
    color: var(--color-text);
    font: inherit;
    font-size: 0.9rem;
    transition: all var(--transition-fast);
  }

  input:focus,
  select:focus,
  textarea:focus {
    outline: none;
    border-color: var(--color-accent);
    box-shadow: 0 0 0 3px var(--color-accent-glow);
  }

  textarea {
    min-height: 5rem;
    resize: vertical;
  }

  .btn-primary {
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: var(--radius-sm);
    background: var(--color-accent);
    color: white;
    font-weight: 800;
    font-size: 0.9rem;
    cursor: pointer;
    box-shadow: var(--shadow-sm);
    transition: all var(--transition-fast);
  }

  .btn-primary:hover {
    background: var(--color-accent-hover);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px var(--color-accent-glow);
  }

  .full-width {
    width: 100%;
  }

  .btn-sm {
    padding: 0.5rem 1rem;
    font-size: 0.82rem;
    border-radius: var(--radius-sm);
    font-weight: 700;
    cursor: pointer;
    border: none;
  }

  .btn-sm.primary {
    background: var(--color-accent);
    color: white;
  }

  .btn-sm.secondary {
    background: rgba(0, 0, 0, 0.06);
    color: var(--color-text);
  }

  .empty-state {
    text-align: center;
    padding: 3rem 1.5rem;
    color: var(--color-text-muted);
  }

  .empty-state .icon {
    font-size: 2.5rem;
    display: block;
    margin-bottom: 0.75rem;
  }

  .directory-list {
    margin-top: 1.5rem;
    padding-top: 1.5rem;
    border-top: 1px solid var(--color-card-border);
  }

  .directory-list h3 {
    font-size: 1rem;
    font-weight: 700;
    margin: 0 0 1rem;
    color: var(--color-primary);
  }

  .account-scroll-list {
    max-height: 18rem;
    overflow-y: auto;
    padding: 0;
    margin: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }

  .account-scroll-list li {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 1rem;
    background: rgba(255, 255, 255, 0.5);
    border: 1px solid var(--color-card-border);
    border-radius: var(--radius-sm);
  }

  .acc-info {
    display: flex;
    flex-direction: column;
  }

  .acc-email {
    font-size: 0.8rem;
    color: var(--color-text-muted);
  }

  .hidden-input {
    display: none;
  }

  .input-hint {
    font-size: 0.78rem;
    color: var(--color-text-muted);
    margin: 0 0 0.3rem;
  }

  @media (max-width: 860px) {
    .grid-layout {
      grid-template-columns: 1fr;
    }
    .form-grid {
      grid-template-columns: 1fr;
    }
    .page-header {
      flex-direction: column;
      align-items: stretch;
    }
    .header-badges {
      align-items: flex-start;
    }
  }
</style>
