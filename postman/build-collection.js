// Collection builder (Hòa, QA): built from the route table in src/routes.js, so the
// collection cannot drift from the server. The auth folder runs first and names the account the
// run creates, so the codes it asserts are the rules and not the state of the database. The
// session token for the reads comes from the run script, which signs in over http.
// Requests that are not in the spec table are marked, so the report can separate the two.
const fs = require('node:fs');
const path = require('node:path');
const { routes } = require('../backend/src/routes');

// The host is written plainly, not as a variable. Checked on 2026-10-27 with newman 6.2.3: a
// variable in the host position is not resolved — the request went to a host named {{base}} —
// while a variable inside the path resolves. So the url keeps the host and the port, and the
// base path is the part that changes in the Postman GUI when the server runs elsewhere.
const BASE = 'http://127.0.0.1:5000/it4788';

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

// Bodies the route table cannot say. The verify-email loop is keyed by the email plus the
// code, and it runs before any session exists (D96), so this request sends the two fields and
// carries no authorization header.
const OVERRIDES = {
  'post /user/verify-email/': {
    body: { email: '{{qa_email}}', code: '123456' },
    auth: false,
    note: 'D96: the email names the account; a session is not needed and is not read. The code cannot be read by the run, because it leaves through the mail path, so this request asserts only the envelope shape.',
  },
};

function requestFor(method, routePath, fromSpec) {
  const override = OVERRIDES[`${method} ${routePath}`];
  const folder = routePath.split('/')[1] || 'root';
  const header = [{ key: 'content-type', value: 'application/json' }];
  if (!override || override.auth !== false) header.push({ key: 'authorization', value: '{{token}}' });
  const item = {
    name: `${method.toUpperCase()} ${routePath}${fromSpec ? '' : ' (not in the spec table)'}`,
    request: {
      method: method.toUpperCase(),
      url: `${BASE}${routePath}`,
      header,
      body: ['post', 'put', 'delete'].includes(method) ? { mode: 'raw', raw: JSON.stringify(override?.body || {}) } : undefined,
      ...(override ? { description: override.note } : {}),
    },
    event: [event('test', envelopeTest().join('\n'))],
  };
  return { folder, item };
}

const folders = { auth: [] };

// Run-scoped account (Hòa, QA): an assertion has to read a rule, not the state a previous run
// left behind. With a fixed demo email the same collection answered two different codes: the
// duplicate rule on a database that already had that account, the register rule on one that did
// not. So the account is built by the run. pm.variables is the run scope, so the name is new on
// every run and nothing is left in the environment afterwards.
const RUN_USER = [
  "if (!pm.variables.get('qa_email')) pm.variables.set('qa_email', 'qa-' + Date.now() + '@postman.test');",
  "if (!pm.variables.get('qa_username')) pm.variables.set('qa_username', 'qa' + Date.now());",
  "if (!pm.variables.get('qa_password')) pm.variables.set('qa_password', 'password1');",
].join('\n');

const RUN_BODY = {
  email: '{{qa_email}}',
  password: '{{qa_password}}',
  name: 'QA Run User',
  username: '{{qa_username}}',
};

function authRequest(name, body, code, note) {
  folders.auth.push({
    name: name,
    request: {
      method: 'POST',
      url: `${BASE}${name.split(' ')[1]}`,
      header: [{ key: 'content-type', value: 'application/json' }],
      body: { mode: 'raw', raw: JSON.stringify(body) },
      ...(note ? { description: note } : {}),
    },
    event: [
      event('prerequest', RUN_USER),
      event('test', [
        ...envelopeTest(code),
        "const body = pm.response.json(); if (body.data && body.data.accessToken) pm.variables.set('token', body.data.accessToken);",
      ].join('\n')),
    ],
  });
}

// A new account answers the register rule. The code that verifies it leaves the server through
// the mail path, so a run cannot close that loop, and the login rule refuses an account that is
// not verified: on any database this pair reads the same two codes.
authRequest('POST /user/', RUN_BODY, '00035',
  'The run names its own account, so this request reads the register rule instead of the duplicate rule.');
authRequest('POST /user/login/', { email: '{{qa_email}}', password: '{{qa_password}}' }, '00044',
  'The account this run created is not verified, so the login gate answers. {{token}} for the reads comes from a verified account: postman/run.js signs in and passes it, or fill it in the Postman environment after signing in by hand.');

for (const [method, routePath, , , needsAuth, fromSpec] of routes) {
  // Only the two auth requests are written by hand above, because they name the run account. The
  // first version skipped the path /user/, which is also the path of three routes that read, update
  // and delete the account the session belongs to, so those three never reached the collection.
  if (method === 'post' && (routePath === '/user/' || routePath === '/user/login/')) continue;
  const { folder, item } = requestFor(method, routePath, fromSpec);
  folders[folder] = folders[folder] || [];
  folders[folder].push(item);
}

const collection = {
  info: {
    name: 'tulanh-api',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0',
    description: 'Built from src/routes.js. The order runs auth first. The codes asserted there are rules, not state: the run creates its own account, so register reads the register rule and login reads the gate that refuses an account the run cannot verify. {{token}} for the reads comes from a verified account, which postman/run.js signs in and passes in.',
  },
  item: Object.entries(folders).map(([name, items]) => ({ name, item: items })),
};

const out = path.join(__dirname, 'tulanh.postman_collection.json');
fs.writeFileSync(out, JSON.stringify(collection, null, 2) + '\n');
const itemCount = collection.item.reduce((total, folder) => total + folder.item.length, 0);
console.log('written', out, 'folders', collection.item.length, 'requests', itemCount, 'of', routes.length, 'route-table entries');
