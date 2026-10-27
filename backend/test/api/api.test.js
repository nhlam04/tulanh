const { createApp, buildDeps } = require('../../src/app');
const { memoryStore } = require('../../src/store/memory');
const { resetRateLimit } = require('../../src/middleware/core');

let server;
let base;
let deps;

beforeAll(async () => {
  deps = buildDeps(memoryStore({
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

async function uploadFile(path, form, token) {
  const res = await fetch(base + path, {
    method: 'POST',
    headers: token ? { authorization: `Bearer ${token}` } : {},
    body: form,
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

  test('the verification loop closes with no session and only for the account the email names (D40)', async () => {
    const registered = await post('/user/', {
      email: 'loop@mail.com', password: 'password1', name: 'Loop User', username: 'loopuser',
    });
    expect(registered.body.code).toBe('00035');

    const sent = await post('/user/send-verification-code/', { email: 'loop@mail.com' });
    expect(sent.body.code).toBe('00048');
    const code = (await deps.store.collection('verification_codes').findOne({ user_id: registered.body.data.user.id })).code;

    expect((await post('/user/verify-email/', { email: 'loop@mail.com', code: '000000' })).body.code).toBe('00054');
    // An email with no account answers the same code, so this path is not a list of accounts.
    expect((await post('/user/verify-email/', { email: 'nobody@mail.com', code })).body.code).toBe('00054');
    // A body user id is not read, so it cannot mark another account verified.
    expect((await post('/user/verify-email/', { userId: registered.body.data.user.id, code })).body.code).toBe('00005');

    expect((await post('/user/verify-email/', { email: 'loop@mail.com', code })).body.code).toBe('00058');
    expect((await post('/user/login/', { email: 'loop@mail.com', password: 'password1' })).body.code).toBe('00047');
  });

  test('the admin catalog path answers the admin-level message over http, and the food form read does not (D41)', async () => {
    await post('/user/', { email: 'cat@mail.com', password: 'password1', name: 'Cat User', username: 'catuser' });
    const row = await deps.store.collection('users').findOne({ email: 'cat@mail.com' });
    row.is_verified = true;
    const token = (await post('/user/login/', { email: 'cat@mail.com', password: 'password1' })).body.data.accessToken;

    const denied = await fetch(`${base}/admin/category/`, {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: 'rau' }),
    });
    expect((await denied.json()).code).toBe('00017');
    expect((await (await fetch(`${base}/admin/category/`, { headers: { authorization: `Bearer ${token}` } })).json()).code).toBe('00017');

    const open = await fetch(`${base}/food/category/`, { headers: { authorization: `Bearer ${token}` } });
    expect((await open.json()).code).toBe('00129');
    const unit = await fetch(`${base}/food/unit/`, { headers: { authorization: `Bearer ${token}` } });
    expect((await unit.json()).code).toBe('00110');
  });

  test('the rate limit reads 60 per minute per ip (D11)', async () => {
    // The window is a calendar minute, so a run that crosses the boundary can land 60 requests in
    // each window and read no limit. The test sends until the limit answers, with a cap that a
    // window must exceed.
    let hit = null;
    for (let i = 0; i < 121 && !hit; i += 1) {
      const res = await post('/user/send-verification-code/', { email: 'no@mail.com' });
      if (res.status === 429) hit = res;
    }
    expect(hit).not.toBeNull();
    expect(hit.body.code).toBe('00024');
  });

  test('the log rule stores the write call (D12)', async () => {
    const res = await post('/user/', { email: 'log@mail.com', password: 'password1', name: 'Log User', username: 'loguser' });
    expect(res.body.code).toBe('00035');
    const rows = (await fetch(`${base}/reports/consumption`, { headers: { authorization: 'Bearer x' } }));
    expect(rows.status).toBe(401);
  });

  test('the upload path holds the file, and the size cap answers before the service rule (D13)', async () => {
    const fs = require('node:fs');
    const dir = '.scratch/uploads-test';
    fs.mkdirSync(dir, { recursive: true });
    process.env.UPLOAD_DIR = dir;

    await post('/user/', { email: 'upload@mail.com', password: 'password1', name: 'Upload User', username: 'upload' });
    const row = await deps.store.collection('users').findOne({ email: 'upload@mail.com' });
    row.is_verified = true;
    const token = (await post('/user/login/', { email: 'upload@mail.com', password: 'password1' })).body.data.accessToken;

    const form = new FormData();
    form.append('image', new Blob(['x'.repeat(1024)], { type: 'image/png' }), 'photo.png');
    const saved = await uploadFile('/uploads/', form, token);
    expect(saved.body.code).toBe('00098');
    expect(saved.body.data.saved).toContain('photo.png');

    const big = new FormData();
    big.append('image', new Blob(['x'.repeat(17 * 1024 * 1024)], { type: 'image/png' }), 'big.png');
    const oversize = await uploadFile('/uploads/', big, token);
    expect(oversize.status).toBe(413);
    expect(oversize.body.code).toBe('00158');

    delete process.env.UPLOAD_DIR;
  }, 30000);
});
