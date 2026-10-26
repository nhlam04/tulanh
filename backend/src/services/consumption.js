// Consumption rule (D20): a write on the device lands as an event row plus a
// quantity change on the lot. request_id is the replay guard (D38).
async function recordConsumption(deps, ctx) {
  if (!ctx.groupId) return { code: '00210' };
  const input = ctx.input;
  if (!input.lotId || !input.quantity || !input.reason) return { code: '00238' };
  const amount = Number(input.quantity);
  if (!(amount > 0)) return { code: '00304' };

  const requestId = input.requestId || null;
  if (requestId) {
    const seen = await deps.repos.consumption_events.findOne({ request_id: requestId });
    if (seen) return { code: '00387', data: { event: seen, replay: true } };
  }

  const lot = await deps.repos.fridge_lots.findOne({ _id: input.lotId });
  if (!lot) return { code: '00213' };

  const result = await deps.store.transaction(async (tx) => {
    const repos = require('./shopping').reposOf(tx);
    const left = Number(lot.quantity) - amount;
    if (left < 0) return { code: '00388' };
    const event = await repos.consumption_events.insertOne({
      group_id: ctx.groupId,
      lot_id: lot._id,
      food_id: lot.food_id,
      user_id: ctx.userId,
      request_id: requestId,
      quantity: amount,
      reason: input.reason,
      logged_at: deps.now(),
    });
    await repos.fridge_lots.updateOne({ _id: lot._id }, { quantity: left, updated_at: deps.now() });
    return { code: '00387', data: { event, lot: { ...lot, quantity: left } } };
  });
  return result;
}

module.exports = { recordConsumption };
