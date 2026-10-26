const http = require('node:http');
const { config } = require('./config');
const { connect } = require('./store/mongo');
const { createIndexes } = require('./store/indexes');
const { createApp, buildDeps } = require('./app');
const { startScheduler } = require('./jobs/runner');
const { attachSocket } = require('./realtime/socket');

async function main() {
  const store = await connect();
  await createIndexes(store.db);
  const deps = buildDeps(store);
  const app = createApp(deps);
  const server = http.createServer(app);
  attachSocket(server, deps);
  server.listen(config.port, () => console.log(`api listening on ${config.port}${config.basePath}`));
  const timer = startScheduler(deps);
  const stop = async () => {
    clearInterval(timer);
    await store.client.close();
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

if (require.main === module) main().catch((error) => { console.error(error); process.exit(1); });
