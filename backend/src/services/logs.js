// Log rule (D12, D63): every call that changes data, and every denied call.
// Fields: user, code, level, message, ip, time, plus route and status.
async function logWrite(deps, { userId, groupId, route, code, level, ip }) {
  await deps.repos.system_logs.insertOne({
    user_id: userId || null,
    group_id: groupId || null,
    route,
    code,
    level,
    message: deps.message(code),
    ip,
    created_at: deps.now(),
  });
}

module.exports = { logWrite };
