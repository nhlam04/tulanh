// Admin scope (team leader): system admin only, one message per level (D28).
const DENY = '00017';

async function listUsers(deps, ctx) {
  if (ctx.role !== 'admin') return { code: DENY };
  const rows = await deps.repos.users.find({}, { limit: deps.pageLimit });
  return { code: '00098', data: { users: rows.map((row) => ({ id: row._id, username: row.username, role: row.role, group_id: row.group_id })) } };
}

async function setRole(deps, ctx) {
  if (ctx.role !== 'admin') return { code: DENY };
  const levels = ['user', 'group_leader', 'admin'];
  if (!levels.includes(ctx.input.role)) return { code: '00025' };
  const user = await deps.repos.users.findOne({ _id: ctx.input.userId });
  if (!user) return { code: '00052' };
  const updated = await deps.repos.users.updateOne({ _id: user._id }, { role: ctx.input.role, updated_at: deps.now() });
  return { code: '00086', data: { user: updated } };
}

async function forceLogout(deps, ctx) {
  if (ctx.role !== 'admin') return { code: DENY };
  const user = await deps.repos.users.findOne({ _id: ctx.input.userId });
  if (!user) return { code: '00052' };
  const removed = await deps.repos.refresh_tokens.find({ user_id: user._id });
  for (const row of removed) await deps.repos.refresh_tokens.deleteOne({ _id: row._id });
  return { code: '00050', data: { sessions: removed.length } };
}

// Log view (D63): the window is the retention rule, 30 days.
async function readLogs(deps, ctx) {
  if (ctx.role !== 'admin') return { code: DENY };
  const cut = new Date(deps.now().getTime() - deps.logRetentionDays * 24 * 60 * 60 * 1000);
  const filter = { created_at: { $gte: cut } };
  if (ctx.input.level) filter.level = ctx.input.level;
  const rows = await deps.repos.system_logs.find(filter, { limit: deps.pageLimit, sort: { created_at: -1 } });
  return { code: '00109', data: { logs: rows } };
}

module.exports = { listUsers, setRole, forceLogout, readLogs };