// Business scope: models, group, food, fridge, shopping, consumption, reports, jobs.
const { seed } = require('./support');
const food = require('../src/services/food');
const fridge = require('../src/services/fridge');
const shopping = require('../src/services/shopping');
const consumption = require('../src/services/consumption');
const report = require('../src/services/report');
const jobs = require('../src/jobs/reminder');

describe('name rules and lot model', () => {
  test('duplicate food name returns the code from the unique rule', async () => {
    const deps = seed({ categories: [{ _id: 'c1', name: 'rau' }], units: [{ _id: 'n1', name: 'kg' }] });
    const ctx = { userId: 'u1', role: 'user', groupId: 'g1' };
    await deps.repos.groups.insertOne({ _id: 'g1', name: 'g', leader_id: 'u1', timezone: 'Asia/Ho_Chi_Minh' });
    ctx.input = { name: 'thit', categoryName: 'rau', unitName: 'kg' };
    const first = await food.createFood(deps, ctx);
    expect(first.code).toBe('00160');
    const second = await food.createFood(deps, ctx);
    expect(second.code).toBe('00151');
  });

  test('one food can hold two lots, so the key is food plus use-by (D18)', async () => {
    const deps = seed();
    const ctx = { userId: 'u1', role: 'user', groupId: 'g1' };
    const row = await deps.repos.foods.insertOne({ _id: 'f1', group_id: 'g1', name: 'thit', created_by: 'u1' });
    const a = await fridge.createLot(deps, { ...ctx, input: { foodId: row._id, quantity: 2, useUntil: '2026-10-30' } });
    const b = await fridge.createLot(deps, { ...ctx, input: { foodId: row._id, quantity: 1, useUntil: '2026-11-02' } });
    expect(a.code).toBe('00202');
    expect(b.code).toBe('00202');
    const same = await fridge.createLot(deps, { ...ctx, input: { foodId: row._id, quantity: 1, useUntil: '2026-10-30' } });
    expect(same.code).toBe('00199');
  });

  test('search matches the whole stemmed word, not a substring (D76)', async () => {
    const deps = seed();
    const ctx = { userId: 'u1', role: 'user', groupId: 'g1' };
    await deps.repos.foods.insertOne({ _id: 'f1', group_id: 'g1', name: 'tao' });
    const hit = await food.searchFood(deps, { ...ctx, input: { keyword: 'tao' } });
    expect(hit.code).toBe('00397');
    const miss = await food.searchFood(deps, { ...ctx, input: { keyword: 'ta' } });
    expect(miss.code).toBe('00399');
  });
});

describe('bought path and consumption', () => {
  test('the bought path writes the task and the lot in one transaction (D21)', async () => {
    const deps = seed();
    await deps.repos.foods.insertOne({ _id: 'f1', group_id: 'g1', name: 'thit', unit_id: 'n1', created_by: 'u1' });
    await deps.repos.shopping_lists.insertOne({ _id: 'l1', group_id: 'g1', created_by: 'u1' });
    const added = await shopping.addTasks(deps, {
      userId: 'u1', role: 'group_leader', groupId: 'g1',
      input: { listId: 'l1', tasks: [{ foodId: 'f1', quantity: 3, buyerUsername: 'an', requestId: 'r1' }] },
    });
    expect(added.code).toBe('00287');
    const task = added.data.tasks[0];
    const bought = await shopping.markBought(deps, { userId: 'u1', role: 'group_leader', groupId: 'g1', input: { taskId: task._id } });
    expect(bought.code).toBe('00390');
    expect(bought.data.lot.quantity).toBe(3);
    const lots = await deps.repos.fridge_lots.find({ group_id: 'g1' });
    expect(lots.length).toBe(1);
  });

  test('a replay of the same request does not create a second lot (D38)', async () => {
    const deps = seed();
    await deps.repos.foods.insertOne({ _id: 'f1', group_id: 'g1', name: 'thit', unit_id: 'n1', created_by: 'u1' });
    const lot = await deps.repos.fridge_lots.insertOne({ _id: 'lot1', group_id: 'g1', food_id: 'f1', quantity: 5, created_by: 'u1' });
    const input = { lotId: lot._id, quantity: 2, reason: 'cook', requestId: 'r9' };
    const first = await consumption.recordConsumption(deps, { userId: 'u1', role: 'user', groupId: 'g1', input });
    const replay = await consumption.recordConsumption(deps, { userId: 'u1', role: 'user', groupId: 'g1', input });
    expect(first.code).toBe('00387');
    expect(replay.data.replay).toBe(true);
    const left = await deps.repos.fridge_lots.findOne({ _id: lot._id });
    expect(left.quantity).toBe(3);
    const over = await consumption.recordConsumption(deps, {
      userId: 'u1', role: 'user', groupId: 'g1', input: { lotId: lot._id, quantity: 10, reason: 'cook', requestId: 'r10' },
    });
    expect(over.code).toBe('00388');
  });

  test('reports read by category and by reason with separate codes (D67, D71)', async () => {
    const deps = seed();
    await deps.repos.categories.insertOne({ _id: 'c1', name: 'rau' });
    await deps.repos.foods.insertOne({ _id: 'f1', group_id: 'g1', name: 'tao', category_id: 'c1' });
    await deps.repos.shopping_lists.insertOne({ _id: 'l1', group_id: 'g1' });
    await deps.repos.shopping_tasks.insertOne({ _id: 't1', list_id: 'l1', food_id: 'f1', quantity: 2, bought_at: new Date('2026-10-20T00:00:00Z') });
    await deps.repos.consumption_events.insertOne({ _id: 'e1', group_id: 'g1', food_id: 'f1', quantity: 1, reason: 'cook', logged_at: new Date() });
    const purchases = await report.purchasesByCategory(deps, { userId: 'u1', groupId: 'g1' });
    const waste = await report.consumptionByReason(deps, { userId: 'u1', groupId: 'g1' });
    expect(purchases.code).toBe('00395');
    expect(waste.code).toBe('00396');
    expect(purchases.data.report.rau.length).toBe(1);
    expect(waste.data.report.cook.length).toBe(1);
  });
});

describe('notification job', () => {
  test('one notice per lot per day, not per day repeat (D35)', async () => {
    const deps = seed();
    await deps.repos.groups.insertOne({ _id: 'g1', leader_id: 'u1', timezone: 'Asia/Ho_Chi_Minh' });
    await deps.repos.foods.insertOne({ _id: 'f1', group_id: 'g1', name: 'thit' });
    await deps.repos.fridge_lots.insertOne({ _id: 'lot1', group_id: 'g1', food_id: 'f1', quantity: 1, use_until: '2026-10-28', created_by: 'u1' });
    const day1 = await jobs.runReminder(deps, new Date('2026-10-26T00:00:00Z'));
    const again = await jobs.runReminder(deps, new Date('2026-10-26T00:00:00Z'));
    const far = await jobs.runReminder(deps, new Date('2026-10-23T00:00:00Z'));
    expect(day1.length).toBe(1);
    expect(again.length).toBe(0);
    expect(far.length).toBe(0);
  });

  test('retention drops rows past 30 days (D63)', async () => {
    const deps = seed();
    await deps.repos.system_logs.insertOne({ _id: 'old', created_at: new Date('2026-09-01T00:00:00Z'), level: 'info' });
    await deps.repos.system_logs.insertOne({ _id: 'new', created_at: new Date('2026-10-25T00:00:00Z'), level: 'info' });
    const removed = await jobs.runRetention(deps);
    expect(removed).toBe(1);
    expect((await deps.repos.system_logs.find({})).length).toBe(1);
  });
});
