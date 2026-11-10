import { BOARD } from './game/board.js';
import { formatMoney, getActivePlayer, getPortfolioValue, getRent, getTileOwner, groupIsComplete } from './game/engine.js';

const $ = (selector, root = document) => root.querySelector(selector);
const app = $('#app');
const toastRoot = $('#toast-root');
const palette = ['#6C8BFF', '#FF9A69', '#4FC6A7', '#D58BE8', '#E8BD55', '#66C4D8'];
const ROOM_KEY = 'fortune-district-room-v1';
let lobby = null;
let game = null;
let selectedTile = null;
let toastTimer;
let rollAnimating = false;
let playerId = localStorage.getItem('fd-player-id') || null;
let playerToken = localStorage.getItem('fd-player-token') || null;
let eventStream = null;
let online = true;
let busy = false;
async function api(path, payload) { const response = await fetch(`/api/${path}`, { method: payload ? 'POST' : 'GET', headers: payload ? { 'Content-Type': 'application/json' } : {}, body: payload ? JSON.stringify(payload) : undefined }); const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Serverfehler'); return data; }
function applyServerState(data) { lobby = data.lobby || null; game = data.game || null; saveRoom(); render(); }
function connectRoom(code) { if (eventStream) eventStream.close(); eventStream = new EventSource(`/api/events?code=${encodeURIComponent(code)}&playerId=${encodeURIComponent(playerId)}&playerToken=${encodeURIComponent(playerToken)}`); eventStream.onopen = () => { online = true; if (lobby || game) render(); }; eventStream.onmessage = event => { try { applyServerState(JSON.parse(event.data)); } catch {} }; eventStream.onerror = () => { online = false; if (lobby || game) render(); }; }

const money = formatMoney;
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ownerOf = tileId => game ? getTileOwner(game, tileId) : null;
const current = () => game ? getActivePlayer(game) : null;
const tileAsset = id => game?.properties[id];
const alivePlayers = () => game?.players.filter(p => !p.bankrupt) || [];

function toast(message, type = 'info') {
  toastRoot.innerHTML = `<div class="toast toast-${type}"><span>${type === 'success' ? '✓' : type === 'error' ? '!' : '✦'}</span>${escapeHtml(message)}</div>`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastRoot.innerHTML = ''; }, 3200);
}

function saveRoom() {
  try { localStorage.setItem(ROOM_KEY, JSON.stringify({ lobby, game })); } catch { /* private browsing / quota */ }
}

function loadRoom() {
  try {
    const saved = JSON.parse(localStorage.getItem(ROOM_KEY) || 'null');
    if (!saved) return;
    lobby = saved.lobby || null;
    game = saved.game || null;
  } catch { lobby = null; game = null; }
}

function createCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function renderLanding() {
  app.innerHTML = `
    <div class="landing-shell">
      <header class="topbar landing-topbar">
        <a class="brand" href="#" aria-label="Fortune District Startseite"><span class="brand-mark">F<span>✦</span></span><span>FORTUNE <b>DISTRICT</b></span></a>
        <div class="topbar-right"><span class="demo-pill"><i></i> ONLINE-SPIELRAUM</span><span class="top-note">Ein Spiel. Eine Stadt. Viele Geschichten.</span></div>
      </header>
      <main class="landing-grid">
        <section class="hero-copy">
          <div class="eyebrow"><span class="eyebrow-line"></span> DEIN PLATZ AM SPIELTISCH</div>
          <h1>Eine Stadt.<br><em>Dein Imperium.</em></h1>
          <p class="hero-lede">Kaufe Straßen, baue dein Viertel aus und handle dich an die Spitze. Ein cleveres Stadtspiel für eure gemeinsame Runde.</p>
          <div class="hero-features"><span>✦ 2–6 Mitspieler</span><span>⌁ Freie Spielregeln</span><span>▧ 40 Spielfelder</span></div>
          <div class="landing-board-art" aria-label="Dekorative 3D-Spielbrettillustration">
            <div class="art-board">
              <div class="art-tile art-a"></div><div class="art-tile art-b"></div><div class="art-tile art-c"></div><div class="art-tile art-d"></div>
              <div class="art-center"><strong>FORTUNE<br>DISTRICT</strong><span>THE CITY IS YOURS</span><div class="art-dice"><b>⚄</b><b>⚂</b></div></div>
              <div class="art-token token-one"></div><div class="art-token token-two"></div><div class="art-token token-three"></div>
            </div>
            <div class="art-spark spark-one">✦</div><div class="art-spark spark-two">✧</div>
          </div>
        </section>
        <section class="setup-card">
          <div class="setup-card-head"><div><div class="eyebrow">SPIELZENTRALE · GASTZUGANG</div><h2>Willkommen am Spieltisch.</h2><p class="login-note">Kein Konto, keine E-Mail, kein Passwort – wähle einfach deinen Spielernamen.</p></div><div class="setup-orbit">✦</div></div>
          <form id="create-form" class="setup-form">
            <label class="field-label" for="host-name">DEIN SPIELERNAME</label>
            <input id="host-name" name="hostName" maxlength="18" value="${escapeHtml(localStorage.getItem('fd-player-name') || '')}" required placeholder="Dein Spielername …" />
            <div class="field-row">
              <div><label class="field-label" for="player-limit">SPIELERZAHL</label><select id="player-limit" name="maxPlayers"><option value="2">2 Spieler</option><option value="3">3 Spieler</option><option value="4" selected>4 Spieler</option><option value="5">5 Spieler</option><option value="6">6 Spieler</option></select></div>
              <div><label class="field-label" for="starting-cash">STARTKAPITAL</label><select id="starting-cash" name="startingCash"><option value="1000">1.000 M</option><option value="1500" selected>1.500 M</option><option value="2000">2.000 M</option><option value="2500">2.500 M</option></select></div>
            </div>
            <button class="btn btn-primary btn-large" type="submit">Raum erstellen <span>↗</span></button>
          </form>
          <div class="setup-divider"><span>ODER</span></div>
          <form id="join-form" class="join-form">
            <label class="field-label" for="join-name">DEIN SPIELERNAME</label>
            <input id="join-name" name="joinName" maxlength="18" value="${escapeHtml(localStorage.getItem('fd-player-name') || '')}" required placeholder="Dein Spielername …" />
            <label class="field-label join-code-label" for="room-code">MIT RAUMCODE BEITRETEN</label>
            <div class="join-row"><input id="room-code" name="roomCode" maxlength="6" placeholder="z. B. F7K2QP" autocomplete="off" required /><button class="btn btn-secondary" type="submit">Beitreten</button></div>
          </form>
          <p class="demo-disclaimer"><span>ⓘ</span> Gastzugang: Du brauchst nur einen Spielernamen. Teile den Raumcode mit Freunden – alle Geräte werden live synchronisiert.</p>
        </section>
      </main>
      <footer class="landing-footer"><span>© FORTUNE DISTRICT · EIN EIGENSTÄNDIGES STADT-BRETT-SPIEL</span><span>MADE FOR YOUR GAME NIGHT <b>✦</b></span></footer>
    </div>`;
  $('#create-form').addEventListener('submit', e => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const host = String(data.get('hostName') || '').trim().slice(0, 18);
    const maxPlayers = Number(data.get('maxPlayers'));
    const startingCash = Number(data.get('startingCash'));
    busy = true;
    if (!host) return toast('Bitte gib einen Spielernamen ein.', 'error');
    localStorage.setItem('fd-player-name', host);
    api('create', { name: host, maxPlayers, startingCash }).then(data => { playerId = data.playerId; playerToken = data.playerToken; localStorage.setItem('fd-player-id', playerId); localStorage.setItem('fd-player-token', playerToken); localStorage.setItem('fd-player-name', host); applyServerState(data); connectRoom(data.lobby.code); }).catch(err => toast(err.message, 'error')).finally(() => { busy = false; });
  });
  $('#join-form').addEventListener('submit', e => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const code = String(formData.get('roomCode') || '').trim().toUpperCase();
    const name = String(formData.get('joinName') || '').trim().slice(0,18);
    if (!name || !code) return;
    localStorage.setItem('fd-player-name', name);
    api('join', { code, name }).then(data => { playerId = data.playerId; playerToken = data.playerToken; localStorage.setItem('fd-player-id', playerId); localStorage.setItem('fd-player-token', playerToken); localStorage.setItem('fd-player-name', name); applyServerState(data); connectRoom(code); }).catch(err => toast(err.message, 'error'));
  });
}

