// Rule C, as approved in the register (D29): a member owns the row they created,
// and the group leader owns group data. One message per level (D28).
const DENY_GROUP = '00196';
const DENY_LEADER = '00258';
const DENY_OWNER = '00167x';

function inGroup(ctx, groupId) {
  return ctx.role === 'admin' || String(ctx.groupId) === String(groupId);
}

function canWrite(row, ctx) {
  if (!row) return false;
  if (ctx.role === 'admin') return true;
  if (ctx.role === 'group_leader') return true;
  return String(row.created_by) === String(ctx.userId);
}

function leaderOnly(ctx) {
  return ctx.role === 'admin' || ctx.role === 'group_leader';
}

module.exports = { inGroup, canWrite, leaderOnly, DENY_GROUP, DENY_LEADER, DENY_OWNER };
