// Send rule (Minh, app shell): on reconnect the client posts its queue to /sync.
// request_id stays with each op, so the server applies each one once.
import { request } from '../api/client';
import { pendingOps, markSent, QueueDb, QueuedOp } from '../offline/queue';

export async function sendQueue(db: QueueDb, token: string | null, at: string) {
  const ops: QueuedOp[] = pendingOps(db);
  if (!ops.length) return { sent: 0, results: [] };
  const response = await request('/sync', { method: 'post', body: { ops }, token });
  const results = (response.data as { applied: { code: string }[] })?.applied || [];
  const applied = ops.filter((_, index) => results[index] && results[index].code !== '00008');
  markSent(db, applied.map((op) => op.requestId), at);
  return { sent: applied.length, results };
}
