const permissions = require('./permission');

// Recipe rule: the row creator owns the recipe under Rule C, and the ingredient
// match is exact (D77), so a food name must name the stored row.
async function createRecipe(deps, ctx) {
  if (!ctx.groupId) return { code: '00345' };
  if (!ctx.input.name) return { code: '00358' };
  const recipe = await deps.repos.recipes.insertOne({
    group_id: ctx.groupId,
    name: ctx.input.name,
    created_by: ctx.userId,
    created_at: deps.now(),
    updated_at: deps.now(),
  });
  return { code: '00378', data: { recipe } };
}

async function addIngredients(deps, ctx) {
  if (!ctx.input.recipeId) return { code: '00358' };
  const recipe = await deps.repos.recipes.findOne({ _id: ctx.input.recipeId });
  if (!recipe) return { code: '00367' };
  if (!permissions.canWrite(recipe, ctx)) return { code: '00167x' };
  const rows = [];
  for (const item of ctx.input.ingredients || []) {
    const food = await deps.repos.foods.findOne({ group_id: ctx.groupId, name: item.foodName });
    if (!food) return { code: '00367' };
    const exists = await deps.repos.ingredients.findOne({ recipe_id: recipe._id, food_id: food._id });
    if (exists) continue;
    rows.push(await deps.repos.ingredients.insertOne({
      recipe_id: recipe._id,
      food_id: food._id,
      quantity: Number(item.quantity || 1),
      unit_id: food.unit_id,
      created_at: deps.now(),
      updated_at: deps.now(),
    }));
  }
  return { code: '00394', data: { recipe, ingredients: rows } };
}

async function listRecipes(deps, ctx) {
  if (!ctx.groupId) return { code: '00345' };
  return { code: '00378', data: { recipes: await deps.repos.recipes.find({ group_id: ctx.groupId }) } };
}

async function updateRecipe(deps, ctx) {
  const recipe = await deps.repos.recipes.findOne({ _id: ctx.input.recipeId });
  if (!recipe) return { code: '00367' };
  if (!permissions.canWrite(recipe, ctx)) return { code: '00167x' };
  const patch = { ...(ctx.input.newName ? { name: ctx.input.newName } : {}), updated_at: deps.now() };
  return { code: '00370', data: { recipe: await deps.repos.recipes.updateOne({ _id: recipe._id }, patch) } };
}

module.exports = { createRecipe, addIngredients, listRecipes, updateRecipe };
