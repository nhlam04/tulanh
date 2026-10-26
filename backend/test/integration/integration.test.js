// Proof for the rules that need a real server: a session needs a replica set,
// and the name rules hold as unique indexes. Development runs a single-node set.
// This file runs on the node test runner, not Jest, because Jest hides the package
// metadata that the driver sends on the handshake.
const nodeTest = require('node:test');
const assert = require('node:assert');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

const { connect } = require('../../src/store/mongo');
const { createIndexes } = require('../../src/store/indexes');
const { buildDeps } = require('../../src/app');
const shopping = require('../../src/services/shopping');
const consumption = require('../../src/services/consumption');
const food = require('../../src/services/food');

let mongod;
let store;

nodeTest.before(async () => {
  mongod = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  process.env.DB_NAME = 'ishop_test';
  store = await connect(mongod.getUri());
  await createIndexes(store.db);
});

nodeTest.after(async () => {
  if (store) await store.client.close();
  if (mongod) await mongod.stop();
});

nodeTest.test('a cross-collection write runs in a transaction (D21)', async () => {
  const deps = buildDeps(store, { now: () => new Date('2026-10-26T03:00:00Z') });
  const ctx = { userId: 'u1', role: 'group_leader', groupId: 'g1' };
  const item = await deps.repos.foods.insertOne({ group_id: 'g1', name: 'thit mua', unit_id: 'n1', created_by: 'u1' });
  const list = await deps.repos.shopping_lists.insertOne({ group_id: 'g1', created_by: 'u1' });
  const task = await deps.repos.shopping_tasks.insertOne({
    list_id: list._id, food_id: item._id, quantity: 2, assign_to: 'u1', claimed_by: 'u1', created_by: 'u1',
  });
  const result = await shopping.markBought(deps, { ...ctx, input: { taskId: task._id } });
  assert.equal(result.code, '00390');
  const lot = await deps.repos.fridge_lots.findOne({ _id: result.data.lot._id });
  assert.equal(lot.quantity, 2);
});

nodeTest.test('a unique index answers with the code that the name rule uses (D19)', async () => {
  const deps = buildDeps(store, { now: () => new Date() });
  await deps.repos.foods.insertOne({ group_id: 'g2', name: 'trung', category_id: 'c1', unit_id: 'n1', created_by: 'u1' });
  let code = null;
  try {
    await deps.repos.foods.insertOne({ group_id: 'g2', name: 'trung', category_id: 'c1', unit_id: 'n1', created_by: 'u2' });
  } catch (error) {
    code = error.code;
  }
  assert.equal(code, 11000);
});

nodeTest.test('the text index answers a whole stemmed word, not a fragment (D76)', async () => {
  const deps = buildDeps(store, { now: () => new Date() });
  await deps.repos.foods.insertOne({ group_id: 'g3', name: 'tao', category_id: 'c1', unit_id: 'n1', created_by: 'u1' });
  const hit = await food.searchFood(deps, { userId: 'u1', role: 'user', groupId: 'g3', input: { keyword: 'TAOS' } });
  assert.equal(hit.code, '00397');
  const fragment = await food.searchFood(deps, { userId: 'u1', role: 'user', groupId: 'g3', input: { keyword: 'tao1' } });
  assert.equal(fragment.code, '00398');
});

nodeTest.test('the replay guard holds on a real unique index (D38)', async () => {
  const deps = buildDeps(store, { now: () => new Date() });
  const item = await deps.repos.foods.insertOne({ group_id: 'g4', name: 'ca', category_id: 'c1', unit_id: 'n1', created_by: 'u1' });
  const lot = await deps.repos.fridge_lots.insertOne({ group_id: 'g4', food_id: item._id, quantity: 4, created_by: 'u1' });
  const input = { lotId: lot._id, quantity: 1, reason: 'cook', requestId: 'r1' };
  const first = await consumption.recordConsumption(deps, { userId: 'u1', role: 'user', groupId: 'g4', input });
  const replay = await consumption.recordConsumption(deps, { userId: 'u1', role: 'user', groupId: 'g4', input });
  assert.equal(first.code, '00387');
  assert.equal(replay.data.replay, true);
  const left = await deps.repos.fridge_lots.findOne({ _id: lot._id });
  assert.equal(left.quantity, 3);
});
