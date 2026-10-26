const { memoryStore } = require('../src/store/memory');
const { buildDeps } = require('../src/app');

const EMPTY = {
  users: [], groups: [], membership: [], categories: [], units: [], foods: [], fridge_lots: [],
  shopping_lists: [], shopping_tasks: [], meal_plans: [], recipes: [], ingredients: [],
  consumption_events: [], user_devices: [], refresh_tokens: [], verification_codes: [],
  notification_log: [], system_logs: [],
};

function seed(extra = {}) {
  const bcrypt = require('bcryptjs');
  const hash = bcrypt.hashSync('password1', 10);
  const rows = { ...EMPTY, ...extra };
  if (rows.users.length === 0) {
    rows.users = [
      { _id: 'u1', email: 'a@mail.com', password_hash: hash, name: 'An Nam', username: 'an', role: 'user', group_id: null, is_verified: true, timezone: 'Asia/Ho_Chi_Minh' },
      { _id: 'u2', email: 'b@mail.com', password_hash: hash, name: 'Binh Minh', username: 'binh', role: 'user', group_id: null, is_verified: false, timezone: 'Asia/Ho_Chi_Minh' },
    ];
  }
  const store = memoryStore(rows);
  return buildDeps(store, { now: () => new Date('2026-10-26T03:00:00Z') });
}

module.exports = { seed, EMPTY };
