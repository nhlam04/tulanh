// Send rule (Minh, app shell): on reconnect the client posts its queue to /sync.
// request_id stays with each op, so the server applies each one once.
import { request } from '../api/client';
import { pendingOps, markSent, QueueDb, QueuedOp } from '../offline/queue';

// Codes that mean the send never reached the rule, so the ops are still owed.
const NOT_APPLIED = ['00006', '00012', '00024', '00008'];

// The code each op type answers with when its rule ran. A queued op that comes back with
// anything else — a denied write, a row that is gone — stays in the queue: counting a write
// the server refused as sent would throw away what the person asked for (rule 5).
const APPLIED: Record<string, string[]> = {
  consumption: ['00387'],
  task_add: ['00287'],
  task_bought: ['00390'],
};

export async function sendQueue(db: QueueDb, token: string | null, at: string) {
  const ops: QueuedOp[] = pendingOps(db);
  if (!ops.length) return { sent: 0, results: [], failed: [] };
  if (!token) return { sent: 0, results: [], failed: [] };

  const response = await request('/sync/', { method: 'post', body: { ops }, token });
  // Nothing was applied: keep the queue and try again on the next reconnect. The request ids
  // do not change, so a retry cannot land a second row.
  if (response.status === 0 || NOT_APPLIED.includes(response.code)) return { sent: 0, results: [], failed: [] };

  const results = (response.data as { applied: { code: string; message?: string }[] })?.applied || [];
  const done = ops.filter((_, index) => results[index] && (APPLIED[ops[index].type] || []).includes(results[index].code));
  const failed = ops
    .map((op, index) => ({ op, result: results[index] }))
    .filter((row) => row.result && !done.includes(row.op))
    .map((row) => ({ code: String(row.result?.code), message: row.result?.message || '' }));
  markSent(db, done.map((op) => op.requestId), at);
  return { sent: done.length, results, failed };
}
