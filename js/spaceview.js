/* Da Fogueira às Estrelas — órbita, Sistema Solar e galáxia */
(function () {
  'use strict';
  const G = (globalThis.G = globalThis.G || {});

  const SV = (G.spaceview = {
    screenW: 800, screenH: 600, dpr: 1,
    solar: { cam: { x: 0, y: 0, z: 1 }, sel: null },
    galaxy: { cam: { x: 0, y: 0, z: 1 }, sel: null, target: null },
    globe: { rot: 0, spin: 0.05 },
  });

  // ---------------- estrelas de fundo ----------------
  function starfield(W, Hh, seed) {
    const c = document.createElement('canvas');
    c.width = W; c.height = Hh;
    const x = c.getContext('2d');
    const r = G.rng(seed);
    const bg = x.createLinearGradient(0, 0, W, Hh);
    bg.addColorStop(0, '#04060d'); bg.addColorStop(0.5, '#070a16'); bg.addColorStop(1, '#05050b');
    x.fillStyle = bg; x.fillRect(0, 0, W, Hh);
    // faixa da Via Láctea
    for (let i = 0; i < 2600; i++) {
      const t = r();
      const px = t * W, py = Hh * (0.25 + t * 0.5) + (r() + r() + r() - 1.5) * Hh * 0.12;
      x.fillStyle = `rgba(200,210,255,${r() * 0.08})`;
      x.fillRect(px, py, 1.6, 1.6);
    }
    for (let i = 0; i < (W * Hh) / 900; i++) {
      const a = Math.pow(r(), 3);
      x.fillStyle = `rgba(${220 + r() * 35},${220 + r() * 35},255,${0.15 + a * 0.85})`;
      const s = a > 0.8 ? 1.6 : 1;
      x.fillRect(r() * W, r() * Hh, s, s);
    }
    return c;
  }
  SV.bg = null;
  function ensureBg() {
    const W = Math.round(SV.screenW), Hh = Math.round(SV.screenH);
    if (!SV.bg || SV.bg.width !== W || SV.bg.height !== Hh) SV.bg = starfield(W, Hh, 4242);
  }

  // ======================= ÓRBITA (globo) =======================
  SV.drawGlobeView = function (ctx, time, dt) {
    ensureBg();
    const W = SV.screenW, Hh = SV.screenH;
    ctx.drawImage(SV.bg, 0, 0, W, Hh);
    const g = G.game, s = g.s;
    const R = Math.min(W, Hh) * 0.33;
    const cx = W * 0.5, cy = Hh * 0.52;
    if (!SV.globe.drag) SV.globe.rot += dt * SV.globe.spin;
    // Sol distante
    const sg = ctx.createRadialGradient(W * 0.06, Hh * 0.2, 0, W * 0.06, Hh * 0.2, W * 0.35);
    sg.addColorStop(0, 'rgba(255,240,200,0.35)'); sg.addColorStop(1, 'rgba(255,200,120,0)');
    ctx.fillStyle = sg; ctx.fillRect(0, 0, W, Hh);
    const orb = g.bodyStage('orbita');
    // satélites atrás do planeta
    const sats = [];
    const nsat = orb * 10 + (s.era >= 8 ? 6 : 0);
    for (let i = 0; i < nsat; i++) {
      const inc = (G.hash2(i, 1, 9) - 0.5) * 1.4, sp = 0.15 + G.hash2(i, 2, 9) * 0.25, rr = R * (1.08 + G.hash2(i, 3, 9) * 0.25);
      const a = time * sp + i * 2.39;
      sats.push({ x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr * Math.sin(inc) * 0.6, z: Math.sin(a) });
    }
    const drawSats = (front) => {
      for (const p of sats) if ((p.z > 0) === front) { ctx.fillStyle = front ? 'rgba(230,240,255,0.95)' : 'rgba(200,210,230,0.4)'; ctx.fillRect(p.x - 0.8, p.y - 0.8, 1.6, 1.6); }
    };
    drawSats(false);
    // Lua
    const moonA = time * 0.06;
    const mx = cx + Math.cos(moonA) * R * 2.3, my = cy + Math.sin(moonA) * R * 0.5, mz = Math.sin(moonA);
    const drawMoon = () => {
      const mr = R * 0.17;
      const mg = ctx.createRadialGradient(mx - mr * 0.4, my - mr * 0.4, mr * 0.1, mx, my, mr);
      mg.addColorStop(0, '#e8e6e0'); mg.addColorStop(1, '#5d5b58');
      ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(mx, my, mr, 0, 7); ctx.fill();
      const ls = g.bodyStage('lua');
      if (ls >= 2) {
        ctx.fillStyle = 'rgba(255,210,140,0.95)';
        for (let i = 0; i < (ls - 1) * 4; i++) ctx.fillRect(mx + (G.hash2(i, 5, 2) - 0.3) * mr * 0.9, my + (G.hash2(i, 6, 2) - 0.5) * mr * 1.2, 1.4, 1.4);
        ctx.strokeStyle = G.rgba(s.color, 0.8); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(mx, my, mr + 4, 0, 7); ctx.stroke();
      }
      ctx.fillStyle = 'rgba(220,226,240,0.8)'; ctx.font = "12px 'IBM Plex Sans', sans-serif"; ctx.textAlign = 'center';
      ctx.fillText('Lua', mx, my + mr + 16);
    };
    if (mz < 0) drawMoon();
    // elevador espacial
    if (s.wonders.elevador) {
      ctx.strokeStyle = 'rgba(200,220,255,0.55)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(cx, cy - R * 0.05); ctx.lineTo(cx, cy - R * 1.65); ctx.stroke();
      ctx.fillStyle = 'rgba(240,248,255,0.95)'; ctx.fillRect(cx - 4, cy - R * 1.65 - 2, 8, 4);
      const t = (time * 0.15) % 1; ctx.fillRect(cx - 1.5, cy - R * (0.1 + t * 1.5), 3, 3);
    }
    G.mapview.drawGlobe(ctx, cx, cy, R, SV.globe.rot, -0.6);
    drawSats(true);
    if (s.wonders.estacao || orb >= 2) {
      const a = time * 0.35;
      const x = cx + Math.cos(a) * R * 1.22, y = cy + Math.sin(a) * R * 0.25;
      if (Math.sin(a) > -0.2) {
        ctx.fillStyle = 'rgba(250,250,255,1)'; ctx.fillRect(x - 5, y - 1, 10, 2); ctx.fillRect(x - 1, y - 3, 2, 6);
        ctx.fillStyle = 'rgba(120,160,255,0.85)'; ctx.fillRect(x - 9, y - 2, 3, 4); ctx.fillRect(x + 6, y - 2, 3, 4);
      }
    }
    if (mz >= 0) drawMoon();
    ctx.fillStyle = 'rgba(230,236,250,0.9)'; ctx.font = "600 14px 'IBM Plex Sans', sans-serif"; ctx.textAlign = 'center';
    ctx.fillText('Terra', cx, cy + R + 32);
    ctx.font = "12px 'IBM Plex Sans', sans-serif"; ctx.fillStyle = 'rgba(190,205,230,0.75)';
    ctx.fillText(`${G.fmt(s.pop)} habitantes · ${nsat} satélites`, cx, cy + R + 50);
    SV.globe.hit = { cx, cy, R, mx, my };
  };

  // ======================= SISTEMA SOLAR =======================
  const TILT = 0.48;
  function planetPos(pd, time) {
    if (!pd.period) return [0, 0];
    const a = (time / pd.period) * 0.9 + G.hash2(pd.a, 1, 1) * 6.28;
    return [Math.cos(a) * pd.a, Math.sin(a) * pd.a * TILT];
  }
  SV.bodyPos = function (id, time) {
    const pd = G.PLANETS_DRAW.find((p) => p.id === id);
    if (pd) return planetPos(pd, time);
    const md = G.MOONS_DRAW[id];
    if (md) {
      const pp = planetPos(G.PLANETS_DRAW.find((p) => p.id === md.parent), time);
      const a = (time / md.period) * 1.2 + G.hash2(md.a, 2, 2) * 6.28;
      return [pp[0] + Math.cos(a) * md.a, pp[1] + Math.sin(a) * md.a * 0.7];
    }
    if (id === 'orbita' || id === 'terra') return SV.bodyPos('terra', time);
    if (id === 'venus_orbita') return SV.bodyPos('venus', time);
    if (id === 'ceres') { const a = time * 0.004 + 1; return [Math.cos(a) * 205, Math.sin(a) * 205 * TILT]; }
    if (id === 'oort') return [0, -600 * TILT];
    return [0, 0];
  };
  SV.solarFit = function () {
    const c = SV.solar.cam;
    c.x = 0; c.y = 0;
    // começa enquadrando o sistema interno até Júpiter, onde a ação começa
    c.z = Math.min(SV.screenW / 640, SV.screenH / (640 * TILT + 120));
  };
  const S2 = (x, y) => { const c = SV.solar.cam; return [(x - c.x) * c.z + SV.screenW / 2, (y - c.y) * c.z + SV.screenH / 2]; };

  function bodyStageAny(id) { const g = G.game; return g.bodyStage(id); }
  function belt() {
    if (SV._belt) return SV._belt;
    const r = G.rng(7), pts = [];
    for (let i = 0; i < 900; i++) pts.push([r() * Math.PI * 2, 190 + (r() + r() - 1) * 16, 0.6 + r() * 0.8]);
    return (SV._belt = pts);
  }

  SV.drawSolar = function (ctx, time) {
    ensureBg();
    const W = SV.screenW, Hh = SV.screenH, g = G.game, s = g.s, c = SV.solar.cam;
    ctx.drawImage(SV.bg, 0, 0, W, Hh);
    const z = c.z;
    // Oort
    if (g.bodyUnlocked(G.BODY.oort) || s.era >= 9) {
      const st = bodyStageAny('oort');
      const [ox, oy] = S2(0, 0);
      ctx.strokeStyle = st >= 3 ? G.rgba(s.color, 0.35) : 'rgba(160,190,255,0.12)';
      ctx.setLineDash([2, 6]); ctx.lineWidth = 6 * z;
      ctx.beginPath(); ctx.ellipse(ox, oy, 575 * z, 575 * TILT * z, 0, 0, 7); ctx.stroke(); ctx.setLineDash([]);
    }
    // órbitas
    for (const pd of G.PLANETS_DRAW) {
      const [ox, oy] = S2(0, 0);
      ctx.strokeStyle = pd.belt ? 'rgba(0,0,0,0)' : 'rgba(140,170,230,0.16)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(ox, oy, pd.a * z, pd.a * TILT * z, 0, 0, 7); ctx.stroke();
    }
    // cinturão
    const bst = bodyStageAny('ceres');
    for (const [a0, rr, sz] of belt()) {
      const a = a0 + time * 0.004;
      const [x, y] = S2(Math.cos(a) * rr, Math.sin(a) * rr * TILT);
      ctx.fillStyle = 'rgba(180,170,155,0.55)'; ctx.fillRect(x, y, sz, sz);
    }
    if (bst >= 2) {
      ctx.fillStyle = G.rgba(s.color, 0.95);
      for (let i = 0; i < (bst - 1) * 6; i++) { const a = i * 1.37 + time * 0.004; const [x, y] = S2(Math.cos(a) * 192, Math.sin(a) * 192 * TILT); ctx.fillRect(x - 1, y - 1, 2.4, 2.4); }
    }
    // Sol
    const [sx, sy] = S2(0, 0);
    const sr = 18 * Math.max(0.6, z);
    let gr = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr * 6);
    gr.addColorStop(0, 'rgba(255,240,200,0.9)'); gr.addColorStop(0.15, 'rgba(255,200,110,0.45)'); gr.addColorStop(1, 'rgba(255,160,60,0)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(sx, sy, sr * 6, 0, 7); ctx.fill();
    gr = ctx.createRadialGradient(sx - sr * 0.3, sy - sr * 0.3, 0, sx, sy, sr);
    gr.addColorStop(0, '#fffbe8'); gr.addColorStop(0.7, '#ffd36b'); gr.addColorStop(1, '#ff9d2e');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(sx, sy, sr, 0, 7); ctx.fill();
    // Enxame de Dyson
    if (s.wonders.dyson) {
      for (let i = 0; i < 260; i++) {
        const a = i * 0.61 + time * (0.15 + (i % 5) * 0.02), rr = 30 + (i % 7) * 3;
        const tilt = ((i % 3) - 1) * 0.6;
        const x = Math.cos(a) * rr, y = Math.sin(a) * rr * (TILT + tilt * 0.3);
        const [px, py] = S2(x, y);
        const fl = 0.4 + 0.6 * Math.abs(Math.sin(time * 2 + i));
        ctx.fillStyle = `rgba(255,${200 + fl * 55},${120 + fl * 100},${0.4 + fl * 0.6})`;
        ctx.fillRect(px - 0.8, py - 0.8, 1.6, 1.6);
      }
    }
    // tráfego de naves (atrás dos planetas)
    const earth = SV.bodyPos('terra', time);
    const cols = G.BODIES.filter((b) => b.kind !== 'orbit' && g.bodyStage(b.id) >= 2);
    ctx.fillStyle = 'rgba(255,230,180,0.9)';
    cols.forEach((b, i) => {
      const p = SV.bodyPos(b.id, time);
      const n = Math.min(4, g.bodyStage(b.id) - 1);
      for (let q = 0; q < n; q++) {
        let t = (time * 0.04 + q / n + i * 0.13) % 1;
        const back = q % 2 === 1;
        if (back) t = 1 - t;
        const mx = (earth[0] + p[0]) / 2 - (p[1] - earth[1]) * 0.25, my = (earth[1] + p[1]) / 2 + (p[0] - earth[0]) * 0.25 * TILT;
        const x = (1 - t) * (1 - t) * earth[0] + 2 * (1 - t) * t * mx + t * t * p[0];
        const y = (1 - t) * (1 - t) * earth[1] + 2 * (1 - t) * t * my + t * t * p[1];
        const [px, py] = S2(x, y);
        ctx.fillRect(px - 1, py - 1, 2, 2);
      }
    });
    // planetas
    const hits = [];
    const drawBody = (id, name, r, color, pd) => {
      const [x0, y0] = SV.bodyPos(id, time);
      const [x, y] = S2(x0, y0);
      const rr = Math.max(2, r * Math.max(0.7, Math.min(2.2, z * 1.4)));
      const ang = Math.atan2(y0, x0);
      if (id === 'terra' && rr > 5) G.mapview.drawGlobe(ctx, x, y, rr, time * 0.2, ang + Math.PI);
      else {
        const lg = ctx.createRadialGradient(x - Math.cos(ang) * rr * 0.5, y - Math.sin(ang) * rr * 0.5, rr * 0.1, x, y, rr);
        lg.addColorStop(0, G.mixHex(color, '#ffffff', 0.35)); lg.addColorStop(0.7, color); lg.addColorStop(1, G.mixHex(color, '#000000', 0.7));
        ctx.fillStyle = lg; ctx.beginPath(); ctx.arc(x, y, rr, 0, 7); ctx.fill();
        if (pd && pd.bands) { ctx.save(); ctx.beginPath(); ctx.arc(x, y, rr, 0, 7); ctx.clip(); ctx.fillStyle = 'rgba(120,80,50,0.25)'; for (let q = -2; q <= 2; q++) ctx.fillRect(x - rr, y + q * rr * 0.35 - rr * 0.07, rr * 2, rr * 0.14); ctx.restore(); }
      }
      if (pd && pd.ring) { ctx.strokeStyle = 'rgba(230,215,170,0.7)'; ctx.lineWidth = Math.max(1, rr * 0.18); ctx.beginPath(); ctx.ellipse(x, y, rr * 2.1, rr * 0.6, -0.25, 0, 7); ctx.stroke(); }
      hits.push({ id, x, y, r: rr });
      return [x, y, rr];
    };
    for (const pd of G.PLANETS_DRAW) {
      if (pd.belt) continue;
      const [x, y, rr] = drawBody(pd.id, pd.name, pd.r, pd.color, pd);
      for (const mid in G.MOONS_DRAW) {
        const md = G.MOONS_DRAW[mid];
        if (md.parent !== pd.id) continue;
        if (z < 0.55 && mid !== 'lua') continue;
        drawBody(mid, G.BODY[mid] ? G.BODY[mid].name : mid, md.r, md.color, null);
      }
      ctx.fillStyle = 'rgba(210,222,245,0.8)'; ctx.font = "11px 'IBM Plex Sans', sans-serif"; ctx.textAlign = 'center';
      ctx.fillText(pd.name, x, y + rr + 13);
    }
    // marcadores de estágio
    for (const b of G.BODIES) {
      const st = g.bodyStage(b.id);
      const unl = g.bodyUnlocked(b);
      const [x0, y0] = SV.bodyPos(b.id, time);
      let [x, y] = S2(x0, y0);
      if (b.id === 'orbita') { y -= 14; }
      if (b.id === 'venus_orbita') { y -= 12; }
      if (b.id === 'ceres') hits.push({ id: 'ceres', x, y, r: 10 });
      if (b.id === 'orbita' || b.id === 'venus_orbita' || b.id === 'oort') hits.push({ id: b.id, x, y, r: 9 });
      if (st >= 3) {
        const pulse = 0.5 + 0.5 * Math.sin(time * 2 + x);
        ctx.strokeStyle = G.rgba(s.color, 0.6 + pulse * 0.4); ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.arc(x, y, 7 + Math.min(6, st - 3) * 1.2, 0, 7); ctx.stroke();
      } else if (st === 2) {
        ctx.strokeStyle = G.rgba(s.color, 0.8); ctx.lineWidth = 1; ctx.setLineDash([2, 2]);
        ctx.beginPath(); ctx.arc(x, y, 7, 0, 7); ctx.stroke(); ctx.setLineDash([]);
      } else if (st === 1) {
        ctx.fillStyle = 'rgba(200,230,255,0.9)';
        ctx.beginPath(); ctx.moveTo(x + 9, y - 3); ctx.lineTo(x + 12, y); ctx.lineTo(x + 9, y + 3); ctx.lineTo(x + 6, y); ctx.closePath(); ctx.fill();
      } else if (unl) {
        ctx.strokeStyle = 'rgba(200,230,255,0.45)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(x, y, 9 + Math.sin(time * 3) * 1.5, 0, 7); ctx.stroke();
      }
      if (SV.solar.sel === b.id) { ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(x, y, 15, 0, 7); ctx.stroke(); }
    }
    SV.solar.hits = hits;
  };
  SV.solarHit = function (sx, sy) {
    const hits = SV.solar.hits || [];
    let best = null, bd = 18;
    for (const h of hits) {
      const d = Math.hypot(h.x - sx, h.y - sy) - h.r;
      if (d < bd && (G.BODY[h.id] || h.id === 'terra')) { bd = d; best = h.id; }
    }
    if (best === 'terra') best = 'orbita';
    if (best === 'venus' && !G.game.bodyUnlocked(G.BODY.venus)) best = 'venus_orbita';
    return best;
  };

  // ======================= GALÁXIA =======================
  SV.galFit = function (zoomSol) {
    const c = SV.galaxy.cam, g = G.game;
    const z = Math.min(SV.screenW, SV.screenH) / 1150;
    if (zoomSol && g.gal) {
      const s = g.gal.sys[g.gal.sol];
      c.x = s.x; c.y = s.y; c.z = z * 6;
      SV.galaxy.target = { x0: c.x, y0: c.y, z0: c.z, x: 0, y: 0, z, t: 0, dur: 4 };
    } else { c.x = 0; c.y = 0; c.z = z; }
  };
  const GS = (x, y) => { const c = SV.galaxy.cam; return [(x - c.x) * c.z + SV.screenW / 2, (y - c.y) * c.z + SV.screenH / 2]; };
  function galaxyHaze() {
    if (SV._haze) return SV._haze;
    const g = G.game;
    const S = 1300, k = S / 1200;
    const c = document.createElement('canvas'); c.width = c.height = S;
    const x = c.getContext('2d');
    const r = G.rng(g.s.seed * 3 + 1);
    const core = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S * 0.2);
    core.addColorStop(0, 'rgba(255,236,200,0.75)'); core.addColorStop(0.25, 'rgba(255,200,150,0.25)'); core.addColorStop(1, 'rgba(120,100,160,0)');
    x.fillStyle = core; x.fillRect(0, 0, S, S);
    const RG = G.GAL.RG;
    // brilho difuso dos braços
    x.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 1400; i++) {
      const arm = Math.floor(r() * 4);
      const t = 0.06 + Math.pow(r(), 0.8) * 0.95;
      const ang = (arm / 4) * Math.PI * 2 + t * 3.4 + (r() + r() - 1) * (0.32 - 0.14 * t);
      const rr = t * RG * 1.02;
      const px = S / 2 + Math.cos(ang) * rr * k, py = S / 2 + Math.sin(ang) * rr * k;
      const rad = (16 + r() * 34) * k * (1.2 - t * 0.5);
      const gg = x.createRadialGradient(px, py, 0, px, py, rad);
      const warm = t < 0.3 ? '255,215,170' : r() < 0.75 ? '150,175,255' : '255,190,210';
      gg.addColorStop(0, 'rgba(' + warm + ',0.07)'); gg.addColorStop(1, 'rgba(' + warm + ',0)');
      x.fillStyle = gg; x.fillRect(px - rad, py - rad, rad * 2, rad * 2);
    }
    const core2 = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S * 0.09);
    core2.addColorStop(0, 'rgba(255,245,225,0.9)'); core2.addColorStop(0.4, 'rgba(255,215,160,0.35)'); core2.addColorStop(1, 'rgba(255,190,120,0)');
    x.fillStyle = core2; x.fillRect(0, 0, S, S);
    x.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 26000; i++) {
      const arm = Math.floor(r() * 4);
      const t = Math.pow(r(), 0.7);
      const ang = (arm / 4) * Math.PI * 2 + t * 3.4 + (r() + r() + r() - 1.5) * (0.5 - 0.25 * t);
      const rr = t * RG * 1.05 + (r() - 0.5) * 30;
      const px = S / 2 + Math.cos(ang) * rr * k, py = S / 2 + Math.sin(ang) * rr * k;
      const warm = r();
      x.fillStyle = warm < 0.7 ? `rgba(190,200,255,${0.05 + r() * 0.18})` : `rgba(255,210,170,${0.05 + r() * 0.18})`;
      x.fillRect(px, py, 1.3, 1.3);
    }
    // nebulosas
    for (let i = 0; i < 22; i++) {
      const a = r() * Math.PI * 2, rr = (0.2 + r() * 0.8) * RG;
      const px = S / 2 + Math.cos(a) * rr * k, py = S / 2 + Math.sin(a) * rr * k;
      const rad = 20 + r() * 50;
      const ng = x.createRadialGradient(px, py, 0, px, py, rad);
      const hue = G.pick(r, ['255,90,140', '90,150,255', '170,100,255', '255,140,90']);
      ng.addColorStop(0, `rgba(${hue},0.12)`); ng.addColorStop(1, `rgba(${hue},0)`);
      x.fillStyle = ng; x.fillRect(px - rad, py - rad, rad * 2, rad * 2);
    }
    SV._haze = { c, k, S };
    return SV._haze;
  }
  SV.resetGalaxy = () => { SV._haze = null; SV._infl = null; SV._links = null; };
  SV.galDirty = true;
  function buildInfluence() {
    const g = G.game, s = g.s;
    const S = 1100, k = S / 1200;
    const c = SV._infl ? SV._infl.c : document.createElement('canvas');
    c.width = c.height = S;
    const x = c.getContext('2d');
    x.clearRect(0, 0, S, S);
    const sys = g.gal.sys, own = g.gown;
    x.globalCompositeOperation = 'lighter';
    for (let i = 0; i < sys.length; i++) {
      const o = own[i];
      if (o < 0) continue;
      let col;
      if (o === 0) col = s.color;
      else { const a = s.galaxy.aliens[o - 1]; if (!a.contact) continue; col = G.ALIENS[o - 1].color; }
      const px = S / 2 + sys[i].x * k, py = S / 2 + sys[i].y * k;
      const rad = 24 * k;
      const gr = x.createRadialGradient(px, py, 0, px, py, rad);
      gr.addColorStop(0, G.rgba(col, o === 0 ? 0.28 : 0.2)); gr.addColorStop(1, G.rgba(col, 0));
      x.fillStyle = gr; x.fillRect(px - rad, py - rad, rad * 2, rad * 2);
    }
    x.globalCompositeOperation = 'source-over';
    SV._infl = { c, k, S };
    // rede humana (árvore geradora mínima simples)
    const hs = [];
    for (let i = 0; i < sys.length; i++) if (own[i] === 0) hs.push(i);
    const links = [];
    if (hs.length > 1) {
      const inT = new Uint8Array(sys.length), best = new Float32Array(sys.length).fill(1e9), from = new Int32Array(sys.length).fill(-1);
      inT[hs[0]] = 1;
      for (const h of hs) if (h !== hs[0]) { best[h] = Math.hypot(sys[h].x - sys[hs[0]].x, sys[h].y - sys[hs[0]].y); from[h] = hs[0]; }
      for (let n = 1; n < hs.length; n++) {
        let bi = -1, bv = 1e9;
        for (const h of hs) if (!inT[h] && best[h] < bv) { bv = best[h]; bi = h; }
        if (bi < 0) break;
        inT[bi] = 1;
        links.push([from[bi], bi]);
        for (const h of hs) if (!inT[h]) { const d = Math.hypot(sys[h].x - sys[bi].x, sys[h].y - sys[bi].y); if (d < best[h]) { best[h] = d; from[h] = bi; } }
      }
    }
    SV._links = links;
    // rótulos de espécies
    SV._alienLabels = [];
    G.ALIENS.forEach((A, k2) => {
      const a = s.galaxy.aliens[k2];
      if (!a.contact) return;
      let sx = 0, sy = 0, n = 0;
      for (let i = 0; i < sys.length; i++) if (own[i] === k2 + 1) { sx += sys[i].x; sy += sys[i].y; n++; }
      if (n) SV._alienLabels.push({ x: sx / n, y: sy / n, name: A.full, col: A.color, gone: a.gone });
    });
    SV.galDirty = false;
  }
  SV.updateGalaxy = function (dt) {
    const T = SV.galaxy.target;
    if (!T) return;
    T.t += dt / T.dur;
    const k = G.smooth(Math.min(1, T.t));
    const c = SV.galaxy.cam;
    c.x = T.x0 + (T.x - T.x0) * k; c.y = T.y0 + (T.y - T.y0) * k;
    c.z = Math.exp(Math.log(T.z0) + (Math.log(T.z) - Math.log(T.z0)) * k);
    if (T.t >= 1) SV.galaxy.target = null;
  };
  SV.drawGalaxy = function (ctx, time) {
    ensureBg();
    const W = SV.screenW, Hh = SV.screenH, g = G.game, s = g.s, c = SV.galaxy.cam;
    ctx.fillStyle = '#020309'; ctx.fillRect(0, 0, W, Hh);
    ctx.globalAlpha = 0.6; ctx.drawImage(SV.bg, 0, 0, W, Hh); ctx.globalAlpha = 1;
    if (!g.gal) return;
    const hz = galaxyHaze();
    const [hx, hy] = GS(-hz.S / 2 / hz.k, -hz.S / 2 / hz.k);
    ctx.drawImage(hz.c, hx, hy, (hz.S / hz.k) * c.z, (hz.S / hz.k) * c.z);
    if (SV.galDirty || !SV._infl) buildInfluence();
    const inf = SV._infl;
    ctx.globalCompositeOperation = 'lighter';
    const [ix, iy] = GS(-inf.S / 2 / inf.k, -inf.S / 2 / inf.k);
    ctx.drawImage(inf.c, ix, iy, (inf.S / inf.k) * c.z, (inf.S / inf.k) * c.z);
    ctx.globalCompositeOperation = 'source-over';
    const sys = g.gal.sys, own = g.gown;
    // rede
    ctx.strokeStyle = G.rgba(s.color, 0.45); ctx.lineWidth = 1;
    ctx.beginPath();
    for (const [a, b] of SV._links || []) { const [x1, y1] = GS(sys[a].x, sys[a].y), [x2, y2] = GS(sys[b].x, sys[b].y); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); }
    ctx.stroke();
    // fronteira colonizável
    const front = g.galFrontier();
    const fset = new Set(front.map((f) => f.j));
    const starR = G.clamp(c.z * 2.2, 1.2, 4.5);
    for (let i = 0; i < sys.length; i++) {
      const sy = sys[i];
      const [x, y] = GS(sy.x, sy.y);
      if (x < -10 || y < -10 || x > W + 10 || y > Hh + 10) continue;
      const tp = G.STAR_TYPES.find((t) => t.id === sy.type);
      const o = own[i];
      let rr = starR * (tp.r / 1.8);
      if (sy.type === 'X') {
        ctx.strokeStyle = 'rgba(180,140,255,0.8)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(x, y, rr * 2.2, rr * 0.8, 0.4, 0, 7); ctx.stroke();
        ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(x, y, rr * 0.8, 0, 7); ctx.fill();
      } else {
        ctx.fillStyle = tp.color; ctx.globalAlpha = o === 0 ? 1 : 0.85;
        ctx.beginPath(); ctx.arc(x, y, rr, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
      }
      if (o === 0) {
        ctx.strokeStyle = G.rgba(s.color, 0.95); ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(x, y, rr + 2.5, 0, 7); ctx.stroke();
      } else if (o > 0 && s.galaxy.aliens[o - 1].contact) {
        ctx.strokeStyle = G.rgba(G.ALIENS[o - 1].color, 0.7); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(x, y, rr + 2, 0, 7); ctx.stroke();
      } else if (fset.has(i)) {
        ctx.strokeStyle = `rgba(220,235,255,${0.35 + 0.25 * Math.sin(time * 2.5 + i)})`; ctx.lineWidth = 1; ctx.setLineDash([2, 2]);
        ctx.beginPath(); ctx.arc(x, y, rr + 3, 0, 7); ctx.stroke(); ctx.setLineDash([]);
      }
      const fl = g.galFlash[i];
      if (fl != null && s.time - fl < 2.5) {
        const k2 = (s.time - fl) / 2.5;
        ctx.strokeStyle = G.rgba(o === 0 ? s.color : '#ff6040', 1 - k2); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, y, rr + 4 + k2 * 26, 0, 7); ctx.stroke();
      }
      if (SV.galaxy.sel === i) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(x, y, rr + 8, 0, 7); ctx.stroke(); }
    }
    // rótulos
    ctx.textAlign = 'center';
    for (const L of SV._alienLabels || []) {
      const [x, y] = GS(L.x, L.y);
      ctx.font = "600 12px 'IBM Plex Sans', sans-serif";
      ctx.fillStyle = L.gone ? 'rgba(200,210,230,0.45)' : G.rgba(L.col, 0.9);
      ctx.fillText(L.name.toUpperCase() + (L.gone ? ' (humanos)' : ''), x, y);
    }
    const sol = sys[g.gal.sol];
    const [solx, soly] = GS(sol.x, sol.y);
    ctx.font = "600 12px 'IBM Plex Sans', sans-serif"; ctx.fillStyle = '#fff';
    ctx.fillText('Sol', solx, soly - 10);
    if (c.z > 2.2) {
      ctx.font = "11px 'IBM Plex Sans', sans-serif";
      for (let i = 0; i < sys.length; i++) {
        if (i === g.gal.sol) continue;
        const [x, y] = GS(sys[i].x, sys[i].y);
        if (x < 0 || y < 0 || x > W || y > Hh) continue;
        ctx.fillStyle = own[i] === 0 ? 'rgba(255,255,255,0.85)' : 'rgba(190,200,225,0.55)';
        ctx.fillText(sys[i].name, x, y - 8);
      }
    }
  };
  SV.galHit = function (sx, sy) {
    const g = G.game;
    if (!g.gal) return -1;
    let best = -1, bd = 12;
    g.gal.sys.forEach((s, i) => { const [x, y] = GS(s.x, s.y); const d = Math.hypot(x - sx, y - sy); if (d < bd) { bd = d; best = i; } });
    return best;
  };
})();
