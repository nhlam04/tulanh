const permissions = require('./permission');

// Rule C (D29): a member can create a food, and the row creator owns the edit.
// The code table still reads group admin, so the report shows this as a proposal.
async function createFood(deps, ctx) {
  if (!ctx.groupId) return { code: '00156x' };
  const input = ctx.input;
  if (!input.name || !input.categoryName || !input.unitName) return { code: '00147' };
  const category = await deps.repos.categories.findOne({ name: input.categoryName });
  const unit = await deps.repos.units.findOne({ name: input.unitName });
  if (!category) return { code: '00155' };
  if (!unit) return { code: '00153' };
  const exists = await deps.repos.foods.findOne({ group_id: ctx.groupId, name: input.name });
  if (exists) return { code: '00151' };
  const food = await deps.repos.foods.insertOne({
    group_id: ctx.groupId,
    name: input.name,
    category_id: category._id,
    unit_id: unit._id,
    image_path: input.imagePath || null,
    created_by: ctx.userId,
    created_at: deps.now(),
    updated_at: deps.now(),
  });
  return { code: '00160', data: { food } };
}

async function updateFood(deps, ctx) {
  const food = await deps.repos.foods.findOne({ _id: ctx.input.foodId });
  if (!food) return { code: '00167' };
  if (food.group_id !== ctx.groupId) return { code: '00196' };
  if (!permissions.canWrite(food, ctx)) return { code: '00167x' };
  const patch = {};
  if (ctx.input.newName) patch.name = ctx.input.newName;
  if (ctx.input.newCategory) {
    const category = await deps.repos.categories.findOne({ name: ctx.input.newCategory });
    if (!category) return { code: '00171' };
    patch.category_id = category._id;
  }
  if (ctx.input.newUnit) {
    const unit = await deps.repos.units.findOne({ name: ctx.input.newUnit });
    if (!unit) return { code: '00169' };
    patch.unit_id = unit._id;
  }
  if (!Object.keys(patch).length) return { code: '00163' };
  patch.updated_at = deps.now();
  const updated = await deps.repos.foods.updateOne({ _id: food._id }, patch);
  return { code: '00141', data: { food: updated } };
}

async function deleteFood(deps, ctx) {
  const food = await deps.repos.foods.findOne({ _id: ctx.input.foodId });
  if (!food) return { code: '00167' };
  if (!permissions.canWrite(food, ctx)) return { code: '00167x' };
  await deps.repos.foods.deleteOne({ _id: food._id });
  await deps.repos.fridge_lots.deleteOne({ food_id: food._id });
  return { code: '00146' };
}

async function listFoods(deps, ctx) {
  if (!ctx.groupId) return { code: '00096' };
  const foods = await deps.repos.foods.find({ group_id: ctx.groupId });
  return { code: '00178', data: { foods } };
}

// Rule for search (D76): the text index matches whole stemmed words, so the
// rule cannot read as a substring match. The endpoint was lost in the fixed file.
async function searchFood(deps, ctx) {
  const shape = require('../rules').searchShape(ctx.input);
  if (shape.code) return shape;
  if (!ctx.groupId) return { code: '00096' };
  const foods = await deps.repos.foods.find({
    group_id: ctx.groupId,
    $text: { $search: stemmed(shape.data.keyword) },
  });
  if (!foods.length) return { code: '00398' };
  return { code: '00397', data: { foods, match: 'whole_word' } };
}

function stemmed(word) {
  return word.toLowerCase().replace(/s$/, '');
}

module.exports = { createFood, updateFood, deleteFood, listFoods, searchFood, stemmed };
