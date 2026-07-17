<script lang="ts">
  let { data } = $props();
</script>

<svelte:head><title>Learner preview | LiftOff</title></svelte:head>

<main>
  <header>
    <div>
      <p class="eyebrow">Read-only learner perspective</p>
      <h1>Sample learner workspace</h1>
      <p>
        Previewing as {data.displayName}. No learner account, records, or submissions are shown.
      </p>
    </div>
    <a href="/">Exit preview</a>
  </header>

  <section>
    <p class="eyebrow">Morning check-in</p>
    <h2>What are your goals today?</h2>
    <fieldset disabled>
      <label>Goals<textarea>Example goal shown only for layout preview</textarea></label>
      <label>First task<input value="Example first task" /></label>
      <label>Blockers<textarea></textarea></label>
      <label>Support needed<textarea></textarea></label>
      <button>Save morning goals</button>
    </fieldset>
  </section>

  <section>
    <p class="eyebrow">End-of-day reflection</p>
    <h2>Did you meet your goals?</h2>
    <fieldset disabled>
      <label>Goal result<select><option>Yes</option></select></label>
      <label>What did you complete?<textarea></textarea></label>
      <label>What got in the way?<textarea></textarea></label>
      <button>Save exit ticket</button>
    </fieldset>
  </section>
</main>

<style>
  :global(body) {
    background-color: var(--color-bg);
  }

  main {
    width: min(100%, 860px);
    margin: 0 auto;
    padding: 3rem 1.25rem 6rem;
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
    align-items: center;
    justify-content: space-between;
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
    font-size: clamp(1.6rem, 3vw, 2.2rem);
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
    opacity: 0.65;
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
    box-shadow: var(--shadow-sm);
  }

  @media (max-width: 760px) {
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
