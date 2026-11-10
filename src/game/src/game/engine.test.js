import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, createGame, getRent, groupIsComplete } from '../src/game/engine.js';

function setup(names = ['Ada', 'Ben'], rules = {}) {
  return createGame(names.map((name, i) => ({ id: `p${i + 1}`, name, color: ['#111111', '#222222'][i] })), rules, 'TEST42');
}

const fixedRoll = values => { let i = 0; return () => values[i++ % values.length] / 6; };

test('a turn cannot be taken by the wrong player', () => {
  const game = setup();
  assert.throws(() => applyAction(game, 'p2', { type: 'roll' }, fixedRoll([1, 2])), /nicht am Zug/);
});

test('a player can buy an unowned property and balance is charged exactly once', () => {
  const game = setup();
  game.phase = 'property-choice'; game.pendingTile = 1;
  applyAction(game, 'p1', { type: 'buy' });
  assert.equal(game.players[0].cash, 1440);
  assert.equal(game.properties[1].ownerId, 'p1');
  assert.equal(game.phase, 'await-end');
});

test('rent is charged to the tenant and paid to the owner', () => {
  const game = setup();
  game.properties[1].ownerId = 'p2';
  game.players[0].position = 1;
  game.phase = 'await-end';
  // Landing is exercised via a deterministic move from field 39.
  game.phase = 'await-roll'; game.players[0].position = 39;
  applyAction(game, 'p1', { type: 'roll' }, fixedRoll([0, 0]));
  assert.equal(game.players[0].position, 1);
  assert.equal(game.players[0].cash, 1698);
  assert.equal(game.players[1].cash, 1502);
});

test('complete groups double the base rent when the rule is enabled', () => {
  const game = setup();
  game.properties[1].ownerId = 'p2';
  game.properties[3].ownerId = 'p2';
  assert.equal(groupIsComplete(game, 'p2', 1), true);
  assert.equal(getRent(game, 1), 4);
});

test('group development requires complete ownership and builds evenly', () => {
  const game = setup();
  game.properties[1].ownerId = 'p1';
  game.properties[3].ownerId = 'p1';
  applyAction(game, 'p1', { type: 'build', tileId: 1 });
  assert.equal(game.properties[1].buildings, 1);
  assert.throws(() => applyAction(game, 'p1', { type: 'build', tileId: 1 }), /gleichmäßig/);
  applyAction(game, 'p1', { type: 'build', tileId: 3 });
  assert.deepEqual([game.properties[1].buildings, game.properties[3].buildings], [1, 1]);
});

test('mortgage blocks rent and can be redeemed for the configured premium', () => {
  const game = setup();
  game.properties[1].ownerId = 'p1';
  applyAction(game, 'p1', { type: 'mortgage', tileId: 1 });
  assert.equal(game.players[0].cash, 1530);
  assert.equal(getRent(game, 1), 0);
  applyAction(game, 'p1', { type: 'unmortgage', tileId: 1 });
  assert.equal(game.players[0].cash, 1497);
  assert.equal(game.properties[1].mortgaged, false);
});

test('auction advances after a pass and awards the property to the highest bidder', () => {
  const game = setup();
  game.phase = 'property-choice'; game.pendingTile = 1;
  applyAction(game, 'p1', { type: 'decline-buy' });
  assert.equal(game.phase, 'auction');
  applyAction(game, 'p1', { type: 'auction-bid', amount: null });
  assert.equal(game.auction.currentBidder, 'p2');
  applyAction(game, 'p2', { type: 'auction-bid', amount: 40 });
  assert.equal(game.phase, 'await-end');
  assert.equal(game.properties[1].ownerId, 'p2');
  assert.equal(game.players[1].cash, 1460);
});

test('trade transfers both cash and properties only after acceptance', () => {
  const game = setup();
  game.properties[1].ownerId = 'p1';
  game.properties[3].ownerId = 'p2';
  applyAction(game, 'p1', { type: 'trade-propose', toId: 'p2', offerCash: 50, requestCash: 20, offerTiles: [1], requestTiles: [3] });
  assert.equal(game.phase, 'trade-response');
  assert.equal(game.properties[1].ownerId, 'p1');
  applyAction(game, 'p2', { type: 'trade-accept' });
  assert.equal(game.properties[1].ownerId, 'p2');
  assert.equal(game.properties[3].ownerId, 'p1');
  assert.equal(game.players[0].cash, 1470);
  assert.equal(game.players[1].cash, 1530);
});

