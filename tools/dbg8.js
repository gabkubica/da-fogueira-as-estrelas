const G = require('./dbg.js'); const game = G.game;
game.start(game.newState({ seed: 12345, civName: 'T', color: '#b3261e', voice: 5 }));
const s = game.s;
// força chegar na era 8
s.era = 8; for (const t of G.TECHS) if (t.era < 8) s.techs[t.id] = 1; game.recalc();
s.pop = 1e10; s.res.knowledge = 0;
for (let i = 0; i < 20; i++) game.tick(0.5);
console.log('rate k', game.rate.knowledge, 'res k', s.res.knowledge);
for (const t of game.eraTechs(8)) console.log(t.id, game.techState(t), G.fmt(game.techCost(t).knowledge));
