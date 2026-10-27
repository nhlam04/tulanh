const { MongoClient, ObjectId } = require('mongodb');
const { config } = require('../config');

const HEX = /^[a-f\d]{24}$/i;

function asId(value) {
  if (value && typeof value === 'object') {
    if (Array.isArray(value)) return { $in: value.map(asId) };
    if (value.$in) return { $in: value.$in.map(asId) };
    if (value.$gte !== undefined || value.$lte !== undefined) {
      const out = { ...value };
      if (out.$gte !== undefined) out.$gte = asId(out.$gte);
      if (out.$lte !== undefined) out.$lte = asId(out.$lte);
      return out;
    }
    return value;
  }
  return HEX.test(String(value)) ? new ObjectId(value) : value;
}

function toFilter(filter) {
  const out = {};
  for (const [key, value] of Object.entries(filter)) out[key] = asId(value);
  return out;
}

// Fields that hold another row's id. A caller's device id, an Expo ticket and an idempotency
// request id are not row ids, so they are absent here and keep the string the caller sent.
const ID_KEYS = new Set([
  '_id', 'group_id', 'user_id', 'food_id', 'unit_id', 'category_id', 'recipe_id',
  'ingredient_id', 'lot_id', 'list_id', 'task_id', 'event_id', 'plan_id',
  'leader_id', 'created_by', 'updated_by', 'claimed_by',
]);

// Write rule that matches the read rule: a 24-character id string becomes an ObjectId on the
// way in too, so a row a service writes is found by the next query. Without this, a service
// writes group_id as a string and find({ group_id }) reads it back as an ObjectId and matches
// nothing. The fake store keeps plain strings, so this rule only shows on a real database.
function toDoc(doc) {
  const out = { ...doc };
  for (const [key, value] of Object.entries(out)) {
    if (ID_KEYS.has(key) && typeof value === 'string' && HEX.test(value)) out[key] = new ObjectId(value);
  }
  return out;
}

// One id shape for the services: every id reads as a string.
function asString(doc) {
  if (!doc) return null;
  const out = { ...doc };
  for (const [key, value] of Object.entries(out)) {
    if (value instanceof ObjectId) out[key] = String(value);
    else if (value && value.$numberDecimal) out[key] = Number(value.toString());
  }
  return out;
}

function buildStore(db, session = null) {
  function collection(name) {
    const col = db.collection(name);
    return {
      async findOne(filter) {
        return asString(await col.findOne(toFilter(filter), { session }));
      },
      async find(filter = {}, options = {}) {
        const cursor = col.find(toFilter(filter), { session });
        if (options.sort) cursor.sort(options.sort);
        return (await cursor.limit(options.limit || config.pageLimit).toArray()).map(asString);
      },
      async insertOne(doc) {
        const result = await col.insertOne(toDoc(doc), { session });
        return asString({ ...doc, _id: result.insertedId });
      },
      async updateOne(filter, patch) {
        const result = await col.updateOne(toFilter(filter), { $set: toDoc(patch) }, { session });
        if (result.modifiedCount === 0) return null;
        return asString(await col.findOne(toFilter(filter), { session }));
      },
      async deleteOne(filter) {
        const result = await col.deleteOne(toFilter(filter), { session });
        return result.deletedCount > 0;
      },
      async count(filter) {
        return col.countDocuments(toFilter(filter), { session });
      },
    };
  }
  return { collection, db, session };
}

async function connect(uri, options = {}) {
  const url = uri || process.env.MONGO_URI || 'mongodb://localhost:27017/?replicaSet=rs0&directConnection=true';
  const client = new MongoClient(url, options);
  await client.connect();
  const db = client.db(process.env.DB_NAME || config.dbName);
  return {
    client,
    db,
    ...buildStore(db),
    async transaction(fn) {
      const session = client.startSession();
      try {
        let result;
        await session.withTransaction(async () => {
          result = await fn(buildStore(db, session));
        });
        return result;
      } finally {
        await session.endSession();
      }
    },
  };
}

module.exports = { connect, buildStore };
