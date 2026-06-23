const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  transports: ['websocket', 'polling']
});

// Serve frontend
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── State ───
const waitingQueues = {
  text: [],
  video: []
};
const rooms = new Map(); // socketId -> partnerId
let onlineCount = 0;

// ─── Helper: match two users ───
function tryMatch(socket, mode, filters) {
  const queue = waitingQueues[mode];

  // Find a compatible partner in queue
  const idx = queue.findIndex(w => w.id !== socket.id);

  if (idx !== -1) {
    const partner = queue.splice(idx, 1)[0];

    // Create room
    rooms.set(socket.id, partner.id);
    rooms.set(partner.id, socket.id);

    // Notify both
    socket.emit('matched', { partnerId: partner.id, initiator: true });
    partner.emit('matched', { partnerId: socket.id, initiator: false });

    console.log(`Matched: ${socket.id} <-> ${partner.id} [${mode}]`);
  } else {
    // Add to queue
    if (!queue.find(w => w.id === socket.id)) {
      queue.push(socket);
    }
    socket.emit('waiting');
    console.log(`Waiting: ${socket.id} [${mode}] queue size: ${queue.length}`);
  }
}

function removeFromQueues(socketId) {
  ['text', 'video'].forEach(mode => {
    waitingQueues[mode] = waitingQueues[mode].filter(s => s.id !== socketId);
  });
}

function disconnectPartner(socketId) {
  const partnerId = rooms.get(socketId);
  if (partnerId) {
    const partnerSocket = io.sockets.sockets.get(partnerId);
    if (partnerSocket) {
      partnerSocket.emit('partnerDisconnected');
    }
    rooms.delete(partnerId);
    rooms.delete(socketId);
  }
}

// ─── Socket Events ───
io.on('connection', (socket) => {
  onlineCount++;
  io.emit('onlineCount', onlineCount);
  console.log(`Connected: ${socket.id} | Total: ${onlineCount}`);

  // Find match
  socket.on('findMatch', ({ mode, filters }) => {
    removeFromQueues(socket.id);
    disconnectPartner(socket.id);
    const chatMode = mode === 'video' ? 'video' : 'text';
    tryMatch(socket, chatMode, filters);
  });

  // Chat message
  socket.on('message', ({ to, message }) => {
    const partnerSocket = io.sockets.sockets.get(to);
    if (partnerSocket) {
      partnerSocket.emit('message', { message });
    }
  });

  // WebRTC signaling
  socket.on('signal', ({ to, signal }) => {
    const partnerSocket = io.sockets.sockets.get(to);
    if (partnerSocket) {
      partnerSocket.emit('signal', { signal });
    }
  });

  // Game actions (Truth/Dare, TTT, Quiz)
  socket.on('gameAction', ({ to, action, data }) => {
    const partnerSocket = io.sockets.sockets.get(to);
    if (partnerSocket) {
      partnerSocket.emit('gameAction', { action, data });
    }
  });

  // Skip
  socket.on('skip', () => {
    disconnectPartner(socket.id);
    removeFromQueues(socket.id);
  });

  // Leave
  socket.on('leave', () => {
    disconnectPartner(socket.id);
    removeFromQueues(socket.id);
  });

  // Disconnect
  socket.on('disconnect', () => {
    onlineCount = Math.max(0, onlineCount - 1);
    io.emit('onlineCount', onlineCount);
    disconnectPartner(socket.id);
    removeFromQueues(socket.id);
    console.log(`Disconnected: ${socket.id} | Total: ${onlineCount}`);
  });
});

// ─── Start Server ───
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