function renderLobby() {
  const rules = lobby.rules;
  app.innerHTML = `
    <div class="app-shell">
      <header class="topbar"><a class="brand" href="#"><span class="brand-mark">F<span>✦</span></span><span>FORTUNE <b>DISTRICT</b></span></a><div class="topbar-right"><span class="demo-pill"><i></i> ONLINE</span><span class="room-chip">RAUM <b>${escapeHtml(lobby.code)}</b></span><button class="icon-btn" data-action="leave-lobby" aria-label="Zur Startseite">↗</button></div></header>
      <main class="lobby-main">
        <div class="lobby-intro"><div><div class="eyebrow">DEIN SPIELRAUM · ${escapeHtml(lobby.code)}</div><h1>Die Runde ist <em>eröffnet.</em></h1><p>Teile den Raumcode. Deine Freunde treten von ihren eigenen Geräten bei.</p></div><button class="btn btn-outline" data-action="copy-invite">↗ Einladung kopieren</button></div>
        <div class="lobby-grid">
          <section class="panel players-panel"><div class="panel-heading"><div><span class="panel-kicker">01 / MIT WEM SPIELST DU?</span><h2>Deine Spielrunde <small>${lobby.players.length}/${rules.maxPlayers}</small></h2></div><span class="live-dot"><i></i> BEREIT</span></div>
            <div class="player-list">${lobby.players.map((p, i) => `<div class="lobby-player"><div class="player-avatar" style="--player:${p.color}">${escapeHtml(p.name.slice(0, 1).toUpperCase())}</div><div class="player-meta"><strong>${escapeHtml(p.name)}</strong><span>${p.id === lobby.hostId ? 'SPIELLEITUNG' : 'MITSPIELER'} · ${i === 0 ? 'AM ZUG BEGINNT' : 'BEREIT'}</span></div>${p.id === lobby.hostId ? '<span class="host-mark">HOST ✦</span>' : '<span class="host-mark">ONLINE</span>'}</div>`).join('')}
            ${lobby.players.length < rules.maxPlayers ? '<div class="full-room-note">Weitere Spieler können mit dem Raumcode beitreten.</div>' : '<div class="full-room-note">Alle Plätze sind belegt.</div>'}
            <div class="invite-box"><div class="invite-icon">↗</div><div><b>Freunde einladen</b><p>Raumcode <strong>${escapeHtml(lobby.code)}</strong> oder Link weitergeben.</p></div><button class="copy-mini" data-action="copy-invite">KOPIEREN</button></div>
          </section>
          <section class="panel rules-panel"><div class="panel-heading"><div><span class="panel-kicker">02 / DEINE STADT, DEINE REGELN</span><h2>Spielregeln</h2></div><span class="rule-icon">⚙</span></div>
            <form id="rules-form" class="rules-form"><fieldset ${playerId !== lobby.hostId ? 'disabled' : ''}>
              <div class="rule-numbers"><label><span>Startkapital</span><div class="money-input"><input type="number" name="startingCash" min="500" max="5000" step="100" value="${rules.startingCash}" /><b>M</b></div></label><label><span>Gehalt bei Start</span><div class="money-input"><input type="number" name="salary" min="50" max="500" step="50" value="${rules.salary}" /><b>M</b></div></label></div>
              <div class="rule-options">
                <label class="switch-row"><span><b>Auktionen</b><small>Freie Grundstücke werden versteigert.</small></span><input type="checkbox" name="auctions" ${rules.auctions ? 'checked' : ''}/><i></i></label>
                <label class="switch-row"><span><b>Doppelte Miete</b><small>Komplette Farbgruppe ohne Häuser.</small></span><input type="checkbox" name="monopolyDoubleRent" ${rules.monopolyDoubleRent ? 'checked' : ''}/><i></i></label>
                <label class="switch-row"><span><b>Freiparktopf</b><small>Steuern landen auf dem freien Platz.</small></span><input type="checkbox" name="freeParkingBonus" ${rules.freeParkingBonus ? 'checked' : ''}/><i></i></label>
              </div>
              <button class="btn btn-small btn-outline save-rules" type="submit">Regeln übernehmen <span>✓</span></button></fieldset>
            </form>
          </section>
          <section class="start-summary"><div class="summary-icon">✦</div><div><span class="panel-kicker">03 / ALLES BEREIT?</span><h3>Deine Stadt wartet.</h3><p>${lobby.players.length} Spieler · ${rules.startingCash.toLocaleString('de-DE')} M Startgeld · ${rules.salary} M Startgehalt · ${rules.auctions ? 'Auktionen an' : 'Auktionen aus'} · ${rules.monopolyDoubleRent ? 'Farbgruppenbonus an' : 'Farbgruppenbonus aus'} · ${rules.freeParkingBonus ? 'Freiparktopf an' : 'Freiparktopf aus'}</p></div><button class="btn btn-primary btn-large" data-action="start-game" ${lobby.players.length < 2 || playerId !== lobby.hostId ? 'disabled' : ''}>Partie starten <span>→</span></button></section>
        </div>
        <p class="lobby-footnote">ⓘ Online-Raum: Der Server verwaltet den gemeinsamen Spielstand. Nur die Spielleitung kann Regeln ändern und die Partie starten.</p>
      </main>
    </div>`;
  $('#rules-form')?.addEventListener('submit', e => {
    e.preventDefault(); const data = new FormData(e.currentTarget);
    const startingCash = Number(data.get('startingCash')), salary = Number(data.get('salary'));
    if (!Number.isInteger(startingCash) || startingCash < 500 || startingCash > 5000 || !Number.isInteger(salary) || salary < 50 || salary > 500) return toast('Bitte gültige Werte für Startkapital und Startgehalt eingeben.', 'error');
    const rules = { ...lobby.rules, startingCash, salary, auctions: data.has('auctions'), monopolyDoubleRent: data.has('monopolyDoubleRent'), freeParkingBonus: data.has('freeParkingBonus') };
    api('rules', { code: lobby.code, playerId, playerToken, rules }).then(applyServerState).then(() => toast('Spielregeln gespeichert.', 'success')).catch(err => toast(err.message, 'error'));
  });
}

