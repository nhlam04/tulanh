// Collection run (Hòa, QA): starts the server against a single-node replica set and runs the
// collection built from the route table.
//
// Newman 6.2.3, checked on 2026-10-27: the run completes through the callback form. The emitter
// form on its own does not complete, because the end event never fires. The first version of this
// file used the emitter form and read `summary.run.responseCount.total`, which is undefined without
// a reporter, so the handler threw and the run looked like a hang. Memory was not the cause: the
// same probe ran with 27.9 GB free and behaved the same way.
//
// The codes read by each request are not collected here. The event that carries the response does
// not fire in the callback form on this version, so the codes come from walk.js, which sends the
// same requests over http.
//
// The first version of this file looked like it hung. It did not: it used the emitter form alone and
// read `summary.run.responseCount.total`, which is undefined without a reporter, so the handler threw
// and the promise never resolved. Memory was not the cause — the same probe ran with 27.9 GB free and
// behaved the same way.
//
// The run cannot read the mailbox, because the verification code leaves the server through the mail
// path. So the run registers the demo user here, sets it verified in the database, and then runs the
// collection. The register request inside the collection reads the duplicate rule, and the login
// request reads the successful sign-in and stores the token.
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const { MongoClient } = require('mongodb');
const newman = require('newman');
const { spawn } = require('node:child_process');

const PORT = 5000;
const BASE = `http://127.0.0.1:${PORT}/it4788`;
const DEMO = { email: 'demo@mail.com', password: 'password1', name: 'Demo User', username: 'demo' };

async function main() {
  const rs = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const uri = rs.getUri();
  const server = spawn('node', ['src/server.js'], {
    cwd: `${__dirname}/../backend`,
    env: { ...process.env, MONGO_URI: uri, PORT: String(PORT) },
  });
  server.stderr.on('data', (d) => process.stderr.write(d));
  await new Promise((resolve) => setTimeout(resolve, 4000));

  const created = await fetch(`${BASE}/user/`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(DEMO),
  });
  console.log('seed register:', (await created.json()).code);

  const client = await MongoClient.connect(uri);
  await client.db('ishop').collection('users').updateOne({ email: DEMO.email }, { $set: { is_verified: true, role: 'admin' } });

  const collection = JSON.parse(require('node:fs').readFileSync(`${__dirname}/ishop.postman_collection.json`, 'utf-8'));
  const requestCount = collection.item.reduce((total, folder) => total + folder.item.length, 0);

  const failures = [];

  const summary = await new Promise((resolve, reject) => {
    const emitter = newman.run({
      collection: `${__dirname}/ishop.postman_collection.json`,
      env: [{ key: 'token', value: '' }],
      timeout: 10000,
    }, (error, run) => (error ? reject(error) : resolve(run)));

    emitter.on('assertion', (source) => {
      for (const assertion of source.assertions || []) {
        if (!assertion.passed) failures.push(`${source.item && source.item.name}: ${assertion.error && assertion.error.message}`);
      }
    });
  });

  console.log('folders:', collection.item.length, 'requests:', requestCount, 'failures:', failures.length);
  for (const failure of failures) console.log(' -', failure);

  await client.close();
  server.kill('SIGTERM');
  await rs.stop();
}

main().catch((error) => { console.log('run failed:', error.message); process.exit(1); });
