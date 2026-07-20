import { describe, expect, it, vi } from 'vitest';

import { SlackDirectory } from './slack-directory';

describe('Slack directory', () => {
  it('resolves an active human by normalized email without placing the token in the body', async () => {
    const http = vi.fn<typeof fetch>(async () =>
      Response.json({
        ok: true,
        user: {
          id: 'U_SANITIZED',
          deleted: false,
          is_bot: false,
          profile: { email: 'learner@example.test' },
        },
      }),
    );

    const result = await new SlackDirectory('secret-token', http).lookupByEmail(
      ' Learner@Example.Test ',
    );

    expect(result).toEqual({ memberId: 'U_SANITIZED', normalizedEmail: 'learner@example.test' });
    const [, init] = http.mock.calls[0];
    expect(String(init?.body)).toContain('learner%40example.test');
    expect(String(init?.body)).not.toContain('secret-token');
  });

  it('rejects inactive, bot, and mismatched directory results', async () => {
    for (const user of [
      { id: 'U_INACTIVE', deleted: true, profile: { email: 'learner@example.test' } },
      { id: 'U_BOT', is_bot: true, profile: { email: 'learner@example.test' } },
      { id: 'U_OTHER', profile: { email: 'other@example.test' } },
    ]) {
      const http = vi.fn<typeof fetch>(async () => Response.json({ ok: true, user }));
      await expect(
        new SlackDirectory('secret-token', http).lookupByEmail('learner@example.test'),
      ).rejects.toThrow();
    }
  });
});
