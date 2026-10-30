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
  return { code: '00357', data: { recipe } };
}

async function addIngredients(deps, ctx) {
  if (!ctx.input.recipeId) return { code: '00358' };
  const recipe = await deps.repos.recipes.findOne({ _id: ctx.input.recipeId });
  if (!recipe) return { code: '00367' };
  if (!permissions.canWrite(recipe, ctx)) return { code: permissions.DENY_OWNER };
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

// The recipe screen needs the link read the other way: one recipe's ingredients, with the
// food names joined in, so a row reads "cà chua · gạo" and not a pile of ids (rule 2).
async function recipeIngredients(deps, ctx) {
  if (!ctx.groupId) return { code: '00345' };
  const recipe = await deps.repos.recipes.findOne({ _id: ctx.input.recipeId });
  if (!recipe || String(recipe.group_id) !== String(ctx.groupId)) return { code: '00367' };
  const rows = await deps.repos.ingredients.find({ recipe_id: recipe._id });
  const ingredients = [];
  for (const row of rows) {
    const food = await deps.repos.foods.findOne({ _id: row.food_id });
    ingredients.push({ foodId: row.food_id, name: food ? food.name : null, quantity: Number(row.quantity || 1) });
  }
  return { code: '00400', data: { ingredients } };
}

async function updateRecipe(deps, ctx) {
  const recipe = await deps.repos.recipes.findOne({ _id: ctx.input.recipeId });
  if (!recipe) return { code: '00367' };
  if (!permissions.canWrite(recipe, ctx)) return { code: permissions.DENY_OWNER };
  const patch = { ...(ctx.input.newName ? { name: ctx.input.newName } : {}), updated_at: deps.now() };
  return { code: '00370', data: { recipe: await deps.repos.recipes.updateOne({ _id: recipe._id }, patch) } };
}

async function deleteRecipe(deps, ctx) {
  if (!ctx.input.recipeId) return { code: '00372' };
  const recipe = await deps.repos.recipes.findOne({ _id: ctx.input.recipeId });
  if (!recipe) return { code: '00373' };
  if (!permissions.canWrite(recipe, ctx)) return { code: permissions.DENY_OWNER };
  await deps.repos.recipes.deleteOne({ _id: recipe._id });
  return { code: '00376' };
}

// Ingredient match is exact (D77), so the food id comes from the stored row.
async function recipesByFood(deps, ctx) {
  if (!ctx.groupId) return { code: '00345' };
  const rows = await deps.repos.ingredients.find({ food_id: ctx.input.foodId });
  const recipes = [];
  for (const row of rows) {
    const recipe = await deps.repos.recipes.findOne({ _id: row.recipe_id });
    if (recipe && String(recipe.group_id) === String(ctx.groupId)) recipes.push(recipe);
  }
  return { code: '00348', data: { recipes } };
}

module.exports = { createRecipe, addIngredients, listRecipes, recipeIngredients, updateRecipe, deleteRecipe, recipesByFood };
