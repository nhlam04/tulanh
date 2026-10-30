// Three-day rule, as one notice per lot (D35), run in the group timezone (D24).
// The timer in runner.js calls this from the server process (D34); this file holds the rules,
// not the timer.
const { config } = require('../config');

function withinDays(lot, today) {
  const days = Math.round((new Date(lot.use_until) - today) / (24 * 60 * 60 * 1000));
  return days <= config.alertDays;
}

async function runReminder(deps, date = new Date()) {
  const groups = await deps.repos.groups.find({});
  const sent = [];
  for (const group of groups) {
    const lots = await deps.repos.fridge_lots.find({ group_id: group._id });
    for (const lot of lots) {
      if (!withinDays(lot, date)) continue;
      const key = { lot_id: lot._id, user_id: lot.created_by, sent_date: date.toISOString().slice(0, 10) };
      if (await deps.repos.notification_log.findOne(key)) continue;
      const row = await deps.repos.notification_log.insertOne({ ...key, group_id: group._id, code: '00346' });
      const devices = await deps.repos.user_devices.find({ user_id: lot.created_by });
      if (deps.push && devices.length) {
        // The payload names the food, so the job reads the food row before the send (D36).
        const food = await deps.repos.foods.findOne({ _id: lot.food_id });
        const out = await deps.push(devices, lot, group.timezone, food, row.sent_date);
        // The send answer is a ticket. The ticket id is stored with the device, so the
        // receipt check later can name which device to stop using.
        for (const ticket of (out.data && out.data.tickets) || []) {
          // The ticket id and the device it went to are stored together, so the receipt check
          // can name the token to stop using.
          await deps.repos.notification_log.updateOne({ _id: row._id }, { ticket_id: ticket.id, device_id: ticket.device_id });
        }
      }
      await deps.repos.fridge_lots.updateOne({ _id: lot._id }, { notified_on: row.sent_date });
      sent.push({ lot_id: lot._id, user_id: lot.created_by, group_timezone: group.timezone });
    }
  }
  return sent;
}

async function runRetention(deps) {
  const cut = new Date(Date.now() - config.logRetentionDays * 24 * 60 * 60 * 1000);
  const rows = await deps.repos.system_logs.find({ created_at: { $lte: cut } });
  for (const row of rows) await deps.repos.system_logs.deleteOne({ _id: row._id });
  return rows.length;
}

// Receipt rule: the ticket only says Expo took the message. The receipt says whether FCM or
// APNs took it, and DeviceNotRegistered stops that token.
async function runReceipts(deps) {
  // Read the log rows that hold a ticket and no receipt yet. The filter is read in code, so
  // the fake store and the driver behave the same.
  const rows = await deps.repos.notification_log.find({});
  const checked = [];
  for (const row of rows.filter((row) => row.ticket_id && !row.receipt_status)) {
    const out = await deps.receipts([row.ticket_id]);
    const receipt = (out.data.receipts || [])[0];
    if (!receipt) continue;
    await deps.repos.notification_log.updateOne({ _id: row._id }, { receipt_status: receipt.status, receipt_error: receipt.error });
    // The rule for a token the platform no longer knows lives in the sender (D33), so the job
    // calls it instead of writing the same update here.
    if (receipt.error === 'DeviceNotRegistered' && row.device_id) await deps.markUnregistered(deps, row.device_id);
    checked.push({ ticket: row.ticket_id, status: receipt.status });
  }
  return checked;
}

module.exports = { runReminder, runRetention, runReceipts };
