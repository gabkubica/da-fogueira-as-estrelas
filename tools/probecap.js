// mede o custo de techs e corpos celestes em segundos do potencial do império, por era
const G = require('./dbg.js'); const game = G.game;
game.start(game.newState({ seed: +(process.argv[2] || 101), civName: 'T', color: '#b3261e', voice: 5 }));
const s = game.s; let t = 0, next = 0, rep = 0;
const T = {}, B = {};
const q = (a, p) => { if (!a || !a.length) return '-'; a = a.slice().sort((x, y) => x - y); return a[Math.floor(p * (a.length - 1))].toFixed(0); };
while (t < 4 * 3600 && !s.victory) {
  game.tick(0.5, false); if (s.event) game.chooseEvent(0); t += 0.5;
  if (t >= next) { G.botStep(s); next = t + 1; }
  if (t >= rep) {
    rep = t + 30; const e = s.era;
    for (const x of G.TECHS) if (game.techState(x) === 'open' || game.techState(x) === 'need') (T[e] = T[e] || []).push(game.techCost(x).knowledge / game.pot('knowledge'));
    for (const b of G.BODIES) { if (!game.bodyUnlocked(b)) continue; const st = game.bodyStage(b.id); if (st >= game.bodyMaxStage(b)) continue; const c = game.bodyCost(b, st); let m = 0; for (const k in c) m = Math.max(m, c[k] / game.pot(k)); (B[e] = B[e] || []).push(m); }
  }
}
for (let e = 0; e < 12; e++) console.log(`era ${e}: tech s p25 ${q(T[e], .25)} p50 ${q(T[e], .5)} p90 ${q(T[e], .9)} | corpo s p25 ${q(B[e], .25)} p50 ${q(B[e], .5)} p90 ${q(B[e], .9)}`);
