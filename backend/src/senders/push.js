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

// Payload rule (D36): the notice names the food and the days left, and nothing that names a
// person or a group. The tap opens the fridge screen, so the lot id travels as data.
// The day is the group day (D24), so a lot due on the next group day reads one day left.
function dayIn(timezone, date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

function daysLeft(useUntil, day) {
  const due = new Date(`${String(useUntil).slice(0, 10)}T00:00:00Z`);
  const today = new Date(`${String(day).slice(0, 10)}T00:00:00Z`);
  return Math.round((due - today) / (24 * 60 * 60 * 1000));
}

async function sendPush(devices, lot, timezone, food, day) {
  if (!devices.length) return { code: '00346', data: { skipped: true } };
  const name = food && food.name ? food.name : 'món trong tủ';
  const left = daysLeft(lot.use_until, day || dayIn(timezone, new Date()));
  const messages = devices
    .filter((device) => device.push_token && !device.unregistered_at)
    .map((device) => ({
      to: device.push_token,
      title: 'Tủ lành của bạn',
      body: `${name} còn ${left} ngày`,
      data: { lot_id: String(lot._id), screen: 'fridge' },
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

module.exports = { sendPush, checkReceipts, markUnregistered, daysLeft, ttl: config.codeTtlMs };
