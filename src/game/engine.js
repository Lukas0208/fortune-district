import { BOARD, CARD_DECKS, GROUPS } from './board.js';

const clone = value => structuredClone(value);
const money = n => `${Math.round(n).toLocaleString('de-DE')} M`;
const alive = state => state.players.filter(p => !p.bankrupt);
const active = state => state.players[state.turnIndex];
const prop = (state, id) => state.properties[id];
const square = id => BOARD[id];
const log = (state, message, kind = 'info') => {
  state.log.unshift({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, message, kind });
  state.log = state.log.slice(0, 35);
};
const fail = message => { throw new Error(message); };
const requirePlayer = (state, playerId) => {
  const player = state.players.find(p => p.id === playerId && !p.bankrupt);
  if (!player) fail('Dieser Spieler ist nicht mehr in der Partie.');
  return player;
};
const requireTurn = (state, playerId, phases = ['await-roll', 'await-end', 'property-choice', 'jail-choice']) => {
  const player = requirePlayer(state, playerId);
  if (active(state)?.id !== playerId) fail('Du bist gerade nicht am Zug.');
  if (!phases.includes(state.phase)) fail('Diese Aktion ist in diesem Moment nicht möglich.');
  return player;
};

export const DEFAULT_RULES = Object.freeze({
  startingCash: 1500,
  salary: 200,
  maxPlayers: 6,
  auctions: true,
  monopolyDoubleRent: true,
  freeParkingBonus: false,
  jailBail: 50,
  maxRounds: 0
});

export function createGame(players, rules = {}, roomCode = 'MOHN42') {
  const config = { ...DEFAULT_RULES, ...rules };
  if (!Number.isInteger(config.startingCash) || config.startingCash < 500 || config.startingCash > 5000) fail('Das Startkapital muss zwischen 500 und 5.000 M liegen.');
  if (!Number.isInteger(config.salary) || config.salary < 50 || config.salary > 500) fail('Das Startgehalt muss zwischen 50 und 500 M liegen.');
  if (!Number.isInteger(config.maxPlayers) || config.maxPlayers < 2 || config.maxPlayers > 6) fail('Die Spielerzahl muss zwischen 2 und 6 liegen.');
  if (!Number.isInteger(config.jailBail) || config.jailBail < 0 || config.jailBail > 500) fail('Der Gefängnisfreikauf ist ungültig.');
  if (!Array.isArray(players) || players.length < 2 || players.length > config.maxPlayers) fail('Für eine Partie werden mindestens zwei und höchstens so viele Spieler wie eingestellt benötigt.');
  const normalized = players.map((p, i) => ({
    id: p.id || `p${i + 1}-${Math.random().toString(36).slice(2, 6)}`,
    name: String(p.name || `Spieler ${i + 1}`).trim().slice(0, 18) || `Spieler ${i + 1}`,
    color: p.color || ['#6C8BFF', '#FF9A69', '#4FC6A7', '#D58BE8', '#E8BD55', '#66C4D8'][i % 6],
    cash: config.startingCash,
    position: 0,
    jailed: false,
    jailTurns: 0,
    getOutCards: 0,
    bankrupt: false
  }));
  if (new Set(normalized.map(p => p.id)).size !== normalized.length) fail('Spieler-IDs müssen eindeutig sein.');
  if (new Set(normalized.map(p => p.name.toLowerCase())).size !== normalized.length) fail('Spielernamen müssen eindeutig sein.');
  return {
    id: roomCode,
    status: 'playing',
    players: normalized,
    rules: config,
    turnIndex: 0,
    round: 1,
    phase: 'await-roll',
    properties: BOARD.map(() => ({ ownerId: null, mortgaged: false, buildings: 0 })),
    dice: null,
    lastRoll: null,
    extraTurn: false,
    turnDoubles: 0,
    pendingTile: null,
    auction: null,
    trade: null,
    cardDecks: {
      chance: shuffle(CARD_DECKS.chance.map((c, i) => ({ ...c, cardId: `chance-${i}` }))),
      chest: shuffle(CARD_DECKS.chest.map((c, i) => ({ ...c, cardId: `chest-${i}` })))
    },
    cardIndex: { chance: 0, chest: 0 },
    freeParkingPot: 0,
    log: [],
    winnerId: null,
    startedAt: Date.now()
  };
}

