// Rule C, as approved in the register (D29): a member owns the row they created,
// and the group leader owns group data. One message per level (D28).
const DENY_GROUP = '00196';
const DENY_LEADER = '00258';
const DENY_OWNER = '00167x';
// One message for the level above every group rule (D28): the system admin level.
const DENY_ADMIN = '00017';

// Every row in the code table that says a person is not the right person for a row. The route
// handler needs this set to tell a refusal from a normal answer, so the refusal codes live
// here instead of being read out of the message text.
const DENY_CODES = [
  DENY_ADMIN, DENY_GROUP, DENY_LEADER, DENY_OWNER,
  '00210', '00281', '00261', '00273', '00319', '00339', '00327', '00391',
];

function adminOnly(ctx) {
  return ctx.role === 'admin';
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

module.exports = { canWrite, leaderOnly, adminOnly, DENY_GROUP, DENY_LEADER, DENY_OWNER, DENY_ADMIN, DENY_CODES };
