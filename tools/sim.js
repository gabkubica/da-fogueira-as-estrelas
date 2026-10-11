// Simulador headless: um "jogador-robô" joga e mede o ritmo das eras.
const fs = require('fs'), vm = require('vm'), path = require('path');
globalThis.window = globalThis;
for (const f of ['util', 'data', 'world', 'galaxy', 'game']) vm.runInThisContext(fs.readFileSync(path.join(__dirname, '../js/' + f + '.js'), 'utf8'), { filename: f });
const G = globalThis.G, game = G.game;
const seed = +(process.argv[2] || 12345);
const maxH = +(process.argv[3] || 10);
const verbose = process.argv.includes('-v');
game.start(game.newState({ seed, civName: 'Teste', color: '#b3261e', voice: 5 }));
const s = game.s;
const eraT = [0];
let lastEra = 0;
const dt = 0.5;
function botStep() {
  const d = game.d;
  if (s.cd.effort <= s.time) game.effort(s.era < 2 ? 'materials' : 'knowledge');
  // pesquisa
  const open = G.TECHS.filter((t) => game.techState(t) === 'open').sort((a, b) => game.techCost(a).knowledge - game.techCost(b).knowledge);
  if (open.length) game.research(open[0].id);
  // políticas
  if (s.policies.length < d.slots) { const p = [...d.pols].find((x) => !s.policies.includes(x)); if (p) game.togglePolicy(p); }
  // anexar rivais
  for (const rv of s.rivals) if (game.canAnnex(rv.id)) { if (!game.annex(rv.id, 'military')) game.annex(rv.id, 'culture'); }
  // maravilhas
  for (const w of G.WONDERS) if (game.wonderState(w) === 'open') game.buildWonder(w.id);
  // espaço
  for (const b of G.BODIES) if (game.bodyUnlocked(b)) game.advanceBody(b.id);
  if (game.gal) { for (let i = 0; i < 5; i++) if (!game.colonizeBest()) break;
    s.galaxy.aliens.forEach((a) => { const acts = game.alienActions(a); for (const id of ['integrate', 'ally', 'attack', 'gift', 'exchange']) { const x = acts.find((y) => y.id === id); if (x && x.ok && game.alienAct(a.id, id)) break; } if (a.contact && !a.gone && !a.war && a.rel < 0 && game.alienSys[game.alienIdx(a.id)] < 60) game.alienAct(a.id, 'war'); });
  }
  // expandir: até 3 terras por passo se sobrar
  for (let i = 0; i < 3; i++) { const h = game.bestTile(); if (h < 0) break; const c = game.tileCost(h); if (s.res.food >= c.food && s.res.materials >= c.materials * 1.0) game.claimTile(h); else break; }
  // construir o mais barato (normalizado)
  for (let i = 0; i < 4; i++) {
    let best = null, bc = Infinity;
    for (const b of G.BUILDINGS) { if (b.era > s.era || b.era < s.era - 2) continue; const c = game.buildingCost(b.id); let tot = 0; for (const k in c) tot += c[k] / Math.max(1, s.res[k]); if (tot < bc) { bc = tot; best = b.id; } }
    if (!best || !game.buy(best, 1)) break;
  }
  // pesos: força quando há rivais vizinhos
  s.weights.military = game.frontier().touch.size ? 3 : 1;
  s.auto.expand = s.auto.build = s.auto.research = s.auto.colonize = true;
}
let t = 0, next = 0;
while (t < maxH * 3600) {
  game.tick(dt, false);
  if (s.event) game.chooseEvent(0);
  for (const k in s.res) if (isNaN(s.res[k])) { console.log("NaN", k, "t", t, "era", s.era, JSON.stringify(s.space.bodies), s.event, JSON.stringify(s.buffs)); process.exit(); }
  t += dt;
  if (t >= next) { botStep(); next = t + 1; }
  if (s.era !== lastEra) {
    eraT[s.era] = t; lastEra = s.era;
    const prev = eraT[s.era - 1] || 0;
    console.log(`era ${s.era} ${G.ERAS[s.era].name.padEnd(22)} em ${(t / 60).toFixed(1).padStart(6)} min (+${((t - prev) / 60).toFixed(1)}) pop ${G.fmt(s.pop)} terr ${game.ownedLand} (${(game.landFrac()*100).toFixed(0)}%) rivais vivos ${s.rivals.filter(r=>r.alive).length} edif ${Object.values(s.buildings).reduce((a,b)=>a+b,0)} marav ${Object.keys(s.wonders).length}`);
  }
  if (verbose && Math.floor(t) % 120 === 0 && t % 1 === 0) {
    const r = game.rate;
    console.log(`  t=${(t/60).toFixed(0)}m era ${s.era} pop ${G.fmt(s.pop)}/${G.fmt(game.capacity())} terr ${game.ownedLand} techs ${Object.keys(s.techs).length} | ${G.RES_ORDER.map(k => k[0] + ':' + G.fmt(s.res[k]) + '(' + G.fmt(r[k]) + ')').join(' ')} | nextTile ${G.fmt((game.bestTile() >= 0 ? game.tileCost(game.bestTile()).food : 0))}`);
  }
  if (s.victory) { console.log('VITÓRIA em', (t / 3600).toFixed(2), 'h'); break; }
}
console.log('fim: era', s.era, 'pop', G.fmt(s.pop), 'sistemas', game.galCount || 0, 'tempo', (t / 3600).toFixed(2), 'h', 'legado', game.legacyGain());