function shuffle(items) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function nextAliveIndex(state, from = state.turnIndex) {
  for (let step = 1; step <= state.players.length; step++) {
    const idx = (from + step) % state.players.length;
    if (!state.players[idx].bankrupt) return idx;
  }
  return from;
}

function checkGameOver(state) {
  const standing = alive(state);
  if (standing.length <= 1) {
    state.status = 'finished';
    state.phase = 'game-over';
    state.winnerId = standing[0]?.id || null;
    if (standing[0]) log(state, `${standing[0].name} gewinnt das Stadtspiel!`, 'success');
    return true;
  }
  return false;
}

function advanceTurn(state) {
  if (checkGameOver(state)) return;
  if (state.extraTurn && !active(state).bankrupt) {
    state.extraTurn = false;
    state.phase = 'await-roll';
    log(state, `${active(state).name} ist wegen eines Paschs noch einmal dran.`, 'success');
    return;
  }
  const old = state.turnIndex;
  state.turnIndex = nextAliveIndex(state, old);
  if (state.turnIndex <= old) state.round++;
  state.extraTurn = false;
  state.turnDoubles = 0;
  state.phase = active(state).jailed ? 'jail-choice' : 'await-roll';
  state.pendingTile = null;
  log(state, `Runde ${state.round}: ${active(state).name} ist am Zug.`, 'turn');
}

function movePlayer(state, player, steps, { collectStart = true } = {}) {
  const old = player.position;
  const raw = old + steps;
  if (collectStart && steps > 0 && raw >= BOARD.length) {
    player.cash += state.rules.salary;
    log(state, `${player.name} passiert Start und erhält ${money(state.rules.salary)}.`, 'money');
  }
  player.position = ((raw % BOARD.length) + BOARD.length) % BOARD.length;
  log(state, `${player.name} zieht auf ${square(player.position).name}.`, 'move');
}

function sendToJail(state, player) {
  player.position = 10;
  player.jailed = true;
  player.jailTurns = 0;
  state.extraTurn = false;
  state.turnDoubles = 0;
  state.phase = 'await-end';
  state.pendingTile = null;
  log(state, `${player.name} muss ins Gefängnis. Der Zug ist beendet.`, 'warning');
}

function getGroupTiles(tileId) {
  const tile = square(tileId);
  if (tile.group) return GROUPS[tile.group];
  if (tile.type === 'rail') return BOARD.filter(s => s.type === 'rail').map(s => s.id);
  if (tile.type === 'utility') return BOARD.filter(s => s.type === 'utility').map(s => s.id);
  return [];
}

function ownsGroup(state, playerId, tileId) {
  const ids = getGroupTiles(tileId);
  return ids.length > 0 && ids.every(id => prop(state, id).ownerId === playerId);
}

function countOwnedType(state, playerId, type) {
  return BOARD.filter(s => s.type === type && prop(state, s.id).ownerId === playerId).length;
}

function rentFor(state, tileId, diceTotal = state.lastRoll?.total || 7) {
  const tile = square(tileId);
  const asset = prop(state, tileId);
  if (!asset.ownerId || asset.mortgaged) return 0;
  if (tile.type === 'property') {
    const base = tile.rent[asset.buildings] || tile.rent[0];
    return asset.buildings === 0 && state.rules.monopolyDoubleRent && ownsGroup(state, asset.ownerId, tileId) ? base * 2 : base;
  }
  if (tile.type === 'rail') {
    const count = countOwnedType(state, asset.ownerId, 'rail');
    return [0, 25, 50, 100, 200][count] || 25;
  }
  if (tile.type === 'utility') {
    const count = countOwnedType(state, asset.ownerId, 'utility');
    return diceTotal * (count === 2 ? 10 : 4);
  }
  return 0;
}

