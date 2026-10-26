const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const { config } = require('../config');

// Access token: HMAC over the payload. No package, no dependency to pin.
function sign(payload, ttlSec) {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + ttlSec })).toString('base64url');
  const sig = crypto.createHmac('sha256', config.jwtSecret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function verify(token) {
  if (!token || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  const want = crypto.createHmac('sha256', config.jwtSecret).update(body).digest('base64url');
  if (sig !== want) return null;
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  if (payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

function hashPassword(value) {
  return bcrypt.hashSync(value, config.bcryptWorkFactor);
}

function checkPassword(value, hash) {
  return bcrypt.compareSync(value, hash);
}

// A token is hashed for storage, so a plain token string never sits in the database.
function hashToken(value) {
  return crypto.createHmac('sha256', config.jwtSecret).update(String(value)).digest('hex');
}

module.exports = { sign, verify, hashPassword, checkPassword, hashToken };
