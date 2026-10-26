const { config } = require('../config');
const { verify } = require('../util/token');
const { envelope } = require('../envelope');

// Rate limit (D11): 60 per minute, window per IP.
const hits = new Map();
function resetRateLimit() {
  hits.clear();
}

function rateLimit(req, res, next) {
  const minute = Math.floor(Date.now() / 60000);
  const key = `${req.ip}:${minute}`;
  hits.set(key, (hits.get(key) || 0) + 1);
  if (hits.get(key) > config.rateLimitPerMinute) return res.status(429).json(envelope('00024'));
  next();
}

function authenticate(req, res, next) {
  const raw = String(req.headers.authorization || '');
  const token = raw.startsWith('Bearer ') ? raw.slice(7) : '';
  if (!token) return res.status(401).json(envelope('00006'));
  const payload = verify(token);
  if (!payload) return res.status(401).json(envelope('00012'));
  req.ctx = { userId: payload.sub, role: payload.role || 'user', groupId: null };
  next();
}

// System actor (D64): the report needs an actor block for the cron read and write.
function attachGroup(deps) {
  return async function attachGroup(req, res, next) {
    if (!req.ctx) return next();
    const user = await deps.repos.users.findOne({ _id: req.ctx.userId });
    if (user) req.ctx.groupId = user.group_id;
    if (user && user.role) req.ctx.role = user.role;
    next();
  };
}

function errorHandler(deps) {
  return function errorHandler(error, req, res, next) {
    if (error.code === 11000) {
      const code = String(error.message).includes('request_id') ? '00387' : '00151';
      return res.status(409).json(envelope(code));
    }
    if (error.name === 'MongoError' || String(error.message).includes('ObjectId')) {
      return res.status(400).json(envelope('00023'));
    }
    if (!req.resSent) {
      deps.repos.system_logs.insertOne({
        user_id: req.ctx && req.ctx.userId,
        group_id: req.ctx && req.ctx.groupId,
        route: req.path,
        code: '00008',
        level: 'error',
        message: error.message,
        ip: req.ip,
        created_at: new Date(),
      }).catch(() => {});
    }
    res.status(500).json(envelope('00008'));
  };
}

module.exports = { rateLimit, authenticate, attachGroup, errorHandler, resetRateLimit };
