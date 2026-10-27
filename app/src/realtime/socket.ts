// Socket rule (Minh): one connection, one room per group, set by the server.
// The handshake carries the token, because the room is the group the server reads from that
// token, not from a group name typed on the device. The url is the origin: the socket is
// mounted on the server root, while the API paths sit under the base path.
import { io, type Socket } from 'socket.io-client';

export type SocketAuth = { token: string | null };

export function originOf(base: string): string {
  try {
    return new URL(base).origin;
  } catch {
    return base;
  }
}

export const socket = {
  connect(base: string, auth: SocketAuth): Socket {
    return io(originOf(base), { auth, reconnectionAttempts: 5 });
  },
};
