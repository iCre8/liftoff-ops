import { describe, expect, it } from 'vitest';

import { preferenceChanges, resolvePermittedLearnerChannel } from './communication-preferences';

describe('learner communication preferences', () => {
  it('expands per-channel and both-channel actions deterministically', () => {
    expect(preferenceChanges('STOP_BOTH')).toEqual([
      { channel: 'EMAIL', enabled: false },
      { channel: 'SLACK', enabled: false },
    ]);
    expect(preferenceChanges('RESUME_EMAIL')).toEqual([{ channel: 'EMAIL', enabled: true }]);
  });

  it('uses only enabled available channels and suppresses when none remain', () => {
    expect(
      resolvePermittedLearnerChannel({
        preferredChannel: 'EMAIL',
        slackAvailable: true,
        enabledChannels: new Set(['SLACK']),
      }),
    ).toBe('SLACK');
    expect(
      resolvePermittedLearnerChannel({
        preferredChannel: 'SLACK',
        slackAvailable: true,
        enabledChannels: new Set(),
      }),
    ).toBeNull();
  });
});
