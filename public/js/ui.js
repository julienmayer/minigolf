// Gestion des écrans HTML : menu, salon, HUD, scores, fin de partie.

const $ = (id) => document.getElementById(id);

export const COLORS = [
  '#e63946', '#457b9d', '#2a9d8f', '#ffb703', '#9b5de5',
  '#f15bb5', '#fb8500', '#00bbf9', '#f1faee', '#343a40',
];

let selectedColor = COLORS[Math.floor(Math.random() * COLORS.length)];
let bannerTimer = null;

export function getSelectedColor() { return selectedColor; }

export function init(cb) {
  // nuancier de couleurs
  const row = $('colorRow');
  for (const c of COLORS) {
    const s = document.createElement('div');
    s.className = 'swatch' + (c === selectedColor ? ' selected' : '');
    s.style.background = c;
    s.addEventListener('click', () => {
      selectedColor = c;
      row.querySelectorAll('.swatch').forEach(e => e.classList.remove('selected'));
      s.classList.add('selected');
      cb.click();
    });
    row.appendChild(s);
  }

  $('nameInput').value = sessionStorage.getItem('mg_name') || '';
  const urlCode = new URLSearchParams(location.search).get('code');
  if (urlCode) $('joinCode').value = urlCode.toUpperCase().slice(0, 4);

  const getName = () => {
    const n = $('nameInput').value.trim();
    if (!n) { showMenuError('Choisis un pseudo d’abord !'); return null; }
    sessionStorage.setItem('mg_name', n);
    return n;
  };

  $('btnCreate').addEventListener('click', () => {
    const n = getName();
    if (n) { cb.click(); cb.create(n, selectedColor); }
  });
  $('btnJoin').addEventListener('click', () => {
    const n = getName();
    const code = $('joinCode').value.trim().toUpperCase();
    if (n && code.length !== 4) { showMenuError('Le code fait 4 caractères.'); return; }
    if (n) { cb.click(); cb.join(n, selectedColor, code); }
  });
  $('joinCode').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('btnJoin').click(); });
  $('nameInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('btnCreate').click(); });

  $('btnStart').addEventListener('click', () => { cb.click(); cb.start(); });
  $('btnReplay').addEventListener('click', () => { cb.click(); cb.replay(); });
  $('btnResume').addEventListener('click', () => { cb.click(); cb.resume(); });
  $('btnQuit').addEventListener('click', () => { cb.click(); cb.quit(); });
  $('btnCopy').addEventListener('click', () => {
    const code = $('lobbyCode').textContent;
    const link = `${location.origin}/?code=${code}`;
    navigator.clipboard?.writeText(link).then(
      () => toast('Lien copié ! Envoie-le à tes amis 🎉'),
      () => toast(`Lien : ${link}`),
    );
    cb.click();
  });
}

export function showMenuError(msg) {
  setMenuLoading(false);
  const e = $('menuError');
  e.textContent = msg;
  e.classList.remove('hidden');
  setTimeout(() => e.classList.add('hidden'), 4000);
}

export function setMenuLoading(active) {
  $('menuLoader').classList.toggle('hidden', !active);
  $('btnCreate').disabled = active;
  $('btnJoin').disabled = active;
  $('nameInput').disabled = active;
  $('joinCode').disabled = active;
}

const SCREENS = ['menu', 'lobby', 'holeEnd', 'gameEnd'];
export function showScreen(name) {
  if (name !== 'menu') setMenuLoading(false);
  for (const s of SCREENS) $(s).classList.toggle('hidden', s !== name);
  $('hud').classList.toggle('hidden', name !== null);
}
export function showHud() {
  for (const s of SCREENS) $(s).classList.add('hidden');
  $('hud').classList.remove('hidden');
}

export function showEscapeMenu(visible) {
  $('escapeMenu').classList.toggle('hidden', !visible);
}

// ---------------------------------------------------------------- salon

