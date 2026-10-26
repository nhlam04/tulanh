// Proof for the two rules that need a real server: a session needs a replica set,
// and the name rules hold as unique indexes. Development runs a single-node set.

let store;
let mongod;

beforeAll(async () => {
  const { MongoMemoryReplSet } = require('mongodb-memory-server');
  mongod = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  process.env.MONGO_URI = mongod.getUri();
  process.env.DB_NAME = 'ishop_test';
  const { connect } = require('../src/store/mongo');
  const { createIndexes } = require('../src/store/indexes');
  store = await connect(mongod.getUri());
  await createIndexes(store.db);
}, 120000);

afterAll(async () => {
  if (store) await store.client.close();
  if (mongod) await mongod.stop();
});

const services = {
  auth: require('../src/services/auth'),
  food: require('../src/services/food'),
  shopping: require('../src/services/shopping'),
  consumption: require('../src/services/consumption'),
};
const { buildDeps } = require('../src/app');

describe('single-node replica set', () => {
  test('a cross-collection write runs in a transaction (D21)', async () => {
    const deps = buildDeps(store, { now: () => new Date('2026-10-26T03:00:00Z') });
    const ctx = { userId: 'u1', role: 'group_leader', groupId: 'g1' };
    const food = await deps.repos.foods.insertOne({ group_id: 'g1', name: 'thit mua', unit_id: 'n1', created_by: 'u1' });
    const list = await deps.repos.shopping_lists.insertOne({ group_id: 'g1', created_by: 'u1' });
    const task = await deps.repos.shopping_tasks.insertOne({
      list_id: list._id, food_id: food._id, quantity: 2, assign_to: 'u1',
      claimed_by: 'u1', created_by: 'u1',
    });
    const result = await services.shopping.markBought(deps, { ...ctx, input: { taskId: task._id } });
    expect(result.code).toBe('00390');
    const lot = await deps.repos.fridge_lots.findOne({ _id: result.data.lot._id });
    expect(lot.quantity).toBe(2);
  });

  test('a unique index answers with the code that the name rule uses (D19)', async () => {
    const deps = buildDeps(store, { now: () => new Date() });
    await deps.repos.foods.insertOne({ group_id: 'g2', name: 'trung', category_id: 'c1', unit_id: 'n1', created_by: 'u1' });
    try {
      await deps.repos.foods.insertOne({ group_id: 'g2', name: 'trung', category_id: 'c1', unit_id: 'n1', created_by: 'u2' });
      throw new Error('the unique index did not run');
    } catch (error) {
      expect(error.code).toBe(11000);
    }
  });

  test('the text index answers a whole stemmed word, not a fragment (D76)', async () => {
    const deps = buildDeps(store, { now: () => new Date() });
    await deps.repos.foods.insertOne({ group_id: 'g3', name: 'tao', category_id: 'c1', unit_id: 'n1', created_by: 'u1' });
    const hit = await services.food.searchFood(deps, { userId: 'u1', role: 'user', groupId: 'g3', input: { keyword: 'TAOS' } });
    expect(hit.code).toBe('00397');
    const fragment = await services.food.searchFood(deps, { userId: 'u1', role: 'user', groupId: 'g3', input: { keyword: 'tao1' } });
    expect(fragment.code).toBe('00398');
  });

  test('the replay guard holds on a real unique index (D38)', async () => {
    const deps = buildDeps(store, { now: () => new Date() });
    const food = await deps.repos.foods.insertOne({ group_id: 'g4', name: 'ca', category_id: 'c1', unit_id: 'n1', created_by: 'u1' });
    const lot = await deps.repos.fridge_lots.insertOne({ group_id: 'g4', food_id: food._id, quantity: 4, created_by: 'u1' });
    const input = { lotId: lot._id, quantity: 1, reason: 'cook', requestId: 'r1' };
    const first = await services.consumption.recordConsumption(deps, { userId: 'u1', role: 'user', groupId: 'g4', input });
    const replay = await services.consumption.recordConsumption(deps, { userId: 'u1', role: 'user', groupId: 'g4', input });
    expect(first.code).toBe('00387');
    expect(replay.data.replay).toBe(true);
    const left = await deps.repos.fridge_lots.findOne({ _id: lot._id });
    expect(left.quantity).toBe(3);
  });
});
