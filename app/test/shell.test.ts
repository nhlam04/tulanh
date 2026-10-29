// App shell scope (Minh): the offline rule, the queue guard, the socket handshake.
import { request, rawRequest, setBase, baseUrl, DEFAULT_BASE, EXPIRED, setRenewer } from '../src/api/client';
import { tokenStore } from '../src/auth/token';
import { init, queueOp, pendingOps, markSent, QueueDb } from '../src/offline/queue';
import { sendQueue } from '../src/offline/send';
import { BASE_URL_KEY, initSettings, readSetting, writeSetting } from '../src/settings';
import { writeOrQueue } from '../src/offline/write';
import type { Session } from '../src/session';

function fakeDb(): QueueDb {
  const rows: Record<string, unknown>[] = [];
  return {
    run(sql, params) {
      if (sql.startsWith('CREATE')) return;
      if (sql.startsWith('INSERT OR IGNORE')) {
        const [id, type, requestId, payload, sentAt] = params as string[];
        if (!rows.some((row) => row.request_id === requestId)) rows.push({ id, type, request_id: requestId, payload, sent_at: sentAt });
        return;
      }
      if (sql.startsWith('UPDATE')) {
        const [at, requestId] = params as string[];
        const row = rows.find((item) => item.request_id === requestId);
        if (row) row.sent_at = at;
      }
    },
    all(sql, params) {
      const whereNull = sql.includes('sent_at IS NULL');
      return rows.filter((row) => !whereNull || !row.sent_at);
    },
    get(sql, params) {
      const path = params[0] as string;
      return rows.find((row) => row.path === path) || null;
    },
  };
}

test('offline blocks a write and keeps the read path (D38)', async () => {
  const write = await request('/consumption', { method: 'post', body: { lotId: 'x', quantity: 1 }, offline: true });
  expect(write.queued).toBe(true);
  expect(write.code).toBe('00008');
});

test('a queued write keeps its request id, and a replay does not add a second row', () => {
  const db = fakeDb();
  init(db);
  queueOp(db, { id: '1', type: 'consumption', requestId: 'r1', payload: { lotId: 'x', quantity: 1 }, sentAt: null });
  queueOp(db, { id: '2', type: 'consumption', requestId: 'r1', payload: { lotId: 'x', quantity: 1 }, sentAt: null });
  expect(pendingOps(db).length).toBe(1);
  markSent(db, ['r1'], '2026-10-26T03:00:00Z');
  expect(pendingOps(db).length).toBe(0);
});

test('the queue posts once and marks only the ops the server took', async () => {
  const db = fakeDb();
  init(db);
  queueOp(db, { id: '1', type: 'consumption', requestId: 'r1', payload: { lotId: 'x', quantity: 1 }, sentAt: null });
  queueOp(db, { id: '2', type: 'consumption', requestId: 'r2', payload: { lotId: 'x', quantity: 9 }, sentAt: null });
  const original = global.fetch;
  global.fetch = (async () => ({ json: async () => ({ code: '00098', message: 'ok', data: { applied: [{ code: '00387' }, { code: '00008' }] } }) })) as unknown as typeof fetch;
  const out = await sendQueue(db, 'token', '2026-10-26T03:01:00Z');
  global.fetch = original;
  expect(out.sent).toBe(1);
  expect(pendingOps(db).map((op) => op.requestId)).toEqual(['r2']);
});

test('a send the server refused for a session keeps the whole queue', async () => {
  const db = fakeDb();
  init(db);
  queueOp(db, { id: '1', type: 'consumption', requestId: 'r1', payload: { lotId: 'x', quantity: 1 }, sentAt: null });
  const original = global.fetch;
  global.fetch = (async () => ({ status: 401, json: async () => ({ code: '00012', message: 'bad token', data: null }) })) as unknown as typeof fetch;
  const out = await sendQueue(db, 'expired-token', '2026-10-26T03:02:00Z');
  global.fetch = original;
  expect(out.sent).toBe(0);
  expect(pendingOps(db).map((op) => op.requestId)).toEqual(['r1']);
});

function sessionWith(db: QueueDb, offline: boolean): Session {
  return { db, token: 'token', offline } as unknown as Session;
}

test('a write with the network off goes to the queue, not to the wire (D38)', async () => {
  const db = fakeDb();
  init(db);
  const out = await writeOrQueue(sessionWith(db, true), '/consumption/', { lotId: 'x', quantity: 1 }, {
    type: 'consumption', payload: { lotId: 'x', quantity: 1 },
  });
  expect(out.code).toBe('00008');
  expect(pendingOps(db).length).toBe(1);
  expect(pendingOps(db)[0].requestId).toBeTruthy();
});

test('a write the server never answered is queued as well', async () => {
  const db = fakeDb();
  init(db);
  const original = global.fetch;
  global.fetch = (async () => {
    throw new Error('no route to host');
  }) as unknown as typeof fetch;
  const out = await writeOrQueue(sessionWith(db, false), '/consumption/', { lotId: 'x', quantity: 1 }, {
    type: 'consumption', payload: { lotId: 'x', quantity: 1 },
  });
  global.fetch = original;
  expect(out.status).toBe(0);
  expect(pendingOps(db).length).toBe(1);
});

