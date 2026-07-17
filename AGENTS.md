# Repository guidance

- Read `project-notes/design-decisions.md`, `project-notes/phase-2.md`, and `project-notes/project_config.md` before changing product behavior or infrastructure.
- Google Sheets is authoritative for attendance; Postgres is authoritative for incident and outreach history.
- Never introduce learner-identifying fixtures, production records, credentials, tokens, or raw message content into the repository.
- Preserve the approved timing, threshold, correction, retry, and accommodation rules unless a new decision is explicitly approved and logged.
- Keep external providers behind typed adapters. Tests must use sanitized fakes and must not send real messages or write to a live Sheet.
- Use exact package versions, the committed lockfiles, Nix, and Docker Compose. Do not require undocumented global installations.
- Store secrets outside the worktree and mount them as files. Never use Docker build arguments or image layers for credentials.
- Record verified project-specific configuration changes in `project-notes/project_config.md` without including secret values, provider identifiers, learner data, or raw logs.
- Run `pnpm verify` and `docker compose config` before handing off implementation changes.
- Do not provision, deploy, migrate, send external messages, or alter provider configuration without explicit authorization.
