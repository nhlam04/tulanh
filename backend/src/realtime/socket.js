// Sync scope (team leader): one room per group, and the write paths announce the change so a
// second device on the same group sees it without a refresh.
// Rule: the room comes from the token, not from the handshake. A device that presents a token
// the server cannot verify gets no room, and a verified user joins the group on their own row,
// so a socket cannot read a group it does not belong to.
const { Server } = require('socket.io');
const { verify } = require('../util/token');

function attachSocket(server, deps) {
  const io = new Server(server);

  io.on('connection', async (socket) => {
    const token = socket.handshake.auth && socket.handshake.auth.token;
    const payload = token ? verify(token) : null;
    if (!token) {
      socket.emit('error', { code: '00006' });
      socket.disconnect(true);
      return;
    }
    if (!payload) {
      socket.emit('error', { code: '00012' });
      socket.disconnect(true);
      return;
    }
    const user = await deps.repos.users.findOne({ _id: payload.sub });
    if (!user || !user.group_id) {
      socket.emit('error', { code: '00096' });
      socket.disconnect(true);
      return;
    }
    const userId = String(user._id);
    const groupId = String(user.group_id);
    socket.join(`group:${groupId}`);

    socket.on('queue', async (ops) => {
      const result = await deps.services.sync.applyOps(deps, { userId, groupId, role: user.role, input: { ops } });
      socket.emit('sync_result', result);
      io.to(`group:${groupId}`).emit('synced', { by: userId, code: result.code });
    });
  });

  deps.emit = (groupId, event, payload) => io.to(`group:${groupId}`).emit(event, payload);
  return io;
}

module.exports = { attachSocket };
