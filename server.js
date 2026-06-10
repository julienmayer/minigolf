import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUB = path.join(__dirname, 'public');
const THREE_DIR = path.join(__dirname, 'node_modules', 'three', 'build');
const PORT = process.env.PORT || 3000;

const NUM_HOLES = 9;
const HOLE_TIME_MS = 240_000;   // 4 min max par trou
const BETWEEN_MS = 6_500;       // écran des scores entre les trous
const MAX_PLAYERS = 10;
const FAIL_SCORE = 9;           // score si le trou n'est pas terminé

const COLORS = [
  '#e63946', '#457b9d', '#2a9d8f', '#ffb703', '#9b5de5',
  '#f15bb5', '#fb8500', '#00bbf9', '#f1faee', '#343a40',
];

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    res.writeHead(400); res.end('Bad request'); return;
  }
  if (pathname === '/') pathname = '/index.html';

  let base = PUB, rel = pathname;
  if (pathname.startsWith('/lib/three/')) {
    base = THREE_DIR;
    rel = pathname.slice('/lib/three/'.length);
  }
  const file = path.normalize(path.join(base, rel));
  if (!file.startsWith(base)) { res.writeHead(403); res.end('Forbidden'); return; }

  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
});

// ---------------------------------------------------------------- rooms

const wss = new WebSocketServer({ server });
const rooms = new Map(); // code -> room

function makeCode() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = '';
    for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  } while (rooms.has(code));
  return code;
}

function send(ws, obj) {
  if (ws.readyState === 1) ws.send(JSON.stringify(obj));
}

function broadcast(room, obj, skipId = null) {
  const data = JSON.stringify(obj);
  for (const p of room.players.values()) {
    if (p.id !== skipId && p.ws.readyState === 1) p.ws.send(data);
  }
}

function snapshot(room) {
  return [...room.players.values()].map(p => ({ id: p.id, name: p.name, color: p.color, host: p.host }));
}

function sanitizeName(raw) {
  const name = String(raw || "").replace(/[\x00-\x1f<>]/g, "").trim().slice(0, 14);
  return name || 'Joueur';
}

function pickColor(room, wanted) {
  const used = new Set([...room.players.values()].map(p => p.color));
  if (COLORS.includes(wanted) && !used.has(wanted)) return wanted;
  return COLORS.find(c => !used.has(c)) || COLORS[0];
}

function joinRoom(ws, room, msg) {
  const id = 'p' + (++room.seq);
  const p = {
    id,
    ws,
    name: sanitizeName(msg.name),
    color: pickColor(room, msg.color),
    host: room.players.size === 0,
    strokes: 0,
    done: false,
    holed: false,
    result: 0,
  };
  room.players.set(id, p);
  ws.meta = { code: room.code, id };
  send(ws, { type: 'joined', code: room.code, id, players: snapshot(room), numHoles: NUM_HOLES });
  broadcast(room, { type: 'player_joined', player: { id, name: p.name, color: p.color, host: p.host } }, id);
}

function ctx(ws) {
  if (!ws.meta) return {};
  const room = rooms.get(ws.meta.code);
  if (!room) return {};
  return { room, p: room.players.get(ws.meta.id) };
}

function startHole(room, i) {
  room.hole = i;
  room.state = 'playing';
  for (const p of room.players.values()) {
    p.strokes = 0; p.done = false; p.holed = false; p.result = 0;
  }
  broadcast(room, { type: 'hole_start', hole: i, duration: HOLE_TIME_MS });
  clearTimeout(room.timer);
  room.timer = setTimeout(() => endHole(room), HOLE_TIME_MS + 2000);
}

function checkDone(room) {
  if (room.state !== 'playing') return;
  if (room.players.size === 0) return;
  for (const p of room.players.values()) if (!p.done) return;
  endHole(room);
}

function endHole(room) {
  if (room.state !== 'playing') return;
  clearTimeout(room.timer);
  room.state = 'between';
  const results = [];
  for (const p of room.players.values()) {
    const score = p.done ? p.result : FAIL_SCORE;
    let arr = room.scores.get(p.id);
    if (!arr) { arr = new Array(NUM_HOLES).fill(null); room.scores.set(p.id, arr); }
    arr[room.hole] = score;
    results.push({ id: p.id, score, holed: p.holed, strokes: p.strokes });
  }
  const totals = [...room.players.values()].map(p => ({
    id: p.id,
    total: (room.scores.get(p.id) || []).reduce((a, s) => a + (s || 0), 0),
  }));
  broadcast(room, { type: 'hole_end', hole: room.hole, results, totals });
  room.nextTimer = setTimeout(() => {
    if (!rooms.has(room.code) || room.players.size === 0) return;
    if (room.hole + 1 < NUM_HOLES) {
      startHole(room, room.hole + 1);
    } else {
      room.state = 'end';
      const table = [...room.players.values()].map(p => {
        const arr = room.scores.get(p.id) || new Array(NUM_HOLES).fill(null);
        return { id: p.id, scores: arr, total: arr.reduce((a, s) => a + (s || 0), 0) };
      });
      broadcast(room, { type: 'game_end', table });
    }
  }, BETWEEN_MS);
}

