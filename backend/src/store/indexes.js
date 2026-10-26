// Index rules in one file, so the code matches the index table in the report.
// Unique indexes hold the name rules that the response codes check (D19).
const indexes = {
  users: [{ keys: { email: 1 }, unique: true }, { keys: { username: 1 }, unique: true }],
  groups: [{ keys: { leader_id: 1 } }],
  membership: [{ keys: { group_id: 1, user_id: 1 }, unique: true }],
  categories: [{ keys: { name: 1 }, unique: true }],
  units: [{ keys: { name: 1 }, unique: true }],
  foods: [{ keys: { group_id: 1, name: 1 }, unique: true }, { keys: { name: 1 }, type: 'text' }],
  fridge_lots: [{ keys: { group_id: 1, use_until: 1 } }, { keys: { group_id: 1, food_id: 1 } }],
  shopping_lists: [{ keys: { group_id: 1, target_date: 1 } }],
  shopping_tasks: [{ keys: { list_id: 1, food_id: 1 }, unique: true }, { keys: { list_id: 1 } }],
  meal_plans: [{ keys: { group_id: 1, plan_date: 1 } }],
  recipes: [{ keys: { group_id: 1, name: 1 } }],
  ingredients: [{ keys: { recipe_id: 1, food_id: 1 }, unique: true }],
  consumption_events: [{ keys: { group_id: 1, logged_at: 1 } }, { keys: { request_id: 1 }, unique: true, sparse: true }],
  user_devices: [{ keys: { user_id: 1, device_id: 1 }, unique: true }],
  refresh_tokens: [{ keys: { token_hash: 1 }, unique: true }],
  verification_codes: [{ keys: { user_id: 1, expires_at: 1 } }],
  notification_log: [{ keys: { lot_id: 1, user_id: 1, sent_date: 1 }, unique: true }],
  system_logs: [{ keys: { created_at: 1, level: 1 } }],
};

async function createIndexes(db) {
  for (const [name, list] of Object.entries(indexes)) {
    for (const spec of list) {
      await db.collection(name).createIndex(spec.keys, {
        unique: spec.unique,
        sparse: spec.sparse,
        background: true,
      });
    }
  }
}

module.exports = { indexes, createIndexes };
