import { createHmac, timingSafeEqual } from 'node:crypto';

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function freshTimestamp(timestamp: string, now: Date, toleranceSeconds = 300): boolean {
  if (!/^\d+$/.test(timestamp)) return false;
  return Math.abs(now.getTime() / 1000 - Number(timestamp)) <= toleranceSeconds;
}

export function verifySlackSignature(input: {
  rawBody: string;
  timestamp: string;
  signature: string;
  signingSecret: string;
  now?: Date;
}): boolean {
  if (!freshTimestamp(input.timestamp, input.now ?? new Date())) return false;
  const digest = createHmac('sha256', input.signingSecret)
    .update(`v0:${input.timestamp}:${input.rawBody}`)
    .digest('hex');
  return safeEqual(`v0=${digest}`, input.signature);
}

export function verifyResendSignature(input: {
  rawBody: string;
  eventId: string;
  timestamp: string;
  signature: string;
  signingSecret: string;
  now?: Date;
}): boolean {
  if (!freshTimestamp(input.timestamp, input.now ?? new Date())) return false;
  const encodedSecret = input.signingSecret.startsWith('whsec_')
    ? input.signingSecret.slice('whsec_'.length)
    : input.signingSecret;
  let secret: Buffer;
  try {
    secret = Buffer.from(encodedSecret, 'base64');
  } catch {
    return false;
  }
  if (secret.length === 0) return false;
  const expected = createHmac('sha256', secret)
    .update(`${input.eventId}.${input.timestamp}.${input.rawBody}`)
    .digest('base64');
  return input.signature
    .split(' ')
    .some((candidate) => candidate.startsWith('v1,') && safeEqual(expected, candidate.slice(3)));
}
