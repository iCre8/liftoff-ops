import { fail } from '@sveltejs/kit';

import {
  communicationPreferenceActionSchema,
  preferenceChanges,
} from '$lib/domain/communication-preferences';
import { requireRole } from '$lib/server/auth';
import { getDatabase } from '$lib/server/db';
import { setLearnerCommunicationPreferences } from '$lib/server/services/communication-preferences';

function learnerAccount(locals: App.Locals) {
  const account = requireRole(locals, 'learner');
  if (!account.learner) throw new Error('Learner role is missing its cohort profile');
  return account;
}

export const load = async ({ locals }) => {
  const account = learnerAccount(locals);
  const preferences = await getDatabase().learnerCommunicationPreference.findMany({
    where: { learnerId: account.learner!.id, channel: { in: ['EMAIL', 'SLACK'] } },
    select: { channel: true, enabled: true, effectiveAt: true },
  });
  const byChannel = new Map(preferences.map((item) => [item.channel, item]));
  return {
    emailEnabled: byChannel.get('EMAIL')?.enabled ?? true,
    slackEnabled: byChannel.get('SLACK')?.enabled ?? true,
    emailEffectiveAt: byChannel.get('EMAIL')?.effectiveAt ?? null,
    slackEffectiveAt: byChannel.get('SLACK')?.effectiveAt ?? null,
  };
};

export const actions = {
  update: async ({ request, locals }) => {
    const account = learnerAccount(locals);
    const data = await request.formData();
    const parsed = communicationPreferenceActionSchema.safeParse(data.get('preferenceAction'));
    if (!parsed.success) return fail(400, { message: 'Choose a valid communication preference' });
    const changes = preferenceChanges(parsed.data);
    try {
      await setLearnerCommunicationPreferences(getDatabase(), {
        learnerId: account.learner!.id,
        actorAccountId: account.id,
        changes,
        source: changes[0].enabled ? 'LEARNER_RESUME' : 'LEARNER_FORM',
      });
      return {
        success: true,
        message: changeMessage(
          changes.map((change) => change.channel),
          changes[0].enabled,
        ),
      };
    } catch {
      return fail(400, {
        message:
          'Unable to update communication choices. Please try again or contact program staff.',
      });
    }
  },
};

function changeMessage(channels: string[], enabled: boolean): string {
  const label = channels.length === 2 ? 'Email and Slack messages' : `${channels[0]} messages`;
  return enabled
    ? `${label} will resume for future attendance outreach.`
    : `${label} are now suppressed. Attendance recording and human follow-up continue.`;
}
