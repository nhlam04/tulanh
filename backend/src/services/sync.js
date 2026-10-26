// Sync rule (team leader scope): the client keeps its write queue and sends it on
// reconnect. request_id is the guard, so a replay applies once.
const consumption = require('./consumption');
const shopping = require('./shopping');

async function applyOps(deps, ctx) {
  const ops = Array.isArray(ctx.input.ops) ? ctx.input.ops : [];
  if (!ops.length) return { code: '00025', data: null };
  const applied = [];
  for (const op of ops) {
    const call = { userId: ctx.userId, groupId: ctx.groupId, role: 'user', input: { ...op } };
    if (op.type === 'consumption') {
      applied.push(await consumption.recordConsumption(deps, call));
    } else if (op.type === 'task_add') {
      applied.push(await shopping.addTasks(deps, { ...call, input: { listId: op.listId, tasks: [op] } }));
    } else if (op.type === 'task_bought') {
      applied.push(await shopping.markBought(deps, call));
    } else {
      applied.push({ code: '00025', data: null });
    }
  }
  return { code: '00098', data: { applied } };
}

module.exports = { applyOps };