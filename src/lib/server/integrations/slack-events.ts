export function slackAcknowledgmentMessageId(
  event: Record<string, unknown>,
  allowedActors: ReadonlySet<string>,
  staffChannelId: string,
): string | undefined {
  const actor = typeof event.user === 'string' ? event.user : '';
  if (!allowedActors.has(actor)) return undefined;

  if (event.type === 'reaction_added') {
    const item =
      event.item && typeof event.item === 'object' ? (event.item as Record<string, unknown>) : {};
    if (item.channel !== staffChannelId || typeof item.ts !== 'string') return undefined;
    return item.ts;
  }

  if (event.type === 'message') {
    if (event.channel !== staffChannelId || typeof event.thread_ts !== 'string') return undefined;
    return event.thread_ts;
  }

  return undefined;
}
