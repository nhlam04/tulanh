// Socket rule (Minh): one connection, one room per group, set by the server.
import { io } from 'socket.io-client';

export const socket = {
  connect(url: string, options: { auth?: { token: string | null } } = {}) {
    const connection = io(url, { ...options, reconnectionAttempts: 5 });
    return connection;
  },
};
