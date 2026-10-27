// Check the mail path before the demo runs (core). It reads .env, verifies the transport,
// and sends one test message. It prints no credential.
require('dotenv').config();
const nodemailer = require('nodemailer');
const { buildTransport, sendEmail } = require('../src/senders/mailer');

async function main() {
  const transport = buildTransport(nodemailer, process.env);
  if (!transport) {
    console.log('no host set, so the sender runs in noop mode (D95)');
    return;
  }
  console.log('transport:', process.env.SMTP_HOST, process.env.SMTP_PORT, 'secure', process.env.SMTP_SECURE === 'true');
  const ok = await transport.verify();
  console.log('verify:', ok ? 'connected' : 'not connected');

  const to = process.env.MAIL_TEST_TO || process.env.SMTP_FROM;
  const out = await sendEmail(to, '00048', transport);
  console.log('send:', out.code, out.data.mode, out.data.id || '');
}

main().catch((error) => console.log('failed:', error.message));
