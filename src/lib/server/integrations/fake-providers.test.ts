import { describe, expect, it } from 'vitest';

import {
  FakeProviderError,
  SanitizedFakeLearnerMessages,
  SanitizedFakeTeamFollowUp,
} from './fake-providers';

const message = {
  idempotencyKey: 'outreach:sanitized:1',
  recipientExternalId: 'learner-reference',
  templateKey: 'late',
  templateVersion: 1,
  approvedFields: { missedAction: 'morning check-in' },
  renderedContent: 'Please complete your morning check-in or request support.',
};

describe('sanitized provider fakes', () => {
  it('deduplicates messages and call tasks by idempotency key', async () => {
    const messages = new SanitizedFakeLearnerMessages();
    expect(await messages.send(message)).toEqual(await messages.send(message));
    expect(messages.requests).toHaveLength(1);

    const tasks = new SanitizedFakeTeamFollowUp();
    const request = {
      idempotencyKey: 'task:sanitized:1',
      learnerExternalId: 'learner-reference',
      incidentExternalId: 'incident-reference',
    };
    expect(await tasks.createCallTask(request)).toEqual(await tasks.createCallTask(request));
    expect(tasks.requests).toHaveLength(1);
  });

  it('exposes bounded permanent versus retryable failure metadata', async () => {
    const provider = new SanitizedFakeLearnerMessages(
      new Map([[message.idempotencyKey, new FakeProviderError('recipient_not_found', true)]]),
    );
    await expect(provider.send(message)).rejects.toMatchObject({
      code: 'recipient_not_found',
      permanent: true,
    });
    expect(provider.requests).toHaveLength(0);
  });
});
