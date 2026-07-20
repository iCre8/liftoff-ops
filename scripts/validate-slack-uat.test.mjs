import { spawnSync } from 'node:child_process';

import { describe, expect, it } from 'vitest';

describe('Slack UAT validation command', () => {
  it('loads under the pinned Node runtime before checking external secrets', () => {
    const result = spawnSync(process.execPath, ['scripts/validate-slack-uat.mjs'], {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: { PATH: process.env.PATH },
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('SLACK_BOT_TOKEN or SLACK_BOT_TOKEN_FILE is required');
    expect(result.stderr).not.toContain('ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX');
  });
});
