import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
async function freePort() {
  const socket = net.createServer();
  await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve));
  const { port } = socket.address();
  await new Promise(resolve => socket.close(resolve));
  return port;
}
async function boot(port, dataDir) {
  const child = spawn(process.execPath, ['server.mjs'], { cwd: root, env: { ...process.env, PORT: String(port), DATA_DIR: dataDir }, stdio: 'ignore' });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(`${base}/api/health`)).ok) return { child, base }; } catch {}
    await new Promise(resolve => setTimeout(resolve, 75));
  }
  child.kill();
  throw new Error('Testserver konnte nicht gestartet werden.');
}
async function stop(child) {
  if (child.exitCode !== null) return;
  child.kill();
  await new Promise(resolve => child.once('exit', resolve));
}
async function post(base, endpoint, payload) {
  const response = await fetch(`${base}/api/${endpoint}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
  return { status: response.status, data: await response.json() };
}

test('Online-Räume synchronisieren Aktionen, lehnen falsche Züge ab und überstehen Serverneustarts', async t => {
  const port = await freePort();
  const dataDir = await mkdtemp(path.join(tmpdir(), 'fortune-district-'));
  let server = await boot(port, dataDir);
  t.after(async () => { await stop(server.child); await rm(dataDir, { recursive: true, force: true }); });

  const host = (await post(server.base, 'create', { name: 'Host', maxPlayers: 3, startingCash: 1500 })).data;
  const guest = (await post(server.base, 'join', { code: host.lobby.code, name: 'Gast' })).data;
  assert.equal((await post(server.base, 'start', { code: host.lobby.code, playerId: host.playerId, playerToken: host.playerToken })).status, 200);

  const invalid = await post(server.base, 'action', { code: host.lobby.code, playerId: guest.playerId, playerToken: guest.playerToken, action: { type: 'roll' } });
  assert.equal(invalid.status, 400);
  const valid = await post(server.base, 'action', { code: host.lobby.code, playerId: host.playerId, playerToken: host.playerToken, action: { type: 'roll' } });
  assert.equal(valid.status, 200);
  assert.ok(valid.data.game.lastRoll);

  await stop(server.child);
  server = await boot(port, dataDir);
  const restored = await post(server.base, 'rejoin', { code: host.lobby.code, playerId: host.playerId, playerToken: host.playerToken });
  assert.equal(restored.status, 200);
  assert.equal(restored.data.lobby.players.length, 2);
  assert.ok(restored.data.game.lastRoll);
});
