import { describe, expect, it, vi } from 'vitest';

import type { LearnerMessagePort } from '$lib/server/integrations/contracts';

import {
  sendLearnerMessageWithPreference,
  type CommunicationPreferencePort,
} from './communication-preferences';

const request = {
  idempotencyKey: 'outreach:sanitized:preference',
  recipientExternalId: 'recipient-reference',
  templateKey: 'late',
  templateVersion: 1,
  approvedFields: {},
  renderedContent: 'Please complete your check-in or request support.',
};

describe('preference-aware learner delivery', () => {
  it('records suppression and makes zero provider calls', async () => {
    const preferences: CommunicationPreferencePort = {
      isEnabled: vi.fn(async () => false),
      recordSuppressed: vi.fn(async () => undefined),
    };
    const provider: LearnerMessagePort = { send: vi.fn() };
    await expect(
      sendLearnerMessageWithPreference({
        preferences,
        provider,
        learnerId: 'learner-ref',
        channel: 'EMAIL',
        request,
      }),
    ).resolves.toEqual({ status: 'SUPPRESSED' });
    expect(provider.send).not.toHaveBeenCalled();
    expect(preferences.recordSuppressed).toHaveBeenCalledOnce();
  });

  it('sends once when the selected channel remains enabled', async () => {
    const preferences: CommunicationPreferencePort = {
      isEnabled: vi.fn(async () => true),
      recordSuppressed: vi.fn(async () => undefined),
    };
    const provider: LearnerMessagePort = {
      send: vi.fn(async () => ({ providerMessageId: 'provider-ref', acceptedAt: '2026-07-20' })),
    };
    const result = await sendLearnerMessageWithPreference({
      preferences,
      provider,
      learnerId: 'learner-ref',
      channel: 'SLACK',
      request,
    });
    expect(result.status).toBe('SENT');
    expect(provider.send).toHaveBeenCalledOnce();
    expect(preferences.recordSuppressed).not.toHaveBeenCalled();
  });
});
