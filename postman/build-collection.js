// Collection builder (Hòa, QA): built from the route table in src/routes.js, so the
// collection cannot drift from the server. The auth folder runs first and stores the token.
// Requests that are not in the spec table are marked, so the report can separate the two.
const fs = require('node:fs');
const path = require('node:path');
const { routes } = require('../backend/src/routes');

const BASE = 'http://127.0.0.1:5000/it4788';
const DEMO = { email: 'demo@mail.com', password: 'password1', name: 'Demo User', username: 'demo' };

function event(name, script) {
  return { listen: name, script: { type: 'exec', exec: [script] } };
}

function envelopeTest(code) {
  return [
    `pm.test('the response reads the envelope shape', () => {`,
    `  const body = pm.response.json();`,
    `  pm.expect(Object.keys(body).sort()).toEqual(['code', 'data', 'message']);`,
    code ? `  pm.expect(body.code).toBe('${code}');` : '',
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
      url: { raw: `${BASE}${routePath}`, protocol: 'http', host: ['127.0.0.1'], path: routePath.split('/').filter(Boolean) },
      header: [{ key: 'authorization', value: '{{token}}' }],
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
      url: { raw: `${BASE}${name.split(' ')[1]}`, protocol: 'http', host: ['127.0.0.1'], path: name.split(' ')[1].split('/').filter(Boolean) },
      body: { mode: 'raw', raw: JSON.stringify(body) },
    },
    event: [event('test', [
      ...envelopeTest(code),
      "const body = pm.response.json(); if (body.data && body.data.accessToken) pm.environment.set('token', body.data.accessToken);",
    ].join('\n'))],
  });
}

authRequest('POST /user/', DEMO, '00035');
authRequest('POST /user/login/', { email: DEMO.email, password: DEMO.password }, '00044');

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
