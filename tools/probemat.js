// Para onde vão os materiais: soma o gasto por categoria ao longo da partida.
const G = require('./dbg.js'); const game = G.game; const run = require('./run.js');
const spent = {}; let cur = null;
const wrap = (name, cat) => { const f = game[name]; game[name] = function (...a) { const before = game.s.res.materials; const r = f.apply(game, a); const d = before - game.s.res.materials; if (d > 0) { const e = game.s.era; spent[e] = spent[e] || {}; spent[e][cat] = (spent[e][cat] || 0) + d; } return r; }; };
wrap('buy', 'obras'); wrap('claimTile', 'terras'); wrap('buildWonder', 'maravilhas'); wrap('advanceBody', 'espaço'); wrap('colonize', 'sistemas');
run(+(process.argv[2] || 101), 3, false, 8);
for (const e in spent) { const t = Object.values(spent[e]).reduce((a, b) => a + b, 0); console.log('era ' + e + ': ' + Object.entries(spent[e]).map(([k, v]) => k + ' ' + Math.round(v / t * 100) + '%').join(' · ')); }
