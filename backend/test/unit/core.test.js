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
