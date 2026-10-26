const { config } = require('../config');
const { sign, verify, hashPassword, checkPassword, hashToken } = require('../util/token');
const rules = require('../rules');

// Auth rule (D25): one state for activation and verification. Business routes
// read `is_verified`; login keeps its own gate, so the two codes stay apart.
async function register(deps, ctx) {
  const input = ctx.input;
  const shape = rules.registerShape(input);
  if (shape.code) return shape;
  const users = deps.repos.users;
  if (await users.findOne({ email: input.email })) return { code: '00032' };
  const user = await users.insertOne({
    email: input.email,
    password_hash: hashPassword(input.password),
    name: input.name,
    username: input.username || input.email.split('@')[0],
    language: input.language || 'vi',
    timezone: input.timezone || 'Asia/Ho_Chi_Minh',
    role: 'user',
    is_verified: false,
    group_id: null,
    created_at: deps.now(),
  });
  if (input.deviceId) {
    await deps.repos.user_devices.insertOne({
      user_id: user._id,
      device_id: input.deviceId,
      platform: input.platform || 'android',
      push_token: input.pushToken || null,
      last_seen_at: deps.now(),
    });
  }
  return { code: '00035', data: { user: publicUser(user) } };
}

async function sendCode(deps, ctx) {
  const input = ctx.input;
  if (!input.email) return { code: '00005' };
  const user = await deps.repos.users.findOne({ email: input.email });
  if (!user) return { code: '00036' };
  const code = String(Math.floor(100000 + Math.random() * 900000));
  await deps.repos.verification_codes.insertOne({
    user_id: user._id,
    code,
    expires_at: new Date(Date.now() + config.codeTtlMs),
    used_at: null,
  });
  // Delivery is the provider's job. The code and the receiver go out; nothing else.
  if (deps.sendEmail) await deps.sendEmail(user.email, code);
  return { code: '00048', data: { email: user.email } };
}

async function verifyCode(deps, ctx) {
  const input = ctx.input;
  if (!input.code) return { code: '00053' };
  const row = await deps.repos.verification_codes.findOne({ user_id: input.userId, code: input.code, used_at: null });
  if (!row) return { code: '00054' };
  if (row.expires_at && new Date(row.expires_at) < deps.now()) return { code: '00062' };
  await deps.repos.verification_codes.updateOne({ _id: row._id }, { used_at: deps.now() });
  const user = await deps.repos.users.updateOne({ _id: input.userId }, { is_verified: true });
  if (!user) return { code: '00009' };
  return { code: '00058', data: { user: publicUser(user) } };
}

async function login(deps, ctx) {
  const input = ctx.input;
  const shape = rules.loginShape(input);
  if (shape.code) return shape;
  const user = await deps.repos.users.findOne({ email: input.email });
  if (!user) return { code: '00042' };
  if (!user.is_verified) return { code: '00044' };
  if (!checkPassword(input.password, user.password_hash)) return { code: '00045' };
  const access = sign({ sub: user._id, role: user.role }, config.accessTtlSec);
  const refresh = cryptoRandom();
  await deps.repos.refresh_tokens.insertOne({
    user_id: user._id,
    token_hash: hashToken(refresh),
    expires_at: new Date(Date.now() + config.refreshTtlSec * 1000),
    created_at: deps.now(),
  });
  return { code: '00047', data: { accessToken: access, refreshToken: refresh } };
}

async function refresh(deps, ctx) {
  const input = ctx.input;
  if (!input.refreshToken) return { code: '00059' };
  const row = await deps.repos.refresh_tokens.findOne({ token_hash: hashToken(input.refreshToken) });
  if (!row) return { code: '00061' };
  if (new Date(row.expires_at) < deps.now()) return { code: '00062' };
  await deps.repos.refresh_tokens.deleteOne({ _id: row._id });
  const next = cryptoRandom();
  await deps.repos.refresh_tokens.insertOne({
    user_id: row.user_id,
    token_hash: hashToken(next),
    expires_at: new Date(Date.now() + config.refreshTtlSec * 1000),
    created_at: deps.now(),
  });
  const access = sign({ sub: row.user_id }, config.accessTtlSec);
  return { code: '00065', data: { accessToken: access, refreshToken: next } };
}

async function logout(deps, ctx) {
  await deps.repos.refresh_tokens.deleteOne({ token_hash: hashToken(ctx.refreshToken) });
  return { code: '00050' };
}

function publicUser(user) {
  return {
    id: user._id,
    email: user.email,
    username: user.username,
    name: user.name,
    language: user.language,
    timezone: user.timezone,
    role: user.role,
    group_id: user.group_id,
  };
}

function cryptoRandom() {
  return require('node:crypto').randomBytes(24).toString('hex');
}

module.exports = { register, sendCode, verifyCode, login, refresh, logout, publicUser };
