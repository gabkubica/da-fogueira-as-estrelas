/* Da Fogueira às Estrelas — inicialização, laço principal e controles */
(function () {
  'use strict';
  const G = globalThis.G;
  const game = G.game, MV = G.mapview, SV = G.spaceview, UI = G.ui;
  const $ = (s) => document.querySelector(s);
  const M = (G.main = { view: 'earth', running: false, offline: false });
  const params = new URLSearchParams(location.search);
  M.speed = Math.max(0.1, +(params.get('speed') || 1));

  let canvas, ctx, dpr = 1, W = 0, H = 0;
  function resize() {
    const r = canvas.parentElement.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = Math.max(50, r.width); H = Math.max(50, r.height);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    MV.screenW = SV.screenW = W; MV.screenH = SV.screenH = H;
    MV.dpr = SV.dpr = dpr;
    SV.bg = null;
  }

  M.themeFor = (e) => (e <= 4 ? 'pergaminho' : e <= 6 ? 'atlas' : e === 7 ? 'moderno' : 'cosmos');
  function applyTheme() { /* a moldura é fixa; só o mapa muda */ }

  // ---------------- vistas ----------------
  M.views = () => {
    const e = game.s.era;
    const v = [{ id: 'earth', name: 'Terra' }];
    if (e >= 8) v.push({ id: 'globe', name: 'Órbita' }, { id: 'solar', name: 'Sistema Solar' });
    if (game.gal) v.push({ id: 'galaxy', name: 'Galáxia' });
    return v;
  };
  function renderViewbar() {
    const v = M.views();
    const bar = $('#viewbar');
    bar.hidden = v.length < 2;
    M.known = M.known || {};
    bar.innerHTML = v.map((x) => `<button class="${x.id === M.view ? 'on' : ''} ${M.known[x.id] || x.id === 'earth' ? '' : 'new'}" data-view="${x.id}">${x.name}</button>`).join('');
  }
  M.setView = function (id) {
    if (!M.views().find((x) => x.id === id)) id = 'earth';
    const first = !M.seen || !M.seen[id];
    M.seen = M.seen || {}; M.seen[id] = true;
    M.view = id;
    M.known = M.known || {}; M.known[id] = true;
    if (id === 'solar' && first) SV.solarFit();
    if (id === 'galaxy' && first) SV.galFit(false);
    document.body.dataset.view = id;
    renderViewbar();
    UI.selCard();
    $('#hovercard').hidden = true;
  };

  // ---------------- início ----------------
  M.errors = [];
  addEventListener('error', (e) => { if (!e || !e.message) return; const t = e.message + (e.filename ? ' (' + e.filename.split('/').pop() + ':' + e.lineno + ')' : ''); M.errors.push(t); if (UI.reportError) UI.reportError(t); });
  addEventListener('unhandledrejection', (e) => { if (UI.reportError) UI.reportError(String(e.reason && e.reason.message || e.reason)); });
  function boot() {
    canvas = $('#view');
    ctx = canvas.getContext('2d');
    resize();
    addEventListener('resize', resize);
    // o palco pode mudar de tamanho sem a janela mudar (fontes carregando, HUD, painel)
    if (window.ResizeObserver) new ResizeObserver(() => resize()).observe(canvas.parentElement);
    else setInterval(() => { const r = canvas.parentElement.getBoundingClientRect(); if (Math.abs(r.width - W) > 1 || Math.abs(r.height - H) > 1) resize(); }, 500);
    UI.wire();
    UI.wireSel();
    wireInput();
    wireGameEvents();
    $('#viewbar').addEventListener('click', (e) => { const b = e.target.closest('[data-view]'); if (b) M.setView(b.dataset.view); });
    $('#mapctl').addEventListener('click', (e) => {
      const b = e.target.closest('[data-z]');
      if (!b) return;
      const z = b.dataset.z;
      if (z === 'home') { if (M.view === 'earth') MV.focusOwn(1.2); else if (M.view === 'solar') SV.solarFit(); else if (M.view === 'galaxy') SV.galFit(false); return; }
      zoomAt(W / 2, H / 2, z === 'in' ? 1.35 : 1 / 1.35);
    });
    const saved = game.loadSaved();
    UI.showStart(!!(saved && saved.s), newGame, () => M.loadData(saved));
    requestAnimationFrame(frame);
    addEventListener('visibilitychange', () => {
      if (!M.running) return;
      if (document.hidden) game.save();
    });
    addEventListener('beforeunload', () => { if (M.running) game.save(); });
  }

  function newGame(opts) {
    const ld = $('#loading');
    ld.hidden = false; $('#loading span').textContent = 'Criando o mundo…';
    // deixa o navegador mostrar a tela de carregamento antes do trabalho pesado
    setTimeout(() => {
      try {
        const s = game.newState({ seed: opts.seed, civName: opts.civName, color: G.flagMapColor(opts.flag), voice: opts.voice, flag: opts.flag });
        game.start(s);
        game.save();
        startPlaying(true, null);
      } catch (e) { console.error(e); M.errors.push('início: ' + (e && e.stack || e)); UI.fatal('Erro ao criar o mundo: ' + (e && e.message || e)); }
    }, 60);
  }
  M.loadData = function (data) {
    M.offline = true;
    try { game.resume(data); } catch (e) { console.error(e); UI.toast('Não foi possível carregar o império salvo.', 'bad'); M.offline = false; return; }
    const secs = (Date.now() - (data.s.savedAt || Date.now())) / 1000;
    const off = game.offline(secs);
    M.offline = false;
    startPlaying(false, off);
  };
  function catchUp(secs) {
    M.offline = true;
    const before = game.s.era;
    const off = game.offline(secs);
    M.offline = false;
    if (game.s.era !== before) afterEraChange(game.s.era, true);
    MV.terrDirty = MV.fogDirty = MV.lightsDirty = MV.roadsDirty = true;
    UI.dirtyTab = true;
    if (off) offlineModal(off);
  }

  function startPlaying(isNew, off) {
    MV.reset(); SV.resetGalaxy();
    try { if (localStorage.getItem('fae-simples') === '1') MV.simple = true; } catch (e) {}
    MV.TS = MV.simple ? 1 : innerWidth < 900 ? 1.3 : 2;
    M.seen = {};
    applyTheme();
    game.rates();
    UI.buildHUD(); UI.renderTabs(); UI.renderTab(); UI.updateTicker(); UI.updateNotice(); UI.refresh();
    M.setView('earth');
    const style = MV.styleForEra(game.s.era);
    const ld = $('#loading');
    ld.hidden = false;
    $('#loading span').textContent = 'Desenhando o mundo…';
    M.loadStart = performance.now();
    clearTimeout(M.diagT);
    M.diagT = setTimeout(() => { if (!M.running) UI.diagnostic(); }, 12000);
    MV.ensureStyle(style, () => {
      ld.hidden = true;
      clearTimeout(M.diagT);
      const dg = document.querySelector('.diag'); if (dg) dg.remove();
      MV.setStyle(style, true);
      const cap = game.s.settlements.find((x) => x.capital && x.owner === 0);
      if (isNew && cap) { const [x, y] = G.hexCenter(cap.h); MV.cam.x = x; MV.cam.y = y; MV.cam.z = 1.6; MV.flyTo(x, y, 3.6, 3.5); }
      else { const [x, y] = cap ? G.hexCenter(cap.h) : [0, 0]; MV.cam.x = x; MV.cam.y = y; MV.cam.z = 2; MV.focusOwn(0.01); }
      M.running = true;
      simLast = Date.now(); acc = 0;
      if (isNew) UI.eraNote(0);
      else if (off) offlineModal(off);
    }, (p) => { M.loadProg = p; $('#loading i').style.width = Math.round(p * 100) + '%'; });
  }
  // recomeça o desenho do mapa no modo simples (sem símbolos, resolução menor)
  M.simpleMode = function () {
    try { localStorage.setItem('fae-simples', '1'); } catch (e) {}
    MV.simple = true;
    startPlaying(false, null);
  };

  function offlineModal(off) {
    const b = off.before, a = off.after;
    const rows = [
      ['População', `${G.fmt(b.pop)} → ${G.fmt(a.pop)}`],
      ['Territórios', `${b.land} → ${a.land}`],
      ['Ano', `${G.fmtYear(b.year)} → ${G.fmtYear(a.year)}`],
    ];
    G.RES_ORDER.forEach((k) => { const d = a.res[k] - b.res[k]; if (Math.abs(d) > 0.5) rows.push([UI.RN[k], (d >= 0 ? '+' : '') + G.fmt(d)]); });
    UI.modal(`<h2>Enquanto você esteve fora</h2><p class="hint">${G.fmtTime(off.secs)} se passaram. O povo seguiu trabalhando.</p>${rows.map((r) => `<div class="kv"><span>${r[0]}</span><b>${r[1]}</b></div>`).join('')}<div class="btnrow"><button class="btn" data-act="close">Continuar</button></div>`);
  }

  // ---------------- eventos do jogo ----------------
  let pendingTerr = false, lastTerr = 0, pendingTicker = false;
  function wireGameEvents() {
    const structural = ['buildings', 'techs', 'gov', 'genes', 'space', 'aliens', 'rivals', 'wonder', 'galaxy', 'legacy'];
    structural.forEach((ev) => game.on(ev, () => { UI.dirtyTab = true; }));
    game.on('territory', () => { pendingTerr = true; if (UI.tab === 'territorio') UI.dirtyTab = true; });
    game.on('explore', () => { MV.fogDirty = true; });
    game.on('settlements', () => { MV.roadsDirty = true; MV.lightsDirty = true; if (UI.tab === 'povo') UI.dirtyTab = true; });
    game.on('chronicle', () => { pendingTicker = true; if (UI.tab === 'cronica') UI.dirtyTab = true; });
    game.on('toast', (t) => { if (!M.offline) UI.toast(t.text, t.kind); });
    game.on('event', () => UI.updateNotice());
    game.on('contact', () => { UI.updateNotice(); if (!M.offline && !UI.modalOpen) UI.openNotice(); });
    game.on('galaxy', () => { SV.galDirty = true; if (M.view === 'galaxy') UI.selCard(); });
    game.on('wonder', (w) => { if (!M.offline && w && w.stage >= 3) UI.toast(`Maravilha concluída: ${G.WONDER[w.id].name}`, 'wonder'); MV.roadsDirty = true; });
    game.on('era', (e) => { if (!M.offline) afterEraChange(e, false); });
    game.on('victory', () => {
      if (M.offline) return;
      const s = game.s;
      UI.modal(`<div class="victory"><div class="ck">Fim da jornada</div><h1>A galáxia é humana</h1><p>Da primeira fogueira, às margens de um rio sem nome, até a última estrela da espiral. ${UI.esc(game.empireName())} cumpriu o que nenhum ancestral ousou sonhar.</p>
        <div class="kv"><span>Tempo de jogo</span><b>${G.fmtTime(s.stats.played)}</b></div><div class="kv"><span>População</span><b>${G.fmt(s.pop)}</b></div><div class="kv"><span>Maravilhas</span><b>${game.d.glory}</b></div><div class="kv"><span>Povos incorporados</span><b>${s.stats.absorbed}</b></div>
        <div class="btnrow"><button class="btn" data-act="close">Contemplar o império</button></div></div>`, { cls: 'victory-modal' });
    });
  }
  function afterEraChange(e, quiet) {
    const go = () => {
      applyTheme();
      UI.buildHUD();
      renderViewbar();
      UI.dirtyTab = true;
      const st = MV.styleForEra(e);
      MV.setStyle(st);
      MV.terrDirty = MV.fogDirty = MV.lightsDirty = MV.roadsDirty = true;
      if (quiet) return;
      UI.eraNote(e);
      if (e === 10) SV.galFit(true);
    };
    // começa a preparar o novo estilo do mapa enquanto a cena roda
    MV.ensureStyle(MV.styleForEra(e));
    go();
  }

  // ---------------- laço ----------------
  // a simulação segue o relógio real (setInterval); o requestAnimationFrame só desenha
  let simLast = Date.now(), acc = 0;
  function simStep() {
    const now = Date.now();
    const el = (now - simLast) / 1000;
    simLast = now;
    if (!M.running) return;
    if (el > 30) { catchUp(el); return; }
    acc += Math.min(el, 30) * M.speed;
    let n = 0;
    while (acc >= 0.1 && n < 600) { game.tick(0.1, false); acc -= 0.1; n++; }
    if (n >= 600) acc = 0;
  }
  setInterval(simStep, 100);
  setInterval(() => { if (M.running) game.save(); }, 20000);
  let last = performance.now(), uiT = 0, saveT = 0;
  let lastFrame = 0;
  setInterval(() => { if (performance.now() - lastFrame > 400) frame(performance.now(), true); }, 250);
  function frame(t, fromWatchdog) {
    lastFrame = performance.now();
    const dt = Math.min(0.25, Math.max(0, (t - last) / 1000));
    last = t;
    if (M.running) {
      uiT += dt;
      if (uiT > 0.25) {
        uiT = 0;
        UI.tick(); UI.refreshSel();
        if (pendingTicker) { pendingTicker = false; UI.updateTicker(); }
      }

      if (pendingTerr && t - lastTerr > 280) { pendingTerr = false; lastTerr = t; MV.terrDirty = true; if (MV.style === 'night') MV.lightsDirty = true; }
      if (MV.style === 'night' && t - (M.lastLights || 0) > 5000) { M.lastLights = t; MV.lightsDirty = true; }
      draw(dt, t / 1000);
    }
    if (!fromWatchdog) requestAnimationFrame(frame);
  }
  function draw(dt, time) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    try {
      if (M.view === 'earth') { MV.update(dt); MV.draw(ctx, time); }
      else if (M.view === 'globe') SV.drawGlobeView(ctx, time, dt);
      else if (M.view === 'solar') SV.drawSolar(ctx, time);
      else if (M.view === 'galaxy') { SV.updateGalaxy(dt); SV.drawGalaxy(ctx, time); }
    } catch (e) { if (!M.drawErr) { M.drawErr = true; console.error(e); UI.reportError('Desenho do mapa: ' + (e && e.message ? e.message : e)); } }
  }

  // ---------------- entrada ----------------
  function camOf() { return M.view === 'solar' ? SV.solar.cam : M.view === 'galaxy' ? SV.galaxy.cam : MV.cam; }
  function zoomAt(sx, sy, f) {
    if (M.view === 'globe') return;
    const c = camOf();
    const wx = c.x + (sx - W / 2) / c.z, wy = c.y + (sy - H / 2) / c.z;
    MV.target = null; SV.galaxy.target = null;
    c.z *= f;
    if (M.view === 'earth') MV.clampCam();
    else c.z = G.clamp(c.z, M.view === 'solar' ? 0.25 : 0.25, M.view === 'solar' ? 8 : 14);
    c.x = wx - (sx - W / 2) / c.z; c.y = wy - (sy - H / 2) / c.z;
    if (M.view === 'earth') MV.clampCam();
  }
  function wireInput() {
    const ptrs = new Map();
    let drag = null, pinch = null;
    const pos = (e) => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    canvas.addEventListener('pointerdown', (e) => {
      canvas.setPointerCapture(e.pointerId);
      const [x, y] = pos(e);
      ptrs.set(e.pointerId, [x, y]);
      if (ptrs.size === 1) drag = { x, y, moved: false, sx: x, sy: y };
      else if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]) }; drag = null; }
    });
    canvas.addEventListener('pointermove', (e) => {
      const [x, y] = pos(e);
      if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, [x, y]);
      if (pinch && ptrs.size === 2) {
        const [a, b] = [...ptrs.values()];
        const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
        zoomAt((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, d / pinch.d);
        pinch.d = d;
        return;
      }
      if (drag) {
        const dx = x - drag.x, dy = y - drag.y;
        if (Math.hypot(x - drag.sx, y - drag.sy) > 5) drag.moved = true;
        drag.x = x; drag.y = y;
        if (!drag.moved) return;
        if (M.view === 'globe') { SV.globe.rot -= dx * 0.006; SV.globe.drag = true; return; }
        const c = camOf();
        MV.target = null; SV.galaxy.target = null;
        c.x -= dx / c.z; c.y -= dy / c.z;
        if (M.view === 'earth') MV.clampCam();
        $('#hovercard').hidden = true;
        return;
      }
      if (M.view === 'earth' && e.pointerType === 'mouse') { const h = MV.hitTest(x, y); MV.hover = h; UI.hoverCard(h, x, y); }
    });
    const up = (e) => {
      const was = drag;
      ptrs.delete(e.pointerId);
      if (ptrs.size < 2) pinch = null;
      if (ptrs.size === 0) drag = null;
      SV.globe.drag = false;
      if (was && !was.moved && e.type === 'pointerup') click(was.sx, was.sy, e);
    };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('pointerleave', () => { $('#hovercard').hidden = true; MV.hover = -1; });
    canvas.addEventListener('wheel', (e) => { e.preventDefault(); const [x, y] = pos(e); zoomAt(x, y, Math.exp(-e.deltaY * 0.0016)); }, { passive: false });
  }
  function click(x, y, e) {
    if (M.view === 'earth') {
      const h = MV.hitTest(x, y);
      if (h < 0) return;
      const f = game.frontier();
      if (game.owner[h] === -1 && f.mark[h]) {
        if (game.claimTile(h)) { UI.hoverCard(h, x, y); UI.dirtyTab = true; }
        else UI.toast('Faltam recursos para anexar esta terra', 'bad');
        return;
      }
      if (game.owner[h] > 0) { UI.setTab('territorio'); return; }
      if (e.pointerType !== 'mouse') UI.hoverCard(h, x, y);
    } else if (M.view === 'globe') {
      const g = SV.globe.hit;
      if (g && Math.hypot(x - g.cx, y - g.cy) < g.R) M.setView('earth');
      else if (g && Math.hypot(x - g.mx, y - g.my) < g.R * 0.3) { M.setView('solar'); SV.solar.sel = 'lua'; UI.selCard(); }
    } else if (M.view === 'solar') {
      SV.solar.sel = SV.solarHit(x, y);
      UI.selCard();
    } else if (M.view === 'galaxy') {
      const j = SV.galHit(x, y);
      SV.galaxy.sel = j >= 0 ? j : null;
      UI.selCard();
    }
  }

  if (params.has('dev')) { const sc = document.createElement('script'); sc.src = 'tools/dev.js'; document.head.appendChild(sc); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
