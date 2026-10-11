/* Da Fogueira às Estrelas — o mapa da Terra (pergaminho → atlas → noite) e o globo */
(function () {
  'use strict';
  const G = (globalThis.G = globalThis.G || {});
  const H = G.HEX;

  const MV = (G.mapview = {
    styles: {}, building: {}, style: null, prevStyle: null, fade: 1,
    cam: { x: 0, y: 0, z: 3 }, target: null,
    terrDirty: true, fogDirty: true, roadsDirty: true, lightsDirty: true,
    hover: -1, TS: 2,
  });

  MV.styleForEra = (e) => (e <= 4 ? 'parchment' : e <= 6 ? 'atlas' : 'night');

  // ---------------- paletas ----------------
  const PAL = {
    parchment: {
      deep: [176, 188, 174], shallow: [204, 209, 188], lake: [196, 205, 188], seaice: [236, 233, 222],
      land: { grass: [226, 213, 164], plains: [234, 219, 174], forest: [214, 205, 156], jungle: [207, 202, 148], taiga: [219, 213, 176], savanna: [236, 213, 158], desert: [243, 225, 177], tundra: [228, 224, 205], hills: [224, 203, 156], mountain: [216, 195, 151], ice: [242, 239, 231] },
      ink: [70, 54, 36], ripple: [120, 112, 92], shade: 0.5, grain: 9, coastW: 0.022,
    },
    atlas: {
      deep: [86, 132, 164], shallow: [160, 199, 205], lake: [128, 174, 194], seaice: [226, 236, 238],
      land: { grass: [182, 200, 136], plains: [204, 205, 148], forest: [136, 166, 102], jungle: [112, 152, 88], taiga: [150, 166, 124], savanna: [214, 200, 140], desert: [232, 212, 160], tundra: [196, 197, 172], hills: [198, 178, 132], mountain: [170, 150, 120], ice: [242, 244, 240] },
      ink: [72, 62, 48], ripple: [196, 222, 226], shade: 0.75, grain: 6, coastW: 0.014,
    },
    night: {
      deep: [5, 11, 20], shallow: [11, 26, 40], lake: [12, 26, 40], seaice: [30, 40, 52],
      land: { grass: [25, 33, 32], plains: [29, 34, 32], forest: [19, 29, 26], jungle: [17, 29, 24], taiga: [24, 31, 32], savanna: [34, 34, 28], desert: [42, 38, 32], tundra: [36, 40, 43], hills: [33, 35, 35], mountain: [44, 46, 50], ice: [56, 66, 78] },
      ink: [52, 82, 108], ripple: [16, 34, 52], shade: 0.9, grain: 3, coastW: 0.01,
    },
  };
  MV.PAL = PAL;

  // ---------------- textura de papel ----------------
  MV.paper = (function () {
    if (typeof document === 'undefined') return null;
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const x = c.getContext('2d');
    const im = x.createImageData(256, 256);
    const n = G.makeNoise(99);
    for (let j = 0; j < 256; j++)
      for (let i = 0; i < 256; i++) {
        const a = (i / 256) * Math.PI * 2, b = (j / 256) * Math.PI * 2;
        const v = G.fbm(n, Math.cos(a) * 2, Math.sin(a) * 2 + Math.cos(b) * 2, Math.sin(b) * 2, 4) * 0.5 + 0.5;
        const fib = G.hash2(i, j, 7) * 0.12;
        const k = 255 - Math.floor((v * 0.55 + fib) * 60);
        const p = (j * 256 + i) * 4;
        im.data[p] = k; im.data[p + 1] = k - 6; im.data[p + 2] = k - 18; im.data[p + 3] = 255;
      }
    x.putImageData(im, 0, 0);
    return c;
  })();

  // ---------------- geração de terreno (fatiada no tempo) ----------------
  function* terrainJob(world, styleId, Wf, Hf, out) {
    // os pixels são calculados em meia resolução e ampliados; símbolos e rios são desenhados na resolução cheia
    MV.stage = 'calculando o terreno';
    const half = out.half && Wf > 800;
    const W = half ? Math.round(Wf / 2) : Wf, Hh = half ? Math.round(Hf / 2) : Hf;
    const P = PAL[styleId];
    const E = world.E, T = world.T, M = world.M, GW = world.GW, GH = world.GH, GS = H.GS;
    const ES = smoothElev(world);
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = Hh;
    const ctx = cv.getContext('2d');
    const img = ctx.createImageData(W, Hh);
    const d = img.data;
    const mask = out.wantMask ? new Uint8ClampedArray(W * Hh * 4) : null;
    const sx = H.MW / W, sy = H.MH / Hh;
    const LAND = {};
    for (const k in P.land) LAND[G.TI[k]] = P.land[k];
    const TI = G.TI;
    for (let py = 0; py < Hh; py++) {
      let gy = ((py + 0.5) * sy) / GS;
      if (gy > GH - 1.001) gy = GH - 1.001;
      const y0 = gy | 0, fy = gy - y0;
      const row0 = y0 * GW, row1 = row0 + GW;
      for (let px = 0; px < W; px++) {
        const gx = ((px + 0.5) * sx) / GS;
        const x0 = gx | 0, fx = gx - x0;
        const xa = x0 % GW, xb = (xa + 1) % GW;
        const a = row0 + xa, b = row0 + xb, c = row1 + xa, dd = row1 + xb;
        const e00 = E[a], e01 = E[b], e10 = E[c], e11 = E[dd];
        const e = e00 + (e01 - e00) * fx + (e10 - e00) * fy + (e00 - e01 - e10 + e11) * fx * fy;
        const t = T[a] + (T[b] - T[a]) * fx + (T[c] - T[a]) * fy + (T[a] - T[b] - T[c] + T[dd]) * fx * fy;
        const hj = G.hash2(px, py, 3);
        const m = M[a] + (M[b] - M[a]) * fx + (M[c] - M[a]) * fy + (M[a] - M[b] - M[c] + M[dd]) * fx * fy + (hj - 0.5) * 0.035;
        const s00 = ES[a], s01 = ES[b], s10 = ES[c], s11 = ES[dd];
        const ex = (s01 - s00) * (1 - fy) + (s11 - s10) * fy;
        const ey = (s10 - s00) * (1 - fx) + (s11 - s01) * fx;
        let r, g, bl;
        const p4 = (py * W + px) * 4;
        if (e <= 0) {
          if (t + (hj - 0.5) * 0.04 < 0.1) { [r, g, bl] = P.seaice; }
          else {
            const k = G.smooth(Math.min(1, -e / 0.32));
            r = P.shallow[0] + (P.deep[0] - P.shallow[0]) * k;
            g = P.shallow[1] + (P.deep[1] - P.shallow[1]) * k;
            bl = P.shallow[2] + (P.deep[2] - P.shallow[2]) * k;
          }
        } else {
          if (mask) mask[p4 + 3] = 255;
          const bi = G.classify(e, t, m);
          const col = LAND[bi] || P.land.plains;
          r = col[0]; g = col[1]; bl = col[2];
          // relevo sombreado (luz do noroeste)
          let sh = (ex + ey) * 14 * P.shade;
          if (sh > 0.38) sh = 0.38; else if (sh < -0.38) sh = -0.38;
          const hk = 1 + sh * 0.5 - e * 0.12 * P.shade;
          r *= hk; g *= hk; bl *= hk;
          if (styleId === 'atlas' && e > 0.72 && bi === TI.mountain) { const al = Math.min(1, (e - 0.72) * 5); r += (250 - r) * al; g += (250 - g) * al; bl += (250 - bl) * al; }
        }
        const gr = (G.hash2(px, py, 11) - 0.5) * P.grain;
        d[p4] = r + gr; d[p4 + 1] = g + gr; d[p4 + 2] = bl + gr; d[p4 + 3] = 255;
      }
      if ((py & 7) === 7) yield py / Hh;
    }
    MV.stage = 'pintando o terreno';
    yield 1;
    ctx.putImageData(img, 0, 0);
    let fin = cv, fctx = ctx;
    if (half) {
      fin = document.createElement('canvas'); fin.width = Wf; fin.height = Hf;
      fctx = fin.getContext('2d');
      fctx.imageSmoothingEnabled = true; fctx.imageSmoothingQuality = 'high';
      fctx.drawImage(cv, 0, 0, Wf, Hf);
    }
    if (mask) {
      const mc = document.createElement('canvas');
      mc.width = W; mc.height = Hh;
      const mx = mc.getContext('2d');
      const mi = mx.createImageData(W, Hh);
      mi.data.set(mask);
      mx.putImageData(mi, 0, 0);
      out.mask = mc;
    }
    MV.stage = 'traçando as costas';
    yield 1;
    drawContours(fctx, world, styleId, Wf / H.MW);
    MV.stage = 'desenhando montanhas, florestas e rios';
    yield 1;
    if (out.glyphs) drawGlyphs(fctx, world, styleId, Wf / H.MW);
    if (out.glyphs) drawRivers(fctx, world, styleId, Wf / H.MW);
    out.canvas = fin;
    yield 1;
  }

  // elevação suavizada (para o relevo sombreado não ficar manchado)
  function smoothElev(world) {
    if (world.ES) return world.ES;
    const { GW, GH } = world;
    let A = Float32Array.from(world.E), B = new Float32Array(A.length);
    for (let pass = 0; pass < 2; pass++) {
      for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
        let s = 0;
        for (let k = -2; k <= 2; k++) s += A[y * GW + ((x + k + GW) % GW)];
        B[y * GW + x] = s / 5;
      }
      for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
        let s = 0;
        for (let k = -2; k <= 2; k++) s += B[G.clamp(y + k, 0, GH - 1) * GW + x];
        A[y * GW + x] = s / 5;
      }
    }
    world.ES = A;
    return A;
  }
  // linhas de contorno vetoriais (marching squares): costa nítida em qualquer zoom e ecos no mar
  function contourPath(world, level, k) {
    const { E, GW, GH } = world, GS = H.GS;
    const p = new Path2D();
    const seg = (x1, y1, x2, y2) => { p.moveTo(x1 * GS * k, y1 * GS * k); p.lineTo(x2 * GS * k, y2 * GS * k); };
    for (let y = 0; y < GH - 1; y++) {
      for (let x = 0; x < GW; x++) {
        const x1 = (x + 1) % GW;
        const a = E[y * GW + x] - level, b = E[y * GW + x1] - level, c = E[(y + 1) * GW + x1] - level, d = E[(y + 1) * GW + x] - level;
        const idx = (a > 0 ? 8 : 0) | (b > 0 ? 4 : 0) | (c > 0 ? 2 : 0) | (d > 0 ? 1 : 0);
        if (idx === 0 || idx === 15) continue;
        const T = [x + a / (a - b), y], Rr = [x + 1, y + b / (b - c)], Bt = [x + d / (d - c), y + 1], L = [x, y + a / (a - d)];
        switch (idx) {
          case 1: case 14: seg(L[0], L[1], Bt[0], Bt[1]); break;
          case 2: case 13: seg(Bt[0], Bt[1], Rr[0], Rr[1]); break;
          case 3: case 12: seg(L[0], L[1], Rr[0], Rr[1]); break;
          case 4: case 11: seg(T[0], T[1], Rr[0], Rr[1]); break;
          case 6: case 9: seg(T[0], T[1], Bt[0], Bt[1]); break;
          case 7: case 8: seg(L[0], L[1], T[0], T[1]); break;
          case 5: seg(L[0], L[1], T[0], T[1]); seg(Bt[0], Bt[1], Rr[0], Rr[1]); break;
          case 10: seg(T[0], T[1], Rr[0], Rr[1]); seg(L[0], L[1], Bt[0], Bt[1]); break;
        }
      }
    }
    return p;
  }
  function drawContours(ctx, world, st, k) {
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const P = PAL[st];
    if (st !== 'night') {
      const lv = st === 'parchment' ? [[-0.028, 0.5], [-0.06, 0.34], [-0.1, 0.2], [-0.15, 0.1]] : [[-0.03, 0.55], [-0.07, 0.3]];
      for (const [L, al] of lv) {
        ctx.strokeStyle = 'rgba(' + P.ripple.join(',') + ',' + al + ')';
        ctx.lineWidth = (st === 'parchment' ? 0.42 : 0.5) * k;
        ctx.stroke(contourPath(world, L, k));
      }
    }
    const coast = contourPath(world, 0, k);
    if (st === 'parchment') {
      ctx.strokeStyle = 'rgba(70,54,36,0.18)'; ctx.lineWidth = 2.2 * k; ctx.stroke(coast);
      ctx.strokeStyle = 'rgba(62,46,30,0.95)'; ctx.lineWidth = 0.62 * k; ctx.stroke(coast);
    } else if (st === 'atlas') {
      ctx.strokeStyle = 'rgba(60,70,80,0.75)'; ctx.lineWidth = 0.45 * k; ctx.stroke(coast);
    } else {
      ctx.strokeStyle = 'rgba(70,110,150,0.55)'; ctx.lineWidth = 0.4 * k; ctx.stroke(coast);
    }
    ctx.restore();
  }

  // fatia o trabalho com setTimeout (não depende de requestAnimationFrame, que alguns navegadores pausam)
  function runJob(gen, onDone, onProg, budget, onErr) {
    const step = () => {
      const t0 = performance.now();
      let r;
      try {
        do { r = gen.next(); if (onProg && r.value != null) onProg(r.value); } while (!r.done && performance.now() - t0 < (budget || 40));
      } catch (e) { console.error(e); if (onErr) onErr(e); return; }
      if (r.done) onDone(); else setTimeout(step, 0);
    };
    setTimeout(step, 0);
  }

  // ---------------- símbolos desenhados ----------------
  function drawGlyphs(ctx, world, st, k) {
    if (st === 'night') return;
    const P = PAL[st];
    const ink = `rgb(${P.ink.join(',')})`;
    const TI = G.TI;
    const items = [];
    for (let i = 0; i < H.N; i++) {
      const t = world.terr[i];
      if (t === TI.mountain || t === TI.hills || t === TI.forest || t === TI.taiga || t === TI.jungle || t === TI.desert) items.push(i);
    }
    items.sort((a, b) => a - b);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    for (const i of items) {
      const [cx, cy] = G.hexCenter(i);
      const t = world.terr[i];
      const j1 = G.hash2(i, 1, 5), j2 = G.hash2(i, 2, 5), j3 = G.hash2(i, 3, 5);
      for (const off of [0, cx < 12 ? H.MW : cx > H.MW - 12 ? -H.MW : null]) {
        if (off === null) continue;
        const x = (cx + off + (j1 - 0.5) * 6) * k, y = (cy + (j2 - 0.5) * 5) * k;
        if (t === TI.mountain) {
          const n = j3 > 0.62 ? 2 : 1;
          for (let q = 0; q < n; q++) {
            const ox = n === 2 ? (q ? 3.2 : -3) + (G.hash2(i, q, 31) - 0.5) * 2 : (G.hash2(i, 7, 31) - 0.5) * 3;
            const oy = n === 2 ? (q ? 1.6 : -1.2) : (G.hash2(i, 8, 31) - 0.5) * 3;
            const sz = n === 2 ? 4.6 + G.hash2(i, q, 33) * 2.4 : 5.4 + G.hash2(i, 9, 33) * 4.4;
            mountain(ctx, x + ox * k, y + oy * k, sz * k, st, ink, world.helev[i]);
          }
        }
        else if (t === TI.hills) { if (j3 < 0.55) hill(ctx, x, y, (3.4 + j3 * 1.2) * k, st, ink); }
        else if (t === TI.forest || t === TI.jungle) { const n = t === TI.jungle ? 3 : 2 + (j3 > 0.5 ? 1 : 0); for (let q = 0; q < n; q++) tree(ctx, x + (q - (n - 1) / 2) * 3.2 * k + (G.hash2(i, q, 9) - 0.5) * 2 * k, y + ((q & 1) ? 1.6 : -0.6) * k, 2.3 * k, st, ink, t === TI.jungle); }
        else if (t === TI.taiga) { for (let q = 0; q < 2; q++) conifer(ctx, x + (q - 0.5) * 3.4 * k, y + (q ? 1.2 : -0.8) * k, 2.6 * k, st, ink); }
        else if (t === TI.desert && st === 'parchment') { ctx.fillStyle = 'rgba(110,90,60,0.45)'; for (let q = 0; q < 6; q++) { ctx.beginPath(); ctx.arc(x + (G.hash2(i, q, 13) - 0.5) * 10 * k, y + (G.hash2(i, q, 17) - 0.5) * 8 * k, 0.32 * k, 0, 7); ctx.fill(); } }
        else if (t === TI.desert && st === 'atlas') { ctx.strokeStyle = 'rgba(170,140,90,0.55)'; ctx.lineWidth = 0.45 * k; ctx.beginPath(); ctx.arc(x, y + 2 * k, 3 * k, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke(); }
      }
    }
  }
  function mountain(ctx, x, y, s, st, ink, h) {
    const w = s * 1.0, hh = s * (0.9 + h * 0.4);
    ctx.beginPath();
    ctx.moveTo(x - w, y + hh * 0.35);
    ctx.lineTo(x - w * 0.1, y - hh * 0.65);
    ctx.lineTo(x + w, y + hh * 0.35);
    ctx.closePath();
    if (st === 'parchment') {
      ctx.fillStyle = 'rgba(236,222,186,0.95)'; ctx.fill();
      // hachuras do lado sombreado
      ctx.save(); ctx.clip();
      ctx.strokeStyle = 'rgba(80,62,40,0.55)'; ctx.lineWidth = s * 0.07;
      for (let q = 0; q < 6; q++) { const xx = x - w * 0.05 + q * w * 0.18; ctx.beginPath(); ctx.moveTo(xx, y - hh * 0.6); ctx.lineTo(xx + w * 0.25, y + hh * 0.4); ctx.stroke(); }
      ctx.restore();
      ctx.strokeStyle = ink; ctx.lineWidth = s * 0.11;
      ctx.beginPath(); ctx.moveTo(x - w, y + hh * 0.35); ctx.lineTo(x - w * 0.1, y - hh * 0.65); ctx.lineTo(x + w, y + hh * 0.35); ctx.stroke();
    } else {
      const g = ctx.createLinearGradient(x - w, 0, x + w, 0);
      g.addColorStop(0, 'rgba(214,196,160,0.95)'); g.addColorStop(0.48, 'rgba(190,168,130,0.95)'); g.addColorStop(0.52, 'rgba(140,118,92,0.95)'); g.addColorStop(1, 'rgba(120,100,78,0.95)');
      ctx.fillStyle = g; ctx.fill();
      if (h > 0.68) { ctx.beginPath(); ctx.moveTo(x - w * 0.42, y - hh * 0.2); ctx.lineTo(x - w * 0.1, y - hh * 0.65); ctx.lineTo(x + w * 0.3, y - hh * 0.25); ctx.closePath(); ctx.fillStyle = 'rgba(250,250,248,0.95)'; ctx.fill(); }
      ctx.strokeStyle = 'rgba(80,64,48,0.6)'; ctx.lineWidth = s * 0.06; ctx.stroke();
    }
  }
  function hill(ctx, x, y, s, st, ink) {
    ctx.strokeStyle = st === 'parchment' ? ink : 'rgba(110,90,62,0.7)';
    ctx.lineWidth = s * 0.14;
    ctx.beginPath(); ctx.arc(x - s * 0.5, y + s * 0.4, s * 0.62, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
    ctx.beginPath(); ctx.arc(x + s * 0.55, y + s * 0.55, s * 0.5, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
  }
  function tree(ctx, x, y, s, st, ink, jungle) {
    if (st === 'parchment') {
      ctx.strokeStyle = ink; ctx.lineWidth = s * 0.22;
      ctx.beginPath(); ctx.moveTo(x, y + s * 0.4); ctx.lineTo(x, y + s * 1.1); ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y - s * 0.1, s * (jungle ? 0.75 : 0.62), 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(206,196,150,0.95)'; ctx.fill(); ctx.stroke();
    } else {
      ctx.fillStyle = jungle ? 'rgba(70,112,58,0.85)' : 'rgba(86,124,70,0.85)';
      ctx.beginPath(); ctx.arc(x, y, s * (jungle ? 0.8 : 0.68), 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,230,0.18)'; ctx.beginPath(); ctx.arc(x - s * 0.2, y - s * 0.22, s * 0.3, 0, Math.PI * 2); ctx.fill();
    }
  }
  function conifer(ctx, x, y, s, st, ink) {
    ctx.beginPath(); ctx.moveTo(x, y - s); ctx.lineTo(x + s * 0.55, y + s * 0.6); ctx.lineTo(x - s * 0.55, y + s * 0.6); ctx.closePath();
    if (st === 'parchment') { ctx.fillStyle = 'rgba(210,200,160,0.95)'; ctx.fill(); ctx.strokeStyle = ink; ctx.lineWidth = s * 0.16; ctx.stroke(); }
    else { ctx.fillStyle = 'rgba(70,104,72,0.85)'; ctx.fill(); }
  }
  function drawRivers(ctx, world, st, k) {
    const col = st === 'parchment' ? 'rgba(92,110,120,0.9)' : st === 'atlas' ? 'rgba(74,128,170,0.95)' : 'rgba(40,72,100,0.9)';
    const nxt = world.riverNext, flow = world.river;
    const up = new Uint8Array(H.N);
    for (let i = 0; i < H.N; i++) if (flow[i] && nxt[i] >= 0) up[nxt[i]] = 1;
    ctx.strokeStyle = col; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let i = 0; i < H.N; i++) {
      if (!flow[i] || up[i]) continue;
      // traça do nascente até a foz, desenhando em segmentos de largura crescente
      let cur = i, pts = [G.hexCenter(i)], ws = [flow[i]];
      let guard = 0;
      while (cur >= 0 && guard++ < 200) {
        const n = nxt[cur];
        if (n < 0) break;
        let c = G.hexCenter(n);
        const last = pts[pts.length - 1];
        if (Math.abs(c[0] - last[0]) > H.MW / 2) c = [c[0] + (c[0] < last[0] ? H.MW : -H.MW), c[1]];
        if (world.isWater(n)) { pts.push([(last[0] + c[0]) / 2, (last[1] + c[1]) / 2]); ws.push(flow[cur]); break; }
        pts.push(c); ws.push(flow[n]);
        if (up[n] && n !== i && pts.length > 2 && flow[n] > flow[cur]) { /* junção: continua até o fim, o trecho a jusante é desenhado de novo, sem problema */ }
        cur = n;
      }
      for (let q = 1; q < pts.length; q++) {
        const a = pts[q - 1], b = pts[q];
        const m0 = q > 1 ? [(pts[q - 2][0] + a[0]) / 2, (pts[q - 2][1] + a[1]) / 2] : a;
        const m1 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        ctx.lineWidth = (0.55 + Math.sqrt(ws[q]) * 0.45) * k;
        ctx.beginPath();
        ctx.moveTo(m0[0] * k, m0[1] * k);
        ctx.quadraticCurveTo(a[0] * k, a[1] * k, m1[0] * k, m1[1] * k);
        if (q === pts.length - 1) ctx.lineTo(b[0] * k, b[1] * k);
        ctx.stroke();
      }
    }
  }

  // prévia pequena (tela de fundação)
  MV.renderPreview = function (world, W, Hh, styleId) {
    const out = { wantMask: false, glyphs: false };
    const gen = terrainJob(world, styleId || 'parchment', W, Hh, out);
    let r; do { r = gen.next(); } while (!r.done);
    return out.canvas;
  };

  // ---------------- construir/garantir estilos ----------------
  MV.ensureStyle = function (styleId, cb, onProg) {
    if (MV.styles[styleId]) { cb && cb(); return; }
    if (MV.building[styleId]) { MV.building[styleId].push(cb); return; }
    MV.building[styleId] = [cb];
    const W = Math.round(H.MW * MV.TS), Hh = Math.round(H.MH * MV.TS);
    const out = { wantMask: !MV.mask, glyphs: !MV.simple, half: true };
    const fail = (e) => {
      // plano B: resolução menor; se ainda falhar, avisa na tela
      if (MV.TS > 1) {
        const cbs = MV.building[styleId] || [];
        delete MV.building[styleId];
        MV.TS = 1; MV.mask = null; MV.terr = null; MV.lights = null;
        MV.ensureStyle(styleId, () => cbs.forEach((f) => f && f()), onProg);
        return;
      }
      if (G.ui && G.ui.fatal) G.ui.fatal('Não foi possível desenhar o mapa: ' + (e && e.message ? e.message : e));
    };
    runJob(terrainJob(G.game.world, styleId, W, Hh, out), () => {
      MV.styles[styleId] = out.canvas;
      if (out.mask) MV.mask = out.mask;
      const cbs = MV.building[styleId];
      delete MV.building[styleId];
      cbs.forEach((f) => f && f());
    }, onProg, 40, fail);
  };
  MV.reset = function () {
    MV.styles = {}; MV.building = {}; MV.mask = null; MV.style = null; MV.prevStyle = null;
    MV.terr = null; MV.fog = null; MV.lights = null; MV.globeSrc = null; MV.dayLow = null;
    MV.terrDirty = MV.fogDirty = MV.roadsDirty = MV.lightsDirty = true;
  };
  MV.setStyle = function (st, instant) {
    if (MV.style === st) return;
    MV.ensureStyle(st, () => {
      MV.prevStyle = instant ? null : MV.style;
      MV.style = st;
      if (typeof document !== 'undefined') document.body.dataset.map = st;
      MV.fade = instant ? 1 : 0;
      MV.terrDirty = MV.fogDirty = MV.lightsDirty = true;
    });
  };

  // ---------------- território ----------------
  function hexPath(p, cx, cy, k) {
    const C = G.HEX_CORNERS;
    p.moveTo((cx + C[0][0]) * k, (cy + C[0][1]) * k);
    for (let q = 1; q < 6; q++) p.lineTo((cx + C[q][0]) * k, (cy + C[q][1]) * k);
    p.closePath();
  }
  function offsetsFor(cx) { return cx < 14 ? [0, H.MW] : cx > H.MW - 14 ? [0, -H.MW] : [0]; }

  function buildTerritory() {
    const g = G.game, s = g.s, own = g.owner, st = MV.style;
    const k = MV.TS;
    const W = Math.round(H.MW * k), Hh = Math.round(H.MH * k);
    if (!MV.terr) { MV.terr = document.createElement('canvas'); MV.terr.width = W; MV.terr.height = Hh; }
    const ctx = MV.terr.getContext('2d');
    ctx.clearRect(0, 0, W, Hh);
    const fills = {}, edges = {};
    const C = G.HEX_CORNERS, EN = G.EDGE_NB;
    for (let i = 0; i < H.N; i++) {
      const o = own[i];
      if (o < 0) continue;
      const [cx, cy] = G.hexCenter(i);
      const f = fills[o] || (fills[o] = new Path2D());
      const e = edges[o] || (edges[o] = new Path2D());
      for (const off of offsetsFor(cx)) {
        hexPath(f, cx + off, cy, k);
        for (let q = 0; q < 6; q++) {
          const nb = G.NB[i * 6 + EN[q]];
          if (nb >= 0 && own[nb] === o) continue;
          const a = C[q], b = C[(q + 1) % 6];
          e.moveTo((cx + off + a[0]) * k, (cy + a[1]) * k);
          e.lineTo((cx + off + b[0]) * k, (cy + b[1]) * k);
        }
      }
    }
    const pc = s.color;
    for (const o in fills) {
      const isMe = +o === 0;
      const rv = isMe ? null : s.rivals[o - 1];
      const col = isMe ? pc : rv.color;
      if (st === 'night') {
        ctx.fillStyle = isMe ? G.rgba('#ffcf8a', 0.07) : 'rgba(140,170,210,0.05)';
        ctx.fill(fills[o]);
      } else {
        ctx.fillStyle = G.rgba(col, st === 'parchment' ? (isMe ? 0.22 : 0.15) : isMe ? 0.42 : 0.32);
        ctx.fill(fills[o]);
      }
    }
    for (const o in edges) {
      const isMe = +o === 0;
      const rv = isMe ? null : s.rivals[o - 1];
      const col = isMe ? pc : rv.color;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      if (st === 'night') {
        ctx.strokeStyle = isMe ? 'rgba(255,200,120,0.25)' : 'rgba(150,180,220,0.18)';
        ctx.lineWidth = (isMe ? 3 : 1.6) * k; ctx.stroke(edges[o]);
        ctx.strokeStyle = isMe ? 'rgba(255,214,150,0.85)' : 'rgba(170,195,230,0.45)';
        ctx.lineWidth = (isMe ? 0.9 : 0.5) * k; ctx.stroke(edges[o]);
      } else if (st === 'parchment') {
        ctx.strokeStyle = G.rgba(col, isMe ? 0.45 : 0.35);
        ctx.lineWidth = (isMe ? 3.2 : 2.2) * k; ctx.stroke(edges[o]);
        ctx.setLineDash(isMe ? [] : [1.6 * k, 1.4 * k]);
        ctx.strokeStyle = isMe ? G.mixHex(col, '#2a1a10', 0.35) : G.rgba(G.mixHex(col, '#2a1a10', 0.4), 0.85);
        ctx.lineWidth = (isMe ? 0.9 : 0.6) * k; ctx.stroke(edges[o]);
        ctx.setLineDash([]);
      } else {
        ctx.strokeStyle = G.rgba(G.mixHex(col, '#1a1a1a', 0.3), isMe ? 0.95 : 0.7);
        ctx.lineWidth = (isMe ? 1.1 : 0.6) * k; ctx.stroke(edges[o]);
      }
    }
    // recorta pela terra firme
    if (MV.mask) { ctx.globalCompositeOperation = 'destination-in'; ctx.drawImage(MV.mask, 0, 0, W, Hh); ctx.globalCompositeOperation = 'source-over'; }
    MV.terrDirty = false;
  }

  // ---------------- névoa (terra incógnita) ----------------
  function buildFog() {
    const g = G.game, ex = g.explored;
    const k = 0.6;
    const W = Math.ceil(H.MW * k), Hh = Math.ceil(H.MH * k);
    if (!MV.fog) { MV.fog = document.createElement('canvas'); MV.fog.width = W; MV.fog.height = Hh; }
    const ctx = MV.fog.getContext('2d');
    ctx.clearRect(0, 0, W, Hh);
    let any = false;
    ctx.fillStyle = '#000';
    for (let i = 0; i < H.N; i++) {
      if (ex[i]) continue;
      any = true;
      const [cx, cy] = G.hexCenter(i);
      for (const off of offsetsFor(cx)) { ctx.beginPath(); ctx.arc((cx + off) * k, cy * k, H.R * 1.15 * k, 0, Math.PI * 2); ctx.fill(); }
    }
    MV.fogAny = any;
    if (any && 'filter' in ctx) {
      // borda suave e irregular, como tinta que não chegou ao papel
      const tmp = document.createElement('canvas'); tmp.width = W; tmp.height = Hh;
      const tx = tmp.getContext('2d');
      tx.filter = 'blur(3px)'; tx.drawImage(MV.fog, 0, 0); tx.filter = 'none';
      ctx.clearRect(0, 0, W, Hh); ctx.drawImage(tmp, 0, 0);
    }
    if (any) {
      ctx.globalCompositeOperation = 'source-in';
      if (MV.style === 'night') ctx.fillStyle = '#04080e';
      else ctx.fillStyle = MV.style === 'atlas' ? '#e9dfc6' : '#e8dab6';
      ctx.fillRect(0, 0, W, Hh);
      ctx.globalCompositeOperation = 'source-over';
    }
    // locais para "terra incógnita" e monstros marinhos
    MV.fogSpots = [];
    if (any) {
      const r = G.rng(g.s.seed + 5);
      for (let t = 0; t < 400 && MV.fogSpots.length < 4; t++) {
        const i = Math.floor(r() * H.N);
        if (ex[i]) continue;
        let ok = true;
        for (let k2 = 0; k2 < 6 && ok; k2++) { const nb = G.NB[i * 6 + k2]; if (nb >= 0 && ex[nb]) ok = false; }
        if (!ok || MV.fogSpots.some((x) => G.hexDist(x.h, i) < 20)) continue;
        MV.fogSpots.push({ h: i, water: g.world.isWater(i), r: r() });
      }
    }
    MV.fogDirty = false;
  }

  // ---------------- luzes noturnas ----------------
  function buildLights() {
    const g = G.game, s = g.s, own = g.owner;
    const k = MV.TS * 0.5;
    const W = Math.round(H.MW * k), Hh = Math.round(H.MH * k);
    if (!MV.lights) { MV.lights = document.createElement('canvas'); MV.lights.width = W; MV.lights.height = Hh; }
    const ctx = MV.lights.getContext('2d');
    ctx.clearRect(0, 0, W, Hh);
    if (MV.style !== 'night') { MV.lightsDirty = false; return; }
    ctx.globalCompositeOperation = 'lighter';
    const dens = Math.min(1, 0.45 + (s.era - 7) * 0.12);
    for (let i = 0; i < H.N; i++) {
      if (own[i] < 0 || g.world.isWater(i)) continue;
      const mine = own[i] === 0;
      const [cx, cy] = G.hexCenter(i);
      const n = mine ? 2 + Math.floor(g.capOf(i) * 3) : 1;
      for (let q = 0; q < n; q++) {
        if (G.hash2(i, q, 21) > dens * (mine ? 1 : 0.5)) continue;
        const x = (cx + (G.hash2(i, q, 22) - 0.5) * 11) * k, y = (cy + (G.hash2(i, q, 23) - 0.5) * 10) * k;
        const a = mine ? 0.35 + G.hash2(i, q, 24) * 0.4 : 0.18;
        ctx.fillStyle = mine ? `rgba(255,196,120,${a})` : `rgba(200,210,255,${a})`;
        ctx.fillRect(x, y, 0.9 * k, 0.9 * k);
      }
    }
    for (const st of s.settlements) {
      if (st.owner < 0) continue;
      const pop = g.settlementPop(st);
      const [cx, cy] = G.hexCenter(st.h);
      const rad = (2.5 + Math.log10(Math.max(10, pop)) * 1.4) * k;
      for (const off of offsetsFor(cx)) {
        const gr = ctx.createRadialGradient((cx + off) * k, cy * k, 0, (cx + off) * k, cy * k, rad);
        const mine = st.owner === 0;
        gr.addColorStop(0, mine ? 'rgba(255,236,190,0.95)' : 'rgba(220,230,255,0.6)');
        gr.addColorStop(0.25, mine ? 'rgba(255,190,110,0.5)' : 'rgba(170,190,240,0.25)');
        gr.addColorStop(1, 'rgba(255,160,80,0)');
        ctx.fillStyle = gr;
        ctx.beginPath(); ctx.arc((cx + off) * k, cy * k, rad, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalCompositeOperation = 'source-over';
    MV.lightsDirty = false;
  }

  // ---------------- estradas ----------------
  function buildRoads() {
    const g = G.game, s = g.s, w = g.world;
    const mine = s.settlements.filter((x) => x.owner === 0);
    const n = mine.length;
    const edges = [];
    for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) {
      const d = G.hexDist(mine[a].h, mine[b].h);
      if (d < 26) edges.push([d, a, b]);
    }
    edges.sort((x, y) => x[0] - y[0]);
    const par = mine.map((_, i) => i);
    const find = (x) => (par[x] === x ? x : (par[x] = find(par[x])));
    const roads = [], seas = [];
    for (const [d, a, b] of edges) {
      const ra = find(a), rb = find(b);
      if (ra === rb) continue;
      par[ra] = rb;
      const sameCont = w.cont[mine[a].h] === w.cont[mine[b].h];
      (sameCont ? roads : seas).push([mine[a].h, mine[b].h, d]);
    }
    // rotas marítimas extras entre continentes (componentes desconectados) a partir da capital
    const cap = mine.find((x) => x.capital) || mine[0];
    if (cap && s.era >= 3) {
      const conts = new Map();
      for (const st of mine) { const c = w.cont[st.h]; if (c !== w.cont[cap.h] && w.coast[st.h] && !conts.has(c)) conts.set(c, st); }
      for (const st of conts.values()) if (!seas.some((x) => x.includes(st.h))) seas.push([cap.h, st.h, G.hexDist(cap.h, st.h)]);
    }
    MV.roads = roads; MV.seas = seas;
    // rotas aéreas entre as maiores cidades
    const big = mine.slice().sort((a, b) => g.settlementPop(b) - g.settlementPop(a)).slice(0, 9);
    MV.air = [];
    for (let i = 1; i < big.length; i++) MV.air.push([big[0].h, big[i].h]);
    for (let i = 1; i + 2 < big.length; i += 2) MV.air.push([big[i].h, big[i + 2].h]);
    MV.roadsDirty = false;
  }

  // ---------------- ícones de assentamentos ----------------
  function settlementIcon(ctx, x, y, sz, tier, st, col, capital, mine) {
    const ink = st === 'night' ? '#ffd9a0' : st === 'atlas' ? '#3d3428' : '#46341f';
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    if (st === 'night') {
      ctx.fillStyle = mine ? 'rgba(255,240,210,0.95)' : 'rgba(210,225,255,0.8)';
      ctx.beginPath(); ctx.arc(x, y, Math.max(1.2, sz * 0.12 * (1 + tier * 0.25)), 0, 7); ctx.fill();
      if (capital) { ctx.strokeStyle = mine ? 'rgba(255,220,160,0.9)' : 'rgba(200,215,255,0.6)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, sz * 0.45, 0, 7); ctx.stroke(); }
      return;
    }
    if (st === 'atlas') {
      const r = sz * (0.16 + tier * 0.045);
      ctx.fillStyle = '#fbf6ea'; ctx.strokeStyle = ink; ctx.lineWidth = Math.max(0.8, sz * 0.07);
      if (capital) {
        star(ctx, x, y, r * 1.9, r * 0.85);
        ctx.fillStyle = mine ? col : '#f2e8d2'; ctx.fill(); ctx.stroke();
        return;
      }
      ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.stroke();
      if (tier >= 3) { ctx.fillStyle = ink; ctx.beginPath(); ctx.arc(x, y, r * 0.45, 0, 7); ctx.fill(); }
      if (tier >= 5) { ctx.beginPath(); ctx.arc(x, y, r * 1.5, 0, 7); ctx.stroke(); }
      return;
    }
    // pergaminho: desenhos a tinta
    const s2 = sz * 0.5;
    ctx.strokeStyle = ink; ctx.fillStyle = '#efe3c4'; ctx.lineWidth = Math.max(0.8, sz * 0.065);
    const house = (hx, hy, hw) => {
      ctx.beginPath();
      ctx.moveTo(hx - hw, hy + hw * 0.9); ctx.lineTo(hx - hw, hy); ctx.lineTo(hx, hy - hw * 0.85); ctx.lineTo(hx + hw, hy); ctx.lineTo(hx + hw, hy + hw * 0.9); ctx.closePath();
      ctx.fill(); ctx.stroke();
    };
    const tower = (hx, hy, hw, hh) => {
      ctx.beginPath(); ctx.rect(hx - hw, hy - hh, hw * 2, hh); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(hx - hw * 1.2, hy - hh); ctx.lineTo(hx, hy - hh - hw * 1.6); ctx.lineTo(hx + hw * 1.2, hy - hh); ctx.closePath(); ctx.fill(); ctx.stroke();
    };
    if (tier === 0) {
      ctx.beginPath(); ctx.moveTo(x - s2 * 0.55, y + s2 * 0.45); ctx.lineTo(x, y - s2 * 0.55); ctx.lineTo(x + s2 * 0.55, y + s2 * 0.45); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, y - s2 * 0.55); ctx.lineTo(x, y - s2 * 0.8); ctx.stroke();
    } else if (tier === 1) {
      house(x - s2 * 0.35, y, s2 * 0.32); house(x + s2 * 0.35, y + s2 * 0.12, s2 * 0.28);
    } else if (tier === 2) {
      house(x - s2 * 0.5, y + s2 * 0.1, s2 * 0.3); house(x + s2 * 0.5, y + s2 * 0.15, s2 * 0.28); tower(x, y + s2 * 0.25, s2 * 0.17, s2 * 0.55);
    } else {
      const R = s2 * (0.55 + (tier - 3) * 0.12);
      ctx.beginPath(); ctx.ellipse(x, y + R * 0.15, R, R * 0.62, 0, 0, 7); ctx.fill(); ctx.stroke();
      const nt = Math.min(6, tier);
      for (let q = 0; q < nt; q++) {
        const a = Math.PI + (q / Math.max(1, nt - 1)) * Math.PI;
        tower(x + Math.cos(a) * R * 0.85, y + R * 0.15 + Math.sin(a) * R * 0.5 + s2 * 0.15, s2 * 0.12, s2 * (0.35 + (tier >= 5 ? 0.2 : 0)));
      }
      tower(x, y + R * 0.3, s2 * 0.16, s2 * (0.6 + tier * 0.08));
    }
    if (capital) {
      ctx.strokeStyle = ink; ctx.lineWidth = Math.max(0.8, sz * 0.05);
      const fx = x + s2 * 0.62, fy = y - s2 * 0.75;
      ctx.beginPath(); ctx.moveTo(fx, fy + s2 * 0.9); ctx.lineTo(fx, fy - s2 * 0.35); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(fx, fy - s2 * 0.35); ctx.quadraticCurveTo(fx + s2 * 0.3, fy - s2 * 0.45, fx + s2 * 0.55, fy - s2 * 0.2); ctx.lineTo(fx, fy - s2 * 0.02); ctx.closePath();
      ctx.fillStyle = col; ctx.fill(); ctx.stroke();
    }
  }
  function star(ctx, x, y, R, r) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5; const rr = i % 2 ? r : R; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    ctx.closePath();
  }

  function wonderGlyph(ctx, x, y, sz, glyph, st) {
    const ink = st === 'night' ? '#ffe2a8' : '#3d2c18';
    ctx.strokeStyle = ink; ctx.lineWidth = Math.max(0.8, sz * 0.06);
    ctx.fillStyle = st === 'night' ? 'rgba(255,214,140,0.25)' : st === 'atlas' ? '#efe2c0' : '#ead9b0';
    const s = sz * 0.5;
    ctx.beginPath();
    switch (glyph) {
      case 'pyramid': ctx.moveTo(x - s, y + s * 0.6); ctx.lineTo(x, y - s * 0.7); ctx.lineTo(x + s, y + s * 0.6); ctx.closePath(); break;
      case 'ziggurat': ctx.rect(x - s, y + s * 0.2, s * 2, s * 0.4); ctx.rect(x - s * 0.65, y - s * 0.2, s * 1.3, s * 0.4); ctx.rect(x - s * 0.32, y - s * 0.55, s * 0.64, s * 0.35); break;
      case 'stones': for (let q = 0; q < 6; q++) { const a = (q / 6) * Math.PI * 2; ctx.rect(x + Math.cos(a) * s * 0.7 - s * 0.1, y + Math.sin(a) * s * 0.4 - s * 0.3, s * 0.2, s * 0.4); } break;
      case 'lighthouse': case 'tower': case 'tower2': case 'antenna': case 'elevator':
        ctx.moveTo(x - s * 0.35, y + s * 0.7); ctx.lineTo(x - s * 0.12, y - s * 0.8); ctx.lineTo(x + s * 0.12, y - s * 0.8); ctx.lineTo(x + s * 0.35, y + s * 0.7); ctx.closePath(); break;
      case 'cathedral': case 'dome': case 'observatory': case 'palace': case 'crystal':
        ctx.rect(x - s * 0.8, y - s * 0.1, s * 1.6, s * 0.7); ctx.moveTo(x - s * 0.5, y - s * 0.1); ctx.arc(x, y - s * 0.1, s * 0.5, Math.PI, 0); break;
      default:
        ctx.moveTo(x - s * 0.9, y + s * 0.6); ctx.lineTo(x - s * 0.9, y - s * 0.2); ctx.lineTo(x, y - s * 0.7); ctx.lineTo(x + s * 0.9, y - s * 0.2); ctx.lineTo(x + s * 0.9, y + s * 0.6); ctx.closePath();
        for (let q = -2; q <= 2; q++) { ctx.moveTo(x + q * s * 0.35, y - s * 0.1); ctx.lineTo(x + q * s * 0.35, y + s * 0.6); }
    }
    ctx.fill(); ctx.stroke();
  }

  // ---------------- câmera ----------------
  MV.screenW = 800; MV.screenH = 600;
  MV.toMap = (sx, sy) => [MV.cam.x + (sx - MV.screenW / 2) / MV.cam.z, MV.cam.y + (sy - MV.screenH / 2) / MV.cam.z];
  MV.toScreen = (mx, my) => [(mx - MV.cam.x) * MV.cam.z + MV.screenW / 2, (my - MV.cam.y) * MV.cam.z + MV.screenH / 2];
  MV.zMin = () => Math.max(0.35, (MV.screenH / H.MH) * 0.92);
  MV.clampCam = function () {
    const c = MV.cam;
    c.z = G.clamp(c.z, MV.zMin(), 6);
    c.x = ((c.x % H.MW) + H.MW) % H.MW;
    const halfH = MV.screenH / 2 / c.z;
    c.y = H.MH < halfH * 2 ? H.MH / 2 : G.clamp(c.y, halfH - 20, H.MH - halfH + 20);
  };
  MV.flyTo = function (x, y, z, dur) { MV.target = { x0: MV.cam.x, y0: MV.cam.y, z0: MV.cam.z, x, y, z, t: 0, dur: dur || 2.2 }; };
  MV.focusOwn = function (dur) {
    const g = G.game;
    let minx = 1e9, maxx = -1e9, miny = 1e9, maxy = -1e9, n = 0;
    const cap = g.s.settlements.find((x) => x.owner === 0 && x.capital);
    const ref = cap ? G.hexCenter(cap.h)[0] : 0;
    for (let i = 0; i < H.N; i++) {
      if (!g.explored[i]) continue;
      let [x, y] = G.hexCenter(i);
      if (x - ref > H.MW / 2) x -= H.MW; else if (ref - x > H.MW / 2) x += H.MW;
      if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y; n++;
    }
    if (!n) return;
    const z = Math.min(MV.screenW / (maxx - minx + 40), MV.screenH / (maxy - miny + 40));
    MV.flyTo((minx + maxx) / 2, (miny + maxy) / 2, G.clamp(z, MV.zMin(), 4.2), dur);
  };

  // ---------------- desenho principal ----------------
  MV.update = function (dt) {
    if (MV.target) {
      const T = MV.target;
      T.t += dt / T.dur;
      const k = G.smooth(Math.min(1, T.t));
      let dx = T.x - T.x0;
      if (dx > H.MW / 2) dx -= H.MW; else if (dx < -H.MW / 2) dx += H.MW;
      MV.cam.x = T.x0 + dx * k; MV.cam.y = T.y0 + (T.y - T.y0) * k;
      MV.cam.z = Math.exp(Math.log(T.z0) + (Math.log(T.z) - Math.log(T.z0)) * k);
      if (T.t >= 1) MV.target = null;
    }
    if (MV.fade < 1) MV.fade = Math.min(1, MV.fade + dt / 2.5);
    MV.clampCam();
  };

  MV.draw = function (ctx, time) {
    const g = G.game;
    const W = MV.screenW, Hh = MV.screenH, c = MV.cam;
    const st = MV.style;
    ctx.fillStyle = st === 'night' ? '#03060b' : st === 'atlas' ? '#d9ccb0' : '#d8c8a2';
    ctx.fillRect(0, 0, W, Hh);
    if (!st || !MV.styles[st]) return;
    if (MV.terrDirty) buildTerritory();
    if (MV.fogDirty) buildFog();
    if (MV.lightsDirty) buildLights();
    if (MV.roadsDirty) buildRoads();
    const k = MV.TS;
    // deslocamentos horizontais para dar a volta no mundo
    const left = c.x - W / 2 / c.z, right = c.x + W / 2 / c.z;
    const offs = [];
    for (let o = Math.floor(left / H.MW) - 0; o <= Math.floor(right / H.MW); o++) offs.push(o * H.MW);
    const base = (img, alpha, scaleK) => {
      if (!img) return;
      ctx.globalAlpha = alpha;
      for (const ox of offs) {
        const [sx, sy] = MV.toScreen(ox, 0);
        ctx.drawImage(img, sx, sy, H.MW * c.z + 0.6, H.MH * c.z);
      }
      ctx.globalAlpha = 1;
    };
    ctx.imageSmoothingEnabled = true;
    if (MV.prevStyle && MV.fade < 1) { base(MV.styles[MV.prevStyle], 1); base(MV.styles[st], MV.fade); }
    else base(MV.styles[st], 1);
    if (st !== 'night' && MV.paper && !MV.noPaper) try {
      ctx.save();
      ctx.globalCompositeOperation = 'multiply';
      ctx.globalAlpha = st === 'parchment' ? 0.32 : 0.2;
      const pat = ctx.createPattern(MV.paper, 'repeat');
      const [sx, sy] = MV.toScreen(0, 0);
      const pz = Math.min(c.z, 1.6) * 0.9;
      const m = new DOMMatrix([pz, 0, 0, pz, sx, sy]);
      pat.setTransform(m);
      ctx.fillStyle = pat; ctx.fillRect(0, 0, W, Hh);
      ctx.restore();
    } catch (e) { MV.noPaper = true; ctx.restore(); }
    base(MV.terr, 1);
    if (st === 'night' && MV.lights) {
      ctx.globalCompositeOperation = 'lighter';
      base(MV.lights, 0.95);
      ctx.globalCompositeOperation = 'source-over';
    }
    drawOverlay(ctx, time, offs);
    if (MV.fogAny && MV.fog) base(MV.fog, 1);
    drawFogDecor(ctx, offs, time);
    drawLabels(ctx, offs);
    drawFrame(ctx, time);
  };

  function drawOverlay(ctx, time, offs) {
    const g = G.game, s = g.s, c = MV.cam, st = MV.style;
    ctx.save();
    for (const ox of offs) {
      ctx.setTransform(c.z * MV.dpr, 0, 0, c.z * MV.dpr, (ox - c.x) * c.z * MV.dpr + MV.screenW / 2 * MV.dpr, (-c.y) * c.z * MV.dpr + MV.screenH / 2 * MV.dpr);
      // anexações recentes: brilho
      for (const f of g.flips) {
        const age = s.time - f.t;
        if (age > 2.2 || age < 0) continue;
        const [x, y] = G.hexCenter(f.h);
        const a = (1 - age / 2.2) * 0.55;
        ctx.fillStyle = f.o === 0 ? (st === 'night' ? `rgba(255,220,150,${a})` : `rgba(255,248,220,${a})`) : `rgba(60,40,20,${a * 0.4})`;
        ctx.beginPath();
        const C = G.HEX_CORNERS;
        ctx.moveTo(x + C[0][0], y + C[0][1]); for (let q = 1; q < 6; q++) ctx.lineTo(x + C[q][0], y + C[q][1]); ctx.closePath();
        ctx.fill();
      }
      drawRoads(ctx, time, st, s.era);
    }
    ctx.restore();
    // ícones (tamanho em pixels, posição na tela)
    const zoomK = G.clamp(c.z / 2.4, 0.55, 1.8);
    const showMinor = c.z > 1.4;
    for (const ox of offs) {
      for (const stl of s.settlements) {
        if (stl.owner < 0) continue;
        if (!g.explored[stl.h]) continue;
        const [mx, my] = G.hexCenter(stl.h);
        const [x, y] = MV.toScreen(mx + ox, my);
        if (x < -30 || y < -30 || x > MV.screenW + 30 || y > MV.screenH + 30) continue;
        const pop = g.settlementPop(stl);
        const tier = g.tierOf(pop);
        if (!showMinor && !stl.capital && tier < 3 && stl.owner === 0 && c.z < 0.9) continue;
        const mine = stl.owner === 0;
        const col = mine ? s.color : s.rivals[stl.owner - 1].color;
        const sz = (16 + tier * 2.2) * zoomK * (mine ? 1 : 0.85);
        settlementIcon(ctx, x, y, sz, tier, st, col, stl.capital, mine);
      }
      for (const id in s.wonders) {
        const w = s.wonders[id];
        if (w.h == null || w.h < 0) continue;
        const [mx, my] = G.hexCenter(w.h);
        const [x, y] = MV.toScreen(mx + ox, my);
        if (x < -30 || y < -30 || x > MV.screenW + 30 || y > MV.screenH + 30) continue;
        const stg = w.stage || 3;
        if (stg < 3) { ctx.save(); ctx.globalAlpha = 0.45 + stg * 0.15; ctx.setLineDash([2, 2]); }
        wonderGlyph(ctx, x, y, 18 * zoomK, G.WONDER[id].glyph, st);
        if (stg < 3) {
          // andaimes
          ctx.setLineDash([]); ctx.strokeStyle = st === 'night' ? 'rgba(255,220,160,0.8)' : 'rgba(60,40,20,0.8)'; ctx.lineWidth = 1;
          const s2 = 9 * zoomK;
          ctx.beginPath(); for (let q = -1; q <= 1; q++) { ctx.moveTo(x + q * s2, y + s2 * 0.6); ctx.lineTo(x + q * s2, y - s2 * 0.8); } ctx.moveTo(x - s2, y - s2 * 0.1); ctx.lineTo(x + s2, y - s2 * 0.1); ctx.moveTo(x - s2, y + s2 * 0.6); ctx.lineTo(x + s2, y - s2 * 0.8); ctx.stroke();
          ctx.restore();
        }
      }
    }
  }

  function drawRoads(ctx, time, st, era) {
    if (!MV.roads) return;
    const center = (h) => G.hexCenter(h);
    const curve = (a, b, bend) => {
      let [x1, y1] = center(a), [x2, y2] = center(b);
      if (x2 - x1 > H.MW / 2) x2 -= H.MW; else if (x1 - x2 > H.MW / 2) x2 += H.MW;
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
      const nx = -(y2 - y1), ny = x2 - x1;
      const b2 = bend * (G.hash2(a, b, 1) - 0.5);
      return [x1, y1, mx + nx * b2, my + ny * b2, x2, y2];
    };
    if (era >= 1) {
      ctx.lineCap = 'round';
      let col, w, dash = null;
      if (st === 'night') { col = 'rgba(255,190,110,0.55)'; w = 0.9; }
      else if (era <= 2) { col = 'rgba(110,80,50,0.65)'; w = 0.5; dash = [0.6, 1.4]; }
      else if (era <= 4) { col = 'rgba(110,76,44,0.7)'; w = 0.7; dash = [2.2, 1.2]; }
      else if (era === 5) { col = 'rgba(120,80,45,0.8)'; w = 0.75; }
      else { col = 'rgba(40,36,34,0.85)'; w = 0.8; }
      ctx.strokeStyle = col; ctx.lineWidth = w; ctx.setLineDash(dash || []);
      ctx.beginPath();
      for (const [a, b] of MV.roads) { const p = curve(a, b, 0.25); ctx.moveTo(p[0], p[1]); ctx.quadraticCurveTo(p[2], p[3], p[4], p[5]); }
      ctx.stroke();
      ctx.setLineDash([]);
      if (era === 6 && st !== 'night') {
        // dormentes da ferrovia
        ctx.strokeStyle = 'rgba(40,36,34,0.7)'; ctx.lineWidth = 0.3;
        ctx.beginPath();
        for (const [a, b] of MV.roads) {
          const p = curve(a, b, 0.25);
          for (let t = 0.05; t < 1; t += 0.06) {
            const x = (1 - t) * (1 - t) * p[0] + 2 * (1 - t) * t * p[2] + t * t * p[4];
            const y = (1 - t) * (1 - t) * p[1] + 2 * (1 - t) * t * p[3] + t * t * p[5];
            const dx = 2 * (1 - t) * (p[2] - p[0]) + 2 * t * (p[4] - p[2]);
            const dy = 2 * (1 - t) * (p[3] - p[1]) + 2 * t * (p[5] - p[3]);
            const L = Math.hypot(dx, dy) || 1;
            ctx.moveTo(x - (dy / L) * 0.9, y + (dx / L) * 0.9); ctx.lineTo(x + (dy / L) * 0.9, y - (dx / L) * 0.9);
          }
        }
        ctx.stroke();
      }
    }
    // rotas marítimas e navios
    if (era >= 3 && MV.seas && MV.seas.length) {
      ctx.strokeStyle = st === 'night' ? 'rgba(120,180,255,0.35)' : 'rgba(70,60,50,0.45)';
      ctx.lineWidth = 0.5; ctx.setLineDash([1.6, 1.6]);
      ctx.beginPath();
      for (const [a, b] of MV.seas) { const p = curve(a, b, 0.5); ctx.moveTo(p[0], p[1]); ctx.quadraticCurveTo(p[2], p[3], p[4], p[5]); }
      ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = st === 'night' ? 'rgba(160,210,255,0.9)' : 'rgba(60,44,30,0.9)';
      MV.seas.forEach(([a, b], i) => {
        const p = curve(a, b, 0.5);
        const L = Math.hypot(p[4] - p[0], p[5] - p[1]);
        const t = ((time * 6) / Math.max(20, L) + i * 0.37) % 1;
        const x = (1 - t) * (1 - t) * p[0] + 2 * (1 - t) * t * p[2] + t * t * p[4];
        const y = (1 - t) * (1 - t) * p[1] + 2 * (1 - t) * t * p[3] + t * t * p[5];
        ctx.beginPath(); ctx.moveTo(x - 1.2, y); ctx.lineTo(x + 1.2, y); ctx.lineTo(x + 0.7, y + 0.8); ctx.lineTo(x - 0.7, y + 0.8); ctx.closePath(); ctx.fill();
        if (st !== 'night') { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 1.8); ctx.lineTo(x + 0.9, y - 0.4); ctx.closePath(); ctx.fill(); }
      });
    }
    // rotas aéreas
    if (era >= 7 && MV.air) {
      ctx.strokeStyle = st === 'night' ? 'rgba(200,225,255,0.18)' : 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 0.4;
      ctx.beginPath();
      for (const [a, b] of MV.air) { const p = curve(a, b, 0.9); ctx.moveTo(p[0], p[1]); ctx.quadraticCurveTo(p[2], p[3], p[4], p[5]); }
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      MV.air.forEach(([a, b], i) => {
        const p = curve(a, b, 0.9);
        const t = (time * 0.05 + i * 0.29) % 1;
        const x = (1 - t) * (1 - t) * p[0] + 2 * (1 - t) * t * p[2] + t * t * p[4];
        const y = (1 - t) * (1 - t) * p[1] + 2 * (1 - t) * t * p[3] + t * t * p[5];
        ctx.beginPath(); ctx.arc(x, y, 0.55, 0, 7); ctx.fill();
      });
    }
  }

  function drawFogDecor(ctx, offs, time) {
    if (!MV.fogAny || !MV.fogSpots || MV.style === 'night') return;
    const c = MV.cam;
    const ink = 'rgba(80,62,40,0.55)';
    for (const ox of offs) for (const sp of MV.fogSpots) {
      const [mx, my] = G.hexCenter(sp.h);
      const [x, y] = MV.toScreen(mx + ox, my);
      if (x < -200 || y < -100 || x > MV.screenW + 200 || y > MV.screenH + 100) continue;
      const z = G.clamp(c.z / 2, 0.6, 2.2);
      if (sp.water && sp.r < 0.6) {
        // serpente marinha
        ctx.save(); ctx.translate(x, y); ctx.scale(z, z);
        ctx.strokeStyle = ink; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-34, 4);
        for (let q = 0; q < 4; q++) ctx.quadraticCurveTo(-26 + q * 16, -12 - Math.sin(time + q) * 2, -18 + q * 16, 4);
        ctx.stroke();
        ctx.beginPath(); ctx.arc(32, -2, 4, 0, 7); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(35, -5); ctx.lineTo(42, -9); ctx.moveTo(35, 0); ctx.lineTo(41, 3); ctx.stroke();
        ctx.restore();
      } else {
        ctx.save();
        ctx.font = `italic ${Math.round(15 * z)}px 'IM Fell English', Georgia, serif`;
        ctx.fillStyle = ink; ctx.textAlign = 'center';
        ctx.fillText('Terra Incógnita', x, y);
        ctx.restore();
      }
    }
  }

  function spaced(ctx, text, x, y, sp) {
    const chars = [...text];
    let w = 0;
    const ws = chars.map((ch) => { const m = ctx.measureText(ch).width; w += m + sp; return m; });
    w -= sp;
    let cx = x - w / 2;
    ctx.textAlign = 'left';
    chars.forEach((ch, i) => { ctx.strokeText(ch, cx, y); ctx.fillText(ch, cx, y); cx += ws[i] + sp; });
    ctx.textAlign = 'center';
  }

  function drawLabels(ctx, offs) {
    const g = G.game, s = g.s, c = MV.cam, st = MV.style;
    const serif = st === 'night' ? "'IBM Plex Sans', system-ui, sans-serif" : "'IM Fell English', 'EB Garamond', Georgia, serif";
    const ink = st === 'night' ? 'rgba(230,236,245,0.92)' : '#3a2a18';
    const halo = st === 'night' ? 'rgba(0,0,0,0.7)' : st === 'atlas' ? 'rgba(245,238,220,0.85)' : 'rgba(236,224,190,0.85)';
    ctx.textAlign = 'center'; ctx.lineJoin = 'round';
    // oceanos
    ctx.font = `italic ${Math.round(G.clamp(12 * c.z / 1.4, 11, 26))}px ${serif}`;
    ctx.fillStyle = st === 'night' ? 'rgba(120,160,200,0.55)' : st === 'atlas' ? 'rgba(40,70,100,0.6)' : 'rgba(70,70,60,0.55)';
    ctx.strokeStyle = 'rgba(0,0,0,0)'; ctx.lineWidth = 0;
    for (const ox of offs) for (const L of g.world.seaLabels) {
      if (!g.explored[L.h]) continue;
      const [mx, my] = G.hexCenter(L.h);
      const [x, y] = MV.toScreen(mx + ox, my);
      if (x < -200 || x > MV.screenW + 200) continue;
      spaced(ctx, L.name, x, y, 3 * G.clamp(c.z / 1.5, 0.6, 1.6));
    }
    // povos rivais (no centro do território)
    if (!MV.rivalCenters || MV.rivalCentersT !== g.s.time) computeRivalCenters();
    ctx.font = `${Math.round(G.clamp(10 * c.z / 1.2, 10, 22))}px ${serif}`;
    ctx.lineWidth = 3; ctx.strokeStyle = halo;
    for (const ox of offs) for (const rc of MV.rivalCenters) {
      if (!g.explored[rc.h]) continue;
      const [x, y] = MV.toScreen(rc.x + ox, rc.y);
      if (x < -200 || x > MV.screenW + 200 || y < -40 || y > MV.screenH + 40) continue;
      const rv = s.rivals[rc.id - 1];
      ctx.fillStyle = st === 'night' ? 'rgba(170,190,230,0.75)' : G.mixHex(rv.color, '#1a1008', 0.45);
      spaced(ctx, g.rivalName(rv).toUpperCase(), x, y, 2.5 * G.clamp(c.z / 1.5, 0.5, 1.4));
    }
    // cidades
    if (c.z < 0.75) return;
    const sz = Math.round(G.clamp(9 + c.z * 1.6, 10, 16));
    ctx.lineWidth = 3; ctx.strokeStyle = halo;
    const placed = [];
    const list = s.settlements.filter((x) => x.owner >= 0 && g.explored[x.h]).map((x) => ({ x, p: g.settlementPop(x) })).sort((a, b) => (b.x.capital - a.x.capital) || b.p - a.p);
    let shown = 0;
    for (const ox of offs) for (const { x: stl, p } of list) {
      const [mx, my] = G.hexCenter(stl.h);
      const [x, y] = MV.toScreen(mx + ox, my);
      if (x < -60 || x > MV.screenW + 60 || y < -20 || y > MV.screenH + 20) continue;
      const tier = g.tierOf(p);
      if (c.z < 1.6 && tier < 2 && !stl.capital) continue;
      const big = stl.capital || tier >= 4;
      ctx.font = `${big ? '600 ' : ''}${stl.owner === 0 ? '' : 'italic '}${big ? sz + 1 : sz}px ${serif}`;
      const ty = y + 10 + tier * 1.5 * G.clamp(c.z / 2.4, 0.55, 1.8) + 6;
      const w = ctx.measureText(stl.name).width;
      if (placed.some((b) => Math.abs(b[0] - x) < (w + b[2]) / 2 + 4 && Math.abs(b[1] - ty) < sz + 2)) continue;
      placed.push([x, ty, w]);
      ctx.fillStyle = stl.owner === 0 ? ink : st === 'night' ? 'rgba(170,190,230,0.75)' : 'rgba(70,56,40,0.8)';
      ctx.strokeText(stl.name, x, ty); ctx.fillText(stl.name, x, ty);
      if (++shown > 160) return;
    }
  }
  function computeRivalCenters() {
    const g = G.game, s = g.s;
    const acc = {};
    for (let i = 0; i < H.N; i++) {
      const o = g.owner[i];
      if (o <= 0) continue;
      const a = acc[o] || (acc[o] = { sx: 0, sy: 0, n: 0, ref: null, cx: 0, cy: 0 });
      let [x, y] = G.hexCenter(i);
      if (a.ref == null) a.ref = x;
      if (x - a.ref > H.MW / 2) x -= H.MW; else if (a.ref - x > H.MW / 2) x += H.MW;
      a.sx += x; a.sy += y; a.n++;
    }
    MV.rivalCenters = [];
    for (const o in acc) {
      const a = acc[o];
      if (a.n < 3 || !s.rivals[o - 1].alive) continue;
      const x = a.sx / a.n, y = a.sy / a.n;
      MV.rivalCenters.push({ id: +o, x, y: y - 6, h: G.hexAt(((x % H.MW) + H.MW) % H.MW, y) });
    }
    MV.rivalCentersT = g.s.time;
  }

  // rosa dos ventos e moldura
  function drawFrame(ctx, time) {
    const st = MV.style, W = MV.screenW, Hh = MV.screenH;
    const vg = ctx.createRadialGradient(W / 2, Hh / 2, Math.min(W, Hh) * 0.35, W / 2, Hh / 2, Math.max(W, Hh) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, st === 'night' ? 'rgba(0,0,0,0.55)' : st === 'atlas' ? 'rgba(70,50,20,0.22)' : 'rgba(80,50,15,0.38)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, Hh);
    if (st === 'night') return;
    const x = W - 70, y = Hh - 78, r = 34;
    ctx.save(); ctx.translate(x, y);
    const ink = st === 'atlas' ? 'rgba(60,50,38,0.75)' : 'rgba(70,50,30,0.8)';
    ctx.strokeStyle = ink; ctx.fillStyle = ink; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(0, 0, r * 0.62, 0, 7); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, r * 0.7, 0, 7); ctx.stroke();
    for (let q = 0; q < 8; q++) {
      const a = (q * Math.PI) / 4 - Math.PI / 2;
      const L = q % 2 ? r * 0.55 : r;
      const w = q % 2 ? 4 : 6;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * L, Math.sin(a) * L);
      ctx.lineTo(Math.cos(a + Math.PI / 2) * w, Math.sin(a + Math.PI / 2) * w);
      ctx.lineTo(0, 0); ctx.closePath();
      ctx.fillStyle = q === 0 ? (st === 'atlas' ? 'rgba(150,40,30,0.85)' : 'rgba(140,40,25,0.85)') : ink; ctx.fill();
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * L, Math.sin(a) * L);
      ctx.lineTo(Math.cos(a - Math.PI / 2) * w, Math.sin(a - Math.PI / 2) * w);
      ctx.lineTo(0, 0); ctx.closePath(); ctx.stroke();
    }
    ctx.font = "13px 'IM Fell English', Georgia, serif"; ctx.textAlign = 'center';
    ctx.fillStyle = ink; ctx.fillText('N', 0, -r - 5);
    ctx.restore();
  }

  MV.hitTest = function (sx, sy) {
    const [mx, my] = MV.toMap(sx, sy);
    const x = ((mx % H.MW) + H.MW) % H.MW;
    return G.hexAt(x, my);
  };

  // ---------------- globo ----------------
  MV.buildGlobeSource = function () {
    const g = G.game;
    const W = 720, Hh = 392;
    if (!MV.dayLow) {
      const out = { wantMask: false, glyphs: false };
      const gen = terrainJob(g.world, 'atlas', W, Hh, out);
      let r; do { r = gen.next(); } while (!r.done);
      MV.dayLow = out.canvas;
    }
    const cv = MV.globeSrc || (MV.globeSrc = document.createElement('canvas'));
    cv.width = W; cv.height = Hh;
    const x = cv.getContext('2d');
    x.drawImage(MV.dayLow, 0, 0);
    // território simplificado
    const sx = W / H.MW, sy = Hh / H.MH;
    const own = g.owner;
    for (let i = 0; i < H.N; i++) {
      const o = own[i];
      if (o < 0 || g.world.isWater(i)) continue;
      const [cx, cy] = G.hexCenter(i);
      x.fillStyle = o === 0 ? G.rgba(g.s.color, 0.4) : 'rgba(255,255,255,0.12)';
      x.fillRect((cx - 7) * sx, (cy - 7) * sy, 14 * sx + 0.5, 14 * sy + 0.5);
    }
    MV.globeDay = x.getImageData(0, 0, W, Hh).data;
    // luzes
    const lc = document.createElement('canvas');
    lc.width = W; lc.height = Hh;
    const lx = lc.getContext('2d');
    // luzes finas, como fotos noturnas de satélite
    const era = g.s.era;
    for (let i = 0; i < H.N; i++) {
      const o = own[i];
      if (o < 0 || g.world.isWater(i)) continue;
      if (era < 6 && o !== 0) continue;
      const [cx, cy] = G.hexCenter(i);
      const n = o === 0 ? (era >= 7 ? 3 : 1) : 1;
      for (let q = 0; q < n; q++) {
        if (G.hash2(i, q, 41) > (o === 0 ? 0.8 : 0.35)) continue;
        const a2 = o === 0 ? 0.35 + G.hash2(i, q, 42) * 0.4 : 0.2;
        lx.fillStyle = o === 0 ? 'rgba(255,190,110,' + a2 + ')' : 'rgba(210,220,255,' + a2 + ')';
        lx.fillRect((cx + (G.hash2(i, q, 43) - 0.5) * 12) * sx, (cy + (G.hash2(i, q, 44) - 0.5) * 10) * sy, 1, 1);
      }
    }
    for (const st of g.s.settlements) {
      if (st.owner < 0) continue;
      const [cx, cy] = G.hexCenter(st.h);
      const p = g.settlementPop(st);
      const r2 = Math.min(2.2, 0.6 + Math.log10(Math.max(10, p)) * 0.18);
      lx.fillStyle = st.owner === 0 ? 'rgba(255,225,170,0.95)' : 'rgba(220,230,255,0.6)';
      lx.beginPath(); lx.arc(cx * sx, cy * sy, r2, 0, 7); lx.fill();
    }
    MV.globeNight = lx.getImageData(0, 0, W, Hh).data;
    MV.globeW = W; MV.globeH = Hh;
    MV.globeT = performance.now();
  };
  MV.drawGlobe = function (ctx, cx, cy, R, rot, sunAng) {
    if (!MV.globeDay || performance.now() - MV.globeT > 8000) MV.buildGlobeSource();
    const N = Math.min(420, Math.round(R * 2 / Math.max(1, R / 210)));
    if (!MV.gcv || MV.gcv.width !== N) {
      MV.gcv = document.createElement('canvas'); MV.gcv.width = MV.gcv.height = N;
      MV.gimg = MV.gcv.getContext('2d').createImageData(N, N);
      const lat = new Float32Array(N * N), lon = new Float32Array(N * N), nz = new Float32Array(N * N), nx = new Float32Array(N * N), ny = new Float32Array(N * N);
      const tilt = 0.32;
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        const x = (i + 0.5) / N * 2 - 1, y = (j + 0.5) / N * 2 - 1;
        const r2 = x * x + y * y;
        const p = j * N + i;
        if (r2 > 1) { lat[p] = 9; continue; }
        const z = Math.sqrt(1 - r2);
        // inclinação do eixo
        const y2 = y * Math.cos(tilt) - z * Math.sin(tilt), z2 = y * Math.sin(tilt) + z * Math.cos(tilt);
        lat[p] = Math.asin(G.clamp(y2, -1, 1));
        lon[p] = Math.atan2(x, z2);
        nx[p] = x; ny[p] = y; nz[p] = z;
      }
      MV.glat = lat; MV.glon = lon; MV.gnx = nx; MV.gny = ny; MV.gnz = nz;
    }
    const d = MV.gimg.data, W = MV.globeW, Hh = MV.globeH;
    const day = MV.globeDay, night = MV.globeNight;
    const lx = Math.cos(sunAng), lz = Math.sin(sunAng), ly = -0.25;
    for (let p = 0; p < N * N; p++) {
      const la = MV.glat[p];
      const q = p * 4;
      if (la > 8) { d[q + 3] = 0; continue; }
      let u = (MV.glon[p] + rot) / (Math.PI * 2);
      u -= Math.floor(u);
      const v = la / Math.PI + 0.5;
      const sxp = (u * W) | 0, syp = Math.min(Hh - 1, (v * Hh) | 0);
      const s4 = (syp * W + sxp) * 4;
      let lit = MV.gnx[p] * lx + MV.gny[p] * ly + MV.gnz[p] * lz;
      lit = G.clamp(lit * 1.6 + 0.15, 0, 1);
      const limb = 0.55 + 0.45 * MV.gnz[p];
      const nl = (1 - lit) * 1.25;
      d[q] = Math.min(255, day[s4] * lit * limb + night[s4] * nl);
      d[q + 1] = Math.min(255, day[s4 + 1] * lit * limb + night[s4 + 1] * nl);
      d[q + 2] = Math.min(255, day[s4 + 2] * lit * limb + night[s4 + 2] * nl + 6);
      d[q + 3] = 255;
    }
    MV.gcv.getContext('2d').putImageData(MV.gimg, 0, 0);
    // atmosfera
    const ag = ctx.createRadialGradient(cx, cy, R * 0.92, cx, cy, R * 1.18);
    ag.addColorStop(0, 'rgba(110,170,255,0.45)'); ag.addColorStop(0.4, 'rgba(80,140,255,0.15)'); ag.addColorStop(1, 'rgba(60,120,255,0)');
    ctx.fillStyle = ag; ctx.beginPath(); ctx.arc(cx, cy, R * 1.18, 0, 7); ctx.fill();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(MV.gcv, cx - R, cy - R, R * 2, R * 2);
    const rim = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.3, R * 0.1, cx, cy, R);
    rim.addColorStop(0, 'rgba(255,255,255,0.06)'); rim.addColorStop(0.85, 'rgba(255,255,255,0)'); rim.addColorStop(1, 'rgba(150,200,255,0.25)');
    ctx.fillStyle = rim; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.fill();
  };
})();