test('bankruptcy removes a player and the remaining player wins', () => {
  const game = setup();
  game.players[0].cash = 0;
  game.properties[1].ownerId = 'p1';
  game.phase = 'await-roll';
  // Tax action is triggered by a deterministic move to the tax square.
  game.players[0].position = 2;
  applyAction(game, 'p1', { type: 'roll' }, fixedRoll([0, 0]));
  assert.equal(game.players[0].bankrupt, true);
  assert.equal(game.status, 'finished');
  assert.equal(game.winnerId, 'p2');
});

test('three consecutive doubles send a player to jail, including across the extra-turn transition', () => {
  const game = setup(['Ada', 'Ben'], { auctions: false });
  game.players[0].position = 8;
  const doubles = fixedRoll([0, 0]);
  applyAction(game, 'p1', { type: 'roll' }, doubles);
  assert.equal(game.turnDoubles, 1);
  applyAction(game, 'p1', { type: 'end-turn' });
  assert.equal(game.turnIndex, 0);
  assert.equal(game.turnDoubles, 1);
  applyAction(game, 'p1', { type: 'roll' }, doubles);
  assert.equal(game.turnDoubles, 2);
  if (game.phase === 'property-choice') applyAction(game, 'p1', { type: 'decline-buy' });
  applyAction(game, 'p1', { type: 'end-turn' });
  applyAction(game, 'p1', { type: 'roll' }, doubles);
  assert.equal(game.players[0].jailed, true);
  assert.equal(game.players[0].position, 10);
  assert.equal(game.extraTurn, false);
});

test('a failed jail roll ends the turn and the jailed player can act again on their next turn', () => {
  const game = setup(['Ada', 'Ben'], { auctions: false });
  game.players[0].jailed = true;
  game.players[0].position = 10;
  game.phase = 'jail-choice';
  applyAction(game, 'p1', { type: 'jail-roll' }, fixedRoll([0, 1]));
  assert.equal(game.players[0].jailTurns, 1);
  assert.equal(game.phase, 'await-end');
  applyAction(game, 'p1', { type: 'end-turn' });
  assert.equal(game.turnIndex, 1);
  applyAction(game, 'p2', { type: 'roll' }, fixedRoll([0, 1]));
  if (game.phase === 'property-choice') applyAction(game, 'p2', { type: 'decline-buy' });
  applyAction(game, 'p2', { type: 'end-turn' });
  assert.equal(game.turnIndex, 0);
  assert.equal(game.phase, 'jail-choice');
});

test('a bidder cannot bid beyond their cash and invalid actions do not change ownership', () => {
  const game = setup();
  game.phase = 'property-choice'; game.pendingTile = 1;
  applyAction(game, 'p1', { type: 'decline-buy' });
  assert.throws(() => applyAction(game, 'p1', { type: 'auction-bid', amount: 2000 }), /übersteigt/);
  assert.equal(game.properties[1].ownerId, null);
  assert.equal(game.auction.highBid, 0);
});

test('a tax bankruptcy correctly ends the game phase rather than leaving a dead turn', () => {
  const game = setup();
  game.players[0].cash = 0;
  game.players[0].position = 2;
  game.properties[1].ownerId = 'p1';
  applyAction(game, 'p1', { type: 'roll' }, fixedRoll([0, 0]));
  assert.equal(game.status, 'finished');
  assert.equal(game.phase, 'game-over');
});

test('a bankrupt current player is skipped when more than one opponent remains', () => {
  const game = createGame([
    { id: 'p1', name: 'Ada' },
    { id: 'p2', name: 'Ben' },
    { id: 'p3', name: 'Cleo' }
  ], { startingCash: 1500 }, 'TEST43');
  game.players[0].cash = 0;
  game.players[0].position = 2;
  game.properties[1].ownerId = 'p1';
  applyAction(game, 'p1', { type: 'roll' }, fixedRoll([0, 0]));
  assert.equal(game.status, 'playing');
  assert.equal(game.players[0].bankrupt, true);
  assert.equal(game.turnIndex, 1);
  assert.equal(game.phase, 'await-roll');
});

test('invalid settings prevent a new game from being created', () => {
  assert.throws(() => setup(['Ada', 'Ben'], { startingCash: 100 }), /Startkapital/);
  assert.throws(() => setup(['Ada', 'Ada']), /eindeutig/);
});
