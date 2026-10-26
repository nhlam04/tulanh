// App shell (Minh): the shell starts the client, the token store, and the socket.
// On reconnect the shell sends the queue, and the cache serves reads while offline.
import { socket } from '../realtime/socket';
import { sendQueue } from '../offline/send';

export async function startShell(deps: { db: any; token: string | null; onEvent?: (event: string, payload: unknown) => void }) {
  const connection = socket.connect(process.env.API_BASE || 'http://127.0.0.1:5000', { auth: { token: deps.token } });

  connection.on('connect', async () => {
    const out = await sendQueue(deps.db, deps.token, new Date().toISOString());
    if (out.sent) deps.onEvent?.('synced', out);
  });

  connection.on('synced', (payload: unknown) => deps.onEvent?.('synced', payload));
  return connection;
}
