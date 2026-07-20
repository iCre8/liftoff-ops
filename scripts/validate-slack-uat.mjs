import { chmodSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, resolve } from 'node:path';

import { readRequiredSecret } from '../src/lib/server/config/secrets.ts';

const sendCanary = process.argv.includes('--send-staff-canary');
const token = readRequiredSecret('SLACK_BOT_TOKEN');
readRequiredSecret('SLACK_SIGNING_SECRET');
const channelId = readRequiredSecret('SLACK_STAFF_CHANNEL_ID');
const staffMemberIds = [
  ...new Set(
    readRequiredSecret('SLACK_STAFF_MEMBER_IDS')
      .split(/[\s,]+/)
      .map((value) => value.trim())
      .filter(Boolean),
  ),
];

if (!/^[CG][A-Z0-9]+$/.test(channelId)) throw new Error('The Slack staff channel ID is invalid');
if (staffMemberIds.length === 0 || staffMemberIds.some((id) => !/^[UW][A-Z0-9]+$/.test(id))) {
  throw new Error('The Slack staff member allowlist is invalid');
}

async function slackApi(method, body = {}) {
  const response = await fetch(`https://slack.com/api/${method}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/x-www-form-urlencoded; charset=utf-8',
    },
    body: new URLSearchParams(body),
  });
  if (!response.ok) throw new Error(`Slack UAT preflight failed with HTTP ${response.status}`);
  const result = await response.json();
  if (!result.ok)
    throw new Error(`Slack UAT preflight failed: ${String(result.error).slice(0, 100)}`);
  return result;
}

await slackApi('auth.test');
for (const memberId of staffMemberIds) {
  const result = await slackApi('users.info', { user: memberId });
  if (!result.user || result.user.deleted || result.user.is_bot) {
    throw new Error('The Slack staff allowlist contains an inactive or bot account');
  }
}

console.log(
  `Slack UAT preflight succeeded: authenticated bot, ${staffMemberIds.length} active staff allowlist entries, provider identifiers logged: no.`,
);

if (!sendCanary) {
  console.log(
    'No message sent. Add --send-staff-canary only after explicit staff-canary approval.',
  );
  process.exit(0);
}

const receiptPath = resolve(
  process.env.LIFTOFF_SLACK_CANARY_RECEIPT_FILE ??
    `${homedir()}/.config/liftoff/slack-uat-canary.receipt.json`,
);
if (existsSync(receiptPath)) {
  throw new Error('A Slack UAT canary receipt already exists; refusing to send a duplicate');
}
const receiptDirectory = dirname(receiptPath);
mkdirSync(receiptDirectory, { recursive: true, mode: 0o700 });
chmodSync(receiptDirectory, 0o700);
writeFileSync(
  receiptPath,
  `${JSON.stringify({ provider: 'slack', status: 'pending', startedAt: new Date().toISOString() }, null, 2)}\n`,
  { mode: 0o600, flag: 'wx' },
);

const result = await slackApi('chat.postMessage', {
  channel: channelId,
  text: 'LiftOff UAT Gate 5 staff-only canary. No learner data is included. Please add a reaction and one thread reply for validation.',
});
if (typeof result.ts !== 'string')
  throw new Error('Slack UAT canary returned no message reference');
const acceptedAt = new Date().toISOString();

writeFileSync(
  receiptPath,
  `${JSON.stringify(
    {
      provider: 'slack',
      channelId,
      providerMessageId: result.ts,
      acceptedAt,
    },
    null,
    2,
  )}\n`,
  { mode: 0o600 },
);
console.log(
  `One staff-only Slack canary sent; private receipt written with mode 0600: ${receiptPath}`,
);
