// Duplicate rule (D19): the answer names the row that clashed. The store knows which collection
// it wrote to, so the error carries the collection and the index key, and the code comes from
// that pair. Reading the code out of the words of the driver error is what made every clash
// answer with the food message, even a username clash.
// The pair is listed for each unique index in src/store/indexes.js that the code table names.
// A unique index the table has no row for answers with the fallback row.
const DUPLICATE_CODE = {
  'users.email': '00032',
  'users.username': '00084',
  'categories.name': '00132',
  'units.name': '00113',
  'foods.group_id_name': '00151',
  'shopping_tasks.list_id_food_id': '00309',
  'consumption_events.request_id': '00387',
};

function duplicateCode(collection, keyPattern) {
  return DUPLICATE_CODE[`${collection}.${Object.keys(keyPattern || {}).join('_')}`] || '00114';
}

// The shape the store hands back for a clash, so a service test can build the same error.
function duplicateError(collection, keyPattern, keyValue = {}) {
  const error = new Error(`duplicate key on ${collection}`);
  error.code = 11000;
  error.name = 'MongoServerError';
  error.collection = collection;
  error.keyPattern = keyPattern;
  error.keyValue = keyValue;
  return error;
}

module.exports = { duplicateCode, duplicateError, DUPLICATE_CODE };
