// Executa uma partida simulada e devolve os tempos de chegada a cada era.
const G = require('./dbg.js'); const game = G.game;
const botStep = G.botStep;
module.exports = function run(seed, maxH, log, stopEra) {
  game.start(game.newState({ seed, civName: 'Teste', color: '#b3261e', voice: 5 }));
  const s = game.s, eraT = [0], techT = [], needT = [], incT = [];
  let t = 0, next = 0, last = 0;
  const dt = 0.5;
  while (t < maxH * 3600) {
    game.tick(dt, false);
    if (s.event) game.chooseEvent(0);
    t += dt;
    if (t >= next) {
      botStep(s); next = t + 1;
      const e = s.era, key = G.TECHS.find((x) => x.era === e && x.eff.era);
      if (incT[e] == null && eraT[e] != null && t >= eraT[e] + 90) { const fb = game.lineCurrent('food'); incT[e] = { m: game.gross.materials, w: game.gross.wealth, en: game.gross.energy, b0: fb ? game.buildingCost(fb.id, 0).materials : 0 }; }
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
  return { eraT, techT, needT, incT, s, t };
};
if (require.main === module) module.exports(+(process.argv[2] || 12345), +(process.argv[3] || 10), true);
