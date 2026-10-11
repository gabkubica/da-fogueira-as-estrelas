/* Da Fogueira às Estrelas — geração da galáxia */
(function () {
  'use strict';
  const G = (globalThis.G = globalThis.G || {});

  G.GAL = { RG: 520, N: 540 };

  const REAL = ['Alfa Centauri', 'Estrela de Barnard', 'Wolf 359', 'Lalande 21185', 'Sirius', 'Ross 154', 'Epsilon Eridani', 'Tau Ceti', 'Procyon', '61 Cygni', 'Gliese 581', 'TRAPPIST-1', 'Kepler-442', 'Vega', 'Altair', 'Fomalhaut', 'Kapteyn', 'Teegarden', 'Gliese 667', 'Luyten'];
  const GREEK = ['Alfa', 'Beta', 'Gama', 'Delta', 'Épsilon', 'Zeta', 'Eta', 'Teta', 'Iota', 'Kapa', 'Lambda', 'Mu', 'Nu', 'Ômicron', 'Sigma', 'Tau', 'Ípsilon', 'Fi', 'Qui', 'Ômega'];
  const CONST = ['Velorum', 'Carinae', 'Draconis', 'Lyrae', 'Cygni', 'Orionis', 'Pegasi', 'Aquilae', 'Hydrae', 'Pavonis', 'Tucanae', 'Leonis', 'Scorpii', 'Persei', 'Aurigae', 'Cephei', 'Lupi', 'Crucis', 'Ursae', 'Serpentis', 'Phoenicis', 'Columbae', 'Fornacis', 'Eridani'];
  const TYPES = [
    { id: 'M', name: 'anã vermelha', color: '#ff9a6a', p: 0.42, hab: 0.35, r: 1.4 },
    { id: 'K', name: 'anã laranja', color: '#ffc58a', p: 0.22, hab: 0.75, r: 1.7 },
    { id: 'G', name: 'anã amarela', color: '#fff1c4', p: 0.14, hab: 1, r: 1.9 },
    { id: 'F', name: 'branco-amarelada', color: '#fbf8ff', p: 0.09, hab: 0.6, r: 2.0 },
    { id: 'A', name: 'branca', color: '#dfe8ff', p: 0.05, hab: 0.3, r: 2.2 },
    { id: 'B', name: 'gigante azul', color: '#a9c4ff', p: 0.03, hab: 0.1, r: 2.6 },
    { id: 'N', name: 'estrela de nêutrons', color: '#c9f0ff', p: 0.025, hab: 0.02, r: 1.2, special: 'pulsar' },
    { id: 'X', name: 'buraco negro', color: '#9b7bff', p: 0.015, hab: 0, r: 2.2, special: 'blackhole' },
    { id: 'R', name: 'gigante vermelha', color: '#ff7550', p: 0.03, hab: 0.15, r: 2.8 },
  ];
  G.STAR_TYPES = TYPES;

  G.genGalaxy = function (seed) {
    const r = G.rng(seed * 7 + 3);
    const { RG, N } = G.GAL;
    const arms = 4;
    const sys = [];
    const gauss = () => (r() + r() + r() - 1.5) / 1.5;
    let tries = 0;
    while (sys.length < N && tries++ < 40000) {
      let x, y;
      const u = r();
      if (u < 0.12) {
        // bojo central
        const rr = Math.pow(r(), 0.7) * RG * 0.18, a = r() * Math.PI * 2;
        x = Math.cos(a) * rr; y = Math.sin(a) * rr;
      } else if (u < 0.88) {
        const k = Math.floor(r() * arms);
        const t = 0.1 + Math.pow(r(), 0.85) * 0.9;
        const ang = (k / arms) * Math.PI * 2 + t * 3.4 + gauss() * (0.28 - 0.12 * t);
        const rr = t * RG + gauss() * 18;
        x = Math.cos(ang) * rr; y = Math.sin(ang) * rr;
      } else {
        const rr = Math.sqrt(r()) * RG, a = r() * Math.PI * 2;
        x = Math.cos(a) * rr; y = Math.sin(a) * rr;
      }
      if (Math.hypot(x, y) < 26) continue; // o buraco negro central fica livre
      let ok = true;
      for (let j = 0; j < sys.length; j++) {
        const dx = sys[j].x - x, dy = sys[j].y - y;
        if (dx * dx + dy * dy < 13 * 13) { ok = false; break; }
      }
      if (!ok) continue;
      let p = r(), ty = TYPES[0];
      for (const t of TYPES) { if (p < t.p) { ty = t; break; } p -= t.p; }
      sys.push({ x, y, type: ty.id, hab: G.clamp(ty.hab * (0.4 + r() * 0.9), 0, 1), rich: r(), planets: 1 + Math.floor(r() * 7), ruins: r() < 0.03 });
    }
    // o Sol: um sistema G na periferia de um braço
    let sol = 0, best = 1e9;
    sys.forEach((s, i) => {
      const d = Math.abs(Math.hypot(s.x, s.y) - RG * 0.62);
      const score = d + (s.y < 0 ? 0 : 40) + (s.x < 0 ? 0 : 25);
      if (score < best) { best = score; sol = i; }
    });
    Object.assign(sys[sol], { type: 'G', hab: 1, name: 'Sol', ruins: false, planets: 8 });
    // nomes
    const byDist = sys.map((s, i) => ({ i, d: Math.hypot(s.x - sys[sol].x, s.y - sys[sol].y) })).sort((a, b) => a.d - b.d);
    let ri = 0;
    const used = new Set(['Sol']);
    byDist.forEach(({ i }) => {
      if (i === sol) return;
      let nm;
      if (ri < REAL.length) nm = REAL[ri++];
      else {
        const k = r();
        if (k < 0.45) nm = G.pick(r, GREEK) + ' ' + G.pick(r, CONST);
        else if (k < 0.7) nm = (r() < 0.5 ? 'HD ' : 'Gliese ') + (100 + Math.floor(r() * 9800));
        else nm = G.makeName(r, Math.floor(r() * 8));
      }
      while (used.has(nm)) nm += ' ' + 'IIIVX'.charAt(Math.floor(r() * 5));
      used.add(nm);
      sys[i].name = nm;
    });
    // vizinhos (k mais próximos)
    sys.forEach((s, i) => {
      const d = [];
      for (let j = 0; j < sys.length; j++) if (j !== i) d.push([Math.hypot(sys[j].x - s.x, sys[j].y - s.y), j]);
      d.sort((a, b) => a[0] - b[0]);
      s.nb = d.slice(0, 7).map((x) => x[1]);
    });
    // espécies alienígenas: lar e território
    const owner = new Int8Array(sys.length).fill(-1);
    owner[sol] = 0;
    const homes = [];
    const order = G.ALIENS.map((a, k) => k);
    order.forEach((k) => {
      const a = G.ALIENS[k];
      const cands = sys.map((s, i) => i).filter((i) => {
        if (owner[i] !== -1) return false;
        const rr = Math.hypot(sys[i].x, sys[i].y);
        if (a.core) return rr < RG * 0.2;
        if (rr < RG * 0.25) return false;
        const ds = Math.hypot(sys[i].x - sys[sol].x, sys[i].y - sys[sol].y);
        if (ds < RG * (k < 3 ? 0.28 : 0.45)) return false;
        return homes.every((h) => Math.hypot(sys[i].x - sys[h].x, sys[i].y - sys[h].y) > RG * 0.45);
      });
      const home = cands.length ? cands[Math.floor(r() * cands.length)] : -1;
      homes.push(home);
      if (home < 0) return;
      const target = Math.round(a.size * sys.length);
      const q = [home];
      owner[home] = k + 1;
      let cnt = 1, qi = 0;
      while (qi < q.length && cnt < target) {
        const c = q[qi++];
        const nbs = G.shuffle(r, sys[c].nb.slice());
        for (const nb of nbs) {
          if (cnt >= target) break;
          if (owner[nb] === -1 && Math.hypot(sys[nb].x - sys[home].x, sys[nb].y - sys[home].y) < RG * 0.45) {
            owner[nb] = k + 1; q.push(nb); cnt++;
          }
        }
      }
    });
    return { sys, sol, owner, homes };
  };
})();