function declareBankrupt(state, player, creditorId = null) {
  const creditor = creditorId ? state.players.find(p => p.id === creditorId && !p.bankrupt) : null;
  for (const tile of BOARD) {
    const asset = prop(state, tile.id);
    if (asset.ownerId !== player.id) continue;
    if (creditor) {
      asset.ownerId = creditor.id;
      asset.mortgaged = false;
      asset.buildings = 0;
    } else {
      asset.ownerId = null;
      asset.mortgaged = false;
      asset.buildings = 0;
    }
  }
  if (creditor) creditor.cash += Math.max(0, player.cash);
  player.cash = 0;
  player.bankrupt = true;
  player.jailed = false;
  log(state, `${player.name} ist zahlungsunfähig und scheidet aus${creditor ? `; Besitz geht an ${creditor.name}` : ''}.`, 'warning');
  checkGameOver(state);
}

function raiseCash(state, player, amount) {
  if (player.cash >= amount) return true;
  // Zuerst Verbesserungen verkaufen, danach unbelastete Grundstücke beleihen.
  const owned = BOARD.filter(tile => prop(state, tile.id).ownerId === player.id);
  for (const tile of owned.filter(t => prop(state, t.id).buildings > 0).sort((a, b) => prop(state, b.id).buildings - prop(state, a.id).buildings)) {
    const asset = prop(state, tile.id);
    while (asset.buildings > 0 && player.cash < amount) {
      const group = getGroupTiles(tile.id).map(id => prop(state, id).buildings);
      const highest = Math.max(...group);
      if (asset.buildings !== highest) break;
      asset.buildings--;
      player.cash += Math.floor(tile.houseCost / 2);
      log(state, `${player.name} verkauft eine ${asset.buildings === 4 ? 'Aufwertung' : 'Haus'}-Ausbaustufe in ${tile.name}.`, 'money');
    }
  }
  for (const tile of owned) {
    const asset = prop(state, tile.id);
    if (player.cash >= amount) break;
    if (asset.mortgaged || asset.buildings > 0) continue;
    asset.mortgaged = true;
    const value = tile.price ? Math.floor(tile.price / 2) : 0;
    player.cash += value;
    log(state, `${tile.name} wird beliehen: +${money(value)}.`, 'money');
  }
  return player.cash >= amount;
}

function pay(state, payer, amount, creditorId = null, reason = 'Zahlung') {
  amount = Math.max(0, Math.round(amount));
  if (amount === 0) return;
  const creditor = creditorId ? state.players.find(p => p.id === creditorId && !p.bankrupt) : null;
  if (!raiseCash(state, payer, amount)) {
    log(state, `${payer.name} kann ${money(amount)} für „${reason}“ nicht aufbringen.`, 'warning');
    declareBankrupt(state, payer, creditor?.id || null);
    return;
  }
  payer.cash -= amount;
  if (creditor) creditor.cash += amount;
  log(state, `${payer.name} zahlt ${money(amount)}${creditor ? ` an ${creditor.name}` : ` (${reason})`}.`, 'money');
}