function boardCoord(id) {
  if (id === 0) return [11, 11];
  if (id <= 10) return [11, 11 - id];
  if (id <= 19) return [21 - id, 1];
  if (id === 20) return [1, 1];
  if (id <= 29) return [1, id - 19];
  if (id === 30) return [1, 11];
  return [id - 29, 11];
}

function iconFor(tile) {
  return ({ start: '✦', rail: '🚆', utility: '⚡', chance: '✧', chest: '▣', tax: '₥', jail: '⌑', gotojail: '↘', parking: '☼' })[tile.type] || '◆';
}

function renderTile(tile) {
  const [row, col] = boardCoord(tile.id);
  const asset = tileAsset(tile.id);
  const owner = ownerOf(tile.id);
  const players = game.players.filter(p => !p.bankrupt && p.position === tile.id);
  const isCorner = [0, 10, 20, 30].includes(tile.id);
  const orientation = row === 1 ? 'tile-top' : row === 11 ? 'tile-bottom' : col === 1 ? 'tile-left' : 'tile-right';
  const groupColor = tile.color || (tile.type === 'rail' ? '#5C7185' : tile.type === 'utility' ? '#43B9B5' : null);
  const title = tile.name;
  const building = asset.buildings === 5 ? '<span class="hotel-pip">H</span>' : asset.buildings ? `<span class="house-pips">${'▰'.repeat(asset.buildings)}</span>` : '';
  return `<button class="board-tile ${orientation} ${isCorner ? 'tile-corner' : ''} ${selectedTile === tile.id ? 'tile-selected' : ''} ${asset.mortgaged ? 'tile-mortgaged' : ''}" style="grid-row:${row};grid-column:${col};--tile-color:${groupColor || 'transparent'}" data-action="select-tile" data-tile="${tile.id}" aria-label="${escapeHtml(title)}${owner ? ', gehört ' + escapeHtml(owner.name) : ''}">
    ${groupColor ? `<span class="tile-band" style="background:${groupColor}"></span>` : ''}
    <span class="tile-symbol">${iconFor(tile)}</span><span class="tile-name">${escapeHtml(title)}</span>
    ${tile.price ? `<span class="tile-price">${tile.price} M</span>` : `<span class="tile-subtitle">${escapeHtml(tile.subtitle || '')}</span>`}
    ${owner ? `<span class="tile-owner" style="--owner:${owner.color}" title="${escapeHtml(owner.name)}"></span>` : ''}
    ${building}
    ${asset.mortgaged ? '<span class="mortgage-label">BELEIHEN</span>' : ''}
    ${players.length ? `<span class="tile-tokens">${players.map(p => `<i style="--player:${p.color}" title="${escapeHtml(p.name)}">${escapeHtml(p.name.slice(0, 1).toUpperCase())}</i>`).join('')}</span>` : ''}
  </button>`;
}

