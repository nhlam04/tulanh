// Queue handle (Minh, app shell): expo-sqlite is the storage behind the queue rule in
// queue.ts. The rule asks for three calls, so the adapter stays three lines wide and a test
// still passes its own fake instead of a database.
import * as SQLite from 'expo-sqlite';
import type { QueueDb } from './queue';

export function openQueueDb(name = 'tulanh.db'): QueueDb {
  const db = SQLite.openDatabaseSync(name);
  return {
    // The schema is several statements at once, which is what execSync is for; a statement
    // with values goes through runSync.
    run(sql, params) {
      if (!params.length) db.execSync(sql);
      else db.runSync(sql, params as SQLite.SQLiteBindParams);
    },
    all(sql, params) {
      return db.getAllSync<Record<string, unknown>>(sql, params as SQLite.SQLiteBindParams);
    },
    get(sql, params) {
      return db.getFirstSync<Record<string, unknown>>(sql, params as SQLite.SQLiteBindParams);
    },
  };
}
