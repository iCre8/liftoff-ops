import { chmodSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { readRequiredSecret } from '../src/lib/server/config/secrets.ts';

const EMAIL_PATTERN = /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/;
const UAT_SENDER_DOMAIN = 'uat-mail.liftofflearning.tech';
const CORPORATE_RECIPIENT_DOMAIN = 'launchpadphilly.org';

export function normalizeRecipientList(value) {
  const recipients = [
    ...new Set(
      value
        .split(/[\s,]+/)
        .map((recipient) => recipient.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
  if (recipients.length === 0 || recipients.some((recipient) => !EMAIL_PATTERN.test(recipient))) {
    throw new Error('The Resend staff recipient allowlist is invalid');
  }
  return recipients;
}

export function normalizeSender(value) {
  const sender = value.trim();
  const bracketed = sender.match(/^[^<>\r\n]+<([^<>]+)>$/);
  const address = (bracketed?.[1] ?? sender).trim().toLowerCase();
  if (!EMAIL_PATTERN.test(address)) throw new Error('The Resend sender is invalid');
  if (!address.endsWith(`@${UAT_SENDER_DOMAIN}`)) {
    throw new Error(`The Resend UAT sender must use @${UAT_SENDER_DOMAIN}`);
  }
  return { sender, address };
}

export function normalizeReplyTo(value, staffRecipients) {
  const replyTo = value.trim().toLowerCase();
  if (
    !EMAIL_PATTERN.test(replyTo) ||
    !replyTo.endsWith(`@${CORPORATE_RECIPIENT_DOMAIN}`) ||
    !staffRecipients.includes(replyTo)
  ) {
    throw new Error('The Resend reply-to must be a corporate staff allowlist member');
  }
  return replyTo;
}

export function assertCanaryRecipient(value, staffRecipients) {
  const recipient = value.trim().toLowerCase();
  if (!EMAIL_PATTERN.test(recipient) || !staffRecipients.includes(recipient)) {
    throw new Error('The Resend UAT canary recipient must be in the staff allowlist');
  }
  return recipient;
}

async function sendResendCanary(apiKey, sender, replyTo, recipient, idempotencyKey) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
      'idempotency-key': idempotencyKey,
    },
    body: JSON.stringify({
      from: sender,
      to: [recipient],
      subject: 'LiftOff UAT Gate 6 staff-only canary',
      text: 'This is the LiftOff UAT Gate 6 staff-only email canary. No learner data is included.',
      reply_to: replyTo,
    }),
  });
  if (!response.ok) {
    throw new Error(`Resend UAT canary failed with HTTP ${response.status}`);
  }
  const result = await response.json();
  if (typeof result.id !== 'string' || !result.id) {
    throw new Error('Resend UAT canary returned no message reference');
  }
  return {
    providerMessageId: result.id,
    acceptedAt: new Date().toISOString(),
  };
}

export async function run(environment = process.env, arguments_ = process.argv.slice(2)) {
  const sendCanary = arguments_.includes('--send-staff-canary');
  const apiKey = readRequiredSecret('RESEND_API_KEY', environment);
  const webhookSecret = readRequiredSecret('RESEND_WEBHOOK_SECRET', environment);
  const { sender } = normalizeSender(readRequiredSecret('RESEND_SENDER', environment));
  const staffRecipients = normalizeRecipientList(
    readRequiredSecret('RESEND_STAFF_RECIPIENTS', environment),
  );
  const replyTo = normalizeReplyTo(
    readRequiredSecret('RESEND_REPLY_TO', environment),
    staffRecipients,
  );

  if (!apiKey.startsWith('re_')) throw new Error('The Resend API key format is invalid');
  if (!webhookSecret.startsWith('whsec_')) {
    throw new Error('The Resend webhook signing secret format is invalid');
  }

  console.log(
    `Resend UAT local preflight succeeded: sender configured, ${staffRecipients.length} staff allowlist entries, secret values and addresses logged: no.`,
  );

  if (!sendCanary) {
    console.log(
      'No email sent. Add --send-staff-canary only after explicit staff-canary approval.',
    );
    return;
  }

  const canaryRecipient = assertCanaryRecipient(
    readRequiredSecret('RESEND_UAT_CANARY_RECIPIENT', environment),
    staffRecipients,
  );
  const receiptPath = resolve(
    environment.LIFTOFF_RESEND_CANARY_RECEIPT_FILE ??
      `${homedir()}/.config/liftoff/resend-uat-canary.receipt.json`,
  );
  if (existsSync(receiptPath)) {
    throw new Error('A Resend UAT canary receipt already exists; refusing to send a duplicate');
  }
  const receiptDirectory = dirname(receiptPath);
  mkdirSync(receiptDirectory, { recursive: true, mode: 0o700 });
  chmodSync(receiptDirectory, 0o700);
  const startedAt = new Date().toISOString();
  const idempotencyKey = `liftoff-uat-gate-6/${startedAt.slice(0, 10)}`;
  writeFileSync(
    receiptPath,
    `${JSON.stringify({ provider: 'resend', status: 'pending', startedAt }, null, 2)}\n`,
    { mode: 0o600, flag: 'wx' },
  );

  const first = await sendResendCanary(apiKey, sender, replyTo, canaryRecipient, idempotencyKey);
  const repeated = await sendResendCanary(apiKey, sender, replyTo, canaryRecipient, idempotencyKey);
  if (first.providerMessageId !== repeated.providerMessageId) {
    throw new Error(
      'Resend did not preserve the provider message reference for an idempotent retry',
    );
  }

  writeFileSync(
    receiptPath,
    `${JSON.stringify(
      {
        provider: 'resend',
        status: 'accepted',
        providerMessageId: first.providerMessageId,
        acceptedAt: first.acceptedAt,
        recipientCount: 1,
        idempotencyVerified: true,
      },
      null,
      2,
    )}\n`,
    { mode: 0o600 },
  );
  console.log(
    `One staff-only Resend canary accepted and idempotent retry verified; private receipt written with mode 0600: ${receiptPath}`,
  );
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) await run();