function boardHTML() {
  return `<div class="board-stage"><div class="board-shadow"></div><div class="board-grid">${BOARD.map(renderTile).join('')}
    <div class="board-center" style="grid-row:2 / 11;grid-column:2 / 11">
      <div class="center-glow"></div><div class="center-head"><span class="center-overline">THE CITY IS YOURS</span><div class="center-logo">FORTUNE <b>DISTRICT</b><span>✦</span></div><div class="center-rule"></div></div>
      <div class="center-current"><span class="center-turn-label">JETZT AM ZUG</span><div class="center-player"><i style="--player:${current().color}">${escapeHtml(current().name.slice(0, 1).toUpperCase())}</i><strong>${escapeHtml(current().name)}</strong></div><div class="center-cash">${money(current().cash)} <small>VERMÖGEN IN BAR</small></div></div>
      <div class="center-dice ${rollAnimating ? 'is-rolling' : ''}">${game.dice ? game.dice.map(n => `<div class="die die-${n}">${['','⚀','⚁','⚂','⚃','⚄','⚅'][n]}</div>`).join('') : '<div class="die die-placeholder">⚄</div><div class="die die-placeholder">⚂</div>'}</div>
      <div class="center-roll-caption">${game.lastRoll ? `LETZTER WURF · ${game.lastRoll.total}` : 'WÜRFELN & LOSZIEHEN'}</div>
      <div class="center-bottom"><span>STRASSEN · GLÜCK · GESCHICK</span><b>EST. 2026</b></div>
    </div></div></div>`;
}

function actionPanel() {
  const player = game.phase === 'trade-response' ? game.players.find(p => p.id === game.trade?.toId) : game.phase === 'auction' ? game.players.find(p => p.id === game.auction?.currentBidder) : current();
  const phase = game.phase;
  if (phase !== 'game-over' && player?.id !== playerId) return `<div class="action-card"><div class="action-kicker">BITTE WARTEN</div><div class="action-icon">⌛</div><h3>${escapeHtml(player?.name || 'Ein Mitspieler')} ist am Zug.</h3><p>Dein Spielbrett wird automatisch aktualisiert, sobald die nächste Aktion erfolgt.</p></div>`;
  if (phase === 'game-over') return `<div class="action-card game-winner"><div class="action-kicker">DIE PARTIE IST ENTSCHIEDEN</div><div class="winner-stars">✦ ✧ ✦</div><h3>${escapeHtml(game.players.find(p => p.id === game.winnerId)?.name || 'Niemand')} gewinnt!</h3><p>Das Stadtimperium hat einen neuen Kopf.</p><button class="btn btn-primary btn-block" data-action="new-game">Neue Partie vorbereiten</button></div>`;
  if (phase === 'property-choice') {
    const tile = BOARD[game.pendingTile];
    const disabled = player.cash < tile.price;
    return `<div class="action-card"><div class="action-kicker">DEIN NÄCHSTER SCHRITT</div><div class="action-icon property-icon" style="--tile-color:${tile.color || '#7b8aa0'}">⌂</div><h3>${escapeHtml(tile.name)}</h3><p>Dieses Grundstück ist noch frei. Möchtest du es in dein Viertel aufnehmen?</p><div class="price-row"><span>Kaufpreis</span><strong>${money(tile.price)}</strong></div><button class="btn btn-primary btn-block" data-action="buy" ${disabled ? 'disabled' : ''}>${disabled ? 'Zu wenig Bargeld' : 'Grundstück kaufen'} <span>→</span></button><button class="btn btn-text btn-block" data-action="decline-buy">${game.rules.auctions ? 'Versteigern lassen' : 'Nicht kaufen'}</button></div>`;
  }
  if (phase === 'auction') {
    const a = game.auction; const bidder = game.players.find(p => p.id === a.currentBidder); const min = a.highBid ? a.highBid + 10 : 10;
    return `<div class="action-card auction-card"><div class="action-kicker">LIVE-AUKTION</div><div class="auction-gavel">⚖</div><h3>${escapeHtml(BOARD[a.tileId].name)}</h3><p>${bidder ? `${escapeHtml(bidder.name)} ist an der Reihe.` : 'Auktion wird fortgesetzt.'}</p><div class="auction-bid"><span>HÖCHSTGEBOT</span><strong>${money(a.highBid)}</strong><small>${a.highBidder ? escapeHtml(game.players.find(p => p.id === a.highBidder)?.name) : 'Noch kein Gebot'}</small></div>${bidder?.id === player.id ? `<div class="auction-controls"><button class="btn btn-primary btn-block" data-action="auction-bid" data-amount="${min}" ${min > (bidder?.cash || 0) ? 'disabled' : ''}>${money(min)} bieten</button><button class="btn btn-text btn-block" data-action="auction-pass">Passen</button></div>` : '<div class="waiting-note"><span class="pulse-dot"></span> Warte auf das Gebot des Mitspielers …</div>'}<div class="auction-order">${a.participants.map(id => { const p = game.players.find(x => x.id === id); return `<span class="auction-player ${a.passed.includes(id) ? 'passed' : ''} ${id === a.currentBidder ? 'bidding' : ''}" style="--player:${p.color}">${escapeHtml(p.name.slice(0, 1))}</span>`; }).join('')}</div></div>`;
  }
  if (phase === 'trade-response') {
    const t = game.trade; const from = game.players.find(p => p.id === t.fromId); const to = game.players.find(p => p.id === t.toId);
    return `<div class="action-card"><div class="action-kicker">HANDELSANGEBOT</div><div class="action-icon">⇄</div><h3>${escapeHtml(from.name)} bietet dir …</h3><div class="trade-summary"><div><small>DU ERHÄLTST</small><b>${money(t.offerCash)}</b><p>${t.offerTiles.map(id => escapeHtml(BOARD[id].name)).join(', ') || 'Keine Grundstücke'}</p></div><div><small>DU GIBST AB</small><b>${money(t.requestCash)}</b><p>${t.requestTiles.map(id => escapeHtml(BOARD[id].name)).join(', ') || 'Keine Grundstücke'}</p></div></div>${player.id === to.id ? `<button class="btn btn-primary btn-block" data-action="trade-accept">Handel annehmen</button><button class="btn btn-text btn-block" data-action="trade-decline">Ablehnen</button>` : `<p class="waiting-note">${escapeHtml(to.name)} muss den Handel annehmen oder ablehnen.</p>`}</div>`;
  }
  if (phase === 'jail-choice') {
    return `<div class="action-card jail-card"><div class="action-kicker">DEIN ZUG · GEFÄNGNIS</div><div class="action-icon jail-icon">⌑</div><h3>Eine kleine Zwangspause.</h3><p>Du sitzt fest. Wähle, wie du wieder auf die Straßen kommst.</p><button class="btn btn-primary btn-block" data-action="jail-roll">Auf einen Pasch hoffen</button><button class="btn btn-secondary btn-block" data-action="jail-pay">${money(game.rules.jailBail)} Freikauf zahlen</button><button class="btn btn-text btn-block" data-action="jail-card" ${player.getOutCards < 1 ? 'disabled' : ''}>Haftfrei-Pass einsetzen (${player.getOutCards})</button></div>`;
  }
  if (phase === 'await-end' && player.jailed) {
    return `<div class="action-card jail-card"><div class="action-kicker">ZUG BEENDET · GEFÄNGNIS</div><div class="action-icon jail-icon">⌑</div><h3>Du bleibst noch sitzen.</h3><p>Diesmal kein Pasch. Der nächste Spieler ist an der Reihe.</p><button class="btn btn-primary btn-block" data-action="end-turn">Nächster Spieler <span>→</span></button></div>`;
  }
  if (phase === 'await-end') {
    return `<div class="action-card"><div class="action-kicker">ZUG ERLEDIGT</div><div class="action-icon success-icon">✓</div><h3>Gut gespielt, ${escapeHtml(player.name)}.</h3><p>${game.extraTurn ? 'Du hast einen Pasch gewürfelt und bekommst einen Extrazug.' : 'Dein Zug ist abgeschlossen. Gib den Spieltisch weiter.'}</p><button class="btn btn-primary btn-block" data-action="end-turn">${game.extraTurn ? 'Extrazug starten' : 'Nächster Spieler'} <span>→</span></button><button class="btn btn-text btn-block" data-action="trade-open">Vorher noch handeln</button></div>`;
  }
  if (phase === 'await-roll') {
    return `<div class="action-card"><div class="action-kicker">DEIN ZUG · SPIELER ${game.turnIndex + 1}</div><div class="action-icon dice-action">⚄</div><h3>Würfelglück, ${escapeHtml(player.name)}?</h3><p>Wirf die Würfel und entdecke, was die Stadt heute für dich bereithält.</p><button class="btn btn-primary btn-block" data-action="roll" ${rollAnimating ? 'disabled' : ''}>${rollAnimating ? 'Würfelt …' : 'Jetzt würfeln'} <span>⚄</span></button><button class="btn btn-text btn-block" data-action="trade-open">Handel vorschlagen</button></div>`;
  }
  return `<div class="action-card"><h3>Spielaktion</h3><p>Diese Aktion ist gerade nicht verfügbar.</p></div>`;
}

