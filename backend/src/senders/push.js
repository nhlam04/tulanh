// Push rule (D33): Expo Push, one channel for both platforms. The client builds in
// an Expo project, so the token is an Expo push token and the send goes to exp.host.
// The send answer is a push ticket, not a delivery. Delivery is read from the receipt, so
// the sender keeps the ticket id and checks the receipt later. A receipt that reads
// DeviceNotRegistered stops the sender from using that token again.
const { config } = require('../config');

const PUSH_URL = process.env.EXPO_PUSH_URL || 'https://exp.host/--/api/v2/push/send';
const RECEIPT_URL = process.env.EXPO_RECEIPT_URL || 'https://exp.host/--/api/v2/push/getReceipts';

function headers() {
  // The push API works without a token by default. An access token is the security layer,
  // taken from the Expo account, and it is required once push security is turned on.
  return {
    'content-type': 'application/json',
    accept: 'application/json',
    ...(process.env.EXPO_ACCESS_TOKEN ? { authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` } : {}),
  };
}

async function sendPush(devices, lot, timezone) {
  if (!devices.length) return { code: '00346', data: { skipped: true } };
  const messages = devices
    .filter((device) => device.push_token && !device.unregistered_at)
    .map((device) => ({
      to: device.push_token,
      title: 'Fridge alert',
      body: `Lot ${lot._id} is used by ${timezone} day ${lot.use_until}`,
    }));
  if (!messages.length) return { code: '00346', data: { skipped: true, devices: devices.length } };
  const res = await fetch(PUSH_URL, { method: 'POST', headers: headers(), body: JSON.stringify(messages) });
  const body = await res.json();
  const tickets = (body.data || []).map((ticket) => ({ id: ticket.id, status: ticket.status, error: ticket.details ? ticket.details.error : null }));
  return { code: '00346', data: { tickets, requestError: body.errors || null } };
}

async function checkReceipts(ticketIds) {
  if (!ticketIds.length) return { code: '00346', data: { receipts: [] } };
  const res = await fetch(RECEIPT_URL, { method: 'POST', headers: headers(), body: JSON.stringify({ ids: ticketIds }) });
  const body = await res.json();
  const receipts = Object.entries(body.data || {}).map(([id, receipt]) => ({
    id,
    status: receipt.status,
    error: receipt.details ? receipt.details.error : null,
  }));
  return { code: '00346', data: { receipts } };
}

// Rule from the receipt: stop sending to a token that reads DeviceNotRegistered.
async function markUnregistered(deps, deviceId) {
  const device = await deps.repos.user_devices.findOne({ _id: deviceId });
  if (!device) return null;
  return deps.repos.user_devices.updateOne({ _id: deviceId }, { unregistered_at: deps.now() });
}

module.exports = { sendPush, checkReceipts, markUnregistered, ttl: config.codeTtlMs };
