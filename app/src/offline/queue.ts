// Offline rule (D38): read cache plus the write queue. The queue keeps request_id,
// which is the guard the server uses, so a replay cannot create a second lot.
// The handle is an interface, so a test can pass a fake instead of expo-sqlite.
export type QueueDb = {
  run(sql: string, params: unknown[]): void;
  all(sql: string, params: unknown[]): Record<string, unknown>[];
  get(sql: string, params: unknown[]): Record<string, unknown> | null;
};

export type QueuedOp = {
  id: string;
  type: 'consumption' | 'task_add' | 'task_bought';
  requestId: string;
  payload: Record<string, unknown>;
  sentAt: string | null;
};

const SCHEMA = `
CREATE TABLE IF NOT EXISTS write_queue (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  request_id TEXT NOT NULL UNIQUE,
  payload TEXT NOT NULL,
  sent_at TEXT
);
CREATE TABLE IF NOT EXISTS read_cache (
  path TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  cached_at TEXT NOT NULL
);
`;

export function init(db: QueueDb) {
  db.run(SCHEMA, []);
}

export function queueOp(db: QueueDb, op: QueuedOp) {
  db.run('INSERT OR IGNORE INTO write_queue (id, type, request_id, payload, sent_at) VALUES (?, ?, ?, ?, ?)', [
    op.id, op.type, op.requestId, JSON.stringify(op.payload), op.sentAt,
  ]);
  return op;
}

export function pendingOps(db: QueueDb): QueuedOp[] {
  return db.all('SELECT id, type, request_id, payload, sent_at FROM write_queue WHERE sent_at IS NULL ORDER BY id', []).map((row) => ({
    id: String(row.id),
    type: String(row.type) as QueuedOp['type'],
    requestId: String(row.request_id),
    payload: JSON.parse(String(row.payload)),
    sentAt: row.sent_at ? String(row.sent_at) : null,
  }));
}

export function markSent(db: QueueDb, requestIds: string[], at: string) {
  for (const requestId of requestIds) db.run('UPDATE write_queue SET sent_at = ? WHERE request_id = ?', [at, requestId]);
}

export function cacheRead(db: QueueDb, path: string, payload: unknown, at: string) {
  db.run('INSERT OR REPLACE INTO read_cache (path, payload, cached_at) VALUES (?, ?, ?)', [path, JSON.stringify(payload), at]);
}

export function readCache(db: QueueDb, path: string) {
  const row = db.get('SELECT payload FROM read_cache WHERE path = ?', [path]);
  return row ? JSON.parse(String(row.payload)) : null;
}