function selectedAssetPanel() {
  if (selectedTile === null || !game) return '';
  const tile = BOARD[selectedTile], asset = tileAsset(selectedTile), owner = ownerOf(selectedTile), player = current();
  const isMine = owner?.id === player.id;
  if (!['property', 'rail', 'utility'].includes(tile.type)) return `<div class="asset-detail"><div class="detail-title"><b>${escapeHtml(tile.name)}</b><button data-action="clear-tile" aria-label="Schließen">×</button></div><p>${escapeHtml(tile.subtitle || 'Ein besonderes Feld auf deiner Route.')}</p></div>`;
  const rents = tile.type === 'property' ? tile.rent.map((r, i) => `<div><span>${i === 0 ? 'Grundmiete' : i === 5 ? 'Hotel' : `${i} Haus${i > 1 ? 'er' : ''}`}</span><b>${money(r * (i === 0 && game.rules.monopolyDoubleRent && groupIsComplete(game, owner?.id, tile.id) ? 2 : 1))}</b></div>`).join('') : `<div><span>Aktuelle Miete</span><b>${money(owner ? getRent(game, tile.id) : 0)}</b></div>`;
  return `<div class="asset-detail"><div class="detail-title"><div><small>GRUNDSTÜCKSDETAILS</small><b>${escapeHtml(tile.name)}</b></div><button data-action="clear-tile" aria-label="Schließen">×</button></div><div class="detail-color" style="--tile-color:${tile.color || '#5C7185'}"></div><div class="detail-line"><span>Kaufpreis</span><b>${money(tile.price)}</b></div><div class="detail-line"><span>Besitzer</span><b>${owner ? escapeHtml(owner.name) : 'Frei'}</b></div>${asset.mortgaged ? '<div class="mortgage-state">BELEIHT · KEINE MIETE</div>' : ''}<div class="rent-table">${rents}</div>${isMine && ['property', 'rail', 'utility'].includes(tile.type) ? `<div class="manage-actions">${tile.type === 'property' ? `<button data-action="build" data-tile="${tile.id}" ${!groupIsComplete(game, player.id, tile.id) || asset.mortgaged || asset.buildings >= 5 || player.cash < tile.houseCost ? 'disabled' : ''}>${asset.buildings === 4 ? 'Hotel bauen' : 'Haus bauen'} · ${money(tile.houseCost)}</button>${asset.buildings > 0 ? `<button data-action="sell-building" data-tile="${tile.id}">Ausbaustufe verkaufen</button>` : ''}` : ''}${asset.mortgaged ? `<button data-action="unmortgage" data-tile="${tile.id}">Auslösen · ${money(Math.ceil(tile.price * .55))}</button>` : `<button data-action="mortgage" data-tile="${tile.id}" ${tile.group && BOARD.filter(t => t.group === tile.group).some(t => tileAsset(t.id).buildings > 0) ? 'disabled' : ''}>Beleihen · ${money(Math.floor(tile.price / 2))}</button>`}</div>` : ''}</div>`;
}

