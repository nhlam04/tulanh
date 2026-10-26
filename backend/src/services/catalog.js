// Catalog rule (D19): the name rules hold as unique indexes, so the check runs
// on insert as well as in the service, and a second insert returns the same code.
async function createCategory(deps, ctx) {
  if (!ctx.input.name) return { code: '00131' };
  if (await deps.repos.categories.findOne({ name: ctx.input.name })) return { code: '00132' };
  const row = await deps.repos.categories.insertOne({ name: ctx.input.name, created_at: deps.now(), updated_at: deps.now() });
  return { code: '00135', data: { category: row } };
}

async function listCategories(deps) {
  return { code: '00129', data: { categories: await deps.repos.categories.find({}) } };
}

async function createUnit(deps, ctx) {
  if (!ctx.input.name) return { code: '00112' };
  if (await deps.repos.units.findOne({ name: ctx.input.name })) return { code: '00113' };
  const row = await deps.repos.units.insertOne({ name: ctx.input.name, created_at: deps.now(), updated_at: deps.now() });
  return { code: '00116', data: { unit: row } };
}

async function listUnits(deps) {
  return { code: '00110', data: { units: await deps.repos.units.find({}) } };
}

module.exports = { createCategory, listCategories, createUnit, listUnits };
