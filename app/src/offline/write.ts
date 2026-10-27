// Write rule (Minh, app shell): a write goes to the server when the device can reach it and
// to the queue when it cannot. The request id travels with the op, so the server applies the
// op once even when the queue is replayed twice.
import { request } from '../api/client';
import { queueOp } from './queue';
import type { Session } from '../session';

export type OpType = 'consumption' | 'task_add' | 'task_bought';

export function newRequestId(): string {
  return `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

export async function writeOrQueue(
  session: Session,
  path: string,
  body: Record<string, unknown>,
  op: { type: OpType; payload: Record<string, unknown> },
) {
  const requestId = String(op.payload.requestId || newRequestId());
  const payload = { ...op.payload, requestId };

  const queue = () => queueOp(session.db, {
    id: requestId, type: op.type, requestId, payload, sentAt: null,
  });

  if (session.offline) {
    queue();
    return { code: '00008', message: 'queued', data: null, status: 0, queued: true };
  }

  const out = await request(path, { method: 'post', body: { ...body, requestId }, token: session.token });
  // status 0 means the server was not reached, so the op is still owed.
  if (out.status === 0) {
    queue();
    return { ...out, queued: true };
  }
  return out;
}
