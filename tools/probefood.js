const G = require('./dbg.js'); const game = G.game;
game.start(game.newState({ seed: +(process.argv[2] || 101), civName: 'T', color: '#b3261e', voice: 5 }));
const s = game.s; let t = 0, next = 0, last = -1, rep = 0;
while (t < 4 * 3600 && !s.victory) {
  game.tick(0.5, false); if (s.event) game.chooseEvent(0); t += 0.5;
  if (t >= next) { G.botStep(s); next = t + 1; }
  if (t >= rep) {
    rep = t + 300; game.rates();
    const b = game.bestTile(); const tc = b >= 0 ? game.tileCost(b).food : 0;
    const g = G.GENES.filter((x) => x.era <= s.era).map((x) => x.id + ':' + (game.geneCost(x).food / Math.max(1e-9, game.rate.food) / 60).toFixed(0) + 'm').join(' ');
    console.log(`${(t/60).toFixed(0).padStart(4)}min era ${s.era} ano ${G.fmtYear ? G.fmtYear(game.year ? game.year() : 0) : ''} pop ${G.fmt(s.pop)} agric ${(game.fr.food*100).toFixed(1)}% exced ${G.fmt(game.rate.food)}/s estoque ${G.fmt(s.res.food)} terra ${(tc/Math.max(1e-9,game.rate.food)).toFixed(0)}s genes[${g}] genesComprados ${Object.keys(s.genes||{}).length}`);
  }
}
