// Collection builder (Hòa, QA): built from the route table in src/routes.js, so the
// collection cannot drift from the server. The auth folder runs first and stores the token.
// Requests that are not in the spec table are marked, so the report can separate the two.
const fs = require('node:fs');
const path = require('node:path');
const { routes } = require('../backend/src/routes');

// The host is written plainly, not as a variable. Checked on 2026-10-27 with newman 6.2.3: a
// variable in the host position is not resolved — the request went to a host named {{base}} —
// while a variable inside the path resolves. So the url keeps the host and the port, and the
// base path is the part that changes in the Postman GUI when the server runs elsewhere.
const BASE = 'http://127.0.0.1:5000/it4788';
const DEMO = { email: 'demo@mail.com', password: 'password1', name: 'Demo User', username: 'demo' };

function event(name, script) {
  return { listen: name, script: { type: 'exec', exec: [script] } };
}

function envelopeTest(code) {
  return [
    `pm.test('the response reads the envelope shape', () => {`,
    `  const body = pm.response.json();`,
    `  pm.expect(Object.keys(body).sort().join(',')).to.equal('code,data,message');`,
    code ? `  pm.expect(body.code).to.equal('${code}');` : '',
    `});`,
  ].filter(Boolean);
}

function requestFor(method, routePath, fromSpec) {
  const needsAuth = ['post', 'put', 'delete'].includes(method) || !['user/'].includes(routePath.replace('/', ''));
  const folder = routePath.split('/')[1] || 'root';
  const item = {
    name: `${method.toUpperCase()} ${routePath}${fromSpec ? '' : ' (not in the spec table)'}`,
    request: {
      method: method.toUpperCase(),
      url: `${BASE}${routePath}`,
      header: [{ key: 'content-type', value: 'application/json' }, { key: 'authorization', value: '{{token}}' }],
      body: ['post', 'put', 'delete'].includes(method) ? { mode: 'raw', raw: '{}' } : undefined,
    },
    event: [event('test', envelopeTest().join('\n'))],
  };
  return { folder, item };
}

const folders = { auth: [] };

function authRequest(name, body, code) {
  folders.auth.push({
    name: name,
    request: {
      method: 'POST',
      url: `${BASE}${name.split(' ')[1]}`,
      header: [{ key: 'content-type', value: 'application/json' }],
      body: { mode: 'raw', raw: JSON.stringify(body) },
    },
    event: [event('test', [
      ...envelopeTest(code),
      "const body = pm.response.json(); if (body.data && body.data.accessToken) pm.environment.set('token', body.data.accessToken);",
    ].join('\n'))],
  });
}

// The run seeds the demo user and sets it verified before the collection runs, so register
// reads the duplicate rule and login reads the successful sign-in and stores the token.
authRequest('POST /user/', DEMO, '00032');
authRequest('POST /user/login/', { email: DEMO.email, password: DEMO.password }, '00047');

for (const [method, routePath, , , needsAuth, fromSpec] of routes) {
  if (routePath === '/user/' || routePath === '/user/login/') continue;
  const { folder, item } = requestFor(method, routePath, fromSpec);
  folders[folder] = folders[folder] || [];
  folders[folder].push(item);
}

const collection = {
  info: {
    name: 'ishop-api',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0',
    description: 'Built from src/routes.js. The order runs auth first, so the token is set before the reads.',
  },
  item: Object.entries(folders).map(([name, items]) => ({ name, item: items })),
};

const out = path.join(__dirname, 'ishop.postman_collection.json');
fs.writeFileSync(out, JSON.stringify(collection, null, 2) + '\n');
console.log('written', out, 'folders', Object.keys(folders).length, 'requests', routes.length + 1);
