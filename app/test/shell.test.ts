// App shell scope (Minh): the offline rule, the queue guard, the socket handshake.
import { request, setBase, baseUrl, DEFAULT_BASE } from '../src/api/client';
import { init, queueOp, pendingOps, markSent, QueueDb } from '../src/offline/queue';
import { sendQueue } from '../src/offline/send';
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
