<script lang="ts">
  let { data } = $props();
</script>

<svelte:head><title>Sanitized development sign-in</title></svelte:head>
<main>
  <div class="login-card">
    <p class="eyebrow">Development environment only</p>
    <h1>Choose a sanitized identity</h1>
    <p class="description">
      This authentication portal is fail-closed in production and is backed by local dev seeds only.
    </p>

    <div class="accounts">
      {#each data.accounts as account}
        {@const primaryRole = account.roles[0]?.role || 'LEARNER'}
        {@const displayName = account.displayName || account.email}
        <form method="POST">
          <input type="hidden" name="email" value={account.email} />
          <button class="account-card {primaryRole.toLowerCase()}">
            <div class="avatar-container">
              <span class="avatar-text">
                {displayName
                  .split(' ')
                  .map((n: string) => n[0])
                  .join('')}
              </span>
            </div>
            <div class="account-details">
              <strong>{displayName}</strong>
              <span class="role-badge"
                >{account.roles.map((role: { role: string }) => role.role).join(' · ')}</span
              >
            </div>
            <div class="arrow">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor">
                <path
                  d="M5 12h14M12 5l7 7-7 7"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </div>
          </button>
        </form>
      {/each}
    </div>
  </div>
</main>

<style>
  main {
    min-height: 100vh;
    display: grid;
    place-items: center;
    padding: 2rem;
  }

  .login-card {
    width: min(540px, 100%);
    background: var(--color-card-bg);
    border: 1px solid var(--color-card-border);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
    backdrop-filter: blur(12px);
    padding: clamp(2rem, 5vw, 3rem);
    text-align: center;
    transition: border-color var(--transition-normal);
  }

  .login-card:hover {
    border-color: rgba(47, 112, 74, 0.2);
  }

  h1 {
    font-size: clamp(1.8rem, 3vw, 2.3rem);
    font-weight: 800;
    letter-spacing: -0.03em;
    margin: 0.5rem 0 1rem;
    line-height: 1.15;
  }

  .eyebrow {
    color: var(--color-accent);
    font-size: 0.75rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    margin: 0;
  }

  .description {
    color: var(--color-text-muted);
    font-size: 0.95rem;
    line-height: 1.5;
    margin: 0 0 2.5rem;
  }

  .accounts {
    display: grid;
    gap: 1rem;
    text-align: left;
  }

  form {
    margin: 0;
  }

  .account-card {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 1.25rem;
    padding: 1.25rem;
    border: 1px solid var(--color-card-border);
    border-radius: var(--radius-md);
    background: rgba(255, 255, 255, 0.5);
    cursor: pointer;
    transition: all var(--transition-normal);
    position: relative;
    overflow: hidden;
  }

  .account-card::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(
      90deg,
      rgba(255, 255, 255, 0) 0%,
      rgba(255, 255, 255, 0.2) 50%,
      rgba(255, 255, 255, 0) 100%
    );
    transform: translateX(-100%);
    transition: transform 0.6s ease-in-out;
  }

  .account-card:hover::after {
    transform: translateX(100%);
  }

  .account-card:hover {
    transform: translateY(-2px);
    background: white;
    box-shadow: var(--shadow-md);
    border-color: var(--color-primary-light);
  }

  .avatar-container {
    width: 3rem;
    height: 3rem;
    border-radius: 50%;
    display: grid;
    place-items: center;
    font-weight: 800;
    font-family: var(--font-heading);
    font-size: 1.1rem;
    flex-shrink: 0;
    transition: transform var(--transition-normal);
  }

  .account-card:hover .avatar-container {
    transform: scale(1.05) rotate(5deg);
  }

  .account-details {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    flex-grow: 1;
  }

  .account-details strong {
    font-size: 1.05rem;
    color: var(--color-primary);
    font-weight: 700;
  }

  .role-badge {
    align-self: flex-start;
    font-size: 0.75rem;
    font-weight: 800;
    letter-spacing: 0.05em;
    padding: 0.2rem 0.6rem;
    border-radius: 999px;
  }

  .arrow {
    color: var(--color-text-muted);
    opacity: 0;
    transform: translateX(-10px);
    transition: all var(--transition-normal);
  }

  .account-card:hover .arrow {
    opacity: 1;
    transform: translateX(0);
    color: var(--color-accent);
  }

  /* Role Specific Themes */
  .admin .avatar-container {
    background: hsl(265, 80%, 94%);
    color: hsl(265, 75%, 45%);
    border: 1.5px solid hsl(265, 80%, 86%);
  }

  .admin .role-badge {
    background: hsl(265, 80%, 94%);
    color: hsl(265, 75%, 45%);
  }

  .admin:hover {
    border-color: hsl(265, 70%, 75%);
    box-shadow: 0 8px 20px hsla(265, 70%, 45%, 0.08);
  }

  .facilitator .avatar-container {
    background: hsl(172, 60%, 92%);
    color: hsl(172, 75%, 32%);
    border: 1.5px solid hsl(172, 60%, 82%);
  }

  .facilitator .role-badge {
    background: hsl(172, 60%, 92%);
    color: hsl(172, 75%, 32%);
  }

  .facilitator:hover {
    border-color: hsl(172, 70%, 50%);
    box-shadow: 0 8px 20px hsla(172, 70%, 32%, 0.08);
  }

  .learner .avatar-container {
    background: hsl(200, 80%, 93%);
    color: hsl(200, 80%, 38%);
    border: 1.5px solid hsl(200, 80%, 84%);
  }

  .learner .role-badge {
    background: hsl(200, 80%, 93%);
    color: hsl(200, 80%, 38%);
  }

  .learner:hover {
    border-color: hsl(200, 70%, 60%);
    box-shadow: 0 8px 20px hsla(200, 70%, 38%, 0.08);
  }
</style>
