// Seed rule (D60): the admin paths need a system admin before anything can be written, and
// login refuses an account that is not verified, so the seed writes both flags itself and
// never opens a route for them. Categories and units are one list for the whole system, so
// a name already present is left alone and the script can run twice.
// Run: npm run seed   (reads backend/.env, same database as npm start)
const { config } = require('../src/config');
const { hashPassword } = require('../src/util/token');
const { connect } = require('../src/store/mongo');
const { buildDeps } = require('../src/app');

const CATEGORIES = ['Rau', 'Hoa quả', 'Thịt', 'Cá', 'Đồ khô'];
const UNITS = ['kg', 'gam', 'lít', 'quả', 'miếng'];

async function seed(store) {
  const deps = buildDeps(store);
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error('SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set. The seed does not invent a password.');
  }

  const users = deps.repos.users;
  let admin = await users.findOne({ email });
  if (!admin) {
    admin = await users.insertOne({
      email,
      password_hash: hashPassword(password),
      name: 'Quản trị',
      username: email.split('@')[0],
      language: 'vi',
      timezone: 'Asia/Ho_Chi_Minh',
      role: 'admin',
      is_verified: true,
      group_id: null,
      created_at: deps.now(),
    });
  } else if (admin.role !== 'admin' || !admin.is_verified) {
    admin = await users.updateOne({ _id: admin._id }, { role: 'admin', is_verified: true });
  }

  const ctx = { userId: String(admin._id), role: 'admin', groupId: null, input: {} };
  const made = { categories: [], units: [] };

  for (const name of CATEGORIES) {
    if (await deps.repos.categories.findOne({ name })) continue;
    const out = await deps.services.catalog.createCategory(deps, { ...ctx, input: { name } });
    made.categories.push(`${name} ${out.code}`);
  }
  for (const unitName of UNITS) {
    if (await deps.repos.units.findOne({ name: unitName })) continue;
    const out = await deps.services.catalog.createUnit(deps, { ...ctx, input: { unitName } });
    made.units.push(`${unitName} ${out.code}`);
  }

  return { admin: { id: String(admin._id), email: admin.email, role: admin.role }, made };
}

async function main() {
  const store = await connect(config.mongoUri);
  const result = await seed(store);
  console.log(JSON.stringify(result, null, 2));
  await store.client.close();
}

if (require.main === module) {
  main().catch((error) => {
    console.error(String(error && error.message));
    process.exitCode = 1;
  });
}

module.exports = { seed };
