const { createApp, buildDeps } = require('../../src/app');
const { memoryStore } = require('../../src/store/memory');
const { resetRateLimit } = require('../../src/middleware/core');

let server;
let base;

beforeAll(async () => {
  const deps = buildDeps(memoryStore({
    users: [], groups: [], categories: [], units: [], foods: [], fridge_lots: [],
    shopping_lists: [], shopping_tasks: [], meal_plans: [], recipes: [], ingredients: [],
    consumption_events: [], user_devices: [], refresh_tokens: [], verification_codes: [],
    notification_log: [], system_logs: [],
  }));
  const app = createApp(deps);
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}/it4788`;
});

beforeEach(() => resetRateLimit());

afterAll(() => server.close());

async function post(path, body, token) {
  const res = await fetch(base + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

describe('http layer', () => {
  test('the envelope shape holds and the register rules run over http', async () => {
    const registered = await post('/user/', {
      email: 'new@mail.com', password: 'password1', name: 'New User', username: 'newuser',
    });
    expect(registered.status).toBe(200);
    expect(registered.body.code).toBe('00035');
    expect(Object.keys(registered.body).sort()).toEqual(['code', 'data', 'message']);

    const gate = await post('/user/login/', { email: 'new@mail.com', password: 'password1' });
    expect(gate.body.code).toBe('00044');

    const noToken = await fetch(`${base}/user/`);
    expect(noToken.status).toBe(401);
    expect((await noToken.json()).code).toBe('00006');
  });

  test('the rate limit reads 60 per minute per ip (D11)', async () => {
    let last = null;
    for (let i = 0; i < 62; i += 1) last = await post('/user/send-verification-code/', { email: 'no@mail.com' });
    expect(last.status).toBe(429);
    expect(last.body.code).toBe('00024');
  });

  test('the log rule stores the write call (D12)', async () => {
    const res = await post('/user/', { email: 'log@mail.com', password: 'password1', name: 'Log User', username: 'loguser' });
    expect(res.body.code).toBe('00035');
    const rows = (await fetch(`${base}/reports/consumption`, { headers: { authorization: 'Bearer x' } }));
    expect(rows.status).toBe(401);
  });
});
