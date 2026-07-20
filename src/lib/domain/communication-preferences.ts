import { z } from 'zod';

export const automatedLearnerChannelSchema = z.enum(['EMAIL', 'SLACK']);
export type AutomatedLearnerChannel = z.infer<typeof automatedLearnerChannelSchema>;

export const communicationPreferenceActionSchema = z.enum([
  'STOP_EMAIL',
  'STOP_SLACK',
  'STOP_BOTH',
  'RESUME_EMAIL',
  'RESUME_SLACK',
  'RESUME_BOTH',
]);

export type CommunicationPreferenceAction = z.infer<typeof communicationPreferenceActionSchema>;

export function preferenceChanges(action: CommunicationPreferenceAction) {
  const enabled = action.startsWith('RESUME_');
  const suffix = action.replace(/^(STOP|RESUME)_/, '');
  const channels: AutomatedLearnerChannel[] =
    suffix === 'BOTH' ? ['EMAIL', 'SLACK'] : [automatedLearnerChannelSchema.parse(suffix)];
  return channels.map((channel) => ({ channel, enabled }));
}

export function resolvePermittedLearnerChannel(input: {
  preferredChannel?: AutomatedLearnerChannel | null;
  slackAvailable: boolean;
  enabledChannels: ReadonlySet<AutomatedLearnerChannel>;
}): AutomatedLearnerChannel | null {
  const available = new Set<AutomatedLearnerChannel>(['EMAIL']);
  if (input.slackAvailable) available.add('SLACK');
  const permitted = (channel: AutomatedLearnerChannel) =>
    available.has(channel) && input.enabledChannels.has(channel);
  if (input.preferredChannel && permitted(input.preferredChannel)) return input.preferredChannel;
  if (permitted('SLACK')) return 'SLACK';
  if (permitted('EMAIL')) return 'EMAIL';
  return null;
}
