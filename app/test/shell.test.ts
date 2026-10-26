// App shell scope (Minh): the offline rule and the queue guard.
import { request } from '../src/api/client';
import { init, queueOp, pendingOps, markSent, QueueDb } from '../src/offline/queue';
import { sendQueue } from '../src/offline/send';

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