function landOn(state, player, rng = Math.random) {
  const tile = square(player.position);
  const asset = prop(state, tile.id);
  state.pendingTile = null;
  if (tile.type === 'property' || tile.type === 'rail' || tile.type === 'utility') {
    if (!asset.ownerId) {
      state.pendingTile = tile.id;
      state.phase = 'property-choice';
      log(state, `${tile.name} gehört noch niemandem. Kaufen oder versteigern?`, 'decision');
      return;
    }
    if (asset.ownerId === player.id || asset.mortgaged) {
      state.phase = 'await-end';
      log(state, `${tile.name} gehört bereits ${asset.ownerId === player.id ? 'dir' : 'jemandem (Hypothek)'} – nichts zu zahlen.`, 'info');
      return;
    }
    const rent = rentFor(state, tile.id, state.lastRoll?.total);
    const owner = state.players.find(p => p.id === asset.ownerId);
    if (owner && rent > 0) pay(state, player, rent, owner.id, 'Miete');
    if (state.status === 'finished') return;
    if (player.bankrupt) { advanceTurn(state); return; }
    state.phase = 'await-end';
    return;
  }
  if (tile.type === 'tax') {
    pay(state, player, tile.amount, null, tile.name);
    if (state.status === 'finished') return;
    if (player.bankrupt) { advanceTurn(state); return; }
    if (state.rules.freeParkingBonus) state.freeParkingPot += tile.amount;
    state.phase = 'await-end';
    return;
  }
  if (tile.type === 'parking') {
    if (state.rules.freeParkingBonus && state.freeParkingPot > 0) {
      player.cash += state.freeParkingPot;
      log(state, `${player.name} nimmt den Freiparktopf mit: ${money(state.freeParkingPot)}.`, 'money');
      state.freeParkingPot = 0;
    } else log(state, 'Ein ruhiger Platz zum Durchatmen.', 'info');
    state.phase = 'await-end';
    return;
  }
  if (tile.type === 'gotojail') return sendToJail(state, player);
  if (tile.type === 'chest' || tile.type === 'chance') return drawCard(state, player, tile.type, rng);
  state.phase = 'await-end';
}

function drawCard(state, player, deckName, rng) {
  const deck = state.cardDecks[deckName];
  let index = state.cardIndex[deckName]++;
  if (index >= deck.length) {
    state.cardDecks[deckName] = shuffle(deck);
    state.cardIndex[deckName] = 1;
    index = 0;
  }
  const card = state.cardDecks[deckName][index];
  log(state, `${deckName === 'chance' ? 'Ereigniskarte' : 'Gemeinschaftskarte'}: ${card.text}`, 'card');
  if (card.cash > 0) player.cash += card.cash;
  if (card.cash < 0) pay(state, player, -card.cash, null, 'Karte');
  if (state.status === 'finished') return;
  if (player.bankrupt) { advanceTurn(state); return; }
  if (card.getOut) player.getOutCards++;
  if (card.jail) return sendToJail(state, player);
  if (card.move !== undefined) {
    const was = player.position;
    if (card.move < was && card.passGo) player.cash += state.rules.salary;
    player.position = card.move;
    log(state, `${player.name} zieht auf ${square(card.move).name}${card.passGo && card.move < was ? ` und erhält ${money(state.rules.salary)}` : ''}.`, 'move');
    return landOn(state, player, rng);
  }
  if (card.back) {
    player.position = (player.position - card.back + BOARD.length) % BOARD.length;
    log(state, `${player.name} zieht ${card.back} Felder zurück.`, 'move');
    return landOn(state, player, rng);
  }
  if (card.nextRail) {
    const next = BOARD.filter(s => s.type === 'rail' && s.id > player.position).sort((a, b) => a.id - b.id)[0] || BOARD.find(s => s.type === 'rail');
    if (next.id < player.position) player.cash += state.rules.salary;
    player.position = next.id;
    return landOn(state, player, rng);
  }
  if (card.repairs) {
    const owned = BOARD.filter(t => prop(state, t.id).ownerId === player.id);
    const houses = owned.reduce((sum, t) => sum + Math.min(4, prop(state, t.id).buildings), 0);
    const hotels = owned.filter(t => prop(state, t.id).buildings === 5).length;
    pay(state, player, houses * 25 + hotels * 100, null, 'Reparaturen');
    if (state.status === 'finished') return;
    if (player.bankrupt) { advanceTurn(state); return; }
  }
  if (card.fromEach) {
    for (const other of alive(state).filter(p => p.id !== player.id)) pay(state, other, card.fromEach, player.id, 'Gemeinschaft');
    if (state.status === 'finished') return;
  }
  state.phase = 'await-end';
}

