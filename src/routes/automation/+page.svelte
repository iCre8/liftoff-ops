<script lang="ts">
  let { data, form } = $props();

  let activeTab = $state<'modes' | 'templates' | 'slack' | 'reports'>('modes');
</script>

<svelte:head><title>Automation Controls | LiftOff</title></svelte:head>

<main>
  <header class="page-header">
    <div class="header-content">
      <p class="eyebrow">Phase 3 Automation Engine</p>
      <h1>Automation Controls</h1>
      <p class="lede">
        Configure cohort execution modes, review queued jobs, manage message templates, map Slack
        identities, and inspect dry-run evidence.
      </p>
    </div>
    <div class="header-status">
      <span class="mode-pill {data.cohorts[0]?.automationMode.toLowerCase() || 'disabled'}">
        Mode: {data.cohorts[0]?.automationMode || 'DISABLED'}
      </span>
      <span class="role-pill">{data.isAdmin ? 'Administrator' : 'Facilitator'}</span>
    </div>
  </header>

  {#if form?.message}
    <div class="notice-banner" class:success={form.success}>
      <span class="notice-icon">{form.success ? '✓' : 'ℹ'}</span>
      <p>{form.message}</p>
    </div>
  {/if}

  <!-- Tab Bar -->
  <div class="tab-navigation">
    <button
      class="tab-btn"
      class:active={activeTab === 'modes'}
      onclick={() => (activeTab = 'modes')}
    >
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor">
        <path
          d="M13 10V3L4 14h7v7l9-11h-7z"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
      Modes & Jobs
      {#if data.jobs.length > 0}
        <span class="tab-count">{data.jobs.length}</span>
      {/if}
    </button>

    <button
      class="tab-btn"
      class:active={activeTab === 'templates'}
      onclick={() => (activeTab = 'templates')}
    >
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor">
        <path
          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
      Templates & Pauses
    </button>

    <button
      class="tab-btn"
      class:active={activeTab === 'slack'}
      onclick={() => (activeTab = 'slack')}
    >
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor">
        <path
          d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
      Recipient Mapping
    </button>

    <button
      class="tab-btn"
      class:active={activeTab === 'reports'}
      onclick={() => (activeTab = 'reports')}
    >
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor">
        <path
          d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
      Reviews & Reports
      {#if data.unresolvedReviews.length > 0}
        <span class="tab-count warning">{data.unresolvedReviews.length}</span>
      {/if}
    </button>
  </div>

  <!-- TAB 1: Modes & Jobs -->
  {#if activeTab === 'modes'}
    <div class="grid-layout">
      <!-- Cohort Automation Mode Control -->
      <section class="panel">
        <div class="panel-header">
          <div>
            <h2>Cohort Execution Modes</h2>
            <p class="subtitle">Switch automation state for active cohorts</p>
          </div>
        </div>

        <div class="panel-body">
          {#each data.cohorts as cohort}
            <article class="mode-card">
              <div class="mode-card-top">
                <strong class="cohort-name">{cohort.name}</strong>
                <span class="mode-tag {cohort.automationMode.toLowerCase()}"
                  >{cohort.automationMode}</span
                >
              </div>
              <p class="job-count-info">
                {cohort._count.automationJobs} queued/review jobs registered
              </p>

              {#if data.isAdmin}
                <form method="POST" action="?/mode" class="mode-actions">
                  <input type="hidden" name="cohortId" value={cohort.id} />
                  <button
                    name="mode"
                    value="DISABLED"
                    class="btn-mode disabled"
                    class:current={cohort.automationMode === 'DISABLED'}
                  >
                    Disable
                  </button>
                  <button
                    name="mode"
                    value="DRY_RUN"
                    class="btn-mode dry-run"
                    class:current={cohort.automationMode === 'DRY_RUN'}
                  >
                    Dry Run
                  </button>
                  {#if data.activeModeEnabled}
                    <button
                      name="mode"
                      value="ACTIVE"
                      class="btn-mode active"
                      class:current={cohort.automationMode === 'ACTIVE'}
                    >
                      Activate
                    </button>
                  {/if}
                </form>
              {/if}
            </article>
          {/each}
        </div>
      </section>

      <!-- Job Queue Review -->
      <section class="panel">
        <div class="panel-header">
          <div>
            <h2>Queued Jobs</h2>
            <p class="subtitle">Scheduled attendance & outreach tasks</p>
          </div>
          <span class="counter-badge">{data.jobs.length} Jobs</span>
        </div>

        <div class="panel-body">
          {#each data.jobs as job}
            <article class="job-item">
              <div class="job-item-header">
                <strong class="job-title">{job.type}</strong>
                <span class="status-chip {job.status.toLowerCase()}">{job.status}</span>
              </div>
              <time class="job-time">Run At: {new Date(job.runAt).toLocaleString()}</time>
            </article>
          {:else}
            <div class="empty-state">
              <span class="icon">⌛</span>
              <p>No jobs currently require staff attention.</p>
            </div>
          {/each}
        </div>
      </section>

      <!-- Dry Run Previews (Full Width) -->
      <section class="panel full-width-panel">
        <div class="panel-header">
          <div>
            <h2>Dry-Run Operation Previews</h2>
            <p class="subtitle">Inspected automation payloads without live external side-effects</p>
          </div>
          <span class="counter-badge">{data.dryRunPlans.length} Previews</span>
        </div>

        <div class="panel-body grid-previews">
          {#each data.dryRunPlans as plan}
            <article class="preview-payload-card">
              <div class="payload-header">
                <strong>{plan.type}</strong>
                <time>{new Date(plan.runAt).toLocaleString()}</time>
              </div>
              <pre class="json-code">{JSON.stringify(plan.payload, null, 2)}</pre>
            </article>
          {:else}
            <div class="empty-state">
              <span class="icon">🔍</span>
              <p>No completed dry-run previews generated yet.</p>
            </div>
          {/each}
        </div>
      </section>
    </div>
  {/if}

  <!-- TAB 2: Templates & Pauses -->
  {#if activeTab === 'templates'}
    <div class="grid-layout">
      <!-- Templates Management -->
      <section class="panel">
        <div class="panel-header">
          <div>
            <h2>Message Templates</h2>
            <p class="subtitle">Approved wording for learner outreach</p>
          </div>
        </div>

        <div class="panel-body">
          <ul class="template-list">
            {#each data.templates as template}
              <li class="template-item">
                <div class="template-info">
                  <strong>{template.key}</strong>
                  <span class="version-tag">v{template.version} • {template.status}</span>
                </div>
                {#if data.canManageTemplates && template.status === 'DRAFT'}
                  <form method="POST" action="?/templateApprove">
                    <input type="hidden" name="id" value={template.id} />
                    <button class="btn-sm primary">Approve</button>
                  </form>
                {/if}
              </li>
            {/each}
          </ul>

          {#if data.canManageTemplates && data.cohorts[0]}
            <form method="POST" action="?/templateDraft" class="form-box">
              <h3>Create Draft Template Version</h3>
              <label>
                <span>Cohort</span>
                <select name="cohortId">
                  {#each data.cohorts as cohort}
                    <option value={cohort.id}>{cohort.name}</option>
                  {/each}
                </select>
              </label>

              <label>
                <span>Template Key</span>
                <input name="key" placeholder="e.g. LATE_OUTREACH_SLACK" required />
              </label>

              <label>
                <span>Supportive Wording Content</span>
                <textarea
                  name="content"
                  placeholder="Hi &#123;&#123;learnerName&#125;&#125;, we noticed you haven't checked in yet today..."
                  required></textarea>
              </label>

              <button class="btn-primary">Create Draft Version</button>
            </form>
          {/if}
        </div>
      </section>

      <!-- Blackouts & Pauses -->
      <section class="panel">
        <div class="panel-header">
          <div>
            <h2>Blackouts & Operational Pauses</h2>
            <p class="subtitle">Holidays and temporary automation suspensions</p>
          </div>
        </div>

        <div class="panel-body">
          {#if data.isAdmin && data.cohorts[0]}
            <form method="POST" action="?/blackout" class="form-box">
              <h3>Add Program Blackout Date</h3>
              <label>
                <span>Cohort</span>
                <select name="cohortId">
                  {#each data.cohorts as cohort}
                    <option value={cohort.id}>{cohort.name}</option>
                  {/each}
                </select>
              </label>
              <label>
                <span>Date</span>
                <input type="date" name="date" required />
              </label>
              <label>
                <span>Reason / Holiday</span>
                <input name="reason" placeholder="e.g. Memorial Day" required />
              </label>
              <button class="btn-primary">Add Blackout</button>
            </form>
          {/if}

          {#if data.canManageTemplates && data.cohorts[0]}
            <form method="POST" action="?/pause" class="form-box">
              <h3>Configure Temporary Operational Pause</h3>
              <label>
                <span>Cohort</span>
                <select name="cohortId">
                  {#each data.cohorts as cohort}
                    <option value={cohort.id}>{cohort.name}</option>
                  {/each}
                </select>
              </label>
              <label>
                <span>Starts At</span>
                <input type="datetime-local" name="startsAt" required />
              </label>
              <label>
                <span>Ends At (Optional)</span>
                <input type="datetime-local" name="endsAt" />
              </label>
              <label>
                <span>Reason</span>
                <input name="reason" placeholder="Reason for temporary pause" required />
              </label>
              <button class="btn-primary">Save Pause</button>
            </form>
          {/if}

          <div class="list-section">
            <h3>Active Blackout Dates</h3>
            <ul>
              {#each data.blackouts as blackout}
                <li><strong>{blackout.date}</strong> — {blackout.reason}</li>
              {:else}
                <li class="empty-text">No blackouts configured.</li>
              {/each}
            </ul>
          </div>
        </div>
      </section>
    </div>
  {/if}

  <!-- TAB 3: Recipient Mapping -->
  {#if activeTab === 'slack'}
    <section class="panel full-width-panel">
      <div class="panel-header">
        <div>
          <h2>Slack Recipient Directory Mapping</h2>
          <p class="subtitle">
            Verify and link learner company emails to verified Slack member IDs
          </p>
        </div>
      </div>

      <div class="panel-body">
        {#if data.isAdmin && data.cohorts[0]}
          <form method="POST" action="?/slackMappingPreview" class="inline-form">
            <select name="cohortId">
              {#each data.cohorts as cohort}
                <option value={cohort.id}>{cohort.name}</option>
              {/each}
            </select>
            <button class="btn-primary">Preview Slack Directory Mappings</button>
          </form>
        {/if}

        {#if form?.slackMappingPreview}
          <form method="POST" action="?/slackMappingConfirm" class="preview-mapping-box">
            <h3>Confirm Discovered Mappings</h3>
            <input type="hidden" name="cohortId" value={form.cohortId} />
            <ul class="checkbox-list">
              {#each form.slackMappingPreview as mapping}
                <li>
                  <label class="checkbox-label">
                    <input
                      type="checkbox"
                      name="confirmedLearnerId"
                      value={mapping.learnerId}
                      required
                    />
                    <span
                      ><strong>Learner:</strong>
                      {mapping.learnerExternalId} → <strong>Slack ID:</strong>
                      {mapping.slackMemberId}</span
                    >
                  </label>
                </li>
              {/each}
            </ul>

            <div class="confirm-action-row">
              <input name="confirmation" placeholder="Type CONFIRM SLACK MAPPINGS" required />
              <button class="btn-primary">Confirm All Selected Mappings</button>
            </div>
          </form>
        {/if}

        <div class="mapping-status-card">
          {#each data.mappingCounts as mapping}
            <div class="mapping-stat">
              <span class="big-num">{mapping.verifiedSlackMappings} / {mapping.learners}</span>
              <p>Learners have a verified Slack Member ID mapping.</p>
            </div>
          {:else}
            <p class="empty-text">No learner Slack mappings exist yet.</p>
          {/each}
        </div>
      </div>
    </section>
  {/if}

  <!-- TAB 4: Reviews & Reports -->
  {#if activeTab === 'reports'}
    <div class="grid-layout">
      <!-- Unresolved Review Queue -->
      <section class="panel">
        <div class="panel-header">
          <div>
            <h2>Daily Unresolved Dashboard</h2>
            <p class="subtitle">Require annotated closure by instructor or TA</p>
          </div>
          <span class="counter-badge warning">{data.unresolvedReviews.length} Due</span>
        </div>

        <div class="panel-body">
          {#each data.unresolvedReviews as review}
            <article class="card-item review-card">
              <div class="item-top">
                <strong>{review.incident.type}</strong>
                <span class="status-chip warning">{review.status}</span>
              </div>

              <time class="due-time">Due By: {new Date(review.dueAt).toLocaleString()}</time>

              {#if data.canReview}
                <form method="POST" action="?/annotateReview" class="annotate-form">
                  <input type="hidden" name="id" value={review.id} />
                  <input name="status" placeholder="Status (e.g. RESOLVED)" required />
                  <input name="actionTaken" placeholder="Action Taken" required />
                  <input name="disposition" placeholder="Disposition (e.g. Excused)" required />
                  <textarea name="closureNote" placeholder="Detailed closure note..." required
                  ></textarea>
                  <button class="btn-primary">Save Review Annotation</button>
                </form>
              {/if}
            </article>
          {:else}
            <div class="empty-state">
              <span class="icon">✅</span>
              <p>All unresolved items for today have been annotated.</p>
            </div>
          {/each}
        </div>
      </section>

      <!-- Operational Metrics & Reconciliation -->
      <section class="panel">
        <div class="panel-header">
          <div>
            <h2>Metrics & Reconciliation</h2>
            <p class="subtitle">Operational baselines, Sheet reconciliation, and CSV export</p>
          </div>
        </div>

        <div class="panel-body">
          {#if data.canReview && data.sessions[0]}
            <form method="POST" action="?/reconcileNow" class="form-box">
              <h3>Trigger Bounded Reconciliation</h3>
              <select name="sessionId">
                {#each data.sessions as session}
                  <option value={session.id}>{session.sessionDate}</option>
                {/each}
              </select>
              <button class="btn-primary">Queue Reconcile Job</button>
            </form>
          {/if}

          <div class="export-box">
            <h3>CSV Data Export</h3>
            {#each data.cohorts as cohort}
              <a href={`/automation/report.csv?cohortId=${cohort.id}`} class="btn-download">
                ⬇ Download {cohort.name} CSV Report
              </a>
            {/each}
          </div>

          {#if data.isAdmin && data.cohorts[0]}
            <div class="danger-zone">
              <h3>Cohort Archival</h3>
              <form method="POST" action="?/archive" class="inline-form">
                <select name="cohortId">
                  {#each data.cohorts as cohort}
                    <option value={cohort.id}>{cohort.name}</option>
                  {/each}
                </select>
                <input name="confirmation" placeholder="Type ARCHIVE" required />
                <button class="btn-danger">Archive Cohort</button>
              </form>
            </div>
          {/if}

          {#if data.isAdmin && data.archivedCohorts[0]}
            <div class="restore-zone">
              <h3>Archival Restoration</h3>
              <form method="POST" action="?/restoreArchive" class="inline-form">
                <select name="cohortId">
                  {#each data.archivedCohorts as cohort}
                    <option value={cohort.id}>{cohort.name}</option>
                  {/each}
                </select>
                <input name="confirmation" placeholder="Type RESTORE" required />
                <button class="btn-primary">Restore Cohort</button>
              </form>
            </div>
          {/if}
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

  .eyebrow {
    color: hsl(145, 65%, 65%);
    font-size: 0.75rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    margin: 0 0 0.4rem;
  }

  h1 {
    font-size: clamp(2rem, 4vw, 2.8rem);
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
    font-size: 0.98rem;
  }

  .header-status {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.5rem;
  }

  .mode-pill,
  .role-pill {
    padding: 0.4rem 0.9rem;
    border-radius: 999px;
    font-size: 0.75rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .mode-pill.disabled {
    background: hsl(0, 0%, 25%);
    color: white;
  }
  .mode-pill.dry_run {
    background: hsl(45, 90%, 40%);
    color: white;
  }
  .mode-pill.active {
    background: hsl(145, 65%, 38%);
    color: white;
  }

  .role-pill {
    background: rgba(255, 255, 255, 0.15);
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

  /* Tabs */
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

  .tab-count.warning {
    background: hsl(3, 100%, 96%);
    color: hsl(3, 75%, 40%);
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
  }

  .panel-body {
    padding: 1.5rem 1.75rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .mode-card {
    padding: 1.25rem;
    border: 1px solid var(--color-card-border);
    border-radius: var(--radius-md);
    background: white;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .mode-card-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .cohort-name {
    font-size: 1.1rem;
    color: var(--color-primary);
  }

  .mode-tag {
    padding: 0.25rem 0.75rem;
    border-radius: 999px;
    font-size: 0.75rem;
    font-weight: 800;
  }

  .mode-tag.disabled {
    background: hsl(0, 0%, 90%);
    color: hsl(0, 0%, 35%);
  }
  .mode-tag.dry_run {
    background: hsl(45, 100%, 92%);
    color: hsl(40, 80%, 25%);
  }
  .mode-tag.active {
    background: hsl(145, 60%, 92%);
    color: hsl(145, 80%, 25%);
  }

  .mode-actions {
    display: flex;
    gap: 0.5rem;
  }

  .btn-mode {
    padding: 0.5rem 1rem;
    border-radius: var(--radius-sm);
    border: 1.5px solid var(--color-card-border);
    background: rgba(0, 0, 0, 0.03);
    font-weight: 700;
    font-size: 0.82rem;
    cursor: pointer;
  }

  .btn-mode.current {
    border-color: var(--color-accent);
    box-shadow: 0 0 0 2px var(--color-accent-glow);
  }

  .job-item {
    padding: 1rem;
    border: 1px solid var(--color-card-border);
    border-radius: var(--radius-md);
    background: white;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .job-item-header {
    display: flex;
    justify-content: space-between;
  }

  .job-time {
    font-size: 0.78rem;
    color: var(--color-text-muted);
  }

  .grid-previews {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
    gap: 1.25rem;
  }

  .preview-payload-card {
    border: 1px solid var(--color-card-border);
    border-radius: var(--radius-md);
    background: white;
    overflow: hidden;
  }

  .payload-header {
    padding: 0.75rem 1rem;
    background: var(--color-accent-light);
    display: flex;
    justify-content: space-between;
    font-size: 0.82rem;
  }

  .json-code {
    padding: 1rem;
    margin: 0;
    background: hsl(150, 20%, 98%);
    font-family: monospace;
    font-size: 0.78rem;
    max-height: 14rem;
    overflow: auto;
  }

  /* Form box */
  .form-box {
    padding: 1.25rem;
    border: 1px solid var(--color-card-border);
    border-radius: var(--radius-md);
    background: rgba(255, 255, 255, 0.5);
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .form-box h3 {
    font-size: 1rem;
    margin: 0;
    color: var(--color-primary);
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
  }

  textarea {
    min-height: 5rem;
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
    align-self: flex-start;
  }

  .btn-danger {
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: var(--radius-sm);
    background: hsl(0, 75%, 45%);
    color: white;
    font-weight: 800;
    cursor: pointer;
  }

  .btn-download {
    display: inline-block;
    padding: 0.75rem 1.25rem;
    background: var(--color-accent-light);
    color: var(--color-accent-hover);
    border: 1px solid var(--color-card-border);
    border-radius: var(--radius-sm);
    font-weight: 700;
    text-decoration: none;
    font-size: 0.9rem;
  }

  .status-chip {
    padding: 0.2rem 0.6rem;
    border-radius: 999px;
    font-size: 0.72rem;
    font-weight: 800;
    background: var(--color-accent-light);
  }

  .empty-state {
    text-align: center;
    padding: 3rem 1.5rem;
    color: var(--color-text-muted);
  }

  .empty-state .icon {
    font-size: 2.5rem;
    display: block;
    margin-bottom: 0.5rem;
  }

  .template-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }

  .template-item {
    padding: 0.85rem 1rem;
    background: white;
    border: 1px solid var(--color-card-border);
    border-radius: var(--radius-sm);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .version-tag {
    font-size: 0.78rem;
    color: var(--color-text-muted);
    display: block;
  }

  .inline-form {
    display: flex;
    gap: 1rem;
    align-items: center;
  }

  .mapping-status-card {
    padding: 2rem;
    background: white;
    border: 1px solid var(--color-card-border);
    border-radius: var(--radius-md);
    text-align: center;
  }

  .big-num {
    font-size: 2.5rem;
    font-weight: 800;
    font-family: var(--font-heading);
    color: var(--color-accent);
  }

  .danger-zone,
  .restore-zone {
    margin-top: 1.5rem;
    padding-top: 1.5rem;
    border-top: 1px solid var(--color-card-border);
  }

  @media (max-width: 860px) {
    .grid-layout {
      grid-template-columns: 1fr;
    }
    .page-header {
      flex-direction: column;
    }
    .header-status {
      align-items: flex-start;
    }
    .inline-form {
      flex-direction: column;
      align-items: stretch;
    }
  }
</style>
