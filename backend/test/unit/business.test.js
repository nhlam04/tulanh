// Business scope: models, group, food, fridge, shopping, consumption, reports, jobs.
const { seed } = require('../support');
const food = require('../../src/services/food');
const fridge = require('../../src/services/fridge');
const shopping = require('../../src/services/shopping');
const consumption = require('../../src/services/consumption');
const catalog = require('../../src/services/catalog');
const report = require('../../src/services/report');
const mealPlan = require('../../src/services/mealPlan');
const recipe = require('../../src/services/recipe');
const jobs = require('../../src/jobs/reminder');

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

  test('a lot carries the place it sits in the tủ, and the place can change (spec: vị trí lưu trữ)', async () => {
    const deps = seed();
    const ctx = { userId: 'u1', role: 'group_leader', groupId: 'g1' };
    const row = await deps.repos.foods.insertOne({ _id: 'f1', group_id: 'g1', name: 'ca', created_by: 'u1' });
    const created = await fridge.createLot(deps, { ...ctx, input: { foodId: row._id, quantity: 2, useUntil: '2026-10-30', location: 'ngăn đá' } });
    expect(created.code).toBe('00202');
    expect(created.data.lot.location).toBe('ngăn đá');
    const plain = await fridge.createLot(deps, { ...ctx, input: { foodId: row._id, quantity: 1, useUntil: '2026-11-02' } });
    expect(plain.data.lot.location).toBe(null);
    const moved = await fridge.updateLot(deps, { ...ctx, input: { lotId: created.data.lot._id, newLocation: 'cửa tủ' } });
    expect(moved.code).toBe('00216');
    expect(moved.data.lot.location).toBe('cửa tủ');
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

  test('a report over a period keeps only the days inside it (spec: khoảng thời gian nhất định)', async () => {
    const deps = seed();
    await deps.repos.categories.insertOne({ _id: 'c1', name: 'rau' });
    await deps.repos.foods.insertOne({ _id: 'f1', group_id: 'g1', name: 'tao', category_id: 'c1' });
    await deps.repos.shopping_lists.insertOne({ _id: 'l1', group_id: 'g1' });
    await deps.repos.shopping_tasks.insertOne({ _id: 't1', list_id: 'l1', food_id: 'f1', quantity: 2, bought_at: new Date('2026-10-20T09:00:00Z') });
    await deps.repos.shopping_tasks.insertOne({ _id: 't2', list_id: 'l1', food_id: 'f1', quantity: 3, bought_at: new Date('2026-10-25T09:00:00Z') });
    await deps.repos.consumption_events.insertOne({ _id: 'e1', group_id: 'g1', food_id: 'f1', quantity: 1, reason: 'cook', logged_at: new Date('2026-10-21T04:00:00Z') });
    await deps.repos.consumption_events.insertOne({ _id: 'e2', group_id: 'g1', food_id: 'f1', quantity: 1, reason: 'spoil', logged_at: new Date('2026-10-26T04:00:00Z') });
    const inWindow = await report.purchasesByCategory(deps, { userId: 'u1', groupId: 'g1', input: { from: '2026-10-21', to: '2026-10-25' } });
    expect(inWindow.data.report.rau.length).toBe(1);
    expect(inWindow.data.report.rau[0].task_id).toBe('t2');
    const outOfWindow = await report.purchasesByCategory(deps, { userId: 'u1', groupId: 'g1', input: { from: '2026-11-01' } });
    expect(Object.keys(outOfWindow.data.report).length).toBe(0);
    const reasons = await report.consumptionByReason(deps, { userId: 'u1', groupId: 'g1', input: { to: '2026-10-24' } });
    expect(Object.keys(reasons.data.report)).toEqual(['cook']);
    // Both ends of the window are inclusive.
    const edge = await report.consumptionByReason(deps, { userId: 'u1', groupId: 'g1', input: { from: '2026-10-26' } });
    expect(Object.keys(edge.data.report)).toEqual(['spoil']);
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

describe('meal plan, recipe, suggestion', () => {
  test('the group leader owns the plan and a member does not (Rule C)', async () => {
    const deps = seed();
    const member = { userId: 'u1', role: 'user', groupId: 'g1' };
    const leader = { userId: 'u2', role: 'group_leader', groupId: 'g1' };
    await deps.repos.foods.insertOne({ _id: 'f1', group_id: 'g1', name: 'ca', created_by: 'u1' });
    const denied = await mealPlan.addPlan(deps, { ...member, input: { foodName: 'ca', timestamp: '2026-10-27T00:00:00Z', name: 'sáng' } });
    expect(denied.code).toBe('00319');
    const added = await mealPlan.addPlan(deps, { ...leader, input: { foodName: 'ca', timestamp: '2026-10-27T00:00:00Z', name: 'sáng' } });
    expect(added.code).toBe('00322');
  });

  test('a meal is suggested only when every ingredient is in the fridge (D77)', async () => {
    const deps = seed();
    const ctx = { userId: 'u1', role: 'user', groupId: 'g1' };
    await deps.repos.foods.insertOne({ _id: 'f1', group_id: 'g1', name: 'tao', created_by: 'u1' });
    await deps.repos.foods.insertOne({ _id: 'f2', group_id: 'g1', name: 'sua', created_by: 'u1' });
    await deps.repos.recipes.insertOne({ _id: 'r1', group_id: 'g1', name: 'sinh to tao', created_by: 'u1' });
    await deps.repos.ingredients.insertOne({ recipe_id: 'r1', food_id: 'f1', quantity: 1 });
    await deps.repos.ingredients.insertOne({ recipe_id: 'r1', food_id: 'f2', quantity: 1 });
    await deps.repos.fridge_lots.insertOne({ group_id: 'g1', food_id: 'f1', quantity: 2, use_until: '2026-11-01', created_by: 'u1' });
    const notYet = await mealPlan.suggestMeals(deps, ctx);
    expect(notYet.data.suggested.length).toBe(0);
    await deps.repos.fridge_lots.insertOne({ group_id: 'g1', food_id: 'f2', quantity: 1, use_until: '2026-11-02', created_by: 'u1' });
    const now = await mealPlan.suggestMeals(deps, ctx);
    expect(now.code).toBe('00392');
    expect(now.data.suggested.length).toBe(1);
  });

  test('the plan for a date becomes a list for the missing items', async () => {
    const deps = seed();
    const ctx = { userId: 'u1', role: 'group_leader', groupId: 'g1' };
    await deps.repos.foods.insertOne({ _id: 'f1', group_id: 'g1', name: 'ca', created_by: 'u1' });
    await deps.repos.recipes.insertOne({ _id: 'r1', group_id: 'g1', name: 'salad', created_by: 'u1' });
    await deps.repos.ingredients.insertOne({ recipe_id: 'r1', food_id: 'f1', quantity: 3 });
    await deps.repos.meal_plans.insertOne({ _id: 'p1', group_id: 'g1', plan_date: '2026-10-27', meal: 'trưa', food_id: 'f1', recipe_id: 'r1', created_by: 'u1' });
    const out = await mealPlan.generateList(deps, { ...ctx, input: { date: '2026-10-27' } });
    expect(out.code).toBe('00393');
    expect(out.data.tasks.length).toBe(1);
    const full = await mealPlan.generateList(deps, { ...ctx, input: { date: '2026-10-28' } });
    expect(full.data.tasks.length).toBe(0);
  });

  test('an ingredient name must name the stored row (D77)', async () => {
    const deps = seed();
    const ctx = { userId: 'u1', role: 'user', groupId: 'g1' };
    await deps.repos.recipes.insertOne({ _id: 'r1', group_id: 'g1', name: 'salad', created_by: 'u1' });
    const miss = await recipe.addIngredients(deps, { ...ctx, input: { recipeId: 'r1', ingredients: [{ foodName: 'cao', quantity: 1 }] } });
    expect(miss.code).toBe('00367');
    await deps.repos.foods.insertOne({ _id: 'f1', group_id: 'g1', name: 'cao', created_by: 'u1' });
    const hit = await recipe.addIngredients(deps, { ...ctx, input: { recipeId: 'r1', ingredients: [{ foodName: 'cao', quantity: 2 }] } });
    expect(hit.code).toBe('00394');
  });
});

describe('the CRUD paths that the spec lists', () => {
  test('category and unit change by name (codes 00141, 00146, 00122, 00128)', async () => {
    const deps = seed();
    const ctx = { userId: 'u1', role: 'admin', groupId: 'g1' };
    const catalog = require('../../src/services/catalog');
    await catalog.createCategory(deps, { ...ctx, input: { name: 'rau' } });
    await catalog.createUnit(deps, { ...ctx, input: { unitName: 'kg' } });
    expect((await catalog.editCategory(deps, { ...ctx, input: { oldName: 'rau', newName: 'trai cay' } })).code).toBe('00141');
    expect((await catalog.editCategory(deps, { ...ctx, input: { oldName: 'rau', newName: 'trai cay' } })).code).toBe('00138');
    expect((await catalog.deleteCategory(deps, { ...ctx, input: { name: 'trai cay' } })).code).toBe('00146');
    expect((await catalog.editUnit(deps, { ...ctx, input: { oldName: 'kg', newName: 'gam' } })).code).toBe('00122');
    expect((await catalog.deleteUnit(deps, { ...ctx, input: { unitName: 'gam' } })).code).toBe('00128');
  });

  test('list create, change and delete follow Rule C (codes 00249, 00266, 00275, 00261)', async () => {
    const deps = seed();
    const leader = { userId: 'u1', role: 'group_leader', groupId: 'g1' };
    const member = { userId: 'u2', role: 'user', groupId: 'g1' };
    await deps.repos.users.updateOne({ _id: 'u2' }, { group_id: 'g1' });
    const created = await shopping.createList(deps, { ...leader, input: { name: 'di cho', assignToUsername: 'binh' } });
    expect(created.code).toBe('00249');
    expect((await shopping.updateList(deps, { ...member, input: { listId: created.data.list._id, newName: 'sieu thi' } })).code).toBe('00261');
    expect((await shopping.updateList(deps, { ...leader, input: { listId: created.data.list._id, newName: 'sieu thi' } })).code).toBe('00266');
    expect((await shopping.deleteList(deps, { ...leader, input: { listId: created.data.list._id } })).code).toBe('00275');
  });

  test('task change and delete read the row owner (codes 00312, 00299, 00307)', async () => {
    const deps = seed();
    const leader = { userId: 'u1', role: 'group_leader', groupId: 'g1' };
    const member = { userId: 'u2', role: 'user', groupId: 'g1' };
    await deps.repos.foods.insertOne({ _id: 'f1', group_id: 'g1', name: 'thit', created_by: 'u1' });
    await deps.repos.foods.insertOne({ _id: 'f2', group_id: 'g1', name: 'ca', created_by: 'u2' });
    await deps.repos.shopping_lists.insertOne({ _id: 'l1', group_id: 'g1', created_by: 'u1' });
    const added = await shopping.addTasks(deps, { ...leader, input: { listId: 'l1', tasks: [{ foodId: 'f1', quantity: 2, buyerUsername: 'an', requestId: 'r1' }] } });
    const task = added.data.tasks[0];
    expect((await shopping.listTasks(deps, { ...member, input: { listId: 'l1' } })).data.tasks.length).toBe(1);
    expect((await shopping.updateTask(deps, { ...member, input: { taskId: task._id, newFoodName: 'ca' } })).code).toBe('00307');
    expect((await shopping.updateTask(deps, { ...leader, input: { taskId: task._id, newFoodName: 'ca' } })).code).toBe('00312');
    expect((await shopping.deleteTask(deps, { ...leader, input: { taskId: task._id } })).code).toBe('00299');
  });

  test('the fridge read by food name resolves the stored row (spec path /fridge/:foodName/)', async () => {
    const deps = seed();
    const ctx = { userId: 'u1', role: 'user', groupId: 'g1' };
    const food = await deps.repos.foods.insertOne({ _id: 'f1', group_id: 'g1', name: 'ca', created_by: 'u1' });
    await deps.repos.fridge_lots.insertOne({ group_id: 'g1', food_id: food._id, quantity: 2, use_until: '2026-11-01', created_by: 'u1' });
    const hit = await fridge.lotsByFood(deps, { ...ctx, input: { foodName: 'ca' } });
    expect(hit.code).toBe('00386');
    expect(hit.data.lots.length).toBe(1);
    const miss = await fridge.lotsByFood(deps, { ...ctx, input: { foodName: 'khong co' } });
    expect(miss.code).toBe('00230');
  });

  test('recipe delete and read by food (codes 00376, 00348)', async () => {
    const deps = seed();
    const ctx = { userId: 'u1', role: 'user', groupId: 'g1' };
    await deps.repos.foods.insertOne({ _id: 'f1', group_id: 'g1', name: 'tao', created_by: 'u1' });
    await deps.repos.recipes.insertOne({ _id: 'r1', group_id: 'g1', name: 'salad', created_by: 'u1' });
    await recipe.addIngredients(deps, { ...ctx, input: { recipeId: 'r1', ingredients: [{ foodName: 'tao', quantity: 1 }] } });
    expect((await recipe.recipesByFood(deps, { ...ctx, input: { foodId: 'f1' } })).data.recipes.length).toBe(1);
    expect((await recipe.deleteRecipe(deps, { ...ctx, input: { recipeId: 'r1' } })).code).toBe('00376');
  });

  test('a recipe reads its ingredients with names, and only its own (code 00400)', async () => {
    const deps = seed();
    const ctx = { userId: 'u1', role: 'user', groupId: 'g1' };
    await deps.repos.foods.insertOne({ _id: 'f1', group_id: 'g1', name: 'tao', created_by: 'u1' });
    await deps.repos.foods.insertOne({ _id: 'f2', group_id: 'g1', name: 'sua', created_by: 'u1' });
    await deps.repos.recipes.insertOne({ _id: 'r1', group_id: 'g1', name: 'sinh to tao', created_by: 'u1' });
    await deps.repos.recipes.insertOne({ _id: 'r2', group_id: 'g1', name: 'tra sua', created_by: 'u1' });
    await recipe.addIngredients(deps, { ...ctx, input: { recipeId: 'r1', ingredients: [{ foodName: 'tao' }, { foodName: 'sua' }] } });
    await recipe.addIngredients(deps, { ...ctx, input: { recipeId: 'r2', ingredients: [{ foodName: 'sua' }] } });
    const out = await recipe.recipeIngredients(deps, { ...ctx, input: { recipeId: 'r1' } });
    expect(out.code).toBe('00400');
    expect(out.data.ingredients.map((row) => row.name).sort()).toEqual(['sua', 'tao']);
    // A row from another recipe stays out of the answer.
    expect((await recipe.recipeIngredients(deps, { ...ctx, input: { recipeId: 'r2' } })).data.ingredients.length).toBe(1);
    // A recipe nobody stored is not a recipe of this group.
    expect((await recipe.recipeIngredients(deps, { ...ctx, input: { recipeId: 'nope' } })).code).toBe('00367');
  });

  test('the image rule keeps the stored path and the size cap (D13, code 00158)', async () => {
    const deps = seed();
    const images = require('../../src/services/images');
    const ok = await images.storeImage(deps, { userId: 'u1', groupId: 'g1', input: { image: 'Tao Photo.PNG', size: 200000 } });
    expect(ok.code).toBe('00098');
    expect(ok.data.saved).toBe('uploads/tao_photo.png');
    const big = await images.storeImage(deps, { userId: 'u1', groupId: 'g1', input: { image: 'big.png', size: 20 * 1024 * 1024 } });
    expect(big.code).toBe('00158');
  });

  test('the send answer is a ticket, and a receipt that reads DeviceNotRegistered stops the token', async () => {
    const deps = seed();
    const push = require('../../src/senders/push');
    deps.push = (devices, lot, timezone, food, day) => push.sendPush(devices, lot, timezone, food, day);
    deps.receipts = (ids) => push.checkReceipts(ids);
    await deps.repos.groups.insertOne({ _id: 'g1', leader_id: 'u1', timezone: 'Asia/Ho_Chi_Minh' });
    await deps.repos.foods.insertOne({ _id: 'f1', group_id: 'g1', name: 'thit' });
    await deps.repos.fridge_lots.insertOne({ _id: 'lot1', group_id: 'g1', food_id: 'f1', quantity: 1, use_until: '2026-10-28', created_by: 'u1' });
    const device = await deps.repos.user_devices.insertOne({ _id: 'd1', user_id: 'u1', push_token: 'ExponentPushToken[abc]', unregistered_at: null });

    const answers = [
      { data: [{ status: 'ok', id: 'ticket1' }] },
      { data: { ticket1: { status: 'error', details: { error: 'DeviceNotRegistered' } } } },
    ];
    const original = global.fetch;
    const requests = [];
    global.fetch = async (url, init) => {
      requests.push(JSON.parse(init.body));
      return { json: async () => answers.shift() };
    };
    const sent = await jobs.runReminder(deps, new Date('2026-10-26T00:00:00Z'));
    const checked = await jobs.runReceipts(deps);
    global.fetch = original;

    expect(sent.length).toBe(1);
    // D36: the notice names the food and the days left, and no person or group.
    const message = requests[0][0];
    expect(message.title).toBe('Tủ lành của bạn');
    expect(message.body).toBe('thit còn 2 ngày');
    expect(message.data.screen).toBe('fridge');
    expect(JSON.stringify(message)).not.toMatch(/u1|g1/);
    expect(checked[0].status).toBe('error');
    const row = await deps.repos.notification_log.findOne({ ticket_id: 'ticket1' });
    expect(row.receipt_error).toBe('DeviceNotRegistered');
    const stopped = await deps.repos.user_devices.findOne({ _id: device._id });
    expect(stopped.unregistered_at).not.toBeNull();
    const again = await push.sendPush([stopped], { _id: 'lot1', use_until: '2026-10-28' }, 'Asia/Ho_Chi_Minh');
    expect(again.data.skipped).toBe(true);
  });
});

describe('catalog access (D41)', () => {
  test('every path under /admin/ answers the admin-level message to a member', async () => {
    const deps = seed({ categories: [{ _id: 'c1', name: 'rau' }], units: [{ _id: 'n1', name: 'kg' }] });
    const member = { userId: 'u1', role: 'user', groupId: 'g1', input: { name: 'rau' } };
    expect((await catalog.createCategory(deps, member)).code).toBe('00017');
    expect((await catalog.listCategoriesForAdmin(deps, member)).code).toBe('00017');
    const leader = { userId: 'u1', role: 'group_leader', groupId: 'g1', input: { unitName: 'kg' } };
    expect((await catalog.listUnitsForAdmin(deps, leader)).code).toBe('00017');
    expect((await catalog.deleteUnit(deps, leader)).code).toBe('00017');
    expect(await deps.repos.categories.count({})).toBe(1);
  });

  test('the reads the food form needs stay open to a member', async () => {
    const deps = seed({ categories: [{ _id: 'c1', name: 'rau' }], units: [{ _id: 'n1', name: 'kg' }] });
    const member = { userId: 'u1', role: 'user', groupId: 'g1', input: {} };
    expect((await catalog.listCategories(deps, member)).code).toBe('00129');
    expect((await catalog.listUnits(deps, member)).code).toBe('00110');
    const admin = { userId: 'u9', role: 'admin', groupId: null, input: {} };
    expect((await catalog.listCategoriesForAdmin(deps, admin)).code).toBe('00129');
    expect((await catalog.listUnitsForAdmin(deps, admin)).code).toBe('00110');
  });

  test('a catalog row a food still uses cannot be deleted', async () => {
    const deps = seed({ categories: [{ _id: 'c1', name: 'rau' }], units: [{ _id: 'n1', name: 'kg' }] });
    await deps.repos.foods.insertOne({ _id: 'f1', group_id: 'g1', name: 'tao', category_id: 'c1', unit_id: 'n1' });
    const admin = { userId: 'u9', role: 'admin', groupId: null, input: { name: 'rau' } };
    expect((await catalog.deleteCategory(deps, admin)).code).toBe('00144');
    const unitAdmin = { userId: 'u9', role: 'admin', groupId: null, input: { unitName: 'kg' } };
    expect((await catalog.deleteUnit(deps, unitAdmin)).code).toBe('00126');
    await deps.repos.foods.deleteOne({ _id: 'f1' });
    expect((await catalog.deleteCategory(deps, admin)).code).toBe('00146');
    expect((await catalog.deleteUnit(deps, unitAdmin)).code).toBe('00128');
  });
});
