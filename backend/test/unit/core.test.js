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

describe('the duplicate rule reads the index, not the words (D19)', () => {
  const { duplicateCode, duplicateError } = require('../../src/errors');

  test('each unique index the code table names keeps its own code', () => {
    expect(duplicateCode('users', { email: 1 })).toBe('00032');
    expect(duplicateCode('users', { username: 1 })).toBe('00084');
    expect(duplicateCode('categories', { name: 1 })).toBe('00132');
    expect(duplicateCode('units', { name: 1 })).toBe('00113');
    expect(duplicateCode('foods', { group_id: 1, name: 1 })).toBe('00151');
    expect(duplicateCode('shopping_tasks', { list_id: 1, food_id: 1 })).toBe('00309');
    expect(duplicateCode('consumption_events', { request_id: 1 })).toBe('00387');
    // A unique index the table has no row for answers with the fallback row.
    expect(duplicateCode('fridge_lots', { group_id: 1, food_id: 1 })).toBe('00114');
  });

  test('the error the store hands back carries the pair the code is read from', () => {
    // Shape measured on driver 7.7, 2026-10-29: MongoServerError with code 11000 and keyPattern;
    // the namespace field the old code read is undefined on this driver.
    const error = duplicateError('users', { username: 1 }, { username: 'an' });
    expect(error.name).toBe('MongoServerError');
    expect(error.code).toBe(11000);
    expect(duplicateCode(error.collection, error.keyPattern)).toBe('00084');
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
    const noop = await mailer.sendEmail('a@mail.com', '654321');
    expect(noop.code).toBe('00048');
    expect(noop.data.mode).toBe('noop');
    let mail = null;
    const fake = { sendMail: async (message) => { mail = message; return { messageId: 'm1' }; } };
    const sent = await mailer.sendEmail('a@mail.com', '654321', fake, { ttlMs: 24 * 60 * 60 * 1000 });
    expect(sent.data.delivered).toBe(true);
    // The person reads the code out of the mail, so the body carries it and the span the
    // database will enforce, not the api sentence.
    expect(mail.text).toContain('654321');
    expect(mail.text).toContain('Mã hết hạn sau 24 giờ.');
    expect(mail.subject).toBe('Mã xác nhận Tủ Lành');
    expect(mailer.buildTransport({ createTransport: (options) => options }, { SMTP_HOST: '127.0.0.1', SMTP_PORT: '1025' }))
      .toEqual({ host: '127.0.0.1', port: 1025, secure: false, auth: undefined });
    expect(mailer.buildTransport({ createTransport: () => 'x' }, {})).toBeNull();
  });
});
