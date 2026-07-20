<script lang="ts">
  let { data, form } = $props();

  const shortDate = (value: string | Date) =>
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }).format(new Date(value));

  const shortTime = (value: string | Date) =>
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(value));

  const windowMessage = (state: 'not_released' | 'open' | 'closed', release: string) =>
    state === 'not_released'
      ? `Available at ${release}`
      : state === 'closed'
        ? 'Edits closed for today'
        : 'Open now';
</script>

<svelte:head><title>My Day | LiftOff</title></svelte:head>

<main>
  <header class="page-header">
    <div class="header-content">
      <p class="eyebrow">Daily Command Center</p>
      <h1>Welcome back, {data.displayName}</h1>
      <p class="lede">
        Submit your morning goals, daily recap exit ticket, and review your weekly attendance
        activity.
      </p>
    </div>
    <div class="header-date">
      <span class="date-badge"
        >{new Date().toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'short',
          day: 'numeric',
        })}</span
      >
    </div>
  </header>

  <nav class="learner-policy-links" aria-label="Learner privacy and communication controls">
    <a href="/learner/communication-preferences">Communication preferences</a>
    <a href="/learner/privacy">Attendance privacy notice</a>
  </nav>

  {#if form?.message}
    <div class="notice-banner" class:success={form.success}>
      <span class="notice-icon">{form.success ? '✓' : 'ℹ'}</span>
      <p>{form.message}</p>
    </div>
  {/if}

  {#if !data.session}
    <section class="panel no-session">
      <div class="no-session-body">
        <span class="hero-icon">🗓️</span>
        <h2>No Program Session Scheduled Today</h2>
        <p>
          Daily morning goal check-ins and exit ticket forms will appear on the next active program
          day.
        </p>
      </div>
    </section>
  {:else}
    <div class="grid-layout">
      <!-- Morning Check-in Form Card -->
      <form method="POST" action="?/morning" class="panel form-panel">
        <div class="panel-header">
          <div>
            <p class="card-eyebrow">Morning Check-in</p>
            <h2>Morning Goals</h2>
          </div>
          <span class="window-pill {data.morningWindow}">
            <span class="dot"></span>
            {windowMessage(data.morningWindow, '9:15 AM')}
          </span>
        </div>

        <input type="hidden" name="idempotencyKey" value={data.morningKey} />

        <fieldset disabled={data.morningWindow !== 'open'} class="fieldset-body">
          <label>
            <span>What are your goals today?</span>
            <textarea
              name="goals"
              maxlength="2000"
              placeholder="Focus areas and learning targets..."
              required>{data.morning?.goals ?? ''}</textarea
            >
          </label>

          <label>
            <span>What will you work on first?</span>
            <textarea
              name="firstTask"
              maxlength="1000"
              placeholder="First actionable item..."
              required>{data.morning?.firstTask ?? ''}</textarea
            >
          </label>

          <label>
            <span>What is blocking you? (Optional)</span>
            <textarea
              name="blockers"
              maxlength="1000"
              placeholder="Technical or personal blockers..."
              >{data.morning?.blockers ?? ''}</textarea
            >
          </label>

          <label>
            <span>What support do you need? (Optional)</span>
            <textarea
              name="supportNeeded"
              maxlength="1000"
              placeholder="Questions or TA assistance needed..."
              >{data.morning?.supportNeeded ?? ''}</textarea
            >
          </label>

          <button class="btn-primary">Save Morning Goals</button>
        </fieldset>
      </form>

      <!-- Daily Recap Exit Ticket Card -->
      <form method="POST" action="?/exit" class="panel form-panel">
        <div class="panel-header">
          <div>
            <p class="card-eyebrow">Daily Recap</p>
            <h2>Exit Ticket</h2>
          </div>
          <span class="window-pill {data.exitWindow}">
            <span class="dot"></span>
            {windowMessage(data.exitWindow, '2:45 PM')}
          </span>
        </div>

        <input type="hidden" name="idempotencyKey" value={data.exitKey} />

        <fieldset disabled={data.exitWindow !== 'open'} class="fieldset-body">
          <div class="morning-recap-box">
            <div class="recap-header">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor">
                <path
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
              <strong>Morning Goal Reference</strong>
            </div>
            <p>{data.morning?.goals ?? 'Submit morning goals first to view them here.'}</p>
          </div>

          <label>
            <span>Did you achieve your goals?</span>
            <select name="goalResult" required>
              <option value="">Choose one</option>
              <option value="yes">Yes — Fully Achieved</option>
              <option value="partially">Partially — Made Progress</option>
              <option value="no">No — Encountered Blockers</option>
            </select>
          </label>

          <label>
            <span>What did you complete today?</span>
            <textarea
              name="completed"
              maxlength="2000"
              placeholder="Summary of accomplishments..."
              required></textarea>
          </label>

          <label>
            <span>If not fully achieved, why not?</span>
            <textarea
              name="explanation"
              maxlength="2000"
              placeholder="Context on unachieved targets..."></textarea>
          </label>

          <label>
            <span>What blockers remain?</span>
            <textarea name="blockers" maxlength="1000" placeholder="Ongoing obstacles..."
            ></textarea>
          </label>

          <label>
            <span>What support do you need tomorrow?</span>
            <textarea
              name="supportNeeded"
              maxlength="1000"
              placeholder="Support needed for tomorrow..."></textarea>
          </label>

          <button class="btn-primary">Save Exit Ticket</button>
        </fieldset>
      </form>
    </div>
  {/if}

  <div class="grid-layout secondary">
    <!-- Accommodation Request Form -->
    <form method="POST" action="?/accommodation" class="panel form-panel">
      <div class="panel-header">
        <div>
          <p class="card-eyebrow">Available Anytime</p>
          <h2>Accommodation Request</h2>
        </div>
      </div>

      <div class="fieldset-body">
        <p class="info-note">
          Describe the adjustment you need. Do not include sensitive medical or diagnostic details.
        </p>

        <label>
          <span>Category</span>
          <select name="category" required>
            <option value="">Select a category</option>
            <option value="schedule_timing">Schedule or timing adjustment</option>
            <option value="attendance_check_in_method">Attendance or check-in method</option>
            <option value="communication">Communication preference</option>
            <option value="accessibility_technology">Accessibility or technology</option>
            <option value="temporary_personal_circumstance">Temporary personal circumstance</option>
            <option value="other">Other</option>
          </select>
        </label>

        <div class="form-row">
          <label>
            <span>Requested Start</span>
            <input type="date" name="requestedStart" required />
          </label>
          <label>
            <span>Requested End (Optional)</span>
            <input type="date" name="requestedEnd" />
          </label>
        </div>

        <label>
          <span>What adjustment do you need?</span>
          <textarea
            name="requestedAdjustment"
            maxlength="2000"
            placeholder="Describe the requested change..."
            required></textarea>
        </label>

        <label>
          <span>How would this adjustment help?</span>
          <textarea
            name="expectedBenefit"
            maxlength="2000"
            placeholder="Describe expected benefit..."
            required></textarea>
        </label>

        <label>
          <span>Preferred Follow-up Method</span>
          <select name="preferredFollowUp" required>
            <option value="email">Company Email</option>
            <option value="in_app">In App Notification</option>
          </select>
        </label>

        <button class="btn-primary">Submit Accommodation Request</button>
      </div>
    </form>

    <!-- Weekly Activity History Timeline -->
    <section class="panel">
      <div class="panel-header">
        <div>
          <p class="card-eyebrow">Monday through Friday</p>
          <h2>This Week's Activity</h2>
        </div>
        <span class="counter-badge">{data.history.length} Submissions</span>
      </div>

      <div class="panel-body">
        <ul class="activity-timeline">
          {#each data.history as item}
            <li class="timeline-item">
              <div class="timeline-icon {item.type === 'GOALS_CHECK_IN' ? 'morning' : 'exit'}">
                {item.type === 'GOALS_CHECK_IN' ? '🌅' : '🌙'}
              </div>
              <div class="timeline-content">
                <strong
                  >{item.type === 'GOALS_CHECK_IN'
                    ? 'Morning Goals Check-in'
                    : 'Exit Ticket Recap'}</strong
                >
                <span class="timestamp"
                  >{shortDate(item.sessionDate)} at {shortTime(item.submittedAt)}</span
                >
              </div>
              {#if item.revised}
                <span class="tag-revised">Revised</span>
              {/if}
            </li>
          {:else}
            <li class="empty-timeline">No submissions recorded yet for this week.</li>
          {/each}
        </ul>

        <div class="sub-section">
          <h3>Your Accommodation Requests</h3>
          <ul class="activity-timeline">
            {#each data.accommodations as request}
              <li class="timeline-item">
                <div class="timeline-content">
                  <strong>{request.category.replaceAll('_', ' ')}</strong>
                </div>
                <span class="status-chip {request.status.toLowerCase()}"
                  >{request.status.replaceAll('_', ' ')}</span
                >
              </li>
            {:else}
              <li class="empty-timeline">No accommodation requests submitted.</li>
            {/each}
          </ul>
        </div>
      </div>
    </section>
  </div>
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

  .eyebrow,
  .card-eyebrow {
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

  .date-badge {
    padding: 0.45rem 1rem;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.12);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: white;
    font-weight: 700;
    font-size: 0.85rem;
  }

  .learner-policy-links {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
  }

  .learner-policy-links a {
    font-weight: 750;
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

  .grid-layout {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1.75rem;
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
    margin: 0;
    color: var(--color-primary);
  }

  .window-pill {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.35rem 0.8rem;
    border-radius: 999px;
    font-size: 0.78rem;
    font-weight: 800;
  }

  .window-pill .dot {
    width: 0.45rem;
    height: 0.45rem;
    border-radius: 50%;
  }

  .window-pill.open {
    background: hsl(145, 60%, 92%);
    color: hsl(145, 80%, 25%);
  }
  .window-pill.open .dot {
    background: hsl(145, 75%, 40%);
    box-shadow: 0 0 6px hsl(145, 75%, 40%);
  }

  .window-pill.not_released {
    background: hsl(45, 100%, 92%);
    color: hsl(40, 80%, 25%);
  }
  .window-pill.not_released .dot {
    background: hsl(40, 80%, 45%);
  }

  .window-pill.closed {
    background: hsl(0, 0%, 92%);
    color: hsl(0, 0%, 40%);
  }
  .window-pill.closed .dot {
    background: hsl(0, 0%, 50%);
  }

  .fieldset-body,
  .panel-body {
    padding: 1.5rem 1.75rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    border: none;
    margin: 0;
  }

  fieldset:disabled {
    opacity: 0.55;
    pointer-events: none;
  }

  .morning-recap-box {
    padding: 1rem 1.25rem;
    background: var(--color-accent-light);
    border: 1px solid var(--color-card-border);
    border-radius: var(--radius-md);
  }

  .recap-header {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    color: var(--color-primary);
    margin-bottom: 0.4rem;
    font-size: 0.82rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .morning-recap-box p {
    margin: 0;
    font-size: 0.92rem;
    line-height: 1.5;
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    font-size: 0.88rem;
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
    font-size: 0.92rem;
  }

  textarea {
    min-height: 5.5rem;
    resize: vertical;
  }

  .btn-primary {
    padding: 0.85rem 1.75rem;
    border: none;
    border-radius: var(--radius-sm);
    background: var(--color-accent);
    color: white;
    font-weight: 800;
    font-size: 0.95rem;
    cursor: pointer;
    align-self: flex-start;
    transition: all var(--transition-fast);
  }

  .btn-primary:hover:not(:disabled) {
    background: var(--color-accent-hover);
    transform: translateY(-2px);
    box-shadow: 0 4px 14px var(--color-accent-glow);
  }

  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }

  .info-note {
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

  .activity-timeline {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .timeline-item {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.85rem 1rem;
    background: white;
    border: 1px solid var(--color-card-border);
    border-radius: var(--radius-md);
  }

  .timeline-icon {
    width: 2.25rem;
    height: 2.25rem;
    border-radius: 50%;
    display: grid;
    place-items: center;
    font-size: 1rem;
    background: var(--color-accent-light);
  }

  .timeline-content {
    display: flex;
    flex-direction: column;
    flex-grow: 1;
  }

  .timestamp {
    font-size: 0.78rem;
    color: var(--color-text-muted);
  }

  .tag-revised {
    padding: 0.2rem 0.5rem;
    border-radius: 999px;
    background: hsl(45, 100%, 92%);
    color: hsl(40, 80%, 25%);
    font-size: 0.72rem;
    font-weight: 800;
  }

  .status-chip {
    padding: 0.2rem 0.65rem;
    border-radius: 999px;
    font-size: 0.72rem;
    font-weight: 800;
    background: var(--color-accent-light);
    color: var(--color-accent-hover);
  }

  .sub-section {
    margin-top: 1.5rem;
    padding-top: 1.5rem;
    border-top: 1px solid var(--color-card-border);
  }

  .sub-section h3 {
    font-size: 1rem;
    margin: 0 0 1rem;
  }

  .no-session {
    text-align: center;
    padding: 4rem 2rem;
  }

  .hero-icon {
    font-size: 3rem;
    display: block;
    margin-bottom: 1rem;
  }

  .empty-timeline {
    font-size: 0.88rem;
    color: var(--color-text-muted);
    padding: 1rem;
    text-align: center;
  }

  @media (max-width: 860px) {
    .grid-layout {
      grid-template-columns: 1fr;
    }
    .form-row {
      grid-template-columns: 1fr;
    }
    .page-header {
      flex-direction: column;
    }
  }
</style>
