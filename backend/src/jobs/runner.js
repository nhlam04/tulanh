// Daily job, started in the server process, which is allowed now that the app
// runs local only (D34). No package: a timer that checks the group time.
const { config } = require('../config');
const { runReminder, runRetention, runReceipts } = require('./reminder');

function localTime(date, zone) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: zone, hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(date);
  const hour = Number(parts.find((p) => p.type === 'hour').value);
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: zone }).format(date);
  return { hour, day };
}

async function tick(deps) {
  const now = deps.now();
  const groups = await deps.repos.groups.find({});
  let ran = false;
  for (const group of groups) {
    const { hour, day } = localTime(now, group.timezone || 'Asia/Ho_Chi_Minh');
    if (hour !== config.reminderHour) continue;
    ran = true;
    const sent = await runReminder(deps, new Date(`${day}T00:00:00Z`));
    if (sent.length) console.log(`reminder ${group._id} ${day} sent=${sent.length}`);
  }
  // The ticket is only the hand-off to Expo, so the receipts for the tickets of this run are
  // read in the same run (D33).
  if (ran) await runReceipts(deps);
  await runRetention(deps);
}

function startScheduler(deps) {
  const handle = setInterval(() => tick(deps).catch((error) => console.error('job', error.message)), 60 * 1000);
  return handle;
}

module.exports = { tick, startScheduler, localTime };
