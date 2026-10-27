const express = require('express');
const { config } = require('./config');
const { envelope, message } = require('./envelope');
const { buildRouter } = require('./routes');
const { errorHandler } = require('./middleware/core');
const senders = require('./senders/push');
const mailer = require('./senders/mailer');

const COLLECTIONS = [
  'users', 'groups', 'categories', 'units', 'foods', 'fridge_lots',
  'shopping_lists', 'shopping_tasks', 'meal_plans', 'recipes', 'ingredients',
  'consumption_events', 'user_devices', 'refresh_tokens', 'verification_codes',
  'notification_log', 'system_logs',
];

// One bundle built at start, so a service takes its dependencies (D50).
function buildDeps(store, extra = {}) {
  const repos = {};
  for (const name of COLLECTIONS) repos[name] = store.collection(name);
  const deps = {
    repos,
    store,
    services: require('./services'),
    now: extra.now || (() => new Date()),
    message,
    sendEmail: extra.sendEmail || mailer.sendEmail,
    push: extra.push || senders.sendPush,
    receipts: extra.receipts || senders.checkReceipts,
    emit: extra.emit || (() => {}),
    pageLimit: config.pageLimit,
    logRetentionDays: config.logRetentionDays,
  };
  deps.nextError = errorHandler(deps);
  return deps;
}

function createApp(deps) {
  const app = express();
  app.use(express.json());
  app.use(config.basePath, buildRouter(deps));
  return app;
}

module.exports = { createApp, buildDeps, COLLECTIONS };
