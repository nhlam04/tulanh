// Three-day rule, as one notice per lot (D35), run in the group timezone (D24),
// started outside the web process (D34). This file is the worker entry.
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
      if (deps.push && devices.length) await deps.push(devices, lot, group.timezone);
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

module.exports = { runReminder, runRetention, withinDays };
