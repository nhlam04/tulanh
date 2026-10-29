// Report rule (D67, D71): purchases read by category, consumption read by reason.
// Code 00395 served both reads in the fixed file, so consumption takes 00396.
// The spec reads a report over a period ("một khoảng thời gian nhất định"), so both reads
// take optional `from` and `to` days, inclusive, and answer everything when neither is given.
function inRange(value, from, to) {
  if (!from && !to) return true;
  const at = new Date(value).getTime();
  if (Number.isNaN(at)) return false;
  if (from && at < new Date(`${from}T00:00:00`).getTime()) return false;
  if (to && at > new Date(`${to}T23:59:59.999`).getTime()) return false;
  return true;
}

async function purchasesByCategory(deps, ctx) {
  if (!ctx.groupId) return { code: '00210' };
  const { from, to } = ctx.input || {};
  const tasks = await deps.repos.shopping_tasks.find({ list_id: { $in: (await listIds(deps, ctx.groupId)) } });
  const byCategory = {};
  for (const task of tasks) {
    if (!task.bought_at) continue;
    if (!inRange(task.bought_at, from, to)) continue;
    const food = await deps.repos.foods.findOne({ _id: task.food_id });
    if (!food) continue;
    const category = await deps.repos.categories.findOne({ _id: food.category_id });
    const name = category ? category.name : 'unknown';
    byCategory[name] ||= [];
    byCategory[name].push({ task_id: task._id, food: food.name, quantity: Number(task.quantity), bought_at: task.bought_at });
  }
  return { code: '00395', data: { report: byCategory } };
}

async function consumptionByReason(deps, ctx) {
  if (!ctx.groupId) return { code: '00210' };
  const { from, to } = ctx.input || {};
  const events = await deps.repos.consumption_events.find({ group_id: ctx.groupId });
  const byReason = {};
  for (const event of events) {
    if (!inRange(event.logged_at, from, to)) continue;
    byReason[event.reason] ||= [];
    byReason[event.reason].push({ event_id: event._id, food_id: event.food_id, quantity: Number(event.quantity), logged_at: event.logged_at });
  }
  return { code: '00396', data: { report: byReason } };
}

async function listIds(deps, groupId) {
  const lists = await deps.repos.shopping_lists.find({ group_id: groupId });
  return lists.map((list) => list._id);
}

module.exports = { purchasesByCategory, consumptionByReason };
