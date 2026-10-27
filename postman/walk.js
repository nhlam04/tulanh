// Request walk (Hòa, QA): sends the same requests as the collection over plain http, so the codes
// read by each request can be collected. Newman's callback form does not carry the response through
// an event on this version, so the code list cannot be read from the newman run. This walk does not
// replace the collection; it reports what the collection reads on this machine.
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const { MongoClient } = require('mongodb');
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
      const response = await fetch(request.url, {
        method: request.method,
        headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
        body: ['POST', 'PUT', 'DELETE'].includes(request.method) && request.body ? request.body.raw : undefined,
      });
      const body = await response.json();
      results.push({ folder: folder.name, request: entry.name, status: response.status, code: body.code, shapeOk: Object.keys(body).sort().join(',') === 'code,data,message' });
    }
  }

  const codes = {};
  for (const row of results) codes[row.code] = (codes[row.code] || 0) + 1;
  console.log('requests:', results.length, 'envelope rule holds:', results.filter((row) => row.shapeOk).length);
  console.log('codes seen:', Object.entries(codes).sort((a, b) => b[1] - a[1]).map(([code, count]) => `${code} x${count}`).join(', '));

  await client.close();
  server.kill('SIGTERM');
  await rs.stop();
}

main().catch((error) => { console.log('walk failed:', error.message); process.exit(1); });
