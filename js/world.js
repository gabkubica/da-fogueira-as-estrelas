/* Da Fogueira às Estrelas — geração do planeta (grade hexagonal que dá a volta no mundo) */
(function () {
  'use strict';
  const G = (globalThis.G = globalThis.G || {});

  const TERR = ['ocean', 'sea', 'lake', 'grass', 'plains', 'forest', 'jungle', 'taiga', 'savanna', 'desert', 'tundra', 'hills', 'mountain', 'ice'];
  const TI = {};
  TERR.forEach((t, i) => (TI[t] = i));
  G.TERR = TERR;
  G.TI = TI;

  const W = 128, H = 80, R = 8;
  const SQ3 = Math.sqrt(3);
  const HW = SQ3 * R;
  const MW = W * HW;
  const MH = (H - 1) * 1.5 * R + 2 * R;
  const GS = 2; // unidades de mapa por célula da grade de ruído
  const GW = Math.ceil(MW / GS), GH = Math.ceil(MH / GS) + 1;
  G.HEX = { W, H, R, SQ3, HW, MW, MH, GS, GW, GH, N: W * H };

  // ---------- geometria hexagonal (pointy-top, odd-r) ----------
  G.hexCenter = function (i) {
    const row = (i / W) | 0, col = i - row * W;
    return [HW * (col + 0.5 * (row & 1)) + HW / 2, 1.5 * R * row + R];
  };
  G.hexAt = function (x, y) {
    // x, y em unidades de mapa → índice do hex (com volta horizontal)
    const px = x - HW / 2, py = y - R;
    const q = ((SQ3 / 3) * px - (1 / 3) * py) / R;
    const r = ((2 / 3) * py) / R;
    // arredondamento cúbico
    let cx = q, cz = r, cy = -cx - cz;
    let rx = Math.round(cx), ry = Math.round(cy), rz = Math.round(cz);
    const dx = Math.abs(rx - cx), dy = Math.abs(ry - cy), dz = Math.abs(rz - cz);
    if (dx > dy && dx > dz) rx = -ry - rz;
    else if (dy > dz) ry = -rx - rz;
    else rz = -rx - ry;
    const row = rz;
    if (row < 0 || row >= H) return -1;
    let col = rx + (row - (row & 1)) / 2;
    col = ((col % W) + W) % W;
    return row * W + col;
  };
  const NB = new Int32Array(W * H * 6);
  (function () {
    const ev = [[1, 0], [-1, 0], [0, -1], [-1, -1], [0, 1], [-1, 1]];
    const od = [[1, 0], [-1, 0], [1, -1], [0, -1], [1, 1], [0, 1]];
    for (let row = 0; row < H; row++)
      for (let col = 0; col < W; col++) {
        const d = row & 1 ? od : ev;
        const i = row * W + col;
        for (let k = 0; k < 6; k++) {
          const r2 = row + d[k][1];
          const c2 = (((col + d[k][0]) % W) + W) % W;
          NB[i * 6 + k] = r2 < 0 || r2 >= H ? -1 : r2 * W + c2;
        }
      }
  })();
  G.NB = NB;
  // Para desenhar bordas: vértices do hex (pointy-top) e qual vizinho fica atrás de cada aresta
  G.HEX_CORNERS = [];
  for (let k = 0; k < 6; k++) {
    const a = (Math.PI / 180) * (60 * k - 30);
    G.HEX_CORNERS.push([R * Math.cos(a), R * Math.sin(a)]);
  }
  // aresta k vai do canto k ao canto k+1; vizinho correspondente (índice em NB):
  // cantos: 0=-30°(direita-cima), 1=30°(direita-baixo), 2=90°(baixo), 3=150°, 4=210°, 5=270°(cima)
  // arestas: 0: direita (E) → nb 0; 1: baixo-direita (SE) → nb 4/; 2: baixo-esq (SW) → nb 5; 3: esquerda (W) → nb 1; 4: cima-esq (NW) → nb 3; 5: cima-dir (NE) → nb 2
  G.EDGE_NB = [0, 4, 5, 1, 3, 2];

  function toCube(i) {
    const row = (i / W) | 0, col = i - row * W;
    const q = col - (row - (row & 1)) / 2;
    return [q, row];
  }
  G.hexDist = function (a, b) {
    const [q1, r1] = toCube(a);
    let [q2, r2] = toCube(b);
    let best = 1e9;
    for (const sh of [0, W, -W]) {
      const dq = q2 + sh - q1, dr = r2 - r1;
      const d = (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
      if (d < best) best = d;
    }
    return best;
  };

  // ---------- classificação de bioma ----------
  // h: elevação relativa (>0 terra, <0 água, ~[-1,1]); t: temperatura 0..1; m: umidade 0..1
  G.classify = function (h, t, m) {
    if (h <= 0) return t < 0.1 ? TI.ice : h > -0.12 ? TI.sea : TI.ocean;
    if (t < 0.13) return TI.ice;
    if (h > 0.58) return TI.mountain;
    if (h > 0.4) return t < 0.25 ? TI.tundra : TI.hills;
    if (t < 0.25) return TI.tundra;
    if (t < 0.4) return m > 0.42 ? TI.taiga : TI.tundra;
    if (t > 0.74) return m < 0.3 ? TI.desert : m < 0.48 ? TI.savanna : TI.jungle;
    if (m < 0.26) return TI.desert;
    if (m < 0.42) return TI.plains;
    if (m < 0.6) return TI.grass;
    return TI.forest;
  };

  G.genWorld = function (seed) {
    // rejeita supercontinentes: o mundo precisa ter oceanos a atravessar
    let best = null;
    for (let k = 0; k < 6; k++) {
      const wd = genOnce(seed + k * 7919);
      wd.seed = seed;
      const land = wd.conts.reduce((a, b) => a + b, 0);
      const big = Math.max(...wd.conts);
      if (!best || big / land < best.r) best = { wd, r: big / land };
      if (big / land <= 0.5) return wd;
    }
    return best.wd;
  };
  function genOnce(seed) {
    const r = G.rng(seed);
    const n1 = G.makeNoise(seed + 11), n2 = G.makeNoise(seed + 23), n3 = G.makeNoise(seed + 37), n4 = G.makeNoise(seed + 41), n5 = G.makeNoise(seed + 59);
    const GN = GW * GH;
    const raw = new Float32Array(GN), T = new Float32Array(GN), M = new Float32Array(GN);
    const TAU = Math.PI * 2;
    const ox = r() * 100, oy = r() * 100;
    for (let gy = 0; gy < GH; gy++) {
      const lat = (gy / (GH - 1) - 0.5) * 2;
      const ny = (gy / GW) * TAU;
      for (let gx = 0; gx < GW; gx++) {
        const ang = (gx / GW) * TAU;
        const cx = Math.cos(ang), cz = Math.sin(ang);
        const wx = G.fbm(n2, cx * 1.1 + ox, ny * 1.1, cz * 1.1, 3) * 0.38;
        const wy = G.fbm(n2, cx * 1.1, ny * 1.1 + oy, cz * 1.1 + 7, 3) * 0.38;
        let e = G.fbm(n1, (cx + wx) * 0.6, (ny + wy) * 0.6, (cz + wx) * 0.6, 6, 2.1, 0.46);
        const rr = 1 - Math.abs(G.fbm(n3, cx * 2.2, ny * 2.2, cz * 2.2, 4, 2, 0.5));
        e += Math.pow(rr, 4) * 0.32 * G.smooth(G.clamp((e + 0.05) / 0.25, 0, 1));
        const pole = Math.max(0, Math.abs(lat) - 0.7) / 0.3;
        e -= pole * pole * 0.7;
        const i = gy * GW + gx;
        raw[i] = e;
        M[i] = G.clamp(0.5 + G.fbm(n4, cx * 1.6, ny * 1.6, cz * 1.6, 4) * 1.1, 0, 1);
        T[i] = 1 - Math.pow(Math.abs(lat), 1.35) + G.fbm(n5, cx * 2, ny * 2, cz * 2, 3) * 0.16;
      }
    }
    // nível do mar pelo percentil → ~36% de terra
    const sorted = Float32Array.from(raw).sort();
    const sea = sorted[Math.floor(GN * 0.64)];
    const hiL = sorted[GN - 1] - sea, loW = sea - sorted[0];
    const E = new Float32Array(GN);
    for (let i = 0; i < GN; i++) {
      const d = raw[i] - sea;
      E[i] = d > 0 ? Math.pow(d / hiL, 0.8) : d / loW;
      if (E[i] > 0) T[i] -= E[i] * 0.3;
    }

    const sample = (A, x, y) => {
      // x,y em unidades de mapa, bilinear com volta horizontal
      let gx = x / GS, gy = y / GS;
      if (gy < 0) gy = 0; if (gy > GH - 1.001) gy = GH - 1.001;
      const x0 = Math.floor(gx), y0 = Math.floor(gy);
      const fx = gx - x0, fy = gy - y0;
      const xa = ((x0 % GW) + GW) % GW, xb = (xa + 1) % GW;
      const a = A[y0 * GW + xa], b = A[y0 * GW + xb], c = A[(y0 + 1) * GW + xa], d = A[(y0 + 1) * GW + xb];
      return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
    };

    // ---------- hexes ----------
    const N = W * H;
    const terr = new Uint8Array(N), helev = new Float32Array(N), coast = new Uint8Array(N);
    const lat = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const [x, y] = G.hexCenter(i);
      const h = sample(E, x, y), t = sample(T, x, y), m = sample(M, x, y);
      helev[i] = h;
      terr[i] = G.classify(h, t, m);
      lat[i] = (y / MH - 0.5) * 2;
    }
    const isWater = (i) => terr[i] <= 2 || (terr[i] === TI.ice && helev[i] <= 0);
    // corpos d'água: lagos pequenos
    const body = new Int32Array(N).fill(-1);
    const bodies = [];
    for (let i = 0; i < N; i++) {
      if (!isWater(i) || body[i] >= 0) continue;
      const id = bodies.length, q = [i], cells = [];
      body[i] = id;
      while (q.length) {
        const c = q.pop(); cells.push(c);
        for (let k = 0; k < 6; k++) {
          const nb = NB[c * 6 + k];
          if (nb >= 0 && body[nb] < 0 && isWater(nb)) { body[nb] = id; q.push(nb); }
        }
      }
      bodies.push(cells);
    }
    bodies.forEach((cells) => {
      if (cells.length < 25) cells.forEach((c) => { if (terr[c] !== TI.ice) terr[c] = TI.lake; });
    });
    for (let i = 0; i < N; i++) {
      if (isWater(i)) continue;
      for (let k = 0; k < 6; k++) {
        const nb = NB[i * 6 + k];
        if (nb >= 0 && isWater(nb)) { coast[i] = 1; break; }
      }
    }
    // continentes
    const cont = new Int32Array(N).fill(-1);
    const conts = [];
    for (let i = 0; i < N; i++) {
      if (isWater(i) || cont[i] >= 0) continue;
      const id = conts.length, q = [i];
      let size = 0;
      cont[i] = id;
      while (q.length) {
        const c = q.pop(); size++;
        for (let k = 0; k < 6; k++) {
          const nb = NB[c * 6 + k];
          if (nb >= 0 && cont[nb] < 0 && !isWater(nb)) { cont[nb] = id; q.push(nb); }
        }
      }
      conts.push(size);
    }

    // ---------- rios ----------
    const river = new Uint16Array(N), riverNext = new Int32Array(N).fill(-1);
    const sources = [];
    for (let i = 0; i < N; i++) {
      if (isWater(i) || terr[i] === TI.ice || terr[i] === TI.desert) continue;
      if (helev[i] > 0.3 && sample(M, ...G.hexCenter(i)) > 0.45) sources.push(i);
    }
    G.shuffle(r, sources);
    let made = 0;
    for (const s of sources) {
      if (made >= 46) break;
      if (river[s]) continue;
      const path = [s];
      let cur = s, ok = false;
      for (let step = 0; step < 80; step++) {
        let best = -1, be = helev[cur];
        for (let k = 0; k < 6; k++) {
          const nb = NB[cur * 6 + k];
          if (nb < 0) continue;
          if (isWater(nb)) { best = nb; be = -9; break; }
          if (helev[nb] < be) { be = helev[nb]; best = nb; }
        }
        if (best < 0) break;
        if (isWater(best)) { riverNext[cur] = best; ok = true; break; }
        if (river[best]) { riverNext[cur] = best; ok = true; path.push(best); break; }
        riverNext[cur] = best;
        path.push(best);
        cur = best;
      }
      if (!ok || path.length < 4) { path.forEach((p) => { if (!river[p]) riverNext[p] = -1; }); continue; }
      made++;
      // fluxo acumulado (inclui o trecho a jusante já existente)
      let c = s, guard = 0;
      while (c >= 0 && !isWater(c) && guard++ < 300) { river[c]++; c = riverNext[c]; }
    }

    // ---------- nomes de oceanos ----------
    const seaLabels = [];
    const bigBodies = bodies.map((cells, id) => ({ id, cells })).filter((b) => b.cells.length > 120).sort((a, b) => b.cells.length - a.cells.length).slice(0, 5);
    const distLand = new Int32Array(N).fill(-1);
    { const q = [];
      for (let i = 0; i < N; i++) if (!isWater(i)) { distLand[i] = 0; q.push(i); }
      let qi = 0;
      while (qi < q.length) { const c = q[qi++]; for (let k = 0; k < 6; k++) { const nb = NB[c * 6 + k]; if (nb >= 0 && distLand[nb] < 0) { distLand[nb] = distLand[c] + 1; q.push(nb); } } } }
    const seaVoice = Math.floor(r() * G.VOICES.length);
    bigBodies.forEach((b, idx) => {
      // até 2 rótulos por oceano grande, em pontos distantes entre si
      const sortedCells = b.cells.slice().sort((x, y) => distLand[y] - distLand[x]);
      const picks = [];
      for (const c of sortedCells) {
        if (Math.abs(lat[c]) > 0.7) continue;
        if (picks.every((p) => G.hexDist(p, c) > 30)) picks.push(c);
        if (picks.length >= (b.cells.length > 900 ? 2 : 1)) break;
      }
      const nm = G.makeName(r, seaVoice + idx);
      picks.forEach((p, j) => seaLabels.push({ h: p, name: (b.cells.length > 600 ? (j ? 'Mar ' : 'Oceano ') : 'Mar ') + (j ? G.makeName(r, seaVoice + idx + 3) : nm) }));
    });

    // ---------- posição inicial ----------
    const goodStart = (i, needRiver) => {
      const t = terr[i];
      return (t === TI.grass || t === TI.plains || t === TI.savanna) && Math.abs(lat[i]) < 0.55 && conts[cont[i]] > 220 && (!needRiver || river[i] > 0);
    };
    let cands = [];
    for (let i = 0; i < N; i++) if (goodStart(i, true)) cands.push(i);
    if (!cands.length) for (let i = 0; i < N; i++) if (goodStart(i, false)) cands.push(i);
    if (!cands.length) for (let i = 0; i < N; i++) if (!isWater(i) && terr[i] !== TI.ice) cands.push(i);
    const start = cands[Math.floor(r() * cands.length)];

    // ---------- povos vizinhos ----------
    const PAL = ['#7d6b9e', '#4f8a78', '#a8743c', '#5f78a8', '#9a5f6f', '#77904a', '#b08850', '#56688f', '#8f6a8a', '#3f7f7a', '#a0603a', '#7a7a4a', '#6a5a8a', '#8a9a5a', '#9a6a4a', '#4a8aa0', '#8a4a5a', '#5a8a5a'];
    const rivals = [];
    const landCells = [];
    for (let i = 0; i < N; i++) if (!isWater(i) && terr[i] !== TI.ice && terr[i] !== TI.mountain && terr[i] !== TI.desert && conts[cont[i]] > 8) landCells.push(i);
    G.shuffle(r, landCells);
    const voices = G.shuffle(r, G.VOICES.map((_, i) => i));
    const nR = 18;
    for (const c of landCells) {
      if (rivals.length >= nR) break;
      if (G.hexDist(c, start) < 10) continue;
      if (rivals.some((rv) => G.hexDist(rv.seed, c) < 11)) continue;
      const id = rivals.length + 1;
      rivals.push({
        id, seed: c, voice: voices[id % voices.length], color: PAL[(id - 1) % PAL.length],
        name: '', temper: r(), alive: true, size0: 5 + Math.floor(r() * 12),
      });
    }
    rivals.forEach((rv) => { rv.name = G.makeName(r, rv.voice); });

    return {
      seed, W, H, R, N, MW, MH, GW, GH,
      E, T, M, sample,
      terr, helev, coast, lat, cont, conts, river, riverNext, body, seaLabels,
      isWater, start, rivals,
      landTotal: (() => { let n = 0; for (let i = 0; i < N; i++) if (!isWater(i) && terr[i] !== TI.ice) n++; return n; })(),
    };
  }
})();
