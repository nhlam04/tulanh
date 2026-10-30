// App shell (Minh): the shell starts the client, the token store, and the socket.
// On reconnect the shell sends the queue and reports the answer through onEvent. Reads are not
// cached: a read needs the server, so an offline read answers with the offline code.
import { socket } from './realtime/socket';
import { sendQueue } from './offline/send';
import { baseUrl } from './api/client';
import type { QueueDb } from './offline/queue';
import type { Socket } from 'socket.io-client';

export type ShellDeps = {
  db: QueueDb;
  token: string | null;
  onEvent?: (event: string, payload: unknown) => void;
};

export async function startShell(deps: ShellDeps): Promise<Socket> {
  const connection = socket.connect(baseUrl(), { token: deps.token });

  connection.on('connect', async () => {
    const out = await sendQueue(deps.db, deps.token, new Date().toISOString());
    if (out.sent) deps.onEvent?.('synced', out);
  });

  // The server answers the sender with sync_result and tells the room with synced, so a
  // second device on the group sees the change without a refresh.
  connection.on('sync_result', (payload: unknown) => deps.onEvent?.('synced', payload));
  connection.on('synced', (payload: unknown) => deps.onEvent?.('synced', payload));
  connection.on('error', (payload: unknown) => deps.onEvent?.('socket', payload));
  return connection;
}