function portfolioHTML() {
  const player = current();
  const owned = BOARD.filter(t => tileAsset(t.id).ownerId === player.id);
  return `<div class="portfolio-block"><div class="side-section-title"><span>DEIN PORTFOLIO</span><b>${owned.length} FELDER</b></div>${owned.length ? `<div class="portfolio-list">${owned.map(tile => { const asset = tileAsset(tile.id); return `<button class="portfolio-item ${selectedTile === tile.id ? 'chosen' : ''}" data-action="select-tile" data-tile="${tile.id}"><i style="--tile-color:${tile.color || '#60748a'}"></i><span>${escapeHtml(tile.name)}<small>${asset.mortgaged ? 'Beleihung aktiv' : asset.buildings ? (asset.buildings === 5 ? 'Hotel' : `${asset.buildings} Häuser`) : 'Grundstück'}</small></span><b>${money(tile.price)}</b></button>`; }).join('')}</div>` : '<div class="empty-portfolio">Noch keine Grundstücke.<br>Dein erstes wartet schon.</div>'}</div>`;
}

function playersHTML() {
  return `<div class="players-block"><div class="side-section-title"><span>SPIELRUNDE</span><b>${alivePlayers().length} AKTIV</b></div><div class="players-mini">${game.players.map((p, i) => `<div class="mini-player ${p.bankrupt ? 'eliminated' : ''} ${p.id === current().id ? 'is-current' : ''}"><i style="--player:${p.color}">${escapeHtml(p.name.slice(0, 1).toUpperCase())}</i><span><b>${escapeHtml(p.name)}</b><small>${p.bankrupt ? 'Ausgeschieden' : `Feld ${p.position} · ${p.jailed ? 'Gefängnis' : 'Im Spiel'}`}</small></span><strong>${money(p.cash)}</strong></div>`).join('')}</div></div>`;
}

function renderGame() {
  if (!game) return renderLobby();
  if (game.status === 'finished') game.phase = 'game-over';
  const phaseLabel = ({ 'await-roll': 'WÜRFELBEREIT', 'await-end': 'ZUG ABSCHLIESSEN', 'property-choice': 'KAUFENTSCHEIDUNG', auction: 'AUKTION LÄUFT', 'jail-choice': 'GEFÄNGNIS', 'trade-response': 'HANDEL', 'game-over': 'PARTIE BEENDET' })[game.phase] || 'IM SPIEL';
  app.innerHTML = `
    <div class="game-shell">
      <header class="topbar game-topbar"><a class="brand" href="#"><span class="brand-mark">F<span>✦</span></span><span>FORTUNE <b>DISTRICT</b></span></a><div class="game-top-center"><span class="turn-pill"><i></i>${phaseLabel}</span><span class="round-label">RUNDE <b>${game.round}</b></span><span class="room-chip">RAUM <b>${escapeHtml(game.id)}</b></span></div><div class="topbar-right"><span class="demo-pill"><i></i> ONLINE · ${online ? 'VERBUNDEN' : 'VERBINDE NEU …'}</span><button class="icon-btn" data-action="toggle-rules" aria-label="Regelhinweise">?</button></div></header>
      <main class="game-main"><div class="game-heading"><div><div class="eyebrow">DIE STADT LIEGT VOR DIR</div><h1>Der Spieltisch.</h1></div><div class="game-heading-right"><span class="connection-status"><i></i> ${online ? 'LIVE SYNCHRONISIERT' : 'VERBINDUNG WIRD WIEDERHERGESTELLT'}</span><span class="total-round">${game.players.length} SPIELER · ${money(game.rules.startingCash)} STARTGELD</span></div></div>
        <div class="game-layout"><section class="board-column"><div class="board-toolbar"><div><span class="board-caption">DAS SPIELFELD</span><span class="board-subcaption">40 FELDER · 1 GROSSE STADT</span></div><div class="board-tools"><button class="zoom-btn" data-action="zoom-out" aria-label="Brett verkleinern">−</button><button class="zoom-btn" data-action="zoom-reset" aria-label="Brettgröße zurücksetzen">100%</button><button class="zoom-btn" data-action="zoom-in" aria-label="Brett vergrößern">+</button><button class="zoom-btn camera-btn" data-action="rotate-board" aria-label="Kameraneigung umschalten">3D</button></div></div><div class="board-scroll"><div class="board-zoom" id="board-zoom">${boardHTML()}</div></div><details class="board-access"><summary>Textansicht des Spielbretts öffnen</summary><div class="accessible-board"><ol>${BOARD.map(tile => { const own = ownerOf(tile.id); const at = game.players.filter(p => !p.bankrupt && p.position === tile.id); return `<li><b>${escapeHtml(tile.name)}</b> — ${escapeHtml(tile.type)}${own ? ` · ${escapeHtml(own.name)}` : ''}${at.length ? ` · Hier: ${at.map(p => escapeHtml(p.name)).join(', ')}` : ''}</li>`; }).join('')}</ol></div></details>
          <div class="game-log"><div class="log-heading"><span>STADTGESPRÄCH</span><small>LETZTE EREIGNISSE</small></div><div class="log-items">${game.log.slice(0, 4).map(entry => `<div class="log-entry log-${entry.kind}"><i>✦</i><span>${escapeHtml(entry.message)}</span></div>`).join('') || '<div class="log-entry">Die Stadt erwacht …</div>'}</div></div>
        </section>
        <aside class="game-sidebar"><div class="turn-player-card" style="--player:${current().color}"><div class="turn-card-top"><span>AKTIVER SPIELER</span><b>0${game.turnIndex + 1}</b></div><div class="turn-player-name"><i>${escapeHtml(current().name.slice(0, 1).toUpperCase())}</i><strong>${escapeHtml(current().name)}</strong></div><div class="turn-player-bottom"><div><small>BARVERMÖGEN</small><b>${money(current().cash)}</b></div><div><small>IMMOBILIENWERT</small><b>${money(getPortfolioValue(game, current().id))}</b></div></div></div>
          ${actionPanel()}
          ${selectedAssetPanel()}
          ${playersHTML()}
          ${portfolioHTML()}
          <button class="btn btn-outline trade-open" data-action="trade-open" ${['auction', 'trade-response', 'property-choice', 'game-over'].includes(game.phase) ? 'disabled' : ''}>⇄ Handel vorschlagen</button>
          <div class="sidebar-foot">LOCAL PLAY · BUILT FOR GAME NIGHT <span>✦</span></div>
        </aside></div>
      </main>
      <footer class="game-footer"><span>FORTUNE DISTRICT <b>·</b> DEIN STADT-BRETTSPIEL</span><span><i></i> ONLINE-SPIELSTAND · ${online ? 'SERVER-SYNCHRONISIERT' : 'VERBINDUNG WIRD WIEDERHERGESTELLT'}</span><button data-action="leave-lobby">SPIELRAUM VERLASSEN ↗</button></footer>
    </div>
    <div id="modal-root"></div>`;
  const zoom = Number(sessionStorage.getItem('fd-zoom') || 100);
  const node = $('#board-zoom');
  if (node) { node.style.setProperty('--board-zoom', zoom / 100); }
  const angle = Number(sessionStorage.getItem('fd-angle') || 1);
  const grid = $('.board-grid');
  if (grid) grid.style.setProperty('--board-tilt', `${angle}deg`);
}

