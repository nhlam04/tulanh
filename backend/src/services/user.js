const permissions = require('./permission');
const { publicUser } = require('./auth');

async function getProfile(deps, ctx) {
  const user = await deps.repos.users.findOne({ _id: ctx.userId });
  if (!user) return { code: '00052' };
  return { code: '00089', data: { user: publicUser(user) } };
}

async function updateProfile(deps, ctx) {
  const user = await deps.repos.users.findOne({ _id: ctx.userId });
  if (!user) return { code: '00052' };
  const patch = {};
  if (ctx.input.name) patch.name = ctx.input.name;
  if (ctx.input.username) patch.username = ctx.input.username;
  if (ctx.input.language) patch.language = ctx.input.language;
  if (ctx.input.timezone) patch.timezone = ctx.input.timezone;
  if (patch.username && await deps.repos.users.findOne({ username: patch.username })) return { code: '00084' };
  if (!Object.keys(patch).length) return { code: '00025' };
  patch.updated_at = deps.now();
  const updated = await deps.repos.users.updateOne({ _id: user._id }, patch);
  return { code: '00086', data: { user: publicUser(updated) } };
}

async function changePassword(deps, ctx) {
  const user = await deps.repos.users.findOne({ _id: ctx.userId });
  if (!user) return { code: '00052' };
  if (!ctx.input.oldPassword || !ctx.input.newPassword) return { code: '00069' };
  if (!require('../util/token').checkPassword(ctx.input.oldPassword, user.password_hash)) return { code: '00072' };
  if (ctx.input.oldPassword === ctx.input.newPassword) return { code: '00073' };
  const updated = await deps.repos.users.updateOne({ _id: user._id }, {
    password_hash: require('../util/token').hashPassword(ctx.input.newPassword),
    updated_at: deps.now(),
  });
  return { code: '00076', data: { user: publicUser(updated) } };
}

async function deleteAccount(deps, ctx) {
  const user = await deps.repos.users.findOne({ _id: ctx.userId });
  if (!user) return { code: '00052' };
  await deps.repos.users.deleteOne({ _id: user._id });
  return { code: '00092' };
}

// Export rule (D40): the data for the current user, as JSON.
async function exportData(deps, ctx) {
  const user = await deps.repos.users.findOne({ _id: ctx.userId });
  if (!user) return { code: '00052' };
  const lots = user.group_id ? await deps.repos.fridge_lots.find({ group_id: user.group_id }) : [];
  const tasks = user.group_id ? await deps.repos.shopping_tasks.find({ created_by: user._id }) : [];
  const events = user.group_id ? await deps.repos.consumption_events.find({ user_id: user._id }) : [];
  return { code: '00384', data: { user: publicUser(user), lots, tasks, events } };
}

async function registerDevice(deps, ctx) {
  if (!ctx.input.deviceId) return { code: '00025' };
  const existing = await deps.repos.user_devices.findOne({ user_id: ctx.userId, device_id: ctx.input.deviceId });
  if (existing) {
    await deps.repos.user_devices.updateOne({ _id: existing._id }, { last_seen_at: deps.now(), push_token: ctx.input.pushToken || existing.push_token });
    return { code: '00383', data: { device: existing } };
  }
  const row = await deps.repos.user_devices.insertOne({
    user_id: ctx.userId,
    device_id: ctx.input.deviceId,
    platform: ctx.input.platform || 'android',
    push_token: ctx.input.pushToken || null,
    last_seen_at: deps.now(),
  });
  return { code: '00383', data: { device: row } };
}

async function listDevices(deps, ctx) {
  const rows = await deps.repos.user_devices.find({ user_id: ctx.userId });
  return { code: '00098', data: { devices: rows } };
}

module.exports = { getProfile, updateProfile, changePassword, deleteAccount, exportData, registerDevice, listDevices, permissions };