function leave(ws) {
  const { room, p } = ctx(ws);
  if (!room || !p) return;
  room.players.delete(p.id);
  room.scores.delete(p.id);
  ws.meta = null;
  if (room.players.size === 0) {
    clearTimeout(room.timer);
    clearTimeout(room.nextTimer);
    rooms.delete(room.code);
    return;
  }
  broadcast(room, { type: 'player_left', id: p.id });
  if (p.host) {
    const next = room.players.values().next().value;
    next.host = true;
    broadcast(room, { type: 'host_change', id: next.id });
  }
  checkDone(room);
}

function handle(ws, m) {
  switch (m.type) {
    case 'create': {
      if (ws.meta) return;
      const code = makeCode();
      rooms.set(code, {
        code, players: new Map(), state: 'lobby', hole: -1,
        scores: new Map(), timer: null, nextTimer: null, seq: 0,
      });
      joinRoom(ws, rooms.get(code), m);
      break;
    }
    case 'join': {
      if (ws.meta) return;
      const room = rooms.get(String(m.code || '').trim().toUpperCase());
      if (!room) return send(ws, { type: 'error', message: 'Code invalide : aucun salon trouvé.' });
      if (room.state !== 'lobby') return send(ws, { type: 'error', message: 'La partie a déjà commencé.' });
      if (room.players.size >= MAX_PLAYERS) return send(ws, { type: 'error', message: 'Le salon est complet.' });
      joinRoom(ws, room, m);
      break;
    }
    case 'start': {
      const { room, p } = ctx(ws);
      if (!room || !p || !p.host || room.state !== 'lobby') return;
      startHole(room, 0);
      break;
    }
    case 'state': {
      const { room, p } = ctx(ws);
      if (!room || !p || room.state !== 'playing') return;
      if (!Array.isArray(m.p) || m.p.length !== 3) return;
      broadcast(room, { type: 'state', id: p.id, p: m.p }, p.id);
      break;
    }
    case 'stroke': {
      const { room, p } = ctx(ws);
      if (!room || !p || room.state !== 'playing' || p.done) return;
      p.strokes = Math.min(p.strokes + 1, 20);
      broadcast(room, { type: 'stroke', id: p.id, strokes: p.strokes }, p.id);
      break;
    }
    case 'holed': {
      const { room, p } = ctx(ws);
      if (!room || !p || room.state !== 'playing' || p.done) return;
      p.done = true;
      p.holed = true;
      p.result = Math.max(1, Math.min(FAIL_SCORE, Math.round(Number(m.strokes) || 1)));
      broadcast(room, { type: 'holed', id: p.id, strokes: p.result });
      checkDone(room);
      break;
    }
    case 'maxed': {
      const { room, p } = ctx(ws);
      if (!room || !p || room.state !== 'playing' || p.done) return;
      p.done = true;
      p.holed = false;
      p.result = FAIL_SCORE;
      broadcast(room, { type: 'maxed', id: p.id }, p.id);
      checkDone(room);
      break;
    }
    case 'replay': {
      const { room, p } = ctx(ws);
      if (!room || !p || !p.host || room.state !== 'end') return;
      room.state = 'lobby';
      room.hole = -1;
      room.scores.clear();
      broadcast(room, { type: 'back_to_lobby', players: snapshot(room) });
      break;
    }
  }
}

wss.on('connection', (ws) => {
  ws.meta = null;
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  ws.on('message', (data) => {
    if (data.length > 4096) return;
    let m;
    try { m = JSON.parse(data); } catch { return; }
    if (!m || typeof m !== 'object' || typeof m.type !== 'string') return;
    handle(ws, m);
  });
  ws.on('close', () => leave(ws));
  ws.on('error', () => {});
});

setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) { ws.terminate(); continue; }
    ws.isAlive = false;
    ws.ping();
  }
}, 30_000);

server.listen(PORT, () => {
  console.log('⛳ Mini-Golf entre amis');
  console.log(`   Local :   http://localhost:${PORT}`);
  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const i of ifaces || []) {
      if (i.family === 'IPv4' && !i.internal) {
        console.log(`   Réseau :  http://${i.address}:${PORT}`);
      }
    }
  }
  console.log('   Pour jouer à distance, voir le README (tunnel cloudflared/ngrok).');
});
