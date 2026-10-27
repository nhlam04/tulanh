// Device setting rule (Minh, app shell): a value the person typed on the device survives a
// restart. The server address is the one that matters (D100) — the route to a phone is a
// tunnel whose address changes every run, so typing it again on each launch is the work this
// module removes. It sits in the same local database as the write queue, so one handle covers
// both and a test can still pass its own fake.
import type { QueueDb } from './offline/queue';

export const BASE_URL_KEY = 'base_url';

export function initSettings(db: QueueDb): void {
  db.run('CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);', []);
}

export function readSetting(db: QueueDb, key: string): string | null {
  const row = db.get('SELECT value FROM settings WHERE key = ?;', [key]);
  const value = row ? String(row.value ?? '') : '';
  return value ? value : null;
}

export function writeSetting(db: QueueDb, key: string, value: string): void {
  db.run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value;', [key, value]);
}
