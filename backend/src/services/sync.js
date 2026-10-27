// Sync rule (team leader scope): the client keeps its write queue and sends it on
// reconnect. request_id is the guard, so a replay applies once.
const consumption = require('./consumption');
const shopping = require('./shopping');

async function applyOps(deps, ctx) {
  const ops = Array.isArray(ctx.input.ops) ? ctx.input.ops : [];
  if (!ops.length) return { code: '00025', data: null };
  const applied = [];
  for (const op of ops) {
    // The device sends an op as { type, requestId, payload }; a flat op is the shape the
    // tests and any other caller use. Both carry the same fields, so one read covers both.
    const fields = { ...(op.payload || {}), ...op };
    delete fields.payload;
    delete fields.sentAt;
    const call = { userId: ctx.userId, groupId: ctx.groupId, role: 'user', input: fields };
    if (op.type === 'consumption') {
      applied.push(await consumption.recordConsumption(deps, call));
    } else if (op.type === 'task_add') {
      applied.push(await shopping.addTasks(deps, { ...call, input: { listId: fields.listId, tasks: [fields] } }));
    } else if (op.type === 'task_bought') {
      applied.push(await shopping.markBought(deps, call));
    } else {
      applied.push({ code: '00025', data: null });
    }
  }
  return { code: '00098', data: { applied } };
}

module.exports = { applyOps };