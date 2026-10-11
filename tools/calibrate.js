// Calibração sequencial: para cada era, descobre se o gargalo é tecnologia ou território e ajusta o botão certo.
const G = require('./dbg.js'); const run = require('./run.js');
const fs = require('fs'), path = require('path');
const TARGET = [7, 10, 14, 17, 20, 23, 26, 29, 28, 32, 38, 45];
const SEEDS = [101, 777];
const LAND = [0.005, 0.014, 0.035, 0.065, 0.11, 0.24, 0.4, 0.62]; // fração de terra firme ao fim de cada era
const from = +(process.argv[2] || 0);
const B = G.BAL;
function measure(e, extra) {
  const before = TARGET.slice(0, e).reduce((a, b) => a + b, 0);
  const lim = ((before * 1.3 + TARGET[e] * 4) / 60 + 0.2) * (extra || 1);
  let dur = 0, land = 0, lb = 0, n = 0, inc = { m: 0, w: 0, en: 0 }, ni = 0;
  for (const seed of SEEDS) {
    const R = run(seed, lim, false, e === 11 ? null : e + 1);
    if (R.eraT[e] == null) return { bad: true };
    const end = e === 11 ? R.eraT[12] : R.eraT[e + 1];
    const tt = R.techT[e], nt = R.needT[e];
    if (nt == null || (tt != null && nt > tt + 5)) lb++;
    dur += end == null ? (R.t - R.eraT[e]) * 2.5 : end - R.eraT[e];
    land += G.game.landFrac(); n++;
    if (R.incT[e]) { inc.m += R.incT[e].m; inc.w += R.incT[e].w; inc.en += R.incT[e].en; ni++; }
  }
  if (ni) { inc.m /= ni; inc.w /= ni; inc.en /= ni; }
  return { dur: dur / n, land: land / n, landBound: lb * 2 > n, reached: true, inc: ni ? inc : null };
}

function gravar() {
  const fmt = (a) => '[' + a.map((x) => Number(x.toPrecision(3)).toExponential(2).replace('e+', 'e')).join(', ') + ']';
  const fmt2 = (a) => '[' + a.map((x) => +x.toPrecision(3)).join(', ') + ']';
  const fmt3 = (a) => '[' + a.map((x) => +Number(x).toPrecision(3)).join(', ') + ']';
  const p = path.join(__dirname, '../js/data.js');
  let d = fs.readFileSync(p, 'utf8');
  d = d.replace(/SC: \[[^\]]*\]/, 'SC: ' + fmt(B.SC)).replace(/KC: \[[^\]]*\]/, 'KC: ' + fmt(B.KC)).replace(/TC: \[[^\]]*\]/, 'TC: ' + fmt2(B.TC)).replace(/BC: \[[^\]]*\]/, 'BC: ' + fmt2(B.BC)).replace(/RW: \[[^\]]*\]/, 'RW: ' + fmt3(B.RW)).replace(/RE: \[[^\]]*\]/, 'RE: ' + fmt3(B.RE)).replace(/AF: \[[^\]]*\]/, 'AF: ' + fmt3(B.AF))
  fs.writeFileSync(p, d);
}
const scaleFrom = (e, f) => { for (let k = e; k < 12; k++) { B.SC[k] *= f; B.KC[k] *= f; } };
for (let e = from; e < 12; e++) {
  if (e > 0 && B.SC[e] < B.SC[e - 1] * 3) scaleFrom(e, (B.SC[e - 1] * 3) / B.SC[e]);
  for (let it = 0; it < 10; it++) {
    if (it > 0) gravar();
    let m = measure(e);
    if (m.bad) { console.log('era', e, 'não alcançada; tentando com mais tempo'); m = measure(e, 3); }
    // na 1ª medição da era, ajusta os preços em riqueza e energia à proporção real de produção
    if (it === 0 && m.inc && m.inc.m > 0) {
      const rw = m.inc.w / m.inc.m, re = m.inc.en / m.inc.m;
      if (e >= 2 && rw > 0) B.RW[e] = rw;
      if (e >= 6 && re > 0) B.RE[e] = re;
      console.log(`      proporções da era ${e}: riqueza ${B.RW[e].toPrecision(3)} energia ${B.RE[e].toPrecision(3)}`);
      gravar();
      continue;
    }

    if (m.bad) { console.log('era', e, 'não alcançada; abortando'); process.exit(1); }
    const ratio = (TARGET[e] * 60) / Math.max(m.dur, 3);
    console.log(`era ${e} it ${it}: ${(m.dur / 60).toFixed(1)} min${m.reached ? '' : ' (est.)'} alvo ${TARGET[e]} ${m.landBound ? '[terra]' : '[tec]'} SC=${B.SC[e].toExponential(2)} TC=${B.TC[e].toFixed(3)}`);
    const lr = 1;
    console.log(`      terra ${(m.land * 100).toFixed(1)}% (alvo ${e <= 7 ? (LAND[e] * 100).toFixed(1) : '-'}%)`);
    if (Math.abs(Math.log(ratio)) < 0.1 && Math.abs(Math.log(lr)) < 0.2) break;
    const f = Math.pow(G.clamp(ratio, 1 / 40, 40), 0.85);
    if (e <= 3 && Math.abs(Math.log(lr)) >= 0.2) B.TC[e] = G.clamp(B.TC[e] * Math.pow(lr, 1.2), 0.002, 200);
    if (m.landBound && e >= 10) { B.BC[e] = G.clamp(B.BC[e] * f, 1e-4, 1e4); B.AF[e] = G.clamp(B.AF[e] * f, 1e-3, 1e3); }
    else if (m.landBound && e >= 8) B.BC[e] = G.clamp(B.BC[e] * f, 1e-4, 1e4);
    else if (m.landBound) B.TC[e] = G.clamp(B.TC[e] * f, 0.002, 200);
    else {
      const floor = e > 0 ? B.SC[e - 1] * 3 : 0;
      const ceil = e > 0 ? B.SC[e - 1] * 1e4 : Infinity;
      if (B.SC[e] * f > ceil) scaleFrom(e, ceil / B.SC[e]);
      else if (B.SC[e] * f >= floor) scaleFrom(e, f);
      else { const f2 = floor / B.SC[e]; scaleFrom(e, f2); for (let k = e; k < 12; k++) B.KC[k] *= f / f2; }
    }
  }
}
const fmt = (a) => '[' + a.map((x) => Number(x.toPrecision(3)).toExponential(2).replace('e+', 'e').replace('e0', '').replace('e-', 'e-')).join(', ') + ']';
const fmt2 = (a) => '[' + a.map((x) => +x.toPrecision(3)).join(', ') + ']';
console.log('SC:', fmt(B.SC)); console.log('KC:', fmt(B.KC)); console.log('TC:', fmt2(B.TC)); console.log('BC:', fmt2(B.BC));
const p = path.join(__dirname, '../js/data.js');
let d = fs.readFileSync(p, 'utf8');
d = d.replace(/SC: \[[^\]]*\]/, 'SC: ' + fmt(B.SC)).replace(/KC: \[[^\]]*\]/, 'KC: ' + fmt(B.KC)).replace(/TC: \[[^\]]*\]/, 'TC: ' + fmt2(B.TC)).replace(/BC: \[[^\]]*\]/, 'BC: ' + fmt2(B.BC));
fs.writeFileSync(p, d);
console.log('gravado');
