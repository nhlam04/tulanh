const { config } = require('../config');
const { verify } = require('../util/token');
const { envelope } = require('../envelope');
const { duplicateCode } = require('../errors');

// Rate limit (D11): 60 per minute, window per IP. One entry per IP holds the window it counts,
// so a window that has closed is dropped when the next request for that IP arrives. Keying the
// Map by "ip:minute" kept an entry for every minute a busy IP had ever reached.
const hits = new Map(); // ip -> { minute, count }
function resetRateLimit() {
  hits.clear();
}

function rateLimit(req, res, next) {
  const minute = Math.floor(Date.now() / 60000);
  const window = hits.get(req.ip);
  if (!window || window.minute !== minute) {
    hits.set(req.ip, { minute, count: 1 });
    return next();
  }
  window.count += 1;
  if (window.count > config.rateLimitPerMinute) return res.status(429).json(envelope('00024'));
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
      return res.status(409).json(envelope(duplicateCode(error.collection, error.keyPattern)));
    }
    // The store builds an ObjectId only for a 24-character hex id, so an id the driver cannot
    // read comes from a value outside the store. Driver 7 names that error BSONError; the name
    // this branch used, MongoError, belongs to driver 3 and never appears here.
    if (error.name === 'BSONError') {
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
