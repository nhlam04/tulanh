// Sync scope test (Lâm): the room comes from the token, not from the handshake.
const http = require('node:http');
const { attachSocket } = require('../../src/realtime/socket');
const { sign } = require('../../src/util/token');
const { buildDeps } = require('../../src/app');
const { memoryStore } = require('../../src/store/memory');
const { io } = require('socket.io-client');

let server;
let deps;
let ioServer;
let url;
let userId;
const clients = [];

// The client is closed before the io server, since the client opened the connection. That
// order alone did not stop the teardown warning. What held the run open was engine.io's
// buffered close on the polling transport: when the transport is not writable at close time,
// engine.io schedules setTimeout(onClose, this.closeTimeout), 30 s by default
// (engine.io/build/transports/polling.js:22 and :318). Connecting over the websocket transport
// only takes that timer away, because a websocket closes right away.
function connect(opts) {
  const socket = io(url, { transports: ['websocket'], ...opts });
  clients.push(socket);
  return socket;
}

beforeAll(async () => {
  deps = buildDeps(memoryStore({
    users: [], groups: [], categories: [], units: [], foods: [], fridge_lots: [],
    shopping_lists: [], shopping_tasks: [], meal_plans: [], recipes: [], ingredients: [],
    consumption_events: [], user_devices: [], refresh_tokens: [], verification_codes: [],
    notification_log: [], system_logs: [],
  }));
  const user = await deps.repos.users.insertOne({ email: 'a@x.y', group_id: 'g1', role: 'user', username: 'a' });
  userId = String(user._id);
  server = http.createServer();
  ioServer = attachSocket(server, deps);
  await new Promise((resolve) => server.listen(0, resolve));
  url = `http://127.0.0.1:${server.address().port}`;
});

afterAll(async () => {
  for (const socket of clients) socket.close();
  if (ioServer) await ioServer.close();
  if (server) server.close();
});

function wait(socket, event) {
  return new Promise((resolve) => socket.once(event, resolve));
}

test('a handshake with no token gets no room (00006)', async () => {
  const socket = connect({ auth: {} });
  const error = await wait(socket, 'error');
  expect(error.code).toBe('00006');
  socket.close();
});

test('a handshake with a token the server cannot verify gets no room (00012)', async () => {
  const socket = connect({ auth: { token: 'made-up.token' } });
  const error = await wait(socket, 'error');
  expect(error.code).toBe('00012');
  socket.close();
});

test('a verified token joins the group on the user row, and the group hears the change', async () => {
  const socket = connect({ auth: { token: sign({ sub: userId, role: 'user' }, 60) } });
  await wait(socket, 'connect');
  const heard = wait(socket, 'synced');
  await new Promise((resolve) => setTimeout(resolve, 50));
  deps.emit('g1', 'synced', { by: userId, code: '00098' });
  expect(await heard).toEqual({ by: userId, code: '00098' });
  socket.close();
});

test('a token that names no group answers 00096', async () => {
  const lone = await deps.repos.users.insertOne({ email: 'b@x.y', group_id: null, role: 'user', username: 'b' });
  const socket = connect({ auth: { token: sign({ sub: String(lone._id), role: 'user' }, 60) } });
  const error = await wait(socket, 'error');
  expect(error.code).toBe('00096');
  socket.close();
});