export function renderLobby(code, players, meId) {
  $('lobbyCode').textContent = code;
  const ul = $('lobbyPlayers');
  ul.innerHTML = '';
  let meHost = false;
  for (const p of players) {
    const li = document.createElement('li');
    const dot = document.createElement('span');
    dot.className = 'dot';
    dot.style.background = p.color;
    li.appendChild(dot);
    const name = document.createElement('span');
    name.textContent = p.name + (p.id === meId ? ' (toi)' : '');
    li.appendChild(name);
    if (p.host) {
      const tag = document.createElement('span');
      tag.className = 'host-tag';
      tag.textContent = '👑 hôte';
      li.appendChild(tag);
    }
    ul.appendChild(li);
    if (p.id === meId && p.host) meHost = true;
  }
  $('btnStart').classList.toggle('hidden', !meHost);
  $('btnStart').textContent = `Lancer la partie (${players.length} joueur${players.length > 1 ? 's' : ''})`;
  $('lobbyHint').classList.toggle('hidden', meHost);
}

// ---------------------------------------------------------------- HUD

export function setHoleInfo(num, name, par) {
  $('holeInfo').textContent = `Trou ${num} « ${name} » — Par ${par}`;
}

export function setTimer(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  const mm = Math.floor(s / 60), ss = String(s % 60).padStart(2, '0');
  const t = $('timer');
  t.textContent = `${mm}:${ss}`;
  t.classList.toggle('low', s <= 30);
}

export function setStrokes(n, max) {
  $('strokesBox').textContent = `Coups : ${n}/${max}`;
}

export function setPower(p) {
  $('powerFill').style.width = `${Math.round(p * 100)}%`;
}

export function setPowers(lines) {
  $('powersBox').innerHTML = lines.join('<br>');
}

export function updateSidePlayers(players, meId) {
  const box = $('sidePlayers');
  box.innerHTML = '';
  for (const p of players) {
    const row = document.createElement('div');
    row.className = 'sp-row' + (p.id === meId ? ' me' : '');
    const dot = document.createElement('span');
    dot.className = 'dot';
    dot.style.background = p.color;
    row.appendChild(dot);
    const name = document.createElement('span');
    name.textContent = p.name;
    row.appendChild(name);
    const st = document.createElement('span');
    st.className = 'sp-status';
    if (p.holedAt != null) { st.textContent = `✓ ${p.holedAt}`; st.classList.add('done'); }
    else if (p.failed) { st.textContent = '✗'; st.classList.add('fail'); }
    else st.textContent = `🏌️ ${p.strokes}`;
    row.appendChild(st);
    box.appendChild(row);
  }
}

export function toast(msg) {
  const box = $('toasts');
  while (box.children.length >= 4) box.firstChild.remove();
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  box.appendChild(t);
  setTimeout(() => t.classList.add('out'), 3000);
  setTimeout(() => t.remove(), 3500);
}

export function banner(text, sub = '', duration = 2400) {
  const b = $('banner');
  clearTimeout(bannerTimer);
  b.classList.remove('hidden', 'fade');
  void b.offsetWidth; // relance l'animation CSS
  $('bannerText').textContent = text;
  $('bannerSub').textContent = sub;
  bannerTimer = setTimeout(() => {
    b.classList.add('fade');
    bannerTimer = setTimeout(() => b.classList.add('hidden'), 500);
  }, duration);
}

// ---------------------------------------------------------------- scores

export function scoreTerm(score, par, holed) {
  if (!holed) return 'Non terminé';
  if (score === 1) return 'Trou en un !';
  const d = score - par;
  if (d <= -3) return 'Albatros !';
  if (d === -2) return 'Eagle !';
  if (d === -1) return 'Birdie !';
  if (d === 0) return 'Par';
  if (d === 1) return 'Bogey';
  if (d === 2) return 'Double bogey';
  return `+${d}`;
}

