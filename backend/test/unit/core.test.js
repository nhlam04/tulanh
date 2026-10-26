// Core scope: architecture, auth, permission, the response shape.
const { seed } = require('../support');
const auth = require('../../src/services/auth');
const food = require('../../src/services/food');

describe('auth gates', () => {
  test('duplicate email keeps its own code', async () => {
    const deps = seed();
    const result = await auth.register(deps, { input: { email: 'a@mail.com', password: 'password1', name: 'An Nam', username: 'an' } });
    expect(result.code).toBe('00032');
  });

  test('login reads the verification flag before the password check', async () => {
    const deps = seed();
    const result = await auth.login(deps, { input: { email: 'b@mail.com', password: 'password1' } });
    expect(result.code).toBe('00044');
  });

  test('refresh rotates the stored token (D26)', async () => {
    const deps = seed();
    const login = await auth.login(deps, { input: { email: 'a@mail.com', password: 'password1' } });
    expect(login.code).toBe('00047');
    const next = await auth.refresh(deps, { input: { refreshToken: login.data.refreshToken } });
    expect(next.code).toBe('00065');
    const replay = await auth.refresh(deps, { input: { refreshToken: login.data.refreshToken } });
    expect(replay.code).toBe('00061');
  });
});

describe('permission, Rule C', () => {
  test('a member edits the row they created and not another row', async () => {
    const deps = seed();
    await deps.repos.foods.insertOne({ _id: 'f1', group_id: 'g1', name: 'thit', created_by: 'u1' });
    await deps.repos.foods.insertOne({ _id: 'f2', group_id: 'g1', name: 'ca', created_by: 'u2' });
    const own = await food.updateFood(deps, { userId: 'u1', role: 'user', groupId: 'g1', input: { foodId: 'f1', newName: 'thit bo' } });
    expect(own.code).toBe('00141');
    const other = await food.updateFood(deps, { userId: 'u1', role: 'user', groupId: 'g1', input: { foodId: 'f2', newName: 'ca bo' } });
    expect(other.code).toBe('00167x');
    const leader = await food.updateFood(deps, { userId: 'u2', role: 'group_leader', groupId: 'g1', input: { foodId: 'f2', newName: 'ca bo' } });
    expect(leader.code).toBe('00141');
  });
});

describe('sync queue and admin levels', () => {
  test('a queued write applies once, and a replay reads the stored event (D38)', async () => {
    const deps = seed();
    const sync = require('../../src/services/sync');
    await deps.repos.foods.insertOne({ _id: 'f1', group_id: 'g1', name: 'thit', created_by: 'u1' });
    const lot = await deps.repos.fridge_lots.insertOne({ _id: 'lot1', group_id: 'g1', food_id: 'f1', quantity: 3, created_by: 'u1' });
    const op = { type: 'consumption', lotId: lot._id, quantity: 1, reason: 'cook', requestId: 'q1' };
    const ctx = { userId: 'u1', groupId: 'g1', input: { ops: [op] } };
    const first = await sync.applyOps(deps, ctx);
    const replay = await sync.applyOps(deps, ctx);
    expect(first.code).toBe('00098');
    expect(first.data.applied[0].code).toBe('00387');
    expect(replay.data.applied[0].data.replay).toBe(true);
    const left = await deps.repos.fridge_lots.findOne({ _id: lot._id });
    expect(left.quantity).toBe(2);
  });

  test('admin levels read one message, not three (D28)', async () => {
    const deps = seed();
    const admin = require('../../src/services/admin');
    const member = { userId: 'u1', role: 'user', groupId: null, input: {} };
    const sys = { userId: 'u1', role: 'admin', groupId: null, input: {} };
    expect((await admin.listUsers(deps, member)).code).toBe('00017');
    const listed = await admin.listUsers(deps, sys);
    expect(listed.code).toBe('00098');
    expect(listed.data.users.length).toBe(2);
    expect((await admin.readLogs(deps, member)).code).toBe('00017');
  });

  test('the mailer runs in noop mode with no host, and sends when a transport is given', async () => {
    const deps = seed();
    const mailer = require('../../src/senders/mailer');
    const noop = await mailer.sendEmail('a@mail.com', '00048');
    expect(noop.code).toBe('00048');
    expect(noop.data.mode).toBe('noop');
    const fake = { sendMail: async () => ({ messageId: 'm1' }) };
    const sent = await mailer.sendEmail('a@mail.com', '00048', fake);
    expect(sent.data.delivered).toBe(true);
    expect(mailer.buildTransport({ createTransport: (options) => options }, { SMTP_HOST: '127.0.0.1', SMTP_PORT: '1025' }))
      .toEqual({ host: '127.0.0.1', port: 1025, secure: false, auth: undefined });
    expect(mailer.buildTransport({ createTransport: () => 'x' }, {})).toBeNull();
  });
});
