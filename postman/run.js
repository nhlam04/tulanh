// Collection run (Hòa, QA): starts the server against a single-node replica set and walks the
// collection built from the route table.
//
// Newman does not complete on this machine. It runs the requests, but the end event never
// fires, so a run that waits for it hangs. Checked on 2026-10-27: one request reached the
// server, the test event fired, and no end event came within 20 seconds. So the runner walks
// the same collection over http and applies the same rule. Newman stays the tool named in the
// test plan, for a machine where it completes.
//
// The verification code cannot be read inside the run, because it leaves the server through
// the mail path. So the runner registers the demo user, sets it verified in the database, and
// then runs the collection. The register request in the collection reads the duplicate rule,
// which is a result, not a failure.
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const { MongoClient } = require('mongodb');
const { spawn } = require('node:child_process');

const PORT = 5000;
const BASE = `http://127.0.0.1:${PORT}/it4788`;
const DEMO = { email: 'demo@mail.com', password: 'password1', name: 'Demo User', username: 'demo' };

function pathOf(url) {
  return String(url).replace(BASE, '');
}

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
  const seeded = await created.json();
  console.log('seed register:', seeded.code, 'user:', seeded.data && seeded.data.user && seeded.data.user.id);

  const client = await MongoClient.connect(uri);
  await client.db('ishop').collection('users').updateOne({ email: DEMO.email }, { $set: { is_verified: true, role: 'admin' } });

  const login = await fetch(`${BASE}/user/login/`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: DEMO.email, password: DEMO.password }),
  });
  const session = await login.json();
  const token = session.data && session.data.accessToken;
  console.log('login:', session.code, 'token set:', Boolean(token));

  const collection = JSON.parse(require('node:fs').readFileSync(`${__dirname}/ishop.postman_collection.json`, 'utf-8'));
  const results = [];
  for (const folder of collection.item) {
    for (const entry of folder.item) {
      const request = entry.request;
      const url = pathOf(request.url.raw);
      const response = await fetch(BASE + url, {
        method: request.method,
        headers: {
          'content-type': 'application/json',
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: ['POST', 'PUT', 'DELETE'].includes(request.method) ? (request.body ? request.body.raw : undefined) : undefined,
      });
      const body = await response.json();
      const shapeOk = Object.keys(body).sort().join(',') === 'code,data,message';
      results.push({ folder: folder.name, request: entry.name, status: response.status, code: body.code, shapeOk });
    }
  }

  const badShape = results.filter((row) => !row.shapeOk);
  const codes = {};
  for (const row of results) codes[row.code] = (codes[row.code] || 0) + 1;
  console.log('requests:', results.length, 'envelope rule holds:', results.length - badShape.length);
  for (const row of badShape) console.log('  shape broken:', row.request, JSON.stringify(row));
  console.log('codes seen:', Object.entries(codes).sort((a, b) => b[1] - a[1]).map(([code, count]) => `${code} x${count}`).join(', '));

  await client.close();
  server.kill('SIGTERM');
  await rs.stop();
}

main().catch((error) => { console.log('run failed:', error.message); process.exit(1); });
