const permissions = require('./permission');

// Meal plan rule (Rule C, D29): the group leader owns the plan. Codes 00319,
// 00327, 00339 already read as group admin, so they hold without a change.
async function addPlan(deps, ctx) {
  if (!ctx.groupId) return { code: '00345' };
  if (!permissions.leaderOnly(ctx)) return { code: '00319' };
  const input = ctx.input;
  if (!input.foodName || !input.timestamp || !input.name) return { code: '00313' };
  if (!['sáng', 'trưa', 'tối'].includes(input.name)) return { code: '00316' };
  const food = await deps.repos.foods.findOne({ group_id: ctx.groupId, name: input.foodName });
  if (!food) return { code: '00317' };
  const plan = await deps.repos.meal_plans.insertOne({
    group_id: ctx.groupId,
    plan_date: String(input.timestamp).slice(0, 10),
    meal: input.name,
    food_id: food._id,
    created_by: ctx.userId,
    created_at: deps.now(),
    updated_at: deps.now(),
  });
  return { code: '00322', data: { plan } };
}

async function listPlans(deps, ctx) {
  if (!ctx.groupId) return { code: '00345' };
  const plans = await deps.repos.meal_plans.find({ group_id: ctx.groupId, plan_date: ctx.input.date || null });
  return { code: '00098', data: { plans } };
}

async function updatePlan(deps, ctx) {
  if (!ctx.input.planId) return { code: '00332' };
  const plan = await deps.repos.meal_plans.findOne({ _id: ctx.input.planId });
  if (!plan) return { code: '00337' };
  if (!permissions.leaderOnly(ctx)) return { code: '00339' };
  const patch = {};
  if (ctx.input.newFoodName) {
    const food = await deps.repos.foods.findOne({ group_id: ctx.groupId, name: ctx.input.newFoodName });
    if (!food) return { code: '00341' };
    patch.food_id = food._id;
  }
  if (ctx.input.newTimestamp) patch.plan_date = String(ctx.input.newTimestamp).slice(0, 10);
  if (ctx.input.newName) patch.meal = ctx.input.newName;
  if (!Object.keys(patch).length) return { code: '00333' };
  patch.updated_at = deps.now();
  return { code: '00344', data: { plan: await deps.repos.meal_plans.updateOne({ _id: plan._id }, patch) } };
}

async function deletePlan(deps, ctx) {
  if (!ctx.input.planId) return { code: '00332' };
  const plan = await deps.repos.meal_plans.findOne({ _id: ctx.input.planId });
  if (!plan) return { code: '00325' };
  if (!permissions.leaderOnly(ctx)) return { code: '00327' };
  await deps.repos.meal_plans.deleteOne({ _id: plan._id });
  return { code: '00330' };
}

// Suggestion rule: a meal is suggested when every ingredient sits in the fridge.
// Exact match per D77, so a food name must match the row, not a similar word.
async function suggestMeals(deps, ctx) {
  if (!ctx.groupId) return { code: '00345' };
  const recipes = await deps.repos.recipes.find({ group_id: ctx.groupId });
  const lots = await deps.repos.fridge_lots.find({ group_id: ctx.groupId });
  const inFridge = new Set(lots.map((lot) => String(lot.food_id)));
  const suggested = [];
  for (const recipe of recipes) {
    const ingredients = await deps.repos.ingredients.find({ recipe_id: recipe._id });
    if (ingredients.length && ingredients.every((row) => inFridge.has(String(row.food_id)))) {
      suggested.push({ recipe_id: recipe._id, name: recipe.name, ingredients: ingredients.map((row) => row.food_id) });
    }
  }
  return { code: '00392', data: { suggested } };
}

// Generate rule: the plan for a date becomes a shopping list for the missing items.
async function generateList(deps, ctx) {
  if (!ctx.groupId) return { code: '00345' };
  if (!permissions.leaderOnly(ctx)) return { code: '00258' };
  const plans = await deps.repos.meal_plans.find({ group_id: ctx.groupId, plan_date: ctx.input.date });
  const inFridge = new Set((await deps.repos.fridge_lots.find({ group_id: ctx.groupId })).map((lot) => String(lot.food_id)));
  const list = await deps.repos.shopping_lists.insertOne({
    group_id: ctx.groupId,
    target_date: ctx.input.date,
    created_by: ctx.userId,
    created_at: deps.now(),
    updated_at: deps.now(),
  });
  const tasks = [];
  for (const plan of plans) {
    const ingredients = await deps.repos.ingredients.find({ recipe_id: plan.recipe_id || plan.food_id });
    for (const row of ingredients.length ? ingredients : [rowFromPlan(plan)]) {
      if (inFridge.has(String(row.food_id))) continue;
      tasks.push(await deps.repos.shopping_tasks.insertOne({
        list_id: list._id,
        food_id: row.food_id,
        quantity: Number(row.quantity || 1),
        assign_to: null,
        claimed_by: null,
        bought_at: null,
        created_by: ctx.userId,
        created_at: deps.now(),
        updated_at: deps.now(),
      }));
    }
  }
  return { code: '00393', data: { list, tasks } };
}

function rowFromPlan(plan) {
  return { food_id: plan.food_id, quantity: 1 };
}

module.exports = { addPlan, listPlans, updatePlan, deletePlan, suggestMeals, generateList };
