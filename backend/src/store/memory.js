const crypto = require('node:crypto');

function asDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date(0) : date;
}

function matches(doc, filter) {
  if (filter.$text) {
    const words = String(filter.$text.$search || '').toLowerCase().split(/\s+/).filter(Boolean);
    const text = Object.values(doc).filter((v) => typeof v === 'string').join(' ').toLowerCase();
    return words.every((word) => text.split(/\W+/).includes(word));
  }
  return Object.entries(filter).every(([key, want]) => {
    if (key === '$text') return true;
    const got = doc[key];
    if (want && typeof want === 'object' && !Array.isArray(want)) {
      if (want.$in) return want.$in.map(String).includes(String(got));
      if (want.$gte !== undefined) return asDate(got) <= asDate(want.$gte);
      if (want.$lte !== undefined) return asDate(got) <= asDate(want.$lte);
    }
    return String(got) === String(want);
  });
}

// Fake store for service tests. Same shape as the Mongo store, so a service
// cannot tell which one it got. Rollback on error keeps the transaction rule.
function memoryStore(seed = {}) {
  const data = {};
  for (const [name, rows] of Object.entries(seed)) {
    data[name] = rows.map((row) => ({ ...row }));
  }

  function collection(name) {
    data[name] ||= [];
    const rows = data[name];
    return {
      findOne(filter) {
        return Promise.resolve(rows.find((row) => matches(row, filter)) || null);
      },
      find(filter = {}, options = {}) {
        let hit = rows.filter((row) => matches(row, filter));
        if (options.sort) {
          const key = Object.keys(options.sort)[0];
          hit = hit.slice().sort((a, b) => (String(a[key]) < String(b[key]) ? -1 : 1));
        }
        return Promise.resolve(hit.slice(0, options.limit || 100).map((row) => ({ ...row })));
      },
      insertOne(doc) {
        const row = { _id: doc._id || crypto.randomUUID(), ...doc };
        rows.push(row);
        return Promise.resolve({ ...row });
      },
      updateOne(filter, patch) {
        const row = rows.find((r) => matches(r, filter));
        if (!row) return Promise.resolve(null);
        Object.assign(row, patch);
        return Promise.resolve({ ...row });
      },
      deleteOne(filter) {
        const index = rows.findIndex((r) => matches(r, filter));
        if (index < 0) return Promise.resolve(false);
        rows.splice(index, 1);
        return Promise.resolve(true);
      },
      count(filter) {
        return Promise.resolve(rows.filter((row) => matches(row, filter)).length);
      },
    };
  }

  return {
    collection,
    async transaction(fn) {
      const snapshot = JSON.parse(JSON.stringify(data));
      try {
        return await fn({ collection });
      } catch (error) {
        for (const [name, rows] of Object.entries(snapshot)) data[name] = rows;
        throw error;
      }
    },
  };
}

module.exports = { memoryStore, matches };
