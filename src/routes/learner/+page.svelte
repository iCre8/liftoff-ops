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

<svelte:head><title>My day | LiftOff</title></svelte:head>
<main>
  <header>
    <div>
      <p class="eyebrow">My day</p>
      <h1>Welcome, {data.displayName}</h1>
    </div>
    <a href="/">Switch workspace</a>
  </header>

  <nav class="learner-policy-links" aria-label="Learner privacy and communication controls">
    <a href="/learner/communication-preferences">Communication preferences</a>
    <a href="/learner/privacy">Attendance privacy notice</a>
  </nav>

  {#if form?.message}<p class:success={form.success} class="notice">{form.message}</p>{/if}

  {#if !data.session}
    <section>
      <h2>No program session scheduled today</h2>
      <p>Daily attendance forms will appear on the next active program day.</p>
    </section>
  {:else}
    <div class="grid">
      <form method="POST" action="?/morning">
        <p class="eyebrow">Morning check-in</p>
        <h2>Morning goals</h2>
        <p class="availability">{windowMessage(data.morningWindow, '9:15 AM')}</p>
        <input type="hidden" name="idempotencyKey" value={data.morningKey} />
        <fieldset disabled={data.morningWindow !== 'open'}>
          <label
            >What are your goals today?<textarea name="goals" maxlength="2000" required
              >{data.morning?.goals ?? ''}</textarea
            ></label
          >
          <label
            >What will you work on first?<textarea name="firstTask" maxlength="1000" required
              >{data.morning?.firstTask ?? ''}</textarea
            ></label
          >
          <label
            >What is blocking you?<textarea name="blockers" maxlength="1000"
              >{data.morning?.blockers ?? ''}</textarea
            ></label
          >
          <label
            >What support do you need?<textarea name="supportNeeded" maxlength="1000"
              >{data.morning?.supportNeeded ?? ''}</textarea
            ></label
          >
          <button>Save morning goals</button>
        </fieldset>
      </form>

      <form method="POST" action="?/exit">
        <p class="eyebrow">Daily recap</p>
        <h2>Exit ticket</h2>
        <p class="availability">{windowMessage(data.exitWindow, '2:45 PM')}</p>
        <input type="hidden" name="idempotencyKey" value={data.exitKey} />
        <fieldset disabled={data.exitWindow !== 'open'}>
          <div class="recap">
            <strong>Morning goal recap</strong>
            <p>{data.morning?.goals ?? 'Submit morning goals to see them here.'}</p>
          </div>
          <label
            >Did you achieve your goals?
            <select name="goalResult" required>
              <option value="">Choose one</option>
              <option value="yes">Yes</option>
              <option value="partially">Partially</option>
              <option value="no">No</option>
            </select>
          </label>
          <label
            >What did you complete?<textarea name="completed" maxlength="2000" required
            ></textarea></label
          >
          <label
            >If not fully achieved, why not?<textarea name="explanation" maxlength="2000"
            ></textarea></label
          >
          <label>What blockers remain?<textarea name="blockers" maxlength="1000"></textarea></label>
          <label
            >What support do you need?<textarea name="supportNeeded" maxlength="1000"
            ></textarea></label
          >
          <button>Save exit ticket</button>
        </fieldset>
      </form>
    </div>
  {/if}

  <div class="grid secondary">
    <form method="POST" action="?/accommodation">
      <p class="eyebrow">Available anytime</p>
      <h2>Accommodation request</h2>
      <p>Please describe the adjustment you need. Do not include diagnoses or medical documents.</p>
      <label
        >Category
        <select name="category" required>
          <option value="">Choose one</option>
          <option value="schedule_timing">Schedule or timing</option>
          <option value="attendance_check_in_method">Attendance or check-in method</option>
          <option value="communication">Communication</option>
          <option value="accessibility_technology">Accessibility or technology</option>
          <option value="temporary_personal_circumstance">Temporary personal circumstance</option>
          <option value="other">Other</option>
        </select>
      </label>
      <label>Requested start<input type="date" name="requestedStart" required /></label>
      <label>Requested end, if known<input type="date" name="requestedEnd" /></label>
      <label
        >What adjustment do you need?<textarea name="requestedAdjustment" maxlength="2000" required
        ></textarea></label
      >
      <label
        >How would it help?<textarea name="expectedBenefit" maxlength="2000" required
        ></textarea></label
      >
      <label
        >Preferred follow-up
        <select name="preferredFollowUp" required>
          <option value="email">Company email</option>
          <option value="in_app">In app</option>
        </select>
      </label>
      <button>Submit request</button>
    </form>

    <section>
      <p class="eyebrow">Monday through Friday</p>
      <h2>This week's activity</h2>
      <ul class="history">
        {#each data.history as item}
          <li>
            <div>
              <strong>{item.type === 'GOALS_CHECK_IN' ? 'Morning goals' : 'Exit ticket'}</strong>
              <span>{shortDate(item.sessionDate)} at {shortTime(item.submittedAt)}</span>
            </div>
            {#if item.revised}<span class="tag">Revised</span>{/if}
          </li>
        {:else}
          <li>No submissions yet this week.</li>
        {/each}
      </ul>

      <h3>Accommodation requests</h3>
      <ul class="history">
        {#each data.accommodations as request}
          <li>
            <span>{request.category.replaceAll('_', ' ')}</span>
            <span class="tag">{request.status.replaceAll('_', ' ')}</span>
          </li>
        {:else}
          <li>No accommodation requests submitted.</li>
        {/each}
      </ul>
    </section>
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

  header {
    display: flex;
    justify-content: space-between;
    gap: 2rem;
    align-items: center;
    background: linear-gradient(135deg, var(--color-primary) 0%, hsl(155, 60%, 11%) 100%);
    color: white;
    padding: clamp(1.5rem, 4vw, 2.5rem);
    border-radius: var(--radius-lg);
    border: 1px solid rgba(255, 255, 255, 0.08);
    box-shadow: var(--shadow-md);
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
  }

  h2 {
    font-size: clamp(1.3rem, 2.5vw, 1.6rem);
    font-weight: 700;
    letter-spacing: -0.02em;
    margin-bottom: 0.5rem;
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

  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.5rem;
  }

  .secondary {
    align-items: start;
  }

  form,
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

  form:hover,
  section:hover {
    border-color: rgba(47, 112, 74, 0.2);
    box-shadow: var(--shadow-lg);
  }

  fieldset {
    margin: 0;
    padding: 0;
    border: 0;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  fieldset:disabled {
    opacity: 0.5;
    pointer-events: none;
  }

  label {
    display: grid;
    gap: 0.45rem;
    font-weight: 700;
    font-size: 0.9rem;
    color: var(--color-primary);
  }

  textarea,
  select,
  input {
    width: 100%;
    padding: 0.8rem;
    border: 1.5px solid var(--color-card-border);
    border-radius: var(--radius-sm);
    background: rgba(255, 255, 255, 0.6);
    color: var(--color-text);
    font: inherit;
    font-size: 0.95rem;
    transition: all var(--transition-fast);
  }

  textarea:focus,
  select:focus,
  input:focus {
    outline: none;
    border-color: var(--color-accent);
    background: white;
    box-shadow: 0 0 0 4px var(--color-accent-glow);
  }

  textarea {
    min-height: 6rem;
    resize: vertical;
    line-height: 1.5;
  }

  button {
    margin-top: 0.75rem;
    padding: 0.85rem 1.5rem;
    border: none;
    border-radius: var(--radius-sm);
    background: var(--color-accent);
    color: white;
    font-weight: 800;
    font-size: 0.95rem;
    cursor: pointer;
    box-shadow: var(--shadow-sm);
    transition: all var(--transition-fast);
  }

  button:hover:not(:disabled) {
    background: var(--color-accent-hover);
    transform: translateY(-2px);
    box-shadow: 0 6px 20px var(--color-accent-glow);
  }

  button:active {
    transform: translateY(0);
  }

  .availability {
    display: inline-block;
    padding: 0.35rem 0.85rem;
    border-radius: 999px;
    background: var(--color-accent-light);
    color: var(--color-accent-hover);
    font-size: 0.82rem;
    font-weight: 700;
    border: 1px solid var(--color-card-border);
    margin-bottom: 1.25rem;
  }

  .recap {
    padding: 1.25rem;
    background: var(--color-accent-light);
    border-radius: var(--radius-md);
    border: 1.5px solid var(--color-card-border);
    font-size: 0.95rem;
    line-height: 1.5;
    margin-bottom: 0.5rem;
  }

  .recap strong {
    display: block;
    color: var(--color-primary);
    font-size: 0.85rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 0.5rem;
  }

  .recap p {
    margin: 0;
    color: var(--color-text);
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

  .learner-policy-links {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
  }

  .learner-policy-links a {
    font-weight: 750;
  }

  .history {
    display: grid;
    gap: 0.75rem;
    margin: 1.25rem 0 2rem;
    padding: 0;
    list-style: none;
  }

  .history li {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1.25rem;
    padding: 1rem 1.25rem;
    border: 1px solid var(--color-card-border);
    border-radius: var(--radius-md);
    background: rgba(255, 255, 255, 0.4);
    transition: all var(--transition-normal);
  }

  .history li:hover {
    background: white;
    transform: translateY(-2px);
    border-color: var(--color-accent);
    box-shadow: var(--shadow-sm);
  }

  .history div {
    display: grid;
    gap: 0.25rem;
  }

  .history div strong {
    font-size: 0.95rem;
    color: var(--color-primary);
  }

  .history span {
    color: var(--color-text-muted);
    font-size: 0.82rem;
    font-weight: 500;
  }

  .tag {
    align-self: center;
    padding: 0.25rem 0.65rem;
    border-radius: 999px;
    background: var(--color-accent-light);
    color: var(--color-accent-hover) !important;
    font-weight: 800;
    font-size: 0.75rem;
    letter-spacing: 0.02em;
    border: 1px solid var(--color-card-border);
  }

  h3 {
    font-size: 1.15rem;
    font-weight: 700;
    margin: 2.25rem 0 1rem;
    letter-spacing: -0.01em;
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