function startAuction(state, tileId) {
  const order = [...state.players.slice(state.turnIndex), ...state.players.slice(0, state.turnIndex)];
  const participants = order.filter(p => !p.bankrupt).map(p => p.id);
  state.auction = { tileId, participants, passed: [], highBid: 0, highBidder: null, currentBidder: participants[0], minRaise: 10 };
  state.phase = 'auction';
  log(state, `Auktion für ${square(tileId).name} beginnt. Mindestgebot: 10 M.`, 'decision');
}

function finishAuction(state) {
  const auction = state.auction;
  if (auction.highBidder) {
    const winner = state.players.find(p => p.id === auction.highBidder);
    winner.cash -= auction.highBid;
    prop(state, auction.tileId).ownerId = winner.id;
    log(state, `${winner.name} ersteigert ${square(auction.tileId).name} für ${money(auction.highBid)}.`, 'success');
  } else log(state, `Für ${square(auction.tileId).name} gab es kein Gebot.`, 'info');
  state.auction = null;
  state.pendingTile = null;
  state.phase = 'await-end';
}

function nextAuctionTurn(state) {
  const a = state.auction;
  const eligible = a.participants.filter(id => !a.passed.includes(id) && !state.players.find(p => p.id === id)?.bankrupt);
  if (eligible.length === 0 || (a.highBidder && eligible.length === 1 && eligible[0] === a.highBidder)) return finishAuction(state);
  const currentAt = eligible.indexOf(a.currentBidder);
  a.currentBidder = eligible[(currentAt + 1 + eligible.length) % eligible.length];
}

function jailRoll(state, player, rng) {
  const d1 = 1 + Math.floor(rng() * 6), d2 = 1 + Math.floor(rng() * 6);
  state.dice = [d1, d2];
  state.lastRoll = { dice: [d1, d2], total: d1 + d2, doubles: d1 === d2 };
  if (d1 === d2) {
    player.jailed = false;
    player.jailTurns = 0;
    log(state, `${player.name} würfelt einen Pasch und ist frei!`, 'success');
    movePlayer(state, player, d1 + d2);
    landOn(state, player, rng);
    return;
  }
  player.jailTurns++;
  log(state, `Kein Pasch. Gefängnisversuch ${player.jailTurns} von 3.`, 'warning');
  if (player.jailTurns >= 3) {
    player.jailed = false;
    player.jailTurns = 0;
    pay(state, player, state.rules.jailBail, null, 'Gefängnisfreikauf');
    if (state.status === 'finished') return;
    if (player.bankrupt) { advanceTurn(state); return; }
    if (!player.bankrupt) {
      log(state, `${player.name} zahlt den Freikauf und rückt weiter.`, 'info');
      movePlayer(state, player, d1 + d2);
      landOn(state, player, rng);
    }
  } else state.phase = 'await-end';
}

function normalRoll(state, player, rng) {
  const d1 = 1 + Math.floor(rng() * 6), d2 = 1 + Math.floor(rng() * 6);
  state.dice = [d1, d2];
  state.lastRoll = { dice: [d1, d2], total: d1 + d2, doubles: d1 === d2 };
  if (d1 === d2) {
    state.turnDoubles++;
    if (state.turnDoubles >= 3) return sendToJail(state, player);
    state.extraTurn = true;
    log(state, `Pasch! ${d1} + ${d2}. Du darfst nach diesem Zug noch einmal würfeln.`, 'success');
  } else state.extraTurn = false;
  movePlayer(state, player, d1 + d2);
  landOn(state, player, rng);
}

