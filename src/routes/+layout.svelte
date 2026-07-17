<script lang="ts">
  let { children } = $props();
</script>

<div class="app-container">
  <!-- Decorative background elements -->
  <div class="blob blob-1"></div>
  <div class="blob blob-2"></div>
  <div class="blob blob-3"></div>
  <div class="grid-overlay"></div>

  <div class="content-wrapper">
    {@render children()}
  </div>
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

    --color-card-bg: rgba(255, 255, 255, 0.82);
    --color-card-border: rgba(220, 227, 217, 0.7);

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

  /* Premium subtle grid overlay */
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

  .content-wrapper {
    position: relative;
    z-index: 2;
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
</style>
