// Point d'entrée : relie le réseau, le moteur 3D et l'interface HTML.

import { Game } from './game.js';
import { Net } from './net.js';
import * as ui from './ui.js';
import * as audio from './audio.js';
import { HOLES, NUM_HOLES, FAIL_SCORE } from './courses.js';

const canvas = document.getElementById('c');
const game = new Game(canvas);
const net = new Net();
game.net = net;

let meId = null;
let roomCode = '';
let lobbyPlayers = [];
let scoresById = new Map();
let scoreTableVisible = false;
let meIsHost = false;

const pars = HOLES.map((h) => h.par);

function refreshScoreTable() {
  ui.showScoreTable(lobbyPlayers, scoresById, pars, scoreTableVisible && game.phase !== 'menu');
}

function updateHostFlags() {
  meIsHost = lobbyPlayers.some((p) => p.id === meId && p.host);
}

ui.init({
  click: () => audio.click(),
  create: async (name, color) => {
    ui.setMenuLoading(true);
    try {
      await net.connect();
      net.send({ type: 'create', name, color });
    } catch {
      ui.showMenuError('Connexion impossible au serveur.');
    }
  },
  join: async (name, color, code) => {
    ui.setMenuLoading(true);
    try {
      await net.connect();
      net.send({ type: 'join', name, color, code });
    } catch {
      ui.showMenuError('Connexion impossible au serveur.');
    }
  },
  start: () => net.send({ type: 'start' }),
  replay: () => net.send({ type: 'replay' }),
  resume: () => game.resume(),
  quit: () => {
    net.disconnect();
    location.replace(location.pathname);
  },
});

net.on('joined', (m) => {
  meId = m.id;
  roomCode = m.code;
  lobbyPlayers = m.players;
  updateHostFlags();
  game.begin(lobbyPlayers, meId);
  ui.showScreen('lobby');
  ui.renderLobby(roomCode, lobbyPlayers, meId);
});

net.on('player_joined', (m) => {
  lobbyPlayers.push(m.player);
  game.addPlayer(m.player);
  ui.renderLobby(roomCode, lobbyPlayers, meId);
});

net.on('player_left', (m) => {
  lobbyPlayers = lobbyPlayers.filter((p) => p.id !== m.id);
  game.removePlayer(m.id);
  ui.renderLobby(roomCode, lobbyPlayers, meId);
});

net.on('host_change', (m) => {
  for (const p of lobbyPlayers) p.host = p.id === m.id;
  updateHostFlags();
  ui.renderLobby(roomCode, lobbyPlayers, meId);
});

net.on('error', (m) => ui.showMenuError(m.message));

net.on('hole_start', (m) => {
  game.startHole(m.hole, m.duration);
  scoreTableVisible = false;
  refreshScoreTable();
});

net.on('state', (m) => game.setRemoteState(m.id, m.p, m.shape));
net.on('power', (m) => game.remotePower(m.id, m.power, m.targets));
net.on('stroke', (m) => game.remoteStroke(m.id, m.strokes));
net.on('holed', (m) => game.remoteHoled(m.id, m.strokes));
net.on('maxed', (m) => game.remoteMaxed(m.id));

net.on('hole_end', (m) => {
  game.freezeHole();
  const holeDef = HOLES[m.hole];
  const totalsMap = new Map(m.totals.map((t) => [t.id, t.total]));

  for (const r of m.results) {
    let arr = scoresById.get(r.id);
    if (!arr) {
      arr = new Array(NUM_HOLES).fill(null);
      scoresById.set(r.id, arr);
    }
    arr[m.hole] = r.score;
  }

  const rows = lobbyPlayers.map((p) => {
    const res = m.results.find((r) => r.id === p.id);
    const score = res?.score ?? FAIL_SCORE;
    const holed = res?.holed ?? false;
    return {
      ...p,
      score,
      holed,
      term: ui.scoreTerm(score, holeDef.par, holed),
      total: totalsMap.get(p.id) ?? 0,
    };
  });

  ui.showHoleEnd(m.hole + 1, holeDef.name, holeDef.par, rows);
  refreshScoreTable();
});

net.on('game_end', (m) => {
  game.gameOver();
  for (const t of m.table) scoresById.set(t.id, t.scores);
  ui.showEnd(lobbyPlayers, scoresById, pars, meIsHost);
  scoreTableVisible = false;
  refreshScoreTable();
});

net.on('back_to_lobby', (m) => {
  lobbyPlayers = m.players;
  scoresById.clear();
  updateHostFlags();
  game.backToLobby();
  ui.showScreen('lobby');
  ui.renderLobby(roomCode, lobbyPlayers, meId);
  scoreTableVisible = false;
  refreshScoreTable();
});

net.on('_close', () => {
  ui.showMenuError('Connexion perdue au serveur.');
  ui.showScreen('menu');
  game.backToLobby();
});

addEventListener('keydown', (e) => {
  if (e.key !== 'Tab' || game.phase === 'menu') return;
  e.preventDefault();
  scoreTableVisible = !scoreTableVisible;
  refreshScoreTable();
});