function transferCash(from, to, amount) {
  if (amount > from.cash) fail('Für dieses Angebot reicht das Bargeld nicht aus.');
  from.cash -= amount;
  to.cash += amount;
}

export function applyAction(state, playerId, action, rng = Math.random) {
  if (!state || state.status !== 'playing') fail('Diese Partie ist nicht aktiv.');
  const kind = action?.type;
  const player = state.players.find(p => p.id === playerId && !p.bankrupt);
  if (!player && kind !== 'trade-accept' && kind !== 'trade-decline' && kind !== 'auction-bid') fail('Spieler nicht gefunden.');

  switch (kind) {
    case 'roll': {
      requireTurn(state, playerId, ['await-roll']);
      if (player.jailed) fail('Wähle zuerst, wie du das Gefängnis verlassen möchtest.');
      normalRoll(state, player, rng);
      break;
    }
    case 'jail-pay': {
      requireTurn(state, playerId, ['jail-choice']);
      pay(state, player, state.rules.jailBail, null, 'Gefängnisfreikauf');
      if (state.status === 'finished') break;
      if (player.bankrupt) { advanceTurn(state); break; }
      if (!player.bankrupt) {
        player.jailed = false; player.jailTurns = 0;
        log(state, `${player.name} kauft sich frei. Jetzt würfeln!`, 'success');
        state.phase = 'await-roll';
      }
      break;
    }
    case 'jail-card': {
      requireTurn(state, playerId, ['jail-choice']);
      if (!player.getOutCards) fail('Du besitzt keinen Haftfrei-Pass.');
      player.getOutCards--; player.jailed = false; player.jailTurns = 0;
      log(state, `${player.name} setzt einen Haftfrei-Pass ein.`, 'success');
      state.phase = 'await-roll';
      break;
    }
    case 'jail-roll': {
      requireTurn(state, playerId, ['jail-choice']);
      jailRoll(state, player, rng);
      break;
    }
    case 'buy': {
      requireTurn(state, playerId, ['property-choice']);
      const id = state.pendingTile;
      if (id === null || prop(state, id).ownerId) fail('Dieses Grundstück steht nicht zum Kauf.');
      const tile = square(id);
      if (player.cash < tile.price) fail('Dafür hast du nicht genug Bargeld. Du kannst stattdessen versteigern lassen.');
      player.cash -= tile.price;
      prop(state, id).ownerId = player.id;
      log(state, `${player.name} kauft ${tile.name} für ${money(tile.price)}.`, 'success');
      state.pendingTile = null; state.phase = 'await-end';
      break;
    }
    case 'decline-buy': {
      requireTurn(state, playerId, ['property-choice']);
      const id = state.pendingTile;
      if (id === null) fail('Es gibt kein offenes Kaufangebot.');
      if (state.rules.auctions) startAuction(state, id);
      else { log(state, `${player.name} verzichtet auf ${square(id).name}.`, 'info'); state.pendingTile = null; state.phase = 'await-end'; }
      break;
    }
    case 'auction-bid': {
      if (state.phase !== 'auction' || state.auction?.currentBidder !== playerId) fail('Du bist bei dieser Auktion nicht an der Reihe.');
      const bid = action.amount;
      if (bid === null || bid === undefined) {
        if (!state.auction.passed.includes(playerId)) state.auction.passed.push(playerId);
        log(state, `${player.name} passt bei der Auktion.`, 'info');
      } else {
        const min = state.auction.highBid ? state.auction.highBid + state.auction.minRaise : 10;
        if (!Number.isInteger(bid) || bid < min) fail(`Das nächste Gebot muss mindestens ${money(min)} betragen.`);
        if (bid > player.cash) fail('Dein Gebot übersteigt dein Bargeld.');
        state.auction.highBid = bid; state.auction.highBidder = playerId;
        log(state, `${player.name} bietet ${money(bid)}.`, 'decision');
      }
      nextAuctionTurn(state);
      break;
    }
    case 'end-turn': {
      requireTurn(state, playerId, ['await-end']);
      advanceTurn(state);
      break;
    }
    case 'build': {
      requireTurn(state, playerId, ['await-roll', 'await-end']);
      const id = Number(action.tileId), tile = square(id), asset = prop(state, id);
      if (!tile || tile.type !== 'property' || asset.ownerId !== player.id) fail('Du besitzt dieses Grundstück nicht.');
      if (!ownsGroup(state, player.id, id)) fail('Du musst zuerst die ganze Farbgruppe besitzen.');
      const group = getGroupTiles(id);
      if (group.some(gid => prop(state, gid).mortgaged)) fail('In einer beliehenen Farbgruppe darf nicht gebaut werden.');
      if (asset.buildings >= 5) fail('Auf diesem Grundstück steht bereits ein Hotel.');
      const min = Math.min(...group.map(gid => prop(state, gid).buildings));
      if (asset.buildings !== min) fail('Bitte gleichmäßig innerhalb der Farbgruppe bauen.');
      if (player.cash < tile.houseCost) fail('Nicht genug Bargeld für den Ausbau.');
      player.cash -= tile.houseCost; asset.buildings++;
      log(state, `${player.name} baut ${asset.buildings === 5 ? 'ein Hotel' : 'ein Haus'} auf ${tile.name} (${money(tile.houseCost)}).`, 'success');
      break;
    }
    case 'sell-building': {
      requireTurn(state, playerId, ['await-roll', 'await-end']);
      const id = Number(action.tileId), tile = square(id), asset = prop(state, id);
      if (!tile || tile.type !== 'property' || asset.ownerId !== player.id || asset.buildings <= 0) fail('Hier gibt es keinen Ausbau, den du verkaufen kannst.');
      const group = getGroupTiles(id), max = Math.max(...group.map(gid => prop(state, gid).buildings));
      if (asset.buildings !== max) fail('Bitte gleichmäßig innerhalb der Farbgruppe verkaufen.');
      asset.buildings--; const refund = Math.floor(tile.houseCost / 2); player.cash += refund;
      log(state, `${player.name} verkauft eine Ausbaustufe auf ${tile.name} und erhält ${money(refund)}.`, 'money');
      break;
    }
    case 'mortgage': {
      requireTurn(state, playerId, ['await-roll', 'await-end']);
      const id = Number(action.tileId), tile = square(id), asset = prop(state, id);
      if (!tile || !['property', 'rail', 'utility'].includes(tile.type) || asset.ownerId !== player.id) fail('Dieses Feld gehört dir nicht.');
      if (asset.mortgaged) fail('Dieses Grundstück ist bereits beliehen.');
      if (tile.group && getGroupTiles(id).some(gid => prop(state, gid).buildings > 0)) fail('Verkaufe zuerst alle Häuser und Hotels dieser Farbgruppe.');
      asset.mortgaged = true; const value = Math.floor(tile.price / 2); player.cash += value;
      log(state, `${tile.name} wird für ${money(value)} beliehen.`, 'money');
      break;
    }
    case 'unmortgage': {
      requireTurn(state, playerId, ['await-roll', 'await-end']);
      const id = Number(action.tileId), tile = square(id), asset = prop(state, id);
      if (!tile || asset.ownerId !== player.id || !asset.mortgaged) fail('Dieses Grundstück ist nicht beliehen.');
      const cost = Math.ceil(tile.price * 0.55);
      if (player.cash < cost) fail(`Zum Auslösen brauchst du ${money(cost)}.`);
      player.cash -= cost; asset.mortgaged = false;
      log(state, `${player.name} löst ${tile.name} für ${money(cost)} aus.`, 'success');
      break;
    }
    case 'trade-propose': {
      requireTurn(state, playerId, ['await-roll', 'await-end']);
      if (state.trade) fail('Es läuft bereits ein Handel.');
      const other = requirePlayer(state, action.toId);
      if (other.id === player.id) fail('Du kannst nicht mit dir selbst handeln.');
      const offerTiles = (action.offerTiles || []).map(Number), requestTiles = (action.requestTiles || []).map(Number);
      const validateTiles = (ids, owner) => ids.every(id => Number.isInteger(id) && square(id) && prop(state, id).ownerId === owner && prop(state, id).buildings === 0 && !prop(state, id).mortgaged);
      if (!validateTiles(offerTiles, player.id) || !validateTiles(requestTiles, other.id)) fail('Ein Grundstück ist nicht frei übertragbar.');
      const offerCash = Number(action.offerCash || 0), requestCash = Number(action.requestCash || 0);
      if (![offerCash, requestCash].every(n => Number.isInteger(n) && n >= 0) || offerCash > player.cash || requestCash > other.cash) fail('Die Bargeldbeträge sind ungültig oder nicht verfügbar.');
      if (!offerTiles.length && !requestTiles.length && !offerCash && !requestCash) fail('Ein leeres Angebot kann nicht gehandelt werden.');
      state.trade = { fromId: player.id, toId: other.id, offerTiles, requestTiles, offerCash, requestCash, resumePhase: state.phase };
      state.phase = 'trade-response';
      log(state, `${player.name} macht ${other.name} ein Handelsangebot.`, 'decision');
      break;
    }
    case 'trade-accept': {
      const trade = state.trade;
      if (!trade || trade.toId !== playerId) fail('Dieses Handelsangebot ist nicht für dich.');
      const from = requirePlayer(state, trade.fromId), to = requirePlayer(state, trade.toId);
      if (from.cash < trade.offerCash || to.cash < trade.requestCash) fail('Das Angebot ist inzwischen nicht mehr erfüllbar.');
      for (const id of trade.offerTiles) if (prop(state, id).ownerId !== from.id) fail('Ein angebotenes Grundstück hat den Besitzer gewechselt.');
      for (const id of trade.requestTiles) if (prop(state, id).ownerId !== to.id) fail('Ein angefragtes Grundstück hat den Besitzer gewechselt.');
      transferCash(from, to, trade.offerCash); transferCash(to, from, trade.requestCash);
      trade.offerTiles.forEach(id => { prop(state, id).ownerId = to.id; });
      trade.requestTiles.forEach(id => { prop(state, id).ownerId = from.id; });
      state.phase = trade.resumePhase; state.trade = null;
      log(state, `${from.name} und ${to.name} haben einen Handel abgeschlossen.`, 'success');
      break;
    }
    case 'trade-decline': {
      const trade = state.trade;
      if (!trade || trade.toId !== playerId) fail('Dieses Handelsangebot ist nicht für dich.');
      state.phase = trade.resumePhase; state.trade = null;
      log(state, `${state.players.find(p => p.id === playerId).name} lehnt den Handel ab.`, 'info');
      break;
    }
    default: fail('Unbekannte Spielaktion.');
  }
  return state;
}

export function getRent(state, tileId) { return rentFor(state, tileId); }
export function groupIsComplete(state, playerId, tileId) { return ownsGroup(state, playerId, tileId); }
export function getActivePlayer(state) { return active(state); }
export function getTileOwner(state, tileId) { return state.players.find(p => p.id === prop(state, tileId).ownerId) || null; }
export function formatMoney(amount) { return money(amount); }
export function getPortfolioValue(state, playerId) {
  return BOARD.reduce((sum, tile) => {
    const asset = prop(state, tile.id);
    if (asset.ownerId !== playerId) return sum;
    return sum + Math.floor(tile.price / 2) + (asset.buildings * Math.floor((tile.houseCost || 0) / 2));
  }, 0);
}
export function snapshot(state) { return clone(state); }