function render() {
  document.body.classList.toggle('playing', !!game);
  if (game) renderGame(); else if (lobby) renderLobby(); else renderLanding();
}

function doAction(type, extra = {}) {
  if (!game || !playerId) return;
  const action = type === 'auction-pass' ? { type: 'auction-bid', amount: null } : { type, ...extra };
  api('action', { code: lobby?.code || game.id, playerId, playerToken, action }).then(applyServerState).catch(error => toast(error.message || 'Aktion nicht möglich.', 'error'));
}

function openTradeModal() {
  const from = current();
  const opponents = alivePlayers().filter(p => p.id !== from.id);
  if (!opponents.length) return toast('Es gibt keine Mitspieler für einen Handel.', 'error');
  const target = opponents[0];
  const own = BOARD.filter(t => tileAsset(t.id).ownerId === from.id && tileAsset(t.id).buildings === 0 && !tileAsset(t.id).mortgaged);
  const theirs = BOARD.filter(t => tileAsset(t.id).ownerId === target.id && tileAsset(t.id).buildings === 0 && !tileAsset(t.id).mortgaged);
  $('#modal-root').innerHTML = `<div class="modal-backdrop" data-action="close-modal"><section class="trade-modal" role="dialog" aria-modal="true" aria-labelledby="trade-title"><div class="modal-top"><div><span class="panel-kicker">GESCHÄFTE & ABSPRACHEN</span><h2 id="trade-title">Ein Handel auf dem Tisch.</h2></div><button data-action="close-modal" aria-label="Schließen">×</button></div><form id="trade-form"><label class="field-label">HANDELSPARTNER</label><select name="toId" id="trade-target">${opponents.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('')}</select><div class="trade-columns"><div class="trade-column"><h3>DU GIBST</h3><label class="field-label">BARGELD</label><input name="offerCash" type="number" min="0" max="${from.cash}" step="10" value="0"><label class="field-label">GRUNDSTÜCKE</label><div id="offer-properties" class="property-checks">${own.length ? own.map(t => `<label><input type="checkbox" name="offerTiles" value="${t.id}"><span>${escapeHtml(t.name)}</span></label>`).join('') : '<small>Keine frei übertragbaren Grundstücke.</small>'}</div></div><div class="trade-column"><h3>DU MÖCHTEST</h3><label class="field-label">BARGELD</label><input name="requestCash" type="number" min="0" max="${target.cash}" step="10" value="0"><label class="field-label">GRUNDSTÜCKE</label><div id="request-properties" class="property-checks">${theirs.length ? theirs.map(t => `<label><input type="checkbox" name="requestTiles" value="${t.id}"><span>${escapeHtml(t.name)}</span></label>`).join('') : '<small>Keine frei übertragbaren Grundstücke.</small>'}</div></div></div><button class="btn btn-primary btn-block" type="submit">Angebot senden ↗</button></form></section></div>`;
  $('#trade-target').addEventListener('change', e => {
    const partner = game.players.find(p => p.id === e.target.value);
    const available = BOARD.filter(t => tileAsset(t.id).ownerId === partner.id && tileAsset(t.id).buildings === 0 && !tileAsset(t.id).mortgaged);
    $('#request-properties').innerHTML = available.length ? available.map(t => `<label><input type="checkbox" name="requestTiles" value="${t.id}"><span>${escapeHtml(t.name)}</span></label>`).join('') : '<small>Keine frei übertragbaren Grundstücke.</small>';
    $('#trade-form [name=requestCash]').max = partner.cash;
  });
  $('#trade-form').addEventListener('submit', e => {
    e.preventDefault(); const data = new FormData(e.currentTarget);
    try {
      api('action', { code: lobby.code, playerId, playerToken, action: { type: 'trade-propose', toId: data.get('toId'), offerCash: Number(data.get('offerCash')), requestCash: Number(data.get('requestCash')), offerTiles: data.getAll('offerTiles'), requestTiles: data.getAll('requestTiles') } }).then(applyServerState).then(() => toast('Handelsangebot wurde versendet.', 'success')).catch(err => toast(err.message, 'error'));
    } catch (err) { toast(err.message, 'error'); }
  });
}

