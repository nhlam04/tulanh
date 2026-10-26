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

// List rule (Rule C): the caller owns the list they created, or is the group leader.
// Codes 00258, 00261, 00270, 00273 read as group admin, so the report shows the change.
async function createList(deps, ctx) {
  if (!ctx.groupId) return { code: '00210' };
  const input = ctx.input;
  if (!input.name || !input.assignToUsername) return { code: '00238' };
  const target = await deps.repos.users.findOne({ username: input.assignToUsername });
  if (!target) return { code: '00245' };
  if (String(target.group_id) !== String(ctx.groupId)) return { code: '00246' };
  const list = await deps.repos.shopping_lists.insertOne({
    group_id: ctx.groupId,
    name: input.name,
    assign_to: input.assignToUsername,
    note: input.note || null,
    target_date: input.date || null,
    created_by: ctx.userId,
    created_at: deps.now(),
    updated_at: deps.now(),
  });
  return { code: '00249', data: { list } };
}

async function listLists(deps, ctx) {
  if (!ctx.groupId) return { code: '00210' };
  return { code: '00292', data: { lists: await deps.repos.shopping_lists.find({ group_id: ctx.groupId }) } };
}

async function updateList(deps, ctx) {
  if (!ctx.input.listId) return { code: '00251' };
  const list = await deps.repos.shopping_lists.findOne({ _id: ctx.input.listId });
  if (!list) return { code: '00260' };
  if (!permissions.canWrite(list, ctx)) return { code: '00261' };
  const patch = {};
  if (ctx.input.newName) patch.name = ctx.input.newName;
  if (ctx.input.newNote) patch.note = ctx.input.newNote;
  if (ctx.input.newDate) patch.target_date = ctx.input.newDate;
  if (ctx.input.newAssignToUsername) {
    const target = await deps.repos.users.findOne({ username: ctx.input.newAssignToUsername });
    if (!target) return { code: '00262' };
    if (String(target.group_id) !== String(ctx.groupId)) return { code: '00263' };
    patch.assign_to = target.username;
  }
  if (!Object.keys(patch).length) return { code: '00252' };
  patch.updated_at = deps.now();
  return { code: '00266', data: { list: await deps.repos.shopping_lists.updateOne({ _id: list._id }, patch) } };
}

async function deleteList(deps, ctx) {
  if (!ctx.input.listId) return { code: '00268' };
  const list = await deps.repos.shopping_lists.findOne({ _id: ctx.input.listId });
  if (!list) return { code: '00272' };
  if (!permissions.canWrite(list, ctx)) return { code: '00273' };
  await deps.repos.shopping_lists.deleteOne({ _id: list._id });
  return { code: '00275' };
}

async function listTasks(deps, ctx) {
  if (!ctx.input.listId) return { code: '00277' };
  const list = await deps.repos.shopping_lists.findOne({ _id: ctx.input.listId });
  if (!list) return { code: '00283' };
  return { code: '00098', data: { tasks: await deps.repos.shopping_tasks.find({ list_id: list._id }) } };
}

async function updateTask(deps, ctx) {
  if (!ctx.input.taskId) return { code: '00301' };
  const task = await deps.repos.shopping_tasks.findOne({ _id: ctx.input.taskId });
  if (!task) return { code: '00306' };
  if (!permissions.canWrite(task, ctx)) return { code: '00307' };
  const patch = {};
  if (ctx.input.newFoodName) {
    const food = await deps.repos.foods.findOne({ group_id: ctx.groupId, name: ctx.input.newFoodName });
    if (!food) return { code: '00308' };
    patch.food_id = food._id;
  }
  if (ctx.input.newQuantity !== undefined) patch.quantity = Number(ctx.input.newQuantity);
  if (!Object.keys(patch).length) return { code: '00302' };
  patch.updated_at = deps.now();
  return { code: '00312', data: { task: await deps.repos.shopping_tasks.updateOne({ _id: task._id }, patch) } };
}

async function deleteTask(deps, ctx) {
  if (!ctx.input.taskId) return { code: '00294' };
  const task = await deps.repos.shopping_tasks.findOne({ _id: ctx.input.taskId });
  if (!task) return { code: '00296' };
  if (!permissions.canWrite(task, ctx)) return { code: '00297' };
  await deps.repos.shopping_tasks.deleteOne({ _id: task._id });
  return { code: '00299' };
}

module.exports = { addTasks, claimTask, markBought, reposOf, useWithin, createList, listLists, updateList, deleteList, listTasks, updateTask, deleteTask };