test('the server address is a device setting, not a build constant', () => {
  setBase('http://10.0.0.5:5000/it4788');
  expect(baseUrl()).toBe('http://10.0.0.5:5000/it4788');
  setBase('   ');
  expect(baseUrl()).toBe(DEFAULT_BASE);
});

jest.mock('socket.io-client', () => ({ io: (url: string, options: unknown) => ({ url, options }) }));

test('the socket handshake carries the token, and the url is the origin', async () => {
  const { socket } = await import('../src/realtime/socket');
  const connection = socket.connect('http://127.0.0.1:5000/it4788', { token: 't1' }) as unknown as {
    url: string;
    options: { auth: { token: string } };
  };
  expect(connection.url).toBe('http://127.0.0.1:5000');
  expect(connection.options.auth.token).toBe('t1');
});

// Device setting rule (D100): the address typed on the phone is kept for the next launch.
test('the device keeps the server address it was given (D100)', () => {
  const values: Record<string, string> = {};
  const db: QueueDb = {
    run(sql, params) {
      if (sql.startsWith('INSERT INTO settings')) values[String(params[0])] = String(params[1]);
    },
    all() {
      return [];
    },
    get(sql, params) {
      const key = String(params[0]);
      return values[key] === undefined ? null : { value: values[key] };
    },
  };
  initSettings(db);
  expect(readSetting(db, BASE_URL_KEY)).toBe(null);
  writeSetting(db, BASE_URL_KEY, 'http://192.168.1.10:5000/it4788');
  expect(readSetting(db, BASE_URL_KEY)).toBe('http://192.168.1.10:5000/it4788');
  writeSetting(db, BASE_URL_KEY, 'https://tulanh-api-mapotofu40-5000.ngrok.io/it4788');
  expect(readSetting(db, BASE_URL_KEY)).toBe('https://tulanh-api-mapotofu40-5000.ngrok.io/it4788');
});

// Renewal rule (D117): an expired access token gets one refresh and one retry; a refused
// refresh keeps the server's answer so the screens show the signed-out state.
test('the expired codes are the four that the table of codes calls session-expired', () => {
  expect(EXPIRED).toEqual(['00011', '00012', '00055', '00062']);
});

test('a call the server expired is renewed and sent once more (D117)', async () => {
  setBase('http://127.0.0.1:5000/it4788');
  const tokens: Array<string | null> = [];
  const original = global.fetch;
  global.fetch = (async (_url: unknown, init?: RequestInit) => {
    const header = (init?.headers as Record<string, string> || {}).authorization || '';
    tokens.push(header ? header.replace('Bearer ', '') : null);
    if (header === 'Bearer expired') {
      return { json: async () => ({ code: '00012', message: 'Token không hợp lệ. Token có thể đã hết hạn.', data: null }) };
    }
    return { json: async () => ({ code: '00089', message: 'Lấy thông tin tài khoản thành công.', data: { user: {} } }) };
  }) as unknown as typeof fetch;
  let renewals = 0;
  setRenewer(async () => {
    renewals += 1;
    return 'fresh';
  });
  const out = await request('/user/', { token: 'expired' });
  global.fetch = original;
  setRenewer(null);
  expect(out.code).toBe('00089');
  expect(renewals).toBe(1);
  expect(tokens).toEqual(['expired', 'fresh']);
});

test('a refresh the server refuses keeps the expired answer (D117)', async () => {
  const original = global.fetch;
  global.fetch = (async () => ({ json: async () => ({ code: '00012', message: 'Token không hợp lệ. Token có thể đã hết hạn.', data: null }) })) as unknown as typeof fetch;
  setRenewer(async () => null);
  const out = await request('/user/', { token: 'expired' });
  global.fetch = original;
  setRenewer(null);
  expect(out.code).toBe('00012');
});

test('an expired answer without a renewer, or without a token, is not retried (D117)', async () => {
  let fetches = 0;
  const original = global.fetch;
  global.fetch = (async () => {
    fetches += 1;
    return { json: async () => ({ code: '00062', message: 'Token đã hết hạn, vui lòng đăng nhập.', data: null }) };
  }) as unknown as typeof fetch;
  const withToken = await request('/user/', { token: 'expired' });
  const withoutToken = await request('/user/');
  global.fetch = original;
  expect(fetches).toBe(2);
  expect(withToken.code).toBe('00062');
  expect(withoutToken.code).toBe('00062');
});

test('the token store keeps the pair and still reads a legacy entry (D117)', async () => {
  let stored: string | false = false;
  const keychain = {
    getGenericPassword: async () => (stored ? { password: stored as string } : false),
    setGenericPassword: async (_user: string, password: string) => {
      stored = password;
    },
    resetGenericPassword: async () => {
      stored = false;
    },
  };
  const store = tokenStore(keychain);
  expect(await store.get()).toBe(null);
  await store.set('a1', 'r1');
  expect(await store.get()).toEqual({ access: 'a1', refresh: 'r1' });
  stored = 'legacy-access';
  expect(await store.get()).toEqual({ access: 'legacy-access', refresh: null });
  await store.clear();
  expect(await store.get()).toBe(null);
});
