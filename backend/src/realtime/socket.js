// Sync scope (team leader): one room per group, and the write paths announce the
// change so a second device on the same group sees it without a refresh.
const { Server } = require('socket.io');

function attachSocket(server, deps) {
  const io = new Server(server);

  io.on('connection', (socket) => {
    const user = socket.handshake.auth && socket.handshake.auth.user;
    if (!user || !user.groupId) {
      socket.emit('error', { code: '00096' });
      return;
    }
    socket.join(`group:${user.groupId}`);
    socket.on('queue', async (ops) => {
      const result = await deps.services.sync.applyOps(deps, { userId: user.id, groupId: user.groupId, input: { ops } });
      socket.emit('sync_result', result);
      io.to(`group:${user.groupId}`).emit('synced', { by: user.id, code: result.code });
    });
  });

  deps.emit = (groupId, event, payload) => io.to(`group:${groupId}`).emit(event, payload);
  return io;
}

module.exports = { attachSocket };
