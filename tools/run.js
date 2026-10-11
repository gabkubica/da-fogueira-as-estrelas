// Executa uma partida simulada e devolve os tempos de chegada a cada era.
const G = require('./dbg.js'); const game = G.game;
function botStep(s) {
  const d = game.d;
  if (s.cd.effort <= s.time) game.effort(s.era < 1 ? 'materials' : 'knowledge');
  const open = G.TECHS.filter((t) => game.techState(t) === 'open').sort((a, b) => game.techCost(a).knowledge - game.techCost(b).knowledge);
  if (open.length) game.research(open[0].id);
  if (s.policies.length < d.slots) { const p = [...d.pols].find((x) => !s.policies.includes(x)); if (p) game.togglePolicy(p); }
  for (const rv of s.rivals) if (game.canAnnex(rv.id)) { if (!game.annex(rv.id, 'military') && !game.annex(rv.id, 'culture')) { if (!game.annexPart(rv.id, 'military')) game.annexPart(rv.id, 'culture'); } }
  for (const w of G.WONDERS) if (game.wonderState(w) === 'open') game.buildWonder(w.id);
  for (const b of G.BODIES) if (game.bodyUnlocked(b)) game.advanceBody(b.id);
  for (const x of G.GENES) if (game.geneState(x) === 'open') game.buyGene(x.id);
  if (game.gal) {
    for (let i = 0; i < 5; i++) if (!game.colonizeBest()) break;
    s.galaxy.aliens.forEach((a) => {
      const acts = game.alienActions(a);
      for (const id of ['integrate', 'ally', 'attack', 'gift', 'exchange']) { const x = acts.find((y) => y.id === id); if (x && x.ok && game.alienAct(a.id, id)) break; }
      if (a.contact && !a.gone && !a.war && a.rel < 0) game.alienAct(a.id, 'war');
    });
  }
  for (let i = 0; i < 3; i++) { const h = game.bestTile(); if (h < 0) break; if (!game.claimTile(h)) break; }
  for (let i = 0; i < 4; i++) {
    let best = null, bc = Infinity;
    for (const b of G.BUILDINGS) { if (b.era > s.era || b.era < s.era - 2) continue; const c = game.buildingCost(b.id); let tot = 0; for (const k in c) tot += c[k] / Math.max(1, s.res[k]); if (tot < bc) { bc = tot; best = b.id; } }
    if (!best || bc > 0.5 || !game.buy(best, 1)) break;
  }
  s.weights.military = game.frontier().touch.size || (s.galaxy && s.galaxy.aliens.some((a) => a.war)) ? 4 : 1;
  s.auto.expand = s.auto.build = s.auto.research = s.auto.colonize = true;
}
module.exports = function run(seed, maxH, log, stopEra) {
  game.start(game.newState({ seed, civName: 'Teste', color: '#b3261e', voice: 5 }));
  const s = game.s, eraT = [0], techT = [], needT = [];
  let t = 0, next = 0, last = 0;
  const dt = 0.5;
  while (t < maxH * 3600) {
    game.tick(dt, false);
    if (s.event) game.chooseEvent(0);
    t += dt;
    if (t >= next) {
      botStep(s); next = t + 1;
      const e = s.era, key = G.TECHS.find((x) => x.era === e && x.eff.era);
      if (key) {
        if (techT[e] == null && game.eraTechs(e).every((x) => x === key || s.techs[x.id])) techT[e] = t;
        if (needT[e] == null && game.needMet(key.eff.need)) needT[e] = t;
      }
    }
    if (s.era !== last) {
      for (let e = last + 1; e <= s.era; e++) eraT[e] = t;
      last = s.era;
      if (log) console.log(`era ${String(s.era).padStart(2)} ${G.ERAS[s.era].name.padEnd(22)} ${(t / 60).toFixed(1).padStart(6)} min (+${((t - eraT[s.era - 1]) / 60).toFixed(1)}) pop ${G.fmt(s.pop)} terr ${game.ownedLand} (${(game.landFrac() * 100).toFixed(0)}%) rivais ${s.rivals.filter((r) => r.alive).length} edif ${Object.values(s.buildings).reduce((a, b) => a + b, 0)} marav ${Object.keys(s.wonders).length} techs ${Object.keys(s.techs).length}`);
    }
    if (s.victory) { eraT[12] = t; break; }
    if (stopEra != null && s.era >= stopEra) break;
  }
  if (log) console.log('fim: era', s.era, 'pop', G.fmt(s.pop), 'sistemas', game.galCount || 0, 'tempo', (t / 3600).toFixed(2), 'h', 'vitória', s.victory, 'legado', game.legacyGain());
  return { eraT, techT, needT, s, t };
};
if (require.main === module) module.exports(+(process.argv[2] || 12345), +(process.argv[3] || 10), true);
