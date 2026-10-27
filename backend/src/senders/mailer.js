// Email rule (auth core): the mailer is a transport, not a rule. When the host is not
// configured the sender runs in noop mode and returns the same code, so a missing config
// is not an error. That follows the pattern the other team reports state: missing FCM or
// email config runs as noop/log.
// Development delivery goes to a local capture, MailHog on port 1025, so no provider
// account is needed for the demo. The message carries the code and the receiver only.
const codes = require('../../../shared/codes.json');

function buildTransport(nodemailer, env) {
  if (!env.SMTP_HOST) return null;
  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: Number(env.SMTP_PORT || 1025),
    secure: env.SMTP_SECURE === 'true',
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  });
}

async function sendEmail(to, code, transport = buildTransport(require('nodemailer'), process.env)) {
  const message = codes[code] || codes['00048'];
  if (!transport) return { code: '00048', message, data: { delivered: false, mode: 'noop', to } };
  const info = await transport.sendMail({
    from: process.env.SMTP_FROM || 'tulanh@localhost',
    to,
    subject: 'tulanh',
    text: message,
  });
  return { code: '00048', message, data: { delivered: true, mode: 'smtp', to, id: info.messageId } };
}

module.exports = { sendEmail, buildTransport };
