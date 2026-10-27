// Email rule (auth core): the mailer is a transport, not a rule. When the host is not
// configured the sender runs in noop mode and returns the same code, so a missing config
// is not an error. That follows the pattern the other team reports state: missing FCM or
// email config runs as noop/log. A local capture is the same switch: point SMTP_HOST at
// MailHog on port 1025 and no provider account is needed for the demo.
// The mail carries the verification code and the receiver only. The code is a value the
// person copies from the mail into the app, so it belongs in the body. The code table is
// the wording of the api answer, which is a different thing, and the two must not be read
// as one: a six-digit verification code is not a key of that table.
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

// One lifetime, one wording: a day reads in hours, a shorter span in minutes.
function expiresIn(ttlMs) {
  const minutes = Math.round(ttlMs / 60000);
  if (minutes >= 60) return `Mã hết hạn sau ${Math.round(minutes / 60)} giờ.`;
  return `Mã hết hạn sau ${Math.max(1, minutes)} phút.`;
}

function body(code, ttlMs) {
  const line = ttlMs ? ` ${expiresIn(ttlMs)}` : '';
  return `Mã xác nhận của bạn là ${code}.${line}\n\nTủ lành của bạn`;
}

async function sendEmail(to, code, transport = buildTransport(require('nodemailer'), process.env), options = {}) {
  const message = codes['00048'];
  if (!transport) return { code: '00048', message, data: { delivered: false, mode: 'noop', to } };
  const info = await transport.sendMail({
    from: process.env.SMTP_FROM || 'tulanh@localhost',
    to,
    subject: 'Mã xác nhận Tủ Lành',
    text: body(code, options.ttlMs),
  });
  return { code: '00048', message, data: { delivered: true, mode: 'smtp', to, id: info.messageId } };
}

module.exports = { sendEmail, buildTransport };
