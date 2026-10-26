// Push rule (D33): Expo Push, one channel for both platforms. The client builds in
// an Expo project, so the token is an Expo push token and the send goes to exp.host.
const { config } = require('../config');

async function sendPush(devices, lot, timezone) {
  if (!devices.length) return { code: '00346', data: { skipped: true } };
  const messages = devices
    .filter((device) => device.push_token)
    .map((device) => ({
      to: device.push_token,
      title: 'Fridge alert',
      body: `Lot ${lot._id} is used by ${timezone} day ${lot.use_until}`,
    }));
  if (!messages.length) return { code: '00346', data: { skipped: true, devices: devices.length } };
  if (!process.env.EXPO_PUSH_URL) return { code: '00346', data: { queued: messages.length } };
  const res = await fetch(process.env.EXPO_PUSH_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(messages),
  });
  const body = await res.json();
  return { code: '00346', data: { sent: body.data ? body.data.length : 0, error: body.error || null } };
}

// Email rule: only the code and the receiver leave the server. No template text.
module.exports = { sendPush, ttl: config.codeTtlMs };
