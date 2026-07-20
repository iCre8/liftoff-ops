import { describe, expect, it } from 'vitest';

import { slackAcknowledgmentMessageId } from './slack-events';

const staff = new Set(['U_STAFF']);

describe('Slack acknowledgment boundary', () => {
  it('accepts staff reactions and thread replies only in the configured channel', () => {
    expect(
      slackAcknowledgmentMessageId(
        {
          type: 'reaction_added',
          user: 'U_STAFF',
          item: { channel: 'C_STAFF', ts: 'message-ref' },
        },
        staff,
        'C_STAFF',
      ),
    ).toBe('message-ref');
    expect(
      slackAcknowledgmentMessageId(
        { type: 'message', user: 'U_STAFF', channel: 'C_STAFF', thread_ts: 'message-ref' },
        staff,
        'C_STAFF',
      ),
    ).toBe('message-ref');
  });

  it('rejects other actors, other channels, and top-level messages', () => {
    expect(
      slackAcknowledgmentMessageId(
        {
          type: 'reaction_added',
          user: 'U_OTHER',
          item: { channel: 'C_STAFF', ts: 'message-ref' },
        },
        staff,
        'C_STAFF',
      ),
    ).toBeUndefined();
    expect(
      slackAcknowledgmentMessageId(
        { type: 'message', user: 'U_STAFF', channel: 'C_OTHER', thread_ts: 'message-ref' },
        staff,
        'C_STAFF',
      ),
    ).toBeUndefined();
    expect(
      slackAcknowledgmentMessageId(
        { type: 'message', user: 'U_STAFF', channel: 'C_STAFF', ts: 'top-level' },
        staff,
        'C_STAFF',
      ),
    ).toBeUndefined();
  });
});
