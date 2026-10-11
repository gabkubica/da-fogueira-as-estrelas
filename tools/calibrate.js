// Calibração sequencial: ajusta a escala de custo de cada era, em ordem, até a duração bater o alvo.
const G = require('./dbg.js'); const run = require('./run.js');
const fs = require('fs'), path = require('path');
const TARGET = [6, 9, 12, 15, 18, 21, 24, 27, 30, 34, 42, 50];
const seed = +(process.argv[2] || 101);
const from = +(process.argv[3] || 0);
const B = G.BAL;
function measure(e) {
  const before = TARGET.slice(0, e).reduce((a, b) => a + b, 0);
  const lim = (before + TARGET[e] * 4) / 60 + 0.2;
  const { eraT, t } = run(seed, lim, false, e === 11 ? null : e + 1);
  if (eraT[e] == null) return { bad: true };
  const end = e === 11 ? eraT[12] : eraT[e + 1];
  return { dur: end == null ? (t - eraT[e]) * 2.5 : end - eraT[e], reached: end != null };
}
for (let e = from; e < 12; e++) {
  if (e > 0 && e > from) { const r = B.SC[e] / B.SC[e - 1]; }
  for (let it = 0; it < 9; it++) {
    const m = measure(e);
    if (m.bad) { console.log('era', e, 'não alcançada; abortando'); process.exit(1); }
    const ratio = (TARGET[e] * 60) / Math.max(m.dur, 3);
    console.log(`era ${e} it ${it}: ${(m.dur / 60).toFixed(1)} min${m.reached ? '' : ' (estimado)'} alvo ${TARGET[e]}  SC=${B.SC[e].toExponential(2)}`);
    if (Math.abs(Math.log(ratio)) < 0.1) break;
    const f = Math.pow(G.clamp(ratio, 1 / 40, 40), 0.85);
    // ajusta esta era e empurra as seguintes junto (mantém as proporções)
    for (let k = e; k < 12; k++) { B.SC[k] *= f; B.KC[k] *= f; }
  }
}
const fmt = (a) => '[' + a.map((x) => Number(x.toPrecision(3)).toExponential(2).replace('e+', 'e')).join(', ') + ']';
console.log('SC:', fmt(B.SC)); console.log('KC:', fmt(B.KC));
const p = path.join(__dirname, '../js/data.js');
let d = fs.readFileSync(p, 'utf8');
d = d.replace(/SC: \[[^\]]*\]/, 'SC: ' + fmt(B.SC)).replace(/KC: \[[^\]]*\]/, 'KC: ' + fmt(B.KC));
fs.writeFileSync(p, d);
console.log('gravado');