export function showHoleEnd(holeNum, holeName, par, rows) {
  $('holeEndTitle').textContent = `Trou ${holeNum} « ${holeName} » — Par ${par}`;
  const box = $('holeEndRows');
  box.innerHTML = '';
  for (const r of rows) {
    const div = document.createElement('div');
    div.className = 'he-row';
    const dot = document.createElement('span');
    dot.className = 'dot';
    dot.style.background = r.color;
    div.appendChild(dot);
    const name = document.createElement('span');
    name.textContent = r.name;
    div.appendChild(name);
    const term = document.createElement('span');
    term.className = 'he-term';
    term.textContent = r.term;
    div.appendChild(term);
    const score = document.createElement('span');
    score.className = 'he-score';
    score.textContent = r.holed ? `${r.score}` : '✗';
    div.appendChild(score);
    const total = document.createElement('span');
    total.className = 'he-total';
    total.textContent = `total ${r.total}`;
    div.appendChild(total);
    box.appendChild(div);
  }
  showScreen('holeEnd');
}

function buildTable(players, scoresById, pars) {
  const table = document.createElement('table');
  const head = document.createElement('tr');
  head.innerHTML = '<th>Joueur</th>' + pars.map((p, i) => `<th>T${i + 1}<br>(${p})</th>`).join('') + '<th>Total</th>';
  table.appendChild(head);
  const rows = players.map(p => {
    const arr = scoresById.get(p.id) || [];
    const total = arr.reduce((a, s) => a + (s || 0), 0);
    return { p, arr, total };
  }).sort((a, b) => a.total - b.total);
  for (const { p, arr, total } of rows) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.textContent = p.name;
    td.style.color = p.color === '#343a40' ? '#9aa6ad' : p.color;
    tr.appendChild(td);
    for (let i = 0; i < pars.length; i++) {
      const c = document.createElement('td');
      const s = arr[i];
      c.textContent = s == null ? '·' : s;
      if (s != null && s < pars[i]) c.className = 'sc-under';
      if (s != null && s > pars[i]) c.className = 'sc-over';
      tr.appendChild(c);
    }
    const tt = document.createElement('td');
    tt.className = 'sc-total';
    tt.textContent = total;
    tr.appendChild(tt);
    table.appendChild(tr);
  }
  return table;
}

export function showScoreTable(players, scoresById, pars, visible) {
  const el = $('scoreTable');
  if (!visible) { el.classList.add('hidden'); return; }
  const grid = $('scoreGrid');
  grid.innerHTML = '';
  grid.appendChild(buildTable(players, scoresById, pars));
  el.classList.remove('hidden');
}

export function showEnd(players, scoresById, pars, meIsHost) {
  const sorted = players.map(p => ({
    p,
    total: (scoresById.get(p.id) || []).reduce((a, s) => a + (s || 0), 0),
  })).sort((a, b) => a.total - b.total);

  const podium = $('podium');
  podium.innerHTML = '';
  const medals = ['🥇', '🥈', '🥉'];
  const order = sorted.slice(0, 3);
  // affichage 2-1-3
  const arranged = order.length === 3 ? [order[1], order[0], order[2]] : order;
  for (const e of arranged) {
    const rank = sorted.indexOf(e);
    const div = document.createElement('div');
    div.className = 'pod' + (rank === 0 ? ' first' : '');
    div.innerHTML = `<div class="pod-medal">${medals[rank]}</div>`;
    const nm = document.createElement('div');
    nm.className = 'pod-name';
    nm.textContent = e.p.name;
    div.appendChild(nm);
    const sc = document.createElement('div');
    sc.className = 'pod-score';
    sc.textContent = `${e.total} coups`;
    div.appendChild(sc);
    podium.appendChild(div);
  }

  const box = $('endTable');
  box.innerHTML = '';
  box.appendChild(buildTable(players, scoresById, pars));

  $('btnReplay').classList.toggle('hidden', !meIsHost);
  $('replayHint').classList.toggle('hidden', meIsHost);
  showScreen('gameEnd');
}
