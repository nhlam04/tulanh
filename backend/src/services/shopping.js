const permissions = require('./permission');
const rules = require('../rules');

// Offline rule (D38): read only, plus the bought path with a stored request.
// request_id is the retry guard, so a replay does not create a second lot.
async function addTasks(deps, ctx) {
  if (!ctx.groupId) return { code: '00210' };
  const shape = rules.taskShape(ctx.input);
  if (shape.code) return shape;
  const list = await deps.repos.shopping_lists.findOne({ _id: ctx.input.listId });
  if (!list) return { code: '00243' };
  if (!permissions.canWrite(list, ctx) && !permissions.leaderOnly(ctx)) return { code: '00281' };
  const added = [];
  for (const task of shape.data.tasks) {
    const food = await deps.repos.foods.findOne({ _id: task.foodId });
    if (!food) return { code: '00308' };
    const exists = await deps.repos.shopping_tasks.findOne({ list_id: list._id, food_id: food._id });
    if (exists) return { code: '00285x' };
    added.push(await deps.repos.shopping_tasks.insertOne({
      list_id: list._id,
      food_id: food._id,
      quantity: Number(task.quantity),
      assign_to: task.buyerUsername,
      claimed_by: null,
      bought_at: null,
      created_by: ctx.userId,
      created_at: deps.now(),
      updated_at: deps.now(),
    }));
  }
  return { code: '00287', data: { tasks: added } };
}

async function claimTask(deps, ctx) {
  const task = await deps.repos.shopping_tasks.findOne({ _id: ctx.input.taskId });
  if (!task) return { code: '00296' };
  const list = await deps.repos.shopping_lists.findOne({ _id: task.list_id });
  if (!list) return { code: '00243' };
  if (task.claimed_by && String(task.claimed_by) !== String(ctx.userId)) return { code: '00246' };
  const updated = await deps.repos.shopping_tasks.updateOne({ _id: task._id }, { claimed_by: ctx.userId, updated_at: deps.now() });
  return { code: '00389', data: { task: updated } };
}

// Bought path (D21): task update and lot insert run in one transaction.
async function markBought(deps, ctx) {
  const task = await deps.repos.shopping_tasks.findOne({ _id: ctx.input.taskId });
  if (!task) return { code: '00296' };
  if (!permissions.canWrite(task, ctx) && String(task.claimed_by) !== String(ctx.userId)) return { code: '00391' };
  const food = await deps.repos.foods.findOne({ _id: task.food_id });
  if (!food) return { code: '00317' };
  const result = await deps.store.transaction(async (tx) => {
    const repos = reposOf(tx);
    const bought = await repos.shopping_tasks.updateOne(
      { _id: task._id },
      { bought_at: deps.now(), claimed_by: task.claimed_by || ctx.userId, updated_at: deps.now() },
    );
    const lot = await repos.fridge_lots.insertOne({
      group_id: food.group_id,
      food_id: food._id,
      quantity: Number(task.quantity),
      unit_id: food.unit_id,
      use_until: useWithin(food.name, deps.now()),
      note: `from task ${task._id}`,
      notified_on: null,
      created_by: ctx.userId,
      created_at: deps.now(),
      updated_at: deps.now(),
    });
    return { task: bought, lot };
  });
  return { code: '00390', data: result };
}

// Three-day rule (D17): read at the time of the call, in the group timezone.
function useWithin(foodName, at) {
  const days = foodName.toLowerCase() === 'com' ? 2 : 3;
  const date = new Date(at.getTime() + days * 24 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 10);
}

function reposOf(store) {
  const names = ['users', 'groups', 'categories', 'units', 'foods', 'fridge_lots', 'shopping_lists', 'shopping_tasks', 'consumption_events'];
  const out = {};
  for (const name of names) out[name] = store.collection(name);
  return out;
}

module.exports = { addTasks, claimTask, markBought, reposOf, useWithin };
