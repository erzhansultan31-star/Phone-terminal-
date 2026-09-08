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
  const shell = os.platform() === 'win32' ? 'powershell.exe' : (process.env.SHELL || 'bash');

  const ptyProcess = pty.spawn(shell, [], {
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
    socket.emit('output', '\r\n[Sessia ayaqtaldy. Betti qaita ashyngyz.]\r\n');
    socket.disconnect(true);
  });

  socket.on('input', (data) => {
    try { ptyProcess.write(data); } catch (e) {}
  });

  socket.on('resize', ({ cols, rows }) => {
    try { ptyProcess.resize(cols, rows); } catch (e) {}
  });

  socket.on('disconnect', () => {
    try { ptyProcess.kill(); } catch (e) {}
  });
});

server.listen(PORT, () => {
  console.log(`Terminal server ${PORT} portynda iske qosyldy`);
});
