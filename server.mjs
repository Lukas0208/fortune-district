import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGame, applyAction, snapshot } from './src/game/engine.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const mime = { '.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml' };
const rooms = new Map();
const dataDir = process.env.DATA_DIR || path.join(root, '.private-data');
const stateFile = path.join(dataDir, 'rooms.json');
async function persistRooms() { await mkdir(dataDir, { recursive: true }); const tmp = `${stateFile}.tmp`; await writeFile(tmp, JSON.stringify([...rooms.entries()])); await rename(tmp, stateFile); }
async function restoreRooms() { try { const saved = JSON.parse(await readFile(stateFile, 'utf8')); for (const [key, value] of saved) rooms.set(key, value); } catch (e) { if (e.code !== 'ENOENT') console.error('Room restore failed:', e.message); } }
const streams = new Map();
const colors = ['#6C8BFF','#FF9A69','#4FC6A7','#D58BE8','#E8BD55','#66C4D8'];
const code = () => Array.from({length:6},()=> 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random()*32)]).join('');
const json = (res,status,data) => { res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Access-Control-Allow-Origin':'*'}); res.end(JSON.stringify(data)); };
const publicRoom = r => ({ lobby:r.lobby, game:r.game ? snapshot(r.game) : null, hostId:r.lobby.hostId });
function broadcast(r) { const payload=`data: ${JSON.stringify(publicRoom(r))}\n\n`; for(const res of streams.get(r.lobby.code)||[]) res.write(payload); }
async function body(req) { let raw=''; for await (const chunk of req) { raw+=chunk; if(raw.length>100_000) throw new Error('Anfrage zu groß'); } return raw ? JSON.parse(raw) : {}; }
const server=http.createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,'http://localhost');
    if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type'});return res.end();}
    if(url.pathname==='/api/health') return json(res,200,{ok:true,rooms:rooms.size});
    if(url.pathname.startsWith('/api/')) {
      if(req.method==='POST' && url.pathname==='/api/create') {
        const b=await body(req); const name=String(b.name||'').trim().slice(0,18); const maxPlayers=Number(b.maxPlayers); const startingCash=Number(b.startingCash);
        if(!name || !Number.isInteger(maxPlayers)||maxPlayers<2||maxPlayers>6||!Number.isInteger(startingCash)||startingCash<500||startingCash>5000) return json(res,400,{error:'Bitte Name, Spielerzahl und Startkapital prüfen.'});
        let c=code(); while(rooms.has(c)) c=code(); const pid=`p-${randomUUID()}`;
        const lobby={code:c,hostId:pid,players:[{id:pid,name,color:colors[0]}],rules:{startingCash,salary:200,maxPlayers,auctions:true,monopolyDoubleRent:true,freeParkingBonus:false,jailBail:50,maxRounds:0},createdAt:Date.now()};
        const token=randomUUID(); const room={lobby,game:null,tokens:{[pid]:token}}; rooms.set(c,room); await persistRooms(); return json(res,201,{...publicRoom(room),playerId:pid,playerToken:token});
      }
      if(req.method==='POST' && url.pathname==='/api/join') {
        const b=await body(req); const c=String(b.code||'').toUpperCase(); const r=rooms.get(c); const name=String(b.name||'').trim().slice(0,18);
        if(!r) return json(res,404,{error:'Raum nicht gefunden. Prüfe den sechsstelligen Code.'});
        if(!name) return json(res,400,{error:'Bitte gib einen Spielernamen ein.'});
        if(r.game) return json(res,409,{error:'Die Partie läuft bereits. Ein neuer Beitritt ist nicht möglich.'});
        if(r.lobby.players.length>=r.lobby.rules.maxPlayers) return json(res,409,{error:'Der Raum ist bereits voll.'});
        if(r.lobby.players.some(p=>p.name.toLowerCase()===name.toLowerCase())) return json(res,409,{error:'Dieser Spielername wird bereits verwendet.'});
        const pid=`p-${randomUUID()}`; const token=randomUUID(); r.lobby.players.push({id:pid,name,color:colors[r.lobby.players.length%colors.length]}); r.tokens ||= {}; r.tokens[pid]=token; await persistRooms(); broadcast(r); return json(res,200,{...publicRoom(r),playerId:pid,playerToken:token});
      }
      if(req.method==='GET' && url.pathname==='/api/room') { const r=rooms.get(String(url.searchParams.get('code')||'').toUpperCase()); if(!r)return json(res,404,{error:'Raum nicht gefunden.'}); const pid=url.searchParams.get('playerId'), token=url.searchParams.get('playerToken'); if(!r.lobby.players.some(p=>p.id===pid) || !token || token!==r.tokens?.[pid])return json(res,403,{error:'Keine Berechtigung für diesen Raum.'}); return json(res,200,publicRoom(r)); }
      if(req.method==='POST' && url.pathname==='/api/rejoin') { const b=await body(req); const r=rooms.get(String(b.code||'').toUpperCase()); if(!r)return json(res,404,{error:'Raum nicht gefunden.'}); if(!r.lobby.players.some(p=>p.id===b.playerId) || !b.playerToken || b.playerToken!==r.tokens?.[b.playerId])return json(res,403,{error:'Spielerkennung ist für diesen Raum nicht gültig.'}); return json(res,200,publicRoom(r)); }
      if(req.method==='GET' && url.pathname==='/api/events') {
        const c=String(url.searchParams.get('code')||'').toUpperCase(); const r=rooms.get(c); if(!r)return json(res,404,{error:'Raum nicht gefunden.'}); const pid=url.searchParams.get('playerId'), token=url.searchParams.get('playerToken'); if(!r.lobby.players.some(p=>p.id===pid) || !token || token!==r.tokens?.[pid])return json(res,403,{error:'Keine Berechtigung für diesen Raum.'});
        res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','Access-Control-Allow-Origin':'*'}); res.write(`data: ${JSON.stringify(publicRoom(r))}\n\n`);
        if(!streams.has(c))streams.set(c,new Set()); streams.get(c).add(res); const ping=setInterval(()=>res.write(': ping\n\n'),20000); req.on('close',()=>{clearInterval(ping);streams.get(c)?.delete(res);}); return;
      }
      if(req.method==='POST' && url.pathname==='/api/rules') { const b=await body(req); const r=rooms.get(String(b.code||'').toUpperCase()); if(!r)return json(res,404,{error:'Raum nicht gefunden.'}); if(r.game)return json(res,409,{error:'Die Partie läuft bereits.'}); if(b.playerId!==r.lobby.hostId || !b.playerToken || b.playerToken!==r.tokens?.[b.playerId])return json(res,403,{error:'Nur die authentifizierte Spielleitung darf Regeln ändern.'}); const rules={...r.lobby.rules,...b.rules}; if(!Number.isInteger(rules.startingCash)||rules.startingCash<500||rules.startingCash>5000||!Number.isInteger(rules.salary)||rules.salary<50||rules.salary>500)return json(res,400,{error:'Ungültige Regelwerte.'}); r.lobby.rules=rules; await persistRooms(); broadcast(r); return json(res,200,publicRoom(r)); }
      if(req.method==='POST' && url.pathname==='/api/start') { const b=await body(req); const r=rooms.get(String(b.code||'').toUpperCase()); if(!r)return json(res,404,{error:'Raum nicht gefunden.'}); if(b.playerId!==r.lobby.hostId || !b.playerToken || b.playerToken!==r.tokens?.[b.playerId])return json(res,403,{error:'Nur die authentifizierte Spielleitung kann starten.'}); if(r.lobby.players.length<2)return json(res,409,{error:'Mindestens zwei Spieler werden benötigt.'}); if(r.game)return json(res,409,{error:'Die Partie läuft bereits.'}); r.game=createGame(r.lobby.players,r.lobby.rules,r.lobby.code); r.game.log.unshift({id:'welcome',message:`Die Partie beginnt. ${r.game.players[0].name} startet. Viel Glück!`,kind:'success'}); await persistRooms(); broadcast(r); return json(res,200,publicRoom(r)); }
      if(req.method==='POST' && url.pathname==='/api/reset') { const b=await body(req); const r=rooms.get(String(b.code||'').toUpperCase()); if(!r)return json(res,404,{error:'Raum nicht gefunden.'}); if(b.playerId!==r.lobby.hostId || !b.playerToken || b.playerToken!==r.tokens?.[b.playerId])return json(res,403,{error:'Nur die authentifizierte Spielleitung darf eine neue Partie vorbereiten.'}); r.game=null; await persistRooms(); broadcast(r); return json(res,200,publicRoom(r)); }
      if(req.method==='POST' && url.pathname==='/api/action') { const b=await body(req); const r=rooms.get(String(b.code||'').toUpperCase()); if(!r)return json(res,404,{error:'Raum nicht gefunden.'}); if(!r.game)return json(res,409,{error:'Die Partie hat noch nicht begonnen.'}); if(!r.lobby.players.some(p=>p.id===b.playerId) || !b.playerToken || b.playerToken!==r.tokens?.[b.playerId])return json(res,403,{error:'Spielerkennung ist ungültig. Bitte erneut beitreten.'}); const before=snapshot(r.game); try { applyAction(r.game,b.playerId,b.action); await persistRooms(); broadcast(r); return json(res,200,publicRoom(r)); } catch(e) { r.game=before; return json(res,400,{error:e.message}); } }
      return json(res,404,{error:'API-Endpunkt nicht gefunden.'});
    }
    const pathname=decodeURIComponent(url.pathname); const requested=pathname==='/'?'/index.html':pathname; const safe=path.resolve(root,`.${requested}`); if((!safe.startsWith(root+path.sep)&&safe!==path.join(root,'index.html')) || safe.startsWith(dataDir+path.sep))throw new Error('invalid path'); const data=await readFile(safe); res.writeHead(200,{'Content-Type':mime[path.extname(safe)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);
  } catch(e) { if(!res.headersSent)json(res,400,{error:e.message||'Ungültige Anfrage.'}); else res.end(); }
});
const port=Number(process.env.PORT||4173); await restoreRooms(); server.listen(port,'0.0.0.0',()=>console.log(`Fortune District mit Online-Räumen läuft auf Port ${port}`));
