// Send rule (Minh, app shell): on reconnect the client posts its queue to /sync.
// request_id stays with each op, so the server applies each one once.
import { request } from '../api/client';
import { pendingOps, markSent, QueueDb, QueuedOp } from '../offline/queue';

// Codes that mean the send never reached the rule, so the ops are still owed.
const NOT_APPLIED = ['00006', '00012', '00024', '00008'];

export async function sendQueue(db: QueueDb, token: string | null, at: string) {
  const ops: QueuedOp[] = pendingOps(db);
  if (!ops.length) return { sent: 0, results: [] };
  if (!token) return { sent: 0, results: [] };

  const response = await request('/sync/', { method: 'post', body: { ops }, token });
  // Nothing was applied: keep the queue and try again on the next reconnect. The request ids
  // do not change, so a retry cannot land a second row.
  if (response.status === 0 || NOT_APPLIED.includes(response.code)) return { sent: 0, results: [] };

  const results = (response.data as { applied: { code: string }[] })?.applied || [];
  const applied = ops.filter((_, index) => results[index] && results[index].code !== '00008');
  markSent(db, applied.map((op) => op.requestId), at);
  return { sent: applied.length, results };
}
