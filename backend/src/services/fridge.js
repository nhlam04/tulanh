const permissions = require('./permission');
const rules = require('../rules');

// Lot model (D18): one document per lot, so a food can hold several lots.
// Code 00199 is the duplicate rule for the same food and the same lot key.
async function createLot(deps, ctx) {
  if (!ctx.groupId) return { code: '00210' };
  const shape = rules.lotShape(ctx.input);
  if (shape.code) return shape;
  const food = await deps.repos.foods.findOne({ _id: ctx.input.foodId });
  if (!food) return { code: '00194' };
  if (food.group_id !== ctx.groupId) return { code: '00198' };
  const key = { group_id: ctx.groupId, food_id: food._id, use_until: ctx.input.useUntil };
  if (await deps.repos.fridge_lots.findOne(key)) return { code: '00199' };
  const lot = await deps.repos.fridge_lots.insertOne({
    ...key,
    quantity: Number(ctx.input.quantity),
    unit_id: food.unit_id,
    note: ctx.input.note || null,
    notified_on: null,
    created_by: ctx.userId,
    created_at: deps.now(),
    updated_at: deps.now(),
  });
  return { code: '00202', data: { lot } };
}

async function updateLot(deps, ctx) {
  if (!ctx.input.lotId) return { code: '00204' };
  const lot = await deps.repos.fridge_lots.findOne({ _id: ctx.input.lotId });
  if (!lot) return { code: '00213' };
  if (!permissions.canWrite(lot, ctx)) return { code: '00212' };
  const patch = {};
  if (ctx.input.newQuantity !== undefined) patch.quantity = Number(ctx.input.newQuantity);
  if (ctx.input.newNote !== undefined) patch.note = ctx.input.newNote;
  if (ctx.input.newUseWithin !== undefined) patch.use_until = ctx.input.newUseWithin;
  if (!Object.keys(patch).length) return { code: '00204x' };
  patch.updated_at = deps.now();
  const updated = await deps.repos.fridge_lots.updateOne({ _id: lot._id }, patch);
  return { code: '00216', data: { lot: updated } };
}

async function deleteLot(deps, ctx) {
  const lot = await deps.repos.fridge_lots.findOne({ _id: ctx.input.lotId });
  if (!lot) return { code: '00213' };
  if (!permissions.canWrite(lot, ctx)) return { code: '00219' };
  await deps.repos.fridge_lots.deleteOne({ _id: lot._id });
  return { code: '00224' };
}

async function listLots(deps, ctx) {
  if (!ctx.groupId) return { code: '00225' };
  const lots = await deps.repos.fridge_lots.find({ group_id: ctx.groupId });
  return { code: '00228', data: { lots } };
}

// The spec path is /fridge/:foodName/, so the food row is read by name, not by id. The
// name match is exact, which is the same rule as the ingredient read in D77.
async function lotsByFood(deps, ctx) {
  if (!ctx.groupId) return { code: '00225' };
  const foodId = ctx.input.foodId || (await (async () => {
    const food = await deps.repos.foods.findOne({ group_id: ctx.groupId, name: ctx.input.foodName });
    return food ? food._id : null;
  })());
  if (!foodId) return { code: '00230' };
  const lots = await deps.repos.fridge_lots.find({ group_id: ctx.groupId, food_id: foodId });
  return { code: '00386', data: { lots } };
}

async function getLot(deps, ctx) {
  if (!ctx.groupId) return { code: '00225' };
  const lot = await deps.repos.fridge_lots.findOne({ _id: ctx.input.lotId });
  if (!lot) return { code: '00213' };
  if (String(lot.group_id) !== String(ctx.groupId)) return { code: '00212' };
  return { code: '00237', data: { lot } };
}

module.exports = { createLot, updateLot, deleteLot, listLots, lotsByFood, getLot };
