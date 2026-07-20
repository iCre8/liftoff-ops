<script lang="ts">
  import { page } from '$app/stores';
  let { data, children } = $props();

  let mobileMenuOpen = $state(false);

  function toggleMobileMenu() {
    mobileMenuOpen = !mobileMenuOpen;
  }

  function closeMobileMenu() {
    mobileMenuOpen = false;
  }
</script>

<div class="app-container">
  <!-- Decorative background elements -->
  <div class="blob blob-1"></div>
  <div class="blob blob-2"></div>
  <div class="blob blob-3"></div>
  <div class="grid-overlay"></div>

  <!-- Main Navigation Header -->
  <header class="navbar">
    <div class="nav-container">
      <!-- Logo & Branding -->
      <a href="/" class="brand-logo" onclick={closeMobileMenu}>
        <div class="logo-icon">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor">
            <path
              d="M12 2.5s-4 4.5-4 10c0 2.5 1 4.5 2.5 6l1.5 1.5 1.5-1.5c1.5-1.5 2.5-3.5 2.5-6 0-5.5-4-10-4-10z"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path d="M12 8a2 2 0 100 4 2 2 0 000-4z" stroke-width="2" />
            <path
              d="M5.5 13S3 14 3 17.5c0 1 .5 2 2 2.5"
              stroke-width="1.8"
              stroke-linecap="round"
            />
            <path
              d="M18.5 13S21 14 21 17.5c0 1-.5 2-2 2.5"
              stroke-width="1.8"
              stroke-linecap="round"
            />
          </svg>
        </div>
        <div class="brand-text">
          <span class="app-name">LiftOff</span>
          <span class="cohort-tag">Cohort 3</span>
        </div>
      </a>

      <!-- Desktop Navigation Links -->
      <nav class="nav-links">
        <a href="/" class:active={$page.url.pathname === '/'}>Overview</a>
        <a
          href="/learner"
          class:active={$page.url.pathname.startsWith('/learner') &&
            !$page.url.pathname.startsWith('/learner-preview')}
        >
          My Day
        </a>
        <a href="/operations" class:active={$page.url.pathname.startsWith('/operations')}>
          Operations
        </a>
        <a href="/automation" class:active={$page.url.pathname.startsWith('/automation')}>
          Automation
        </a>
        <a
          href="/learner-preview"
          class:active={$page.url.pathname.startsWith('/learner-preview')}
          class="preview-link"
        >
          Preview
        </a>
      </nav>

      <!-- Account & Auth Actions -->
      <div class="nav-actions">
        {#if data?.account}
          <div class="account-badge {data.account.primaryRole.toLowerCase()}">
            <span class="role-pill">{data.account.primaryRole}</span>
            <span class="account-name">{data.account.displayName}</span>
          </div>
          <form method="POST" action="/auth/logout">
            <button type="submit" class="btn-logout" title="Sign out">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor">
                <path
                  d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </button>
          </form>
        {/if}

        <a href="/dev-login" class="dev-switch-btn" title="Switch identity">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor">
            <path
              d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M8.5 11a4 4 0 100-8 4 4 0 000 8zM20 8v6M23 11h-6"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          <span class="dev-btn-text">Switch Dev Account</span>
        </a>

        <button class="mobile-toggle" onclick={toggleMobileMenu} aria-label="Toggle Navigation">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor">
            {#if mobileMenuOpen}
              <path
                d="M18 6L6 18M6 6l12 12"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            {:else}
              <path
                d="M4 6h16M4 12h16M4 18h16"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            {/if}
          </svg>
        </button>
      </div>
    </div>

    <!-- Mobile Navigation Drawer -->
    {#if mobileMenuOpen}
      <div class="mobile-menu">
        <a href="/" class:active={$page.url.pathname === '/'} onclick={closeMobileMenu}>Overview</a>
        <a
          href="/learner"
          class:active={$page.url.pathname.startsWith('/learner') &&
            !$page.url.pathname.startsWith('/learner-preview')}
          onclick={closeMobileMenu}>My Day</a
        >
        <a
          href="/operations"
          class:active={$page.url.pathname.startsWith('/operations')}
          onclick={closeMobileMenu}>Operations</a
        >
        <a
          href="/automation"
          class:active={$page.url.pathname.startsWith('/automation')}
          onclick={closeMobileMenu}>Automation</a
        >
        <a
          href="/learner-preview"
          class:active={$page.url.pathname.startsWith('/learner-preview')}
          onclick={closeMobileMenu}>Learner Preview</a
        >
      </div>
    {/if}
  </header>

  <div class="content-wrapper">
    {@render children()}
  </div>

  <footer class="app-footer">
    <div class="footer-container">
      <div class="footer-left">
        <span class="footer-brand">LiftOff Attendance Operations</span>
        <span class="footer-dot">•</span>
        <span class="footer-tz">America/New_York (EST)</span>
      </div>
      <div class="footer-right">
        <span class="status-indicator">
          <span class="status-pulse"></span>
          System Operational
        </span>
      </div>
    </div>
  </footer>
</div>

<style>
  :global(:root) {
    --font-heading: 'Outfit', 'Inter', system-ui, sans-serif;
    --font-body: 'Plus Jakarta Sans', 'Inter', system-ui, sans-serif;

    /* Harmonious HSL colors */
    --color-bg: hsl(120, 14%, 97%);
    --color-text: hsl(150, 24%, 12%);
    --color-text-muted: hsl(150, 10%, 45%);

    --color-primary: hsl(152, 53%, 20%);
    --color-primary-light: hsl(152, 40%, 30%);
    --color-primary-glow: hsla(152, 53%, 20%, 0.12);

    --color-accent: hsl(145, 63%, 38%);
    --color-accent-hover: hsl(145, 65%, 32%);
    --color-accent-light: hsl(142, 52%, 94%);
    --color-accent-glow: hsla(145, 63%, 38%, 0.15);

    --color-card-bg: rgba(255, 255, 255, 0.85);
    --color-card-border: rgba(220, 227, 217, 0.75);

    --shadow-sm: 0 2px 8px rgba(23, 35, 28, 0.04);
    --shadow-md: 0 10px 30px rgba(23, 35, 28, 0.05);
    --shadow-lg: 0 20px 50px rgba(23, 35, 28, 0.08);

    --radius-sm: 0.6rem;
    --radius-md: 1rem;
    --radius-lg: 1.5rem;

    --transition-fast: 0.15s cubic-bezier(0.4, 0, 0.2, 1);
    --transition-normal: 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    --transition-slow: 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  }

  :global(body) {
    margin: 0;
    padding: 0;
    min-height: 100vh;
    background-color: var(--color-bg);
    color: var(--color-text);
    font-family: var(--font-body);
    overflow-x: hidden;
    position: relative;
  }

  :global(h1),
  :global(h2),
  :global(h3),
  :global(h4),
  :global(h5) {
    font-family: var(--font-heading);
    color: var(--color-primary);
  }

  .app-container {
    position: relative;
    min-height: 100vh;
    width: 100%;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  /* Glassmorphic Navbar */
  .navbar {
    position: sticky;
    top: 0;
    z-index: 100;
    background: rgba(14, 38, 25, 0.92);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12);
  }

  .nav-container {
    width: min(1280px, calc(100% - 2.5rem));
    margin: 0 auto;
    height: 4.25rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1.5rem;
  }

  .brand-logo {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    text-decoration: none;
    color: white;
  }

  .logo-icon {
    width: 2.25rem;
    height: 2.25rem;
    border-radius: var(--radius-sm);
    background: linear-gradient(135deg, hsl(145, 65%, 45%) 0%, hsl(152, 60%, 25%) 100%);
    display: grid;
    place-items: center;
    color: white;
    box-shadow: 0 0 12px hsla(145, 65%, 45%, 0.4);
  }

  .brand-text {
    display: flex;
    flex-direction: column;
    line-height: 1.1;
  }

  .app-name {
    font-family: var(--font-heading);
    font-size: 1.25rem;
    font-weight: 800;
    letter-spacing: -0.02em;
    color: white;
  }

  .cohort-tag {
    font-size: 0.68rem;
    font-weight: 700;
    color: hsl(145, 60%, 65%);
    text-transform: uppercase;
    letter-spacing: 0.12em;
  }

  .nav-links {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    background: rgba(255, 255, 255, 0.05);
    padding: 0.3rem;
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .nav-links a {
    padding: 0.5rem 1rem;
    border-radius: 999px;
    color: hsl(140, 20%, 82%);
    font-size: 0.88rem;
    font-weight: 600;
    text-decoration: none;
    transition: all var(--transition-fast);
  }

  .nav-links a:hover {
    color: white;
    background: rgba(255, 255, 255, 0.1);
  }

  .nav-links a.active {
    background: var(--color-accent);
    color: white;
    font-weight: 700;
    box-shadow: 0 2px 8px var(--color-accent-glow);
  }

  .preview-link {
    border: 1px dashed rgba(255, 255, 255, 0.25);
  }

  .nav-actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .account-badge {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.35rem 0.75rem 0.35rem 0.4rem;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 999px;
    color: white;
    font-size: 0.82rem;
  }

  .role-pill {
    font-size: 0.68rem;
    font-weight: 800;
    padding: 0.15rem 0.5rem;
    border-radius: 999px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .account-badge.admin .role-pill {
    background: hsl(265, 80%, 92%);
    color: hsl(265, 75%, 35%);
  }

  .account-badge.facilitator .role-pill {
    background: hsl(172, 60%, 90%);
    color: hsl(172, 75%, 25%);
  }

  .account-badge.learner .role-pill {
    background: hsl(200, 80%, 90%);
    color: hsl(200, 80%, 30%);
  }

  .account-badge.instructor .role-pill {
    background: hsl(145, 70%, 90%);
    color: hsl(145, 75%, 25%);
  }

  .account-name {
    font-weight: 600;
    max-width: 14ch;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .btn-logout {
    display: grid;
    place-items: center;
    width: 2.1rem;
    height: 2.1rem;
    padding: 0;
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.06);
    color: hsl(140, 20%, 80%);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .btn-logout:hover {
    background: hsl(0, 70%, 50%);
    color: white;
    border-color: hsl(0, 70%, 50%);
  }

  .dev-switch-btn {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    padding: 0.45rem 0.85rem;
    border-radius: var(--radius-sm);
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: white;
    font-size: 0.82rem;
    font-weight: 700;
    text-decoration: none;
    transition: all var(--transition-fast);
  }

  .dev-switch-btn:hover {
    background: white;
    color: var(--color-primary);
    box-shadow: 0 4px 12px rgba(255, 255, 255, 0.15);
  }

  .mobile-toggle {
    display: none;
    background: transparent;
    border: none;
    color: white;
    cursor: pointer;
    padding: 0.25rem;
  }

  .mobile-menu {
    display: flex;
    flex-direction: column;
    padding: 1rem 1.25rem;
    background: rgba(10, 28, 18, 0.98);
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    gap: 0.5rem;
  }

  .mobile-menu a {
    padding: 0.75rem 1rem;
    border-radius: var(--radius-sm);
    color: white;
    text-decoration: none;
    font-weight: 600;
    font-size: 0.95rem;
  }

  .mobile-menu a.active {
    background: var(--color-accent);
  }

  .content-wrapper {
    position: relative;
    z-index: 2;
    flex: 1;
  }

  .app-footer {
    background: rgba(14, 38, 25, 0.95);
    color: hsl(140, 20%, 75%);
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    padding: 1.25rem 0;
    font-size: 0.82rem;
    margin-top: 4rem;
  }

  .footer-container {
    width: min(1280px, calc(100% - 2.5rem));
    margin: 0 auto;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 1rem;
  }

  .footer-left {
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }

  .footer-brand {
    font-weight: 700;
    color: white;
  }

  .footer-dot {
    opacity: 0.4;
  }

  .status-indicator {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    font-weight: 600;
    color: hsl(145, 60%, 65%);
  }

  .status-pulse {
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 50%;
    background: hsl(145, 65%, 45%);
    box-shadow: 0 0 8px hsl(145, 65%, 45%);
    animation: pulse-dot 2s infinite alternate;
  }

  @keyframes pulse-dot {
    0% {
      opacity: 0.4;
    }
    100% {
      opacity: 1;
    }
  }

  /* Soft glowing background shapes */
  .blob {
    position: absolute;
    border-radius: 50%;
    filter: blur(120px);
    opacity: 0.4;
    z-index: 0;
    pointer-events: none;
    animation: float 25s infinite alternate ease-in-out;
  }

  .blob-1 {
    top: -10%;
    left: -10%;
    width: 50vw;
    height: 50vw;
    background: radial-gradient(circle, hsla(145, 60%, 45%, 0.3) 0%, rgba(255, 255, 255, 0) 70%);
  }

  .blob-2 {
    bottom: -15%;
    right: -10%;
    width: 60vw;
    height: 60vw;
    background: radial-gradient(circle, hsla(152, 60%, 30%, 0.2) 0%, rgba(255, 255, 255, 0) 70%);
    animation-delay: -5s;
    animation-duration: 30s;
  }

  .blob-3 {
    top: 40%;
    right: 15%;
    width: 35vw;
    height: 35vw;
    background: radial-gradient(circle, hsla(38, 70%, 75%, 0.15) 0%, rgba(255, 255, 255, 0) 70%);
    animation-delay: -10s;
    animation-duration: 20s;
  }

  .grid-overlay {
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(rgba(23, 35, 28, 0.012) 1px, transparent 1px),
      linear-gradient(90deg, rgba(23, 35, 28, 0.012) 1px, transparent 1px);
    background-size: 40px 40px;
    z-index: 1;
    pointer-events: none;
  }

  @keyframes float {
    0% {
      transform: translate(0, 0) scale(1);
    }
    50% {
      transform: translate(5%, 3%) scale(1.05);
    }
    100% {
      transform: translate(-3%, -5%) scale(0.95);
    }
  }

  @media (max-width: 900px) {
    .nav-links {
      display: none;
    }
    .mobile-toggle {
      display: block;
    }
    .dev-btn-text {
      display: none;
    }
    .account-name {
      display: none;
    }
  }
</style>
