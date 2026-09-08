const express = require('express');
const http = require('http');
const path = require('path');
const os = require('os');
const pty = require('node-pty');
const { Server } = require('socket.io');

const PORT = process.env.PORT || 3000;
const PASSWORD = process.env.TERMINAL_PASSWORD;

if (!PASSWORD) {
  console.error('QATE: TERMINAL_PASSWORD ortalyk aisnymasy (environment variable) ornatylmagan!');
  process.exit(1);
}

const app = express();
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Debug: list what actually exists on disk, visible in Render logs at startup
console.log('__dirname:', __dirname);
try {
  console.log('Files in __dirname:', require('fs').readdirSync(__dirname));
  console.log('Files in public/:', require('fs').readdirSync(path.join(__dirname, 'public')));
} catch (e) {
  console.log('COULD NOT READ public/ FOLDER:', e.message);
}

const server = http.createServer(app);
const io = new Server(server, {
  maxHttpBufferSize: 1e7,
});

// Simple password check on socket connection
io.use((socket, next) => {
  const auth = socket.handshake.auth || {};
  if (auth.password === PASSWORD) {
    return next();
  }
  next(new Error('unauthorized'));
});

io.on('connection', (socket) => {
  // Attach to (or create) a single persistent tmux session named "main".
  // This means closing the browser tab / losing connection does NOT kill
  // the shell — reopening the site re-attaches to the same running session,
  // keeping cwd, exported env vars, running processes, etc.
  // NOTE: this only survives browser disconnects. If the underlying Render
  // container itself restarts (redeploy, free-tier sleep/wake), tmux and
  // everything in it is gone too — that's a container-level reset, not fixable
  // from inside the app on the free tier.
  const ptyProcess = pty.spawn('tmux', ['new-session', '-A', '-s', 'main'], {
    name: 'xterm-256color',
    cols: 80,
    rows: 24,
    cwd: process.env.HOME || '/root',
    env: process.env,
  });

  ptyProcess.onData((data) => {
    socket.emit('output', data);
  });

  ptyProcess.onExit(() => {
    socket.emit('output', '\r\n[tmux sessiasy ayaqtaldy. Betti qaita ashyngyz.]\r\n');
    socket.disconnect(true);
  });

  socket.on('input', (data) => {
    try { ptyProcess.write(data); } catch (e) {}
  });

  socket.on('resize', ({ cols, rows }) => {
    try { ptyProcess.resize(cols, rows); } catch (e) {}
  });

  socket.on('disconnect', () => {
    // Detach from tmux instead of killing the shell, so the session keeps
    // running in the background and is still there next time we connect.
    try { ptyProcess.write('\u0002d'); } catch (e) {} // Ctrl+B then d = tmux detach
    setTimeout(() => { try { ptyProcess.kill(); } catch (e) {} }, 300);
  });
});

server.listen(PORT, () => {
  console.log(`Terminal server ${PORT} portynda iske qosyldy`);
});
