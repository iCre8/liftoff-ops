<script lang="ts">
  let { data } = $props();

  const getRoleIcon = (role: string) => {
    switch (role.toUpperCase()) {
      case 'ADMIN':
        return '👑';
      case 'FACILITATOR':
        return '🌿';
      case 'INSTRUCTOR':
        return '🎓';
      case 'LEARNER':
        return '🚀';
      default:
        return '👤';
    }
  };
</script>

<svelte:head><title>Development Identity Sign-In | LiftOff</title></svelte:head>

<main>
  <div class="login-card">
    <div class="header-badge">
      <span class="badge-dot"></span>
      Development Environment Only
    </div>

    <h1>Choose a Sanitized Identity</h1>
    <p class="description">
      This authentication portal is fail-closed in production environments and is backed by local
      dev seeds only.
    </p>

    <div class="accounts">
      {#each data.accounts as account}
        {@const primaryRole = account.roles[0]?.role || 'LEARNER'}
        {@const displayName = account.displayName || account.email}
        <form method="POST">
          <input type="hidden" name="email" value={account.email} />
          <button class="account-card {primaryRole.toLowerCase()}">
            <div class="avatar-container">
              <span class="role-icon">{getRoleIcon(primaryRole)}</span>
            </div>
            <div class="account-details">
              <strong>{displayName}</strong>
              <span class="email-sub">{account.email}</span>
              <div class="role-badges">
                {#each account.roles as roleObj}
                  <span class="role-badge {roleObj.role.toLowerCase()}">{roleObj.role}</span>
                {/each}
              </div>
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
    min-height: calc(100vh - 10rem);
    display: grid;
    place-items: center;
    padding: 3rem 1.5rem;
  }

  .login-card {
    width: min(560px, 100%);
    background: var(--color-card-bg);
    border: 1px solid var(--color-card-border);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
    backdrop-filter: blur(16px);
    padding: clamp(2rem, 5vw, 3.25rem);
    text-align: center;
  }

  .header-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.35rem 0.85rem;
    border-radius: 999px;
    background: hsl(45, 100%, 94%);
    color: hsl(40, 80%, 25%);
    font-size: 0.75rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    border: 1px solid hsl(45, 90%, 82%);
    margin-bottom: 1rem;
  }

  .badge-dot {
    width: 0.45rem;
    height: 0.45rem;
    border-radius: 50%;
    background: hsl(40, 80%, 45%);
  }

  h1 {
    font-size: clamp(1.8rem, 3.5vw, 2.4rem);
    font-weight: 800;
    letter-spacing: -0.03em;
    margin: 0 0 0.75rem;
    color: var(--color-primary);
  }

  .description {
    color: var(--color-text-muted);
    font-size: 0.95rem;
    line-height: 1.6;
    margin: 0 0 2rem;
  }

  .accounts {
    display: flex;
    flex-direction: column;
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
    border: 1.5px solid var(--color-card-border);
    border-radius: var(--radius-md);
    background: white;
    cursor: pointer;
    transition: all var(--transition-normal);
    position: relative;
    overflow: hidden;
  }

  .account-card:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
    border-color: var(--color-accent);
  }

  .avatar-container {
    width: 3.25rem;
    height: 3.25rem;
    border-radius: var(--radius-sm);
    display: grid;
    place-items: center;
    font-size: 1.5rem;
    background: var(--color-accent-light);
    flex-shrink: 0;
  }

  .account-details {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    flex-grow: 1;
  }

  .account-details strong {
    font-size: 1.05rem;
    color: var(--color-primary);
    font-weight: 700;
  }

  .email-sub {
    font-size: 0.8rem;
    color: var(--color-text-muted);
  }

  .role-badges {
    display: flex;
    gap: 0.35rem;
    margin-top: 0.3rem;
  }

  .role-badge {
    font-size: 0.68rem;
    font-weight: 800;
    letter-spacing: 0.05em;
    padding: 0.15rem 0.55rem;
    border-radius: 999px;
    text-transform: uppercase;
    background: var(--color-accent-light);
    color: var(--color-accent-hover);
  }

  .role-badge.admin {
    background: hsl(265, 80%, 94%);
    color: hsl(265, 75%, 35%);
  }
  .role-badge.facilitator {
    background: hsl(172, 60%, 90%);
    color: hsl(172, 75%, 25%);
  }
  .role-badge.learner {
    background: hsl(200, 80%, 90%);
    color: hsl(200, 80%, 30%);
  }

  .arrow {
    color: var(--color-text-muted);
    opacity: 0.5;
    transition: all var(--transition-fast);
  }

  .account-card:hover .arrow {
    opacity: 1;
    color: var(--color-accent);
    transform: translateX(4px);
  }
</style>