function copyInvite() {
  const link = `${location.origin}${location.pathname}?room=${encodeURIComponent(lobby?.code || game?.id || '')}`;
  const fallback = () => { const ta = document.createElement('textarea'); ta.value = link; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); toast('Einladungslink kopiert. Freunde können online beitreten.', 'success'); };
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(link).then(() => toast('Einladungslink kopiert. Freunde können online beitreten.', 'success')).catch(fallback); else fallback();
}

app.addEventListener('click', e => {
  const btn = e.target.closest('[data-action]'); if (!btn) return;
  const action = btn.dataset.action;
  if (action === 'leave-lobby') { eventStream?.close(); lobby = null; game = null; selectedTile = null; saveRoom(); render(); return; }
  if (action === 'copy-invite') return copyInvite();
  if (action === 'start-game') {
    if (lobby.players.length < 2) return toast('Füge mindestens einen Mitspieler hinzu.', 'error');
    if (lobby.players.length > lobby.rules.maxPlayers) return toast('Die Spielerzahl überschreitet das eingestellte Limit.', 'error');
    api('start', { code: lobby.code, playerId, playerToken }).then(data => { selectedTile = null; applyServerState(data); }).catch(err => toast(err.message, 'error'));
    return;
  }
  if (action === 'select-tile') { selectedTile = Number(btn.dataset.tile); render(); return; }
  if (action === 'clear-tile') { selectedTile = null; render(); return; }
  if (action === 'trade-open') return openTradeModal();
  if (action === 'toggle-rules') { toast(`Startgeld ${money(game.rules.startingCash)} · Startgehalt ${money(game.rules.salary)} · Auktionen ${game.rules.auctions ? 'an' : 'aus'} · Miete bei Farbgruppe ${game.rules.monopolyDoubleRent ? 'verdoppelt' : 'normal'}.`); return; }
  if (action === 'new-game') { api('reset', { code: lobby.code, playerId, playerToken }).then(data => { selectedTile = null; applyServerState(data); }).catch(err => toast(err.message, 'error')); return; }
  if (action === 'close-modal') { if (e.target === btn) $('#modal-root').innerHTML = ''; return; }
  if (action === 'rotate-board') {
    const angle = Number(sessionStorage.getItem('fd-angle') || 1) === 1 ? 5 : 1;
    sessionStorage.setItem('fd-angle', angle);
    const grid = $('.board-grid'); if (grid) grid.style.setProperty('--board-tilt', `${angle}deg`);
    btn.setAttribute('aria-pressed', String(angle !== 1)); return;
  }
  if (action === 'zoom-in' || action === 'zoom-out' || action === 'zoom-reset') {
    let value = Number(sessionStorage.getItem('fd-zoom') || 100);
    value = action === 'zoom-in' ? Math.min(115, value + 5) : action === 'zoom-out' ? Math.max(80, value - 5) : 100;
    sessionStorage.setItem('fd-zoom', value); $('#board-zoom').style.setProperty('--board-zoom', value / 100); const reset = $('.zoom-btn[data-action="zoom-reset"]'); if (reset) reset.textContent = `${value}%`; return;
  }
  if (action === 'roll') {
    if (rollAnimating) return;
    rollAnimating = true; render();
    setTimeout(() => { rollAnimating = false; doAction('roll'); }, 350);
    return;
  }
  if (action === 'auction-bid') return doAction('auction-bid', { amount: Number(btn.dataset.amount) });
  if (action === 'auction-pass') return doAction('auction-pass');
  if (['buy', 'decline-buy', 'end-turn', 'jail-pay', 'jail-card', 'jail-roll', 'trade-accept', 'trade-decline'].includes(action)) return doAction(action);
  if (['build', 'sell-building', 'mortgage', 'unmortgage'].includes(action)) return doAction(action, { tileId: Number(btn.dataset.tile) });
});



loadRoom();
const queryCode = new URLSearchParams(location.search).get('room');
if (queryCode && playerId) {
  api('rejoin', { code: queryCode.toUpperCase(), playerId, playerToken }).then(data => { applyServerState(data); connectRoom(queryCode.toUpperCase()); }).catch(() => { const name=(prompt('Dein Spielername für diesen Raum?')||'').trim().slice(0,18); if(!name){renderLanding();return;} api('join',{code:queryCode.toUpperCase(),name}).then(data=>{playerId=data.playerId;playerToken=data.playerToken;localStorage.setItem('fd-player-id',playerId);localStorage.setItem('fd-player-token',playerToken);localStorage.setItem('fd-player-name',name);applyServerState(data);connectRoom(queryCode.toUpperCase());}).catch(err=>{renderLanding();toast(err.message,'error');}); });
} else if (queryCode) {
  const savedName = localStorage.getItem('fd-player-name') || '';
  const name = savedName || (prompt('Dein Spielername für diesen Raum?') || '').trim().slice(0,18);
  if (name) api('join', { code: queryCode.toUpperCase(), name }).then(data => { playerId=data.playerId; playerToken=data.playerToken; localStorage.setItem('fd-player-id',playerId); localStorage.setItem('fd-player-token',playerToken); localStorage.setItem('fd-player-name',name); applyServerState(data); connectRoom(queryCode.toUpperCase()); }).catch(err => { toast(err.message,'error'); renderLanding(); });
  else renderLanding();
} else if (lobby?.code && playerId) { api(`room?code=${encodeURIComponent(lobby.code)}&playerId=${encodeURIComponent(playerId)}&playerToken=${encodeURIComponent(playerToken)}`).then(data => { applyServerState(data); connectRoom(lobby.code); }).catch(() => { lobby=null; game=null; render(); }); }
else render();
