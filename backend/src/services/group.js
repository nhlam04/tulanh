// Group rule (D24): the group timezone comes from the group leader.
async function createGroup(deps, ctx) {
  const user = await deps.repos.users.findOne({ _id: ctx.userId });
  if (!user) return { code: '00052' };
  if (user.group_id) return { code: '00093' };
  const group = await deps.repos.groups.insertOne({
    name: ctx.input.name || `group-${ctx.userId}`,
    leader_id: ctx.userId,
    timezone: user.timezone || 'Asia/Ho_Chi_Minh',
    created_at: deps.now(),
  });
  await deps.repos.users.updateOne({ _id: ctx.userId }, { group_id: group._id });
  return { code: '00095', data: { group } };
}

async function addMember(deps, ctx) {
  const username = String(ctx.input.username || '').trim();
  if (!username) return { code: '00100' };
  if (!ctx.groupId) return { code: '00096' };
  const target = await deps.repos.users.findOne({ username });
  if (!target) return { code: '00245' };
  if (target.group_id) return { code: '00099x' };
  await deps.repos.users.updateOne({ _id: target._id }, { group_id: ctx.groupId });
  return { code: '00102', data: { user: { id: target._id, username: target.username } } };
}

async function removeMember(deps, ctx) {
  const group = await deps.repos.groups.findOne({ _id: ctx.groupId });
  if (!group) return { code: '00096' };
  if (String(group.leader_id) !== String(ctx.userId) && ctx.role !== 'admin') return { code: '00104' };
  const target = await deps.repos.users.findOne({ username: ctx.input.username });
  if (!target) return { code: '00245' };
  if (!target.group_id) return { code: '00103' };
  await deps.repos.users.updateOne({ _id: target._id }, { group_id: null });
  return { code: '00106' };
}

async function members(deps, ctx) {
  if (!ctx.groupId) return { code: '00096' };
  const rows = await deps.repos.users.find({ group_id: ctx.groupId });
  return { code: '00098', data: { members: rows.map((row) => ({ id: row._id, username: row.username, name: row.name, timezone: row.timezone })) } };
}

async function leaveGroup(deps, ctx) {
  if (!ctx.groupId) return { code: '00096' };
  await deps.repos.users.updateOne({ _id: ctx.userId }, { group_id: null });
  return { code: '00385' };
}

function groupTimezone(deps, groupId) {
  return deps.repos.groups.findOne({ _id: groupId }).then((group) => (group && group.timezone) || 'Asia/Ho_Chi_Minh');
}

module.exports = { createGroup, addMember, removeMember, members, leaveGroup, groupTimezone };
