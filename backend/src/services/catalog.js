// Catalog rule (D19): the name rules hold as unique indexes, so the check runs
// on insert as well as in the service, and a second insert returns the same code.
// Access rule (D41): every path under /admin/ is the system admin level, and the answer
// is the one admin-level message (00017). The reads the app needs to build a food form
// are the separate paths /food/category/ and /food/unit/, which any member of a group
// may read, so the two GET handlers are split: listCategoriesForAdmin and listCategories.
const { adminOnly, DENY_ADMIN } = require('./permission');

// A category or unit still referenced by a food cannot go: the spec blocks the delete,
// and the code the table gives for that block is the server-error row.
async function inUse(deps, repo, id) {
  return (await deps.repos.foods.findOne({ [repo]: id })) !== null;
}

async function createCategory(deps, ctx) {
  if (!adminOnly(ctx)) return { code: DENY_ADMIN };
  if (!ctx.input.name) return { code: '00131' };
  if (await deps.repos.categories.findOne({ name: ctx.input.name })) return { code: '00132' };
  const row = await deps.repos.categories.insertOne({ name: ctx.input.name, created_at: deps.now(), updated_at: deps.now() });
  return { code: '00135', data: { category: row } };
}

async function listCategories(deps) {
  return { code: '00129', data: { categories: await deps.repos.categories.find({}) } };
}

async function listCategoriesForAdmin(deps, ctx) {
  if (!adminOnly(ctx)) return { code: DENY_ADMIN };
  return listCategories(deps);
}

async function createUnit(deps, ctx) {
  if (!adminOnly(ctx)) return { code: DENY_ADMIN };
  const unitName = ctx.input.unitName || ctx.input.name;
  if (!unitName) return { code: '00112' };
  if (await deps.repos.units.findOne({ name: unitName })) return { code: '00113' };
  const row = await deps.repos.units.insertOne({ name: unitName, created_at: deps.now(), updated_at: deps.now() });
  return { code: '00116', data: { unit: row } };
}

async function listUnits(deps) {
  return { code: '00110', data: { units: await deps.repos.units.find({}) } };
}

async function listUnitsForAdmin(deps, ctx) {
  if (!adminOnly(ctx)) return { code: DENY_ADMIN };
  return listUnits(deps);
}

async function editCategory(deps, ctx) {
  if (!adminOnly(ctx)) return { code: DENY_ADMIN };
  if (!ctx.input.oldName || !ctx.input.newName) return { code: '00136' };
  if (ctx.input.oldName === ctx.input.newName) return { code: '00137' };
  const row = await deps.repos.categories.findOne({ name: ctx.input.oldName });
  if (!row) return { code: '00138' };
  if (await deps.repos.categories.findOne({ name: ctx.input.newName })) return { code: '00138x' };
  return { code: '00141', data: { category: await deps.repos.categories.updateOne({ _id: row._id }, { name: ctx.input.newName, updated_at: deps.now() }) } };
}

async function deleteCategory(deps, ctx) {
  if (!adminOnly(ctx)) return { code: DENY_ADMIN };
  if (!ctx.input.name) return { code: '00142' };
  const row = await deps.repos.categories.findOne({ name: ctx.input.name });
  if (!row) return { code: '00143' };
  if (await inUse(deps, 'category_id', row._id)) return { code: '00144' };
  await deps.repos.categories.deleteOne({ _id: row._id });
  return { code: '00146' };
}

async function editUnit(deps, ctx) {
  if (!adminOnly(ctx)) return { code: DENY_ADMIN };
  if (!ctx.input.oldName || !ctx.input.newName) return { code: '00117' };
  if (ctx.input.oldName === ctx.input.newName) return { code: '00118' };
  const row = await deps.repos.units.findOne({ name: ctx.input.oldName });
  if (!row) return { code: '00119' };
  return { code: '00122', data: { unit: await deps.repos.units.updateOne({ _id: row._id }, { name: ctx.input.newName, updated_at: deps.now() }) } };
}

async function deleteUnit(deps, ctx) {
  if (!adminOnly(ctx)) return { code: DENY_ADMIN };
  if (!ctx.input.unitName) return { code: '00123' };
  const row = await deps.repos.units.findOne({ name: ctx.input.unitName });
  if (!row) return { code: '00125' };
  if (await inUse(deps, 'unit_id', row._id)) return { code: '00126' };
  await deps.repos.units.deleteOne({ _id: row._id });
  return { code: '00128' };
}

module.exports = {
  createCategory, listCategories, listCategoriesForAdmin,
  createUnit, listUnits, listUnitsForAdmin,
  editCategory, deleteCategory, editUnit, deleteUnit,
};
