/* Da Fogueira às Estrelas — interface */
(function () {
  'use strict';
  const G = (globalThis.G = globalThis.G || {});
  const game = G.game;
  const UI = (G.ui = { tab: 'povo', hudBinds: [], tabBinds: [], bid: 0, dirtyTab: true, lastRender: 0, panelDown: false });
  const $ = (s, r) => (r || document).querySelector(s);
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  UI.esc = esc;
  const RN = { food: 'Alimento', materials: 'Materiais', knowledge: 'Saber', culture: 'Cultura', military: 'Força', wealth: 'Riqueza', energy: 'Energia' };
  UI.RN = RN;
  const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
  UI.ROMAN = ROMAN;

  // ---------------- vínculos dinâmicos ----------------
  let curList = null;
  function bind(fn) { const id = 'k' + ++UI.bid; (curList || UI.tabBinds).push([id, fn]); return id; }
  function applyBinds(list) {
    for (let i = 0; i < list.length; i++) {
      const [id, fn] = list[i];
      const el = document.getElementById(id);
      if (!el) continue;
      let v;
      try { v = fn(el); } catch (e) { continue; }
      if (v == null) continue;
      if (typeof v !== 'object') { const t = String(v); if (el.textContent !== t) el.textContent = t; continue; }
      if (v.t != null && el.textContent !== v.t) el.textContent = v.t;
      if (v.h != null && el._h !== v.h) { el.innerHTML = v.h; el._h = v.h; }
      if (v.d != null) el.disabled = v.d;
      if (v.c) for (const k in v.c) el.classList.toggle(k, !!v.c[k]);
      if (v.w != null) el.style.width = v.w;
      if (v.hide != null) el.hidden = !!v.hide;
    }
  }
  UI.refresh = function () {
    applyBinds(UI.hudBinds);
    applyBinds(UI.tabBinds);
  };

  // ---------------- custos ----------------
  function eta(cost) {
    const s = game.s, r = game.rate || {};
    let worst = 0;
    for (const k in cost) {
      const need = cost[k] - s.res[k];
      if (need <= 0) continue;
      const rr = r[k] || 0;
      if (rr <= 0) return Infinity;
      worst = Math.max(worst, need / rr);
    }
    return worst;
  }
  UI.eta = eta;
  // custo fixo (objeto) ou vivo (função que devolve o custo atual)
  const memo = (fn, ms) => { let t = -1e9, v; return () => { const n = performance.now(); if (n - t > (ms || 200)) { v = fn(); t = n; } return v; }; };
  UI.memo = memo;
  function costHTML(cost) {
    const fn = typeof cost === 'function' ? cost : () => cost;
    const c0 = fn() || {};
    const ks = Object.keys(c0).filter((k) => c0[k] > 0);
    if (!ks.length) return '<span class="cost free">sem custo</span>';
    const live = typeof cost === 'function';
    return '<span class="cost">' + ks.map((k) => `<span class="c" data-tip="${RN[k]}" id="${bind(() => ({ c: { no: game.s.res[k] < (fn()[k] || 0) } }))}">${G.ICON[k]}<i ${live ? `id="${bind(() => G.fmt(fn()[k] || 0))}"` : ''}>${G.fmt(c0[k])}</i></span>`).join('') +
      `<span class="eta" id="${bind(() => { const t = eta(fn()); return t <= 0 ? '' : t === Infinity ? '· sem produção' : '· ' + G.fmtTime(t); })}"></span></span>`;
  }
  const afford = (c) => game.afford(typeof c === 'function' ? c() : c);

  // ---------------- texto de efeitos ----------------
  function pct(v) { return G.fmtPct(v); }
  function effLines(eff, f) {
    if (!eff) return [];
    f = f == null ? 1 : f;
    const sc = (v) => 1 + (v - 1) * f;
    const L = [];
    if (eff.mult) for (const k in eff.mult) L.push(`${RN[k]} ${pct(sc(eff.mult[k]))}`);
    if (eff.cap) L.push(`Capacidade populacional ${pct(sc(eff.cap))}`);
    if (eff.growth) L.push(`Crescimento ${pct(sc(eff.growth))}`);
    if (eff.bodyCap) L.push(`População das colônias ${pct(sc(eff.bodyCap))}`);
    const cm = { build: 'Custo de construções', tiles: 'Custo de terras', overseas: 'Custo de terras além-mar', absorb: 'Custo de integrar povos', conquest: 'Custo de conquistas', space: 'Custo de projetos espaciais' };
    for (const k in cm) if (eff[k]) L.push(`${cm[k]} ${pct(sc(eff[k]))}`);
    if (eff.diplomacy) L.push(`Diplomacia ${pct(sc(eff.diplomacy))}`);
    if (eff.conquest == null && eff.absorb == null && eff.space == null) { /* nada */ }
    const fl = eff.flags || {};
    if (fl.seaRange) L.push(fl.seaRange >= 999 ? 'Navegação oceânica: terras em qualquer costa' : `Navegação: atravessa ${fl.seaRange} hexágonos de mar`);
    if (fl.seaAdd) L.push(`Alcance marítimo +${fl.seaAdd}`);
    if (fl.mountains) L.push('Permite ocupar montanhas');
    if (fl.ice) L.push('Permite ocupar o gelo polar');
    if (fl.autoExpand) L.push('Desbloqueia a expansão automática');
    if (fl.autoBuild) L.push('Desbloqueia a construção automática');
    if (fl.autoResearch) L.push('Desbloqueia a pesquisa automática');
    if (fl.autoColonize) L.push('Desbloqueia a colonização automática');
    if (fl.cartography) L.push('Revela grande parte do mundo');
    if (fl.genes) L.push('Abre a Evolução Humana');
    if (fl.range) L.push(`Alcance estelar de ${fl.range} anos-luz`);
    if (fl.rangeAdd) L.push(fl.rangeAdd >= 999 ? 'Alcance estelar ilimitado' : `Alcance estelar +${fl.rangeAdd} anos-luz`);
    if (fl.overseasDiscount) L.push(`Terras além-mar −${Math.round(fl.overseasDiscount * 100)}%`);
    if (fl.spaceDiscount) L.push(`Projetos espaciais −${Math.round(fl.spaceDiscount * 100)}%`);
    if (fl.reveal) L.push('Revela todas as espécies da galáxia');
    if (fl.diplomacy) L.push(`Diplomacia ${pct(fl.diplomacy)}`);
    if (eff.slots) L.push(`+${eff.slots} espaço de política`);
    if (eff.gov) L.push('Governo: ' + eff.gov.map((g) => G.GOV[g].name).join(', '));
    if (eff.pol) L.push('Políticas: ' + eff.pol.map((p) => G.POLICY[p].name).join(', '));
    if (eff.bodies) L.push('Destinos: ' + eff.bodies.map((b) => G.BODY[b].name).join(', '));
    if (eff.era) L.push(`Inaugura a ${G.ERAS[eff.era].name}`);
    return L;
  }
  UI.effLines = effLines;
  const effHTML = (eff, f) => effLines(eff, f).map((l) => `<span class="eff">${esc(l)}</span>`).join('');

  // ---------------- dica flutuante ----------------
  UI.tipFns = {
    tech: (id) => { const t = G.TECH[id]; const st = game.techState(t); return `<b>${esc(t.name)}</b><em>${esc(G.ERAS[t.era].name)}</em><p>${esc(t.desc)}</p>${effLines(t.eff).map((x) => `<div class="tl">${esc(x)}</div>`).join('')}${t.req.length ? `<div class="tr">Requer: ${t.req.map((r) => G.TECH[r].name).join(', ')}</div>` : ''}${t.eff.era ? `<div class="tr">Requer todas as outras tecnologias da era${t.eff.need ? '<br>' + esc(game.needText(t.eff.need)) : ''}</div>` : ''}${st === 'done' ? '<div class="tok">Descoberta</div>' : `<div class="tc">${G.fmt(game.techCost(t).knowledge)} de saber</div>`}`; },
    res: (k) => {
      const s = game.s, sec = G.SECTOR[k];
      const workers = s.pop * (game.fr[k] || 0);
      const per = k === 'food' ? game.foodPer() : sec.base * game.d.mult[k] * game.buffMult(k);
      let h = `<b>${RN[k]}</b><p>${esc(sec.workers[s.era] || '')}: ${G.fmtInt(workers)} (${Math.round((game.fr[k] || 0) * 100)}% do povo)</p>`;
      h += `<div class="tl">Por trabalhador: ${G.fmt(per)}/s</div><div class="tl">Multiplicador total: ×${G.fmt(game.d.mult[k])}</div>`;
      if (k === 'food') h += `<div class="tl">Consumo: ${G.fmt(s.pop * G.BAL.eat)}/s</div><div class="tl">Excedente: ${G.fmtRate(game.rate.food)}</div>`;
      const bm = game.buffMult(k); if (bm !== 1) h += `<div class="tl">Efeitos temporários ×${G.fmt(bm)}</div>`;
      return h;
    },
    pop: () => {
      const s = game.s, d = game.d;
      const C = game.capacity();
      const per = G.BAL.capPerTile[s.era];
      return `<b>População</b><p>${G.fmtInt(s.pop)} de ${G.fmtInt(C)} possíveis.</p><div class="tl">Territórios: ${game.ownedLand} × ${G.fmt(per)} pessoas (ajustado pelo terreno)</div>${d.spaceCap ? `<div class="tl">Colônias no espaço: ${G.fmt(d.spaceCap)}</div>` : ''}${game.galCap ? `<div class="tl">Sistemas estelares: ${G.fmt(game.galCap)}</div>` : ''}<div class="tl">Multiplicador de moradia: ×${G.fmt(d.capMult)}</div><p class="hint">Mais território, moradias e tecnologias aumentam o limite.</p>`;
    },
    glory: () => `<b>Glória</b><p>Cada maravilha concluída dá +${Math.round(G.GLORY_BONUS * 100)}% em toda a produção.</p><div class="tl">${game.d.glory} maravilhas concluídas</div><div class="tl">Marcos alcançados: ${Object.keys(game.s.milestones).length} (+${Math.round(G.MILESTONE_BONUS * 100)}% cada)</div>`,
    era: (e) => { const E = G.ERAS[e]; return `<b>${ROMAN[e]} · ${esc(E.name)}</b><em>${G.fmtYear(E.y0)} — ${G.fmtYear(E.y1)}</em><p>${esc(E.text)}</p>`; },
  };
  function setupTip() {
    const tip = $('#tip');
    let cur = null;
    document.addEventListener('mouseover', (e) => {
      const el = e.target.closest('[data-tip],[data-tipk]');
      if (!el) { tip.hidden = true; cur = null; return; }
      if (el === cur) return;
      cur = el;
      let h = el.dataset.tip ? esc(el.dataset.tip) : '';
      if (el.dataset.tipk) { const [k, a] = el.dataset.tipk.split(':'); try { h = UI.tipFns[k](a); } catch (er) { h = ''; } }
      if (!h) { tip.hidden = true; return; }
      tip.innerHTML = h; tip.hidden = false;
    });
    document.addEventListener('mousemove', (e) => {
      if (tip.hidden) return;
      const w = tip.offsetWidth, h = tip.offsetHeight;
      let x = e.clientX + 16, y = e.clientY + 14;
      if (x + w > innerWidth - 8) x = e.clientX - w - 12;
      if (y + h > innerHeight - 8) y = innerHeight - h - 8;
      tip.style.transform = `translate(${x}px,${y}px)`;
    });
  }

  // ---------------- HUD ----------------
  UI.buildHUD = function () {
    UI.hudBinds = [];
    curList = UI.hudBinds;
    const s = game.s;
    const chips = G.SECTORS.map((sec) => `<div class="chip" data-res="${sec.id}" data-tipk="res:${sec.id}" id="${bind(() => ({ hide: game.s.era < sec.unlock }))}">
        <span class="ci" style="color:var(--r-${sec.id})">${G.ICON[sec.id]}</span>
        <span class="cv" id="${bind(() => G.fmt(game.s.res[sec.id]))}"></span>
        <span class="cr" id="${bind(() => { const r = game.rate[sec.id]; return { t: G.fmtRate(r), c: { neg: r < 0 } }; })}"></span>
      </div>`).join('');
    $('#hud').innerHTML = `
      <div class="hud-emp" data-act="tab" data-id="imperio">
        <span id="${bind(() => ({ h: G.flagSVG(game.s.flag, 46, 31) }))}" class="hud-flag"></span>
        <div class="hud-names">
          <div class="emp-name" id="${bind(() => game.empireName())}"></div>
          <div class="emp-era"><span id="${bind(() => ROMAN[game.s.era] + ' · ' + G.ERAS[game.s.era].name)}"></span><span class="year" id="${bind(() => G.fmtYear(game.s.year))}"></span></div>
        </div>
      </div>
      <div class="hud-pop" data-tipk="pop:">
        <span class="ci">${G.ICON.pop}</span>
        <div><div class="pv"><b id="${bind(() => G.fmtInt(game.s.pop))}"></b><span> / </span><span id="${bind(() => G.fmt(game.capacity()))}"></span></div>
        <div class="bar"><i id="${bind(() => ({ w: Math.min(100, (game.s.pop / Math.max(1, game.capacity())) * 100) + '%' }))}"></i></div></div>
      </div>
      <div class="hud-res">${chips}</div>
      <div class="hud-glory" data-tipk="glory:"><span class="ci">${G.ICON.glory}</span><b id="${bind(() => game.d.glory)}"></b></div>
      <button class="hud-menu" data-act="menu" title="Salvar, exportar, carregar">${G.ICON.save}<span>Jogo</span></button>
    `;
    // linha do tempo
    $('#timeline').innerHTML = G.ERAS.map((E, e) => `<div class="tseg" data-tipk="era:${e}" id="${bind(() => ({ c: { past: game.s.era > e, now: game.s.era === e } }))}">
        <i id="${bind(() => { const s2 = game.s; if (s2.era > e) return { w: '100%' }; if (s2.era < e) return { w: '0%' }; const ts = game.eraTechs(e); return { w: (ts.filter((t) => s2.techs[t.id]).length / ts.length) * 100 + '%' }; })}"></i>
        <span>${ROMAN[e]}</span></div>`).join('') +
      `<div class="tnext" id="${bind(() => ({ h: nextEraHTML() }))}"></div>`;
    curList = null;
  };
  function nextEraHTML() {
    const s = game.s;
    const key = G.TECHS.find((t) => t.era === s.era && t.eff.era);
    if (!key) return s.victory ? 'A galáxia é humana.' : 'Domine toda a galáxia';
    const others = game.eraTechs(s.era).filter((t) => t !== key);
    const left = others.filter((t) => !s.techs[t.id]).length;
    const parts = [];
    if (left) parts.push(`${left} tecnologia${left > 1 ? 's' : ''}`);
    if (!game.needMet(key.eff.need)) {
      const n = key.eff.need;
      if (n.tiles) parts.push(`${Math.max(0, Math.ceil(n.tiles * game.world.landTotal) - (game.ownedLand - game.ownedIce))} territórios`);
      if (n.bodies) parts.push('colônias: ' + n.bodies.filter((b) => (s.space.bodies[b] || 0) < 3).map((b) => G.BODY[b].name).join(', '));
      if (n.systems) parts.push(`${Math.max(0, Math.ceil(n.systems * G.GAL.N) - (game.galCount || 0))} sistemas`);
    }
    const nm = G.ERAS[key.eff.era].short;
    return parts.length ? `Rumo à era ${esc(nm)}: faltam ${esc(parts.join(' · '))}` : `<b>${esc(key.name)}</b> pronta para pesquisa`;
  }

  // ---------------- abas ----------------
  const TABS = [
    { id: 'povo', name: 'Povo', show: () => true },
    { id: 'obras', name: 'Obras', show: () => true },
    { id: 'saber', name: 'Saber', show: () => true },
    { id: 'maravilhas', name: 'Maravilhas', show: () => true },
    { id: 'territorio', name: 'Território', show: () => true },
    { id: 'governo', name: 'Governo', show: () => true },
    { id: 'humanidade', name: 'Humanidade', show: () => !!game.d.fl.genes },
    { id: 'cosmos', name: 'Cosmos', show: () => game.s.era >= 8 || G.BODIES.some((b) => game.bodyUnlocked(b)) },
    { id: 'galaxia', name: 'Galáxia', show: () => !!game.gal },
    { id: 'cronica', name: 'Crônica', show: () => true },
    { id: 'imperio', name: 'Império', show: () => true },
  ];
  UI.renderTabs = function () {
    const vis = TABS.filter((t) => t.show());
    if (!vis.find((t) => t.id === UI.tab)) UI.tab = 'povo';
    $('#tabs').innerHTML = vis.map((t) => `<button class="tab ${t.id === UI.tab ? 'on' : ''}" data-act="tab" data-id="${t.id}">${t.name}</button>`).join('');
    UI.tabsSig = vis.map((t) => t.id).join(',');
  };
  UI.renderTab = function () {
    UI.tabBinds = [];
    curList = UI.tabBinds;
    const body = $('#tabbody');
    const st = body.scrollTop;
    let h = '';
    try { h = R[UI.tab](); } catch (e) { console.error(e); h = '<p>Erro ao desenhar esta aba.</p>'; }
    body.innerHTML = h;
    body.scrollTop = st;
    curList = null;
    UI.dirtyTab = false;
    UI.lastRender = performance.now();
    applyBinds(UI.tabBinds);
  };
  UI.setTab = function (id) {
    if (UI.tab !== id) $('#tabbody').scrollTop = 0;
    UI.tab = id;
    UI.renderTabs();
    UI.renderTab();
    document.body.classList.add('panel-open');
  };
  UI.tick = function () {
    const sig = TABS.filter((t) => t.show()).map((t) => t.id).join(',');
    if (sig !== UI.tabsSig) UI.renderTabs();
    if (UI.dirtyTab && !UI.panelDown && performance.now() - UI.lastRender > 200) UI.renderTab();
  };

  const sec = (title, inner, cls) => `<section class="sec ${cls || ''}"><h3>${title}</h3>${inner}</section>`;
  const R = {};

  // ---- POVO ----
  R.povo = function () {
    const s = game.s;
    let h = sec('População', `
      <div class="bigstat"><b id="${bind(() => G.fmtInt(game.s.pop))}"></b><span>pessoas</span></div>
      <div class="bar big"><i id="${bind(() => ({ w: Math.min(100, (game.s.pop / Math.max(1, game.capacity())) * 100) + '%' }))}"></i></div>
      <div class="kv"><span>Limite</span><b id="${bind(() => G.fmtInt(game.capacity()))}"></b></div>
      <div class="kv"><span>Crescimento</span><b id="${bind(() => { const C = game.capacity(), P = game.s.pop; const g = P < C ? G.BAL.growth * game.d.growth * P * (1 - P / C) + 0.05 : -(P - C) * 0.05; return G.fmtRate(g); })}"></b></div>
      <div class="kv"><span>Por território</span><b>${G.fmt(G.BAL.capPerTile[s.era])} pessoas</b></div>
      <p class="hint" id="${bind(() => (game.s.pop > game.capacity() * 0.97 ? 'O povo está apertado: expanda o território ou construa moradias.' : 'O povo cresce enquanto houver espaço e alimento.'))}"></p>`);
    // divisão do trabalho
    const rows = G.SECTORS.filter((x) => s.era >= x.unlock).map((x) => {
      if (x.id === 'food') {
        return `<div class="job food">
          <div class="jh"><span class="ci" style="color:var(--r-food)">${G.ICON.food}</span><b>${esc(x.workers[s.era])}</b><span class="jp" id="${bind(() => Math.round(game.fr.food * 100) + '%')}"></span></div>
          <div class="jn"><span id="${bind(() => G.fmtInt(game.s.pop * game.fr.food))}"></span> trabalhando · excedente <span id="${bind(() => G.fmtRate(game.rate.food))}"></span></div>
          <label class="sl">Reserva de alimento <input type="range" min="0" max="100" step="5" value="${Math.round(s.margin * 100)}" data-margin="1"><span id="${bind(() => '+' + Math.round(game.s.margin * 100) + '%')}"></span></label>
          <p class="hint">A comida é distribuída automaticamente. A reserva vira estoque para fundar novas terras.</p>
        </div>`;
      }
      return `<div class="job">
        <div class="jh"><span class="ci" style="color:var(--r-${x.id})">${G.ICON[x.id]}</span><b>${esc(x.workers[s.era])}</b><span class="jp" id="${bind(() => Math.round(game.fr[x.id] * 100) + '%')}"></span></div>
        <div class="jn"><span id="${bind(() => G.fmtInt(game.s.pop * game.fr[x.id]))}"></span> trabalhando · <span id="${bind(() => G.fmtRate(game.gross[x.id]))}"></span> de ${RN[x.id].toLowerCase()}</div>
        <input type="range" min="0" max="10" step="1" value="${s.weights[x.id] || 0}" data-weight="${x.id}" aria-label="Prioridade de ${RN[x.id]}">
      </div>`;
    }).join('');
    h += sec('Divisão do trabalho', `<p class="hint">Defina a prioridade de cada ofício. Quem não planta, trabalha nos outros.</p>${rows}`);
    // mutirão
    const btns = G.SECTORS.filter((x) => s.era >= x.unlock).map((x) => `<button class="btn sm" data-act="effort" data-id="${x.id}" id="${bind(() => ({ d: game.s.cd.effort > game.s.time }))}" data-tip="+${RN[x.id]}">${G.ICON[x.id]}<span id="${bind(() => G.fmt(game.effortAmt(x.id)))}"></span></button>`).join('');
    h += sec('Mutirão', `<p class="hint">Convoque o povo para um esforço concentrado.</p><div class="effort">${btns}</div><div class="bar thin"><i id="${bind(() => ({ w: (game.s.cd.effort > game.s.time ? (1 - (game.s.cd.effort - game.s.time) / game.effortCd()) * 100 : 100) + '%' }))}"></i></div>`);
    // assentamentos
    const mine = s.settlements.filter((x) => x.owner === 0).map((x) => ({ x, p: game.settlementPop(x) })).sort((a, b) => b.p - a.p);
    h += sec(`Assentamentos <small>${mine.length}</small>`, `<ol class="cities">${mine.slice(0, 14).map(({ x, p }) => `<li data-act="goto" data-id="${x.h}"><span class="cn">${x.capital ? '★ ' : ''}${esc(x.name)}</span><span class="ct">${game.TIERS[game.tierOf(p)].name}</span><span class="cp">${G.fmt(p)}</span></li>`).join('')}</ol>${mine.length > 14 ? `<p class="hint">e mais ${mine.length - 14}.</p>` : ''}`);
    return h;
  };

  // ---- OBRAS ----
  R.obras = function () {
    const s = game.s;
    let h = '';
    if (game.d.fl.autoBuild) h += `<label class="toggle"><input type="checkbox" data-auto="build" ${s.auto.build ? 'checked' : ''}> Construção automática <small>(gasta até 30% do estoque)</small></label>`;
    for (let e = s.era; e >= 0; e--) {
      const list = G.BUILDINGS.filter((b) => b.era === e);
      if (!list.length) continue;
      const inner = list.map((b) => {
        const n = s.buildings[b.id] || 0;
        const c = game.buildingCost(b.id);
        const bon = G.buildingBonus(b.era);
        const eff = b.cap ? `Moradia +${Math.round(G.buildingCapBonus(b.era) * b.cap * 100)}% cada` : Object.keys(b.s).map((k) => `${RN[k]} +${Math.round(bon * b.s[k] * 100)}% cada`).join(' · ');
        return `<div class="item">
          <div class="ih"><b>${esc(b.name)}</b><span class="cnt">${n}</span></div>
          <div class="id">${esc(b.desc)}</div>
          <div class="ie">${esc(eff)}</div>
          <div class="ia">${costHTML(c)}<span class="btns"><button class="btn" data-act="buy" data-id="${b.id}" id="${bind(() => ({ d: !afford(c) }))}">Construir</button><button class="btn ghost" data-act="buymax" data-id="${b.id}" id="${bind(() => ({ d: !afford(c) }))}">Máx</button></span></div>
        </div>`;
      }).join('');
      h += `<details class="era-group" ${e >= s.era - 1 ? 'open' : ''}><summary>${ROMAN[e]} · ${esc(G.ERAS[e].name)}</summary>${inner}</details>`;
    }
    return h;
  };

  // ---- SABER ----
  R.saber = function () {
    const s = game.s;
    const key = G.TECHS.find((t) => t.era === s.era && t.eff.era);
    let h = `<button class="btn wide tree-btn" data-act="tree">${G.ICON.tree} Abrir a Árvore do Conhecimento</button>`;
    if (game.d.fl.autoResearch) h += `<label class="toggle"><input type="checkbox" data-auto="research" ${s.auto.research ? 'checked' : ''}> Pesquisa automática</label>`;
    const open = G.TECHS.filter((t) => game.techState(t) === 'open').sort((a, b) => game.techCost(a).knowledge - game.techCost(b).knowledge);
    h += sec('Pesquisas disponíveis', open.length ? open.map((t) => techCard(t)).join('') : '<p class="hint">Nenhuma pesquisa disponível agora.</p>');
    const locked = game.eraTechs(s.era).filter((t) => ['locked', 'need'].includes(game.techState(t)));
    if (locked.length) h += sec('Ainda fora de alcance', locked.map((t) => `<div class="item dim" data-tipk="tech:${t.id}"><div class="ih"><b>${esc(t.name)}</b>${t.eff.era ? '<span class="tag">marco</span>' : ''}</div><div class="id">${t.eff.era ? esc(game.needText(t.eff.need) || 'Requer todas as tecnologias da era') : 'Requer ' + esc(t.req.filter((r) => !s.techs[r]).map((r) => G.TECH[r].name).join(', '))}</div></div>`).join(''));
    if (key) h += sec('O próximo marco', `<div class="milestone-card"><b>${esc(key.name)}</b><p>${esc(key.desc)}</p><div class="id" id="${bind(() => nextEraHTML().replace(/<[^>]+>/g, ''))}"></div></div>`);
    return h;
  };
  function techCard(t) {
    const c = game.techCost(t);
    return `<div class="item tech" data-tipk="tech:${t.id}">
      <div class="ih"><b>${esc(t.name)}</b>${t.eff.era ? '<span class="tag">marco</span>' : ''}</div>
      <div class="id">${esc(t.desc)}</div>
      <div class="ie">${effLines(t.eff).slice(0, 3).map(esc).join(' · ')}</div>
      <div class="ia">${costHTML(c)}<button class="btn" data-act="research" data-id="${t.id}" id="${bind(() => ({ d: !afford(c) }))}">Pesquisar</button></div>
    </div>`;
  }

  // ---- ÁRVORE ----
  function laneOf(t) {
    const e = t.eff, f = e.flags || {};
    if (e.era) return 3;
    if (f.seaRange || f.overseasDiscount || f.range || f.rangeAdd || f.autoColonize || e.bodies || f.mountains || f.ice || f.autoExpand || (e.mult && e.mult.military && Object.keys(e.mult).length <= 2)) return 2;
    if (e.gov || e.pol || e.slots || (e.mult && (e.mult.knowledge || e.mult.culture)) || f.genes || f.autoResearch || f.diplomacy) return 1;
    return 0;
  }
  const LANES = ['Produção', 'Saber e Sociedade', 'Expansão e Poder'];
  UI.openTree = function () {
    const s = game.s;
    const NW = 168, NH = 50, CW = 3 * (NW + 22) + 26, TOP = 74;
    const pos = {};
    // grade: em cada era, cada ramo tem duas subcolunas (raízes à esquerda, dependentes à direita)
    const grid = G.ERAS.map((E, e) => {
      const techs = game.eraTechs(e);
      const depth = (t) => (t.req.length ? 1 + Math.max(...t.req.map((r) => (G.TECH[r].era === e ? depth(G.TECH[r]) : 0))) : 0);
      return [0, 1, 2].map((l) => {
        const arr = techs.filter((t) => !t.eff.era && laneOf(t) === l);
        let c0 = arr.filter((t) => depth(t) === 0), c1 = arr.filter((t) => depth(t) > 0);
        if (!c1.length && c0.length > 1) { c1 = c0.slice(Math.ceil(c0.length / 2)); c0 = c0.slice(0, Math.ceil(c0.length / 2)); }
        return [c0, c1];
      });
    });
    const rows = [0, 1, 2].map((l) => Math.max(1, ...grid.map((g) => Math.max(g[l][0].length, g[l][1].length))));
    const laneY = [TOP, TOP + rows[0] * (NH + 12) + 30, 0];
    laneY[2] = laneY[1] + rows[1] * (NH + 12) + 30;
    const bottom = laneY[2] + rows[2] * (NH + 12);
    const keyY = (TOP + bottom) / 2 - NH / 2;
    grid.forEach((g, e) => g.forEach((cols, l) => cols.forEach((col, ci) => col.forEach((t, ri) => { pos[t.id] = { x: e * CW + 20 + ci * (NW + 22), y: laneY[l] + ri * (NH + 12) }; }))));
    G.TECHS.filter((t) => t.eff.era).forEach((t) => { pos[t.id] = { x: t.era * CW + 20 + 2 * (NW + 22), y: keyY, key: true }; });
    { const last = game.eraTechs(11).find((t) => t.id === 'ascensao'); if (last) pos[last.id] = { x: 11 * CW + 20 + 2 * (NW + 22), y: keyY, key: true }; }
    const W = G.ERAS.length * CW + 40, H = bottom + 40;
    let lines = '';
    for (const t of G.TECHS) {
      const p = pos[t.id];
      if (!p) continue;
      const reqs = t.req.slice();
      if (t.eff.era) game.eraTechs(t.era).forEach((x) => { if (x !== t && !G.TECHS.some((y) => y.req.includes(x.id) && y.era === t.era)) reqs.push(x.id); });
      for (const r of reqs) {
        const q = pos[r];
        if (!q) continue;
        const done = s.techs[r] && s.techs[t.id];
        const x1 = q.x + NW, y1 = q.y + NH / 2, x2 = p.x, y2 = p.y + NH / 2;
        const back = x2 <= x1;
        const d = back ? `M${q.x + NW / 2} ${q.y + NH} C${q.x + NW / 2} ${y2} ${p.x + NW / 2} ${q.y + NH} ${p.x + NW / 2} ${p.y}` : `M${x1} ${y1} C${x1 + 24} ${y1} ${x2 - 24} ${y2} ${x2} ${y2}`;
        lines += `<path d="${d}" class="${done ? 'done' : ''}"/>`;
      }
    }
    // espinha entre marcos
    const keys = G.TECHS.filter((t) => t.eff.era);
    for (const k of keys) {
      const p = pos[k.id];
      const firsts = game.eraTechs(k.eff.era).filter((t) => !t.req.length && !t.eff.era);
      for (const f of firsts) { const q = pos[f.id]; if (!q) continue; lines += `<path class="spine ${s.techs[k.id] ? 'done' : ''}" d="M${p.x + NW} ${p.y + NH / 2} C${p.x + NW + 30} ${p.y + NH / 2} ${q.x - 30} ${q.y + NH / 2} ${q.x} ${q.y + NH / 2}"/>`; }
    }
    const nodes = G.TECHS.map((t) => {
      const p = pos[t.id];
      if (!p) return '';
      const st = game.techState(t);
      const known = t.era <= s.era + 1;
      return `<div class="tnode ${st} ${p.key ? 'key' : ''}" style="left:${p.x}px;top:${p.y}px;width:${NW}px;height:${NH}px" data-tipk="tech:${t.id}" ${st === 'open' ? `data-act="research" data-id="${t.id}"` : ''}>
        <b>${known ? esc(t.name) : '· · ·'}</b><small>${st === 'done' ? 'descoberta' : known ? G.fmt(game.techCost(t).knowledge) + ' saber' : ''}</small></div>`;
    }).join('');
    const heads = G.ERAS.map((E, e) => `<div class="thead ${e === s.era ? 'now' : e < s.era ? 'past' : ''}" style="left:${e * CW}px;width:${CW}px"><span>${ROMAN[e]}</span>${esc(E.name)}<small>${G.fmtYear(E.y0)}</small></div>`).join('');
    const lanes = LANES.map((n, l) => `<div class="tlane" style="top:${laneY[l] - 20}px">${n}</div>`).join('');
    const html = `<div class="tree-wrap"><div class="tree-head"><h2>Árvore do Conhecimento</h2><span class="hint">Clique numa tecnologia disponível para pesquisá-la. Cada era termina num marco que abre a seguinte.</span><span class="tk">Saber: <b id="treeK"></b></span><button class="btn ghost" data-act="close">${G.ICON.close} Fechar</button></div>
      <div class="tree-scroll"><div class="tree" style="width:${W}px;height:${H}px">${heads}<div class="lanes">${lanes}</div><svg width="${W}" height="${H}" class="tlinks">${lines}</svg>${nodes}</div></div></div>`;
    UI.modal(html, { cls: 'tree-modal', onOpen: (m) => {
      const sc = $('.tree-scroll', m);
      sc.scrollLeft = Math.max(0, s.era * CW - 60);
      const upd = () => { const el = $('#treeK', m); if (!el) return; el.textContent = G.fmt(game.s.res.knowledge); requestAnimationFrame(upd); };
      upd();
      // arrastar para rolar
      let drag = null;
      sc.addEventListener('pointerdown', (e) => { if (e.target.closest('.tnode')) return; drag = { x: e.clientX, y: e.clientY, l: sc.scrollLeft, t: sc.scrollTop }; });
      addEventListener('pointermove', (e) => { if (!drag) return; sc.scrollLeft = drag.l - (e.clientX - drag.x); sc.scrollTop = drag.t - (e.clientY - drag.y); });
      addEventListener('pointerup', () => (drag = null));
    }, onAct: (act, id) => { if (act === 'research' && game.research(id)) { UI.closeModal(); UI.openTree(); } } });
  };

  // ---- MARAVILHAS ----
  R.maravilhas = function () {
    const s = game.s;
    let h = `<div class="glory-head">${G.ICON.glory}<div><b id="${bind(() => game.d.glory)}"></b> maravilhas concluídas<br><small id="${bind(() => `Glória: +${Math.round(game.d.glory * G.GLORY_BONUS * 100)}% em toda a produção`)}"></small></div></div>`;
    h += '<p class="hint">Grandes obras em três etapas. Cada etapa já rende parte do bônus; a conclusão acrescenta Glória ao império.</p>';
    const order = [];
    for (let e = s.era; e >= 0; e--) order.push(e);
    if (s.era < 11) order.push(s.era + 1);
    for (const e of order) {
      const list = G.WONDERS.filter((w) => w.era === e);
      if (!list.length) continue;
      h += `<div class="era-label">${ROMAN[e]} · ${esc(G.ERAS[e].name)}</div>`;
      h += list.map((w) => {
        const st = game.wonderState(w), stage = game.wonderStage(w.id);
        if (st === 'future') return `<div class="wonder future"><div class="wn">${esc(w.name)}</div><div class="id">Disponível na ${esc(G.ERAS[w.era].name)}.</div></div>`;
        const pips = [0, 1, 2].map((i) => `<i class="${i < stage ? 'on' : ''}" title="${game.WSTAGE_NAMES[i]}"></i>`).join('');
        let act = '';
        if (st === 'done') act = `<div class="done-line">Concluída${s.wonders[w.id].year != null ? ' em ' + G.fmtYear(s.wonders[w.id].year) : ''}</div>`;
        else if (st === 'need') act = `<div class="id">${esc(game.needText(w.need))}</div>`;
        else { const c = game.wonderCost(w); act = `<div class="ia">${costHTML(c)}<button class="btn" data-act="wonder" data-id="${w.id}" id="${bind(() => ({ d: !afford(c) }))}">${stage === 0 ? 'Iniciar obras' : game.WSTAGE_NAMES[stage]}</button></div>`; }
        return `<div class="wonder ${st}"><div class="wh"><div class="wn">${esc(w.name)}</div><div class="pips">${pips}</div></div>
          <div class="id">${esc(w.desc)}</div><div class="ie">${effLines(w.eff).map(esc).join(' · ')}${w.where === 'sun' ? ' · visível no Sistema Solar' : w.where === 'galaxy' ? ' · visível na galáxia' : ''}</div>${act}</div>`;
      }).join('');
    }
    return h;
  };

  // ---- TERRITÓRIO ----
  R.territorio = function () {
    const s = game.s, f = game.frontier();
    const best = game.bestTile();
    const tc = memo(() => { const b = game.bestTile(); return b >= 0 ? game.tileCost(b) : { food: Infinity }; });
    let h = sec('Terras', `
      <div class="kv"><span>Territórios</span><b id="${bind(() => G.fmtInt(game.ownedLand))}"></b></div>
      <div class="kv"><span>Da terra firme do planeta</span><b id="${bind(() => (game.landFrac() * 100).toFixed(1).replace('.', ',') + '%')}"></b></div>
      <div class="kv"><span>Fronteira disponível</span><b>${f.land.length + f.sea.length} terras${f.sea.length ? ` (${f.sea.length} além-mar)` : ''}</b></div>
      <div class="kv"><span>Alcance no mar</span><b>${game.seaRange() >= 999 ? 'oceânico' : game.seaRange() ? game.seaRange() + ' hexágonos' : 'nenhum'}</b></div>
      ${best >= 0 ? `<div class="ia">${costHTML(tc)}<button class="btn" data-act="expand" id="${bind(() => ({ d: !afford(tc) }))}">Anexar terra</button></div>` : '<p class="hint">Nenhuma terra livre ao alcance. Integre povos vizinhos ou aprenda a navegar.</p>'}
      <p class="hint">Também é possível clicar numa terra da fronteira no mapa.</p>
      <label class="toggle"><input type="checkbox" data-auto="culture" ${s.auto.culture ? 'checked' : ''}> Expansão cultural <small>(a cultura atrai terras vizinhas sozinha)</small></label>
      ${game.d.fl.autoExpand ? `<label class="toggle"><input type="checkbox" data-auto="expand" ${s.auto.expand ? 'checked' : ''}> Expansão automática <small>(usa alimento e materiais)</small></label>` : ''}`);
    // povos
    const seen = new Set();
    for (let i = 0; i < game.owner.length; i++) if (game.owner[i] > 0 && game.explored[i]) seen.add(game.owner[i]);
    const alive = s.rivals.filter((r) => r.alive && seen.has(r.id)).sort((a, b) => (f.touch.has(b.id) - f.touch.has(a.id)) || game.rivalTiles[b.id] - game.rivalTiles[a.id]);
    const rows = alive.map((rv) => {
      const near = f.touch.has(rv.id);
      const cm = memo(() => game.rivalCost(rv.id, 'military')), cc = memo(() => game.rivalCost(rv.id, 'culture'));
      return `<div class="rival ${near ? '' : 'far'}">
        <div class="rh"><i class="sw" style="background:${rv.color}"></i><b>${esc(game.rivalName(rv))}</b><span class="cnt">${game.rivalTiles[rv.id]} terras</span></div>
        ${rv.campaign ? '<div class="id">Sendo incorporado ao império…</div>' : !near ? '<div class="id">Sem fronteira com o nosso povo.</div>' : s.era < 1 ? '<div class="id">Ainda somos poucos demais para isso.</div>' : `
        <div class="ia">${costHTML(cc)}<button class="btn" data-act="annex" data-id="${rv.id}" data-mode="culture" id="${bind(() => ({ d: !afford(cc) }))}">Integrar</button></div>
        ${s.era >= 1 ? `<div class="ia">${costHTML(cm)}<button class="btn war" data-act="annex" data-id="${rv.id}" data-mode="military" id="${bind(() => ({ d: !afford(cm) }))}">Conquistar</button></div>` : ''}
        ${game.partCount(rv.id) < game.rivalTiles[rv.id] ? (() => { const pc = memo(() => game.rivalPartCost(rv.id, 'culture')), pm = memo(() => game.rivalPartCost(rv.id, 'military')); return `<div class="part"><span class="pl">Só a fronteira (${game.partCount(rv.id)} terras)</span>${rv.partBusy ? '<span class="id">em andamento…</span>' : `<div class="ia">${costHTML(pc)}<button class="btn sm" data-act="annexpart" data-id="${rv.id}" data-mode="culture" id="${bind(() => ({ d: !afford(pc) }))}">Influenciar</button></div><div class="ia">${costHTML(pm)}<button class="btn sm war" data-act="annexpart" data-id="${rv.id}" data-mode="military" id="${bind(() => ({ d: !afford(pm) }))}">Tomar</button></div>`}</div>`; })() : ''}`}
      </div>`;
    }).join('');
    h += sec(`Povos conhecidos <small>${alive.length}</small>`, rows || '<p class="hint">Nenhum outro povo à vista.</p>');
    const gone = s.rivals.filter((r) => !r.alive);
    if (gone.length) h += sec(`Povos incorporados <small>${gone.length}</small>`, `<p class="gone">${gone.map((r) => esc(r.name)).join(' · ')}</p>`);
    return h;
  };

  // ---- GOVERNO ----
  R.governo = function () {
    const s = game.s, d = game.d;
    const gc = memo(() => game.changeCost(60)), pc = memo(() => game.changeCost(30));
    let h = sec('Forma de governo', `<div class="gov-now"><b>${esc(G.GOV[s.gov].name)}</b><p>${esc(G.GOV[s.gov].desc)}</p><div class="ie">${effLines(G.GOV[s.gov].eff).map(esc).join(' · ')}</div></div>
      ${G.GOVS.filter((g) => d.govs.has(g.id) && g.id !== s.gov).map((g) => `<div class="item"><div class="ih"><b>${esc(g.name)}</b><span class="tag">${esc(g.title)}</span></div><div class="id">${esc(g.desc)}</div><div class="ie">${effLines(g.eff).map(esc).join(' · ')}</div><div class="ia">${costHTML(gc)}<button class="btn" data-act="gov" data-id="${g.id}" id="${bind(() => ({ d: !afford(gc) }))}">Adotar</button></div></div>`).join('')}
      ${d.govs.size <= 1 ? '<p class="hint">Novas formas de governo surgem com as tecnologias.</p>' : ''}`);
    const pols = G.POLICIES.filter((p) => d.pols.has(p.id));
    h += sec(`Políticas <small>${s.policies.length} de ${d.slots}</small>`, d.slots === 0 ? '<p class="hint">A Chefia, no Neolítico, abre o primeiro espaço de política.</p>' :
      pols.map((p) => { const on = s.policies.includes(p.id); return `<div class="policy ${on ? 'on' : ''}"><div class="ih"><b>${esc(p.name)}</b>${on ? '<span class="tag">em vigor</span>' : ''}</div><div class="id">${esc(p.desc)}</div><div class="ie">${effLines(p.eff).map(esc).join(' · ')}</div>
        <div class="ia">${on ? '<span></span><button class="btn ghost" data-act="policy" data-id="' + p.id + '">Revogar</button>' : costHTML(pc) + `<button class="btn" data-act="policy" data-id="${p.id}" id="${bind(() => ({ d: !afford(pc) || game.s.policies.length >= game.d.slots }))}">Adotar</button>`}</div></div>`; }).join(''));
    return h;
  };

  // ---- HUMANIDADE ----
  R.humanidade = function () {
    const s = game.s;
    let h = '<p class="hint lead">A engenharia genética abre um novo caminho: em vez de mudar o mundo para caber em nós, mudamos a nós mesmos para caber no universo.</p>';
    h += G.GENES.map((x) => {
      const st = game.geneState(x);
      const c = game.geneCost(x);
      return `<div class="gene ${st}"><div class="ih"><b>${esc(x.name)}</b><span class="tag">${ROMAN[x.era]}</span></div><div class="id">${esc(x.desc)}</div><div class="ie">${effLines(x.eff).map(esc).join(' · ')}</div>
        ${st === 'done' ? '<div class="done-line">Incorporada ao genoma humano</div>' : st === 'open' ? `<div class="ia">${costHTML(c)}<button class="btn" data-act="gene" data-id="${x.id}" id="${bind(() => ({ d: !afford(c) }))}">Aplicar</button></div>` : `<div class="id">${st === 'future' ? 'Disponível na ' + esc(G.ERAS[x.era].name) : 'Requer ' + esc(x.req.map((r) => G.GENE[r].name).join(' e '))}</div>`}</div>`;
    }).join('');
    return h;
  };

  // ---- COSMOS ----
  R.cosmos = function () {
    let h = `<button class="btn wide" data-act="view" data-id="solar">Ver o Sistema Solar</button>`;
    const list = G.BODIES.filter((b) => game.bodyUnlocked(b));
    if (!list.length) h += '<p class="hint">Pesquise Constelações de Satélites para dar o primeiro passo.</p>';
    h += list.map((b) => bodyCard(b)).join('');
    const lockedN = G.BODIES.length - list.length;
    if (lockedN) h += `<p class="hint">${lockedN} destinos ainda fora de alcance.</p>`;
    return h;
  };
  function bodyCard(b) {
    const st = game.bodyStage(b.id), max = game.bodyMaxStage(b);
    const pips = Array.from({ length: max }, (_, i) => `<i class="${i < st ? 'on' : ''}"></i>`).join('');
    const c = st < max ? game.bodyCost(b, st) : null;
    const lvl = Math.max(0, st - 2);
    return `<div class="body-card" data-act="selbody" data-id="${b.id}"><div class="ih"><b>${esc(b.name)}</b><span class="tag">${esc(game.stageLabel(b, st))}</span></div>
      <div class="id">${esc(b.desc)}</div><div class="pips">${pips}</div>
      <div class="ie">${lvl ? 'Agora: ' + effLines(b.eff.mult ? { mult: b.eff.mult } : {}, lvl).map(esc).join(' · ') + (b.eff.cap ? ` · +${G.fmt(b.eff.cap * lvl)} habitantes` : '') : 'Colônia: ' + effLines(b.eff.mult ? { mult: b.eff.mult } : {}).map(esc).join(' · ') + (b.eff.cap ? ` · +${G.fmt(b.eff.cap)} habitantes por nível` : '')}</div>
      ${c ? `<div class="ia">${costHTML(c)}<button class="btn" data-act="body" data-id="${b.id}" id="${bind(() => ({ d: !afford(c) }))}">${game.actionLabel(b, st)}</button></div>` : '<div class="done-line">Totalmente desenvolvido</div>'}</div>`;
  }
  UI.bodyCard = bodyCard;

  // ---- GALÁXIA ----
  R.galaxia = function () {
    const s = game.s;
    if (!game.gal) return '<p class="hint">A galáxia ainda está fora de alcance.</p>';
    const f = game.galFrontier();
    let best = null, bc = Infinity;
    for (const x of f) { const c = game.sysCost(x.j, x.d).materials; if (c < bc) { bc = c; best = x; } }
    let h = `<button class="btn wide" data-act="view" data-id="galaxy">Ver a galáxia</button>`;
    h += sec('Expansão estelar', `
      <div class="kv"><span>Sistemas humanos</span><b id="${bind(() => `${game.galCount} de ${game.gal.sys.length}`)}"></b></div>
      <div class="bar"><i id="${bind(() => ({ w: game.galFrac() * 100 + '%' }))}"></i></div>
      <div class="kv"><span>Alcance</span><b>${game.galRange() > 1e8 ? 'ilimitado' : Math.round(game.galRange()) + ' anos-luz'}</b></div>
      <div class="kv"><span>Ao alcance</span><b>${f.length} sistemas livres</b></div>
      ${best ? (() => { const sc = memo(() => game.sysCost(best.j, best.d)); return `<div class="ia">${costHTML(sc)}<button class="btn" data-act="colonize" id="${bind(() => ({ d: !afford(sc) }))}">Colonizar ${esc(game.gal.sys[best.j].name)}</button></div>`; })() : '<p class="hint">Nenhum sistema livre ao alcance. Pesquise propulsão melhor.</p>'}
      ${game.d.fl.autoColonize ? `<label class="toggle"><input type="checkbox" data-auto="colonize" ${s.auto.colonize ? 'checked' : ''}> Sondas de Von Neumann colonizam sozinhas</label>` : ''}`);
    const al = s.galaxy.aliens.map((a, k) => ({ a, A: G.ALIENS[k], k }));
    h += sec('Espécies', al.map(({ a, A, k }) => {
      if (!a.contact) return `<div class="alien unknown"><b>Sinal desconhecido</b><div class="id">Ainda não fizemos contato.</div></div>`;
      const cnt = game.alienSys[k + 1];
      const rel = Math.round(a.rel);
      const status = a.gone ? (a.how === 'integração' ? 'Integrados à humanidade' : 'Conquistados') : a.war ? 'Em guerra' : a.allied ? 'Aliados' : rel > 30 ? 'Amistosos' : rel < -30 ? 'Hostis' : 'Neutros';
      const acts = game.alienActions(a);
      return `<div class="alien ${a.war ? 'war' : ''} ${a.gone ? 'gone' : ''}"><div class="rh"><i class="sw" style="background:${A.color}"></i><b>${esc(A.full)}</b><span class="tag">${status}</span></div>
        <div class="id">${esc(A.desc)}</div>
        ${a.gone ? '' : `<div class="kv"><span>Sistemas</span><b>${cnt}</b></div><div class="rel"><span>Relação</span><div class="relbar"><i style="left:${(rel + 100) / 2}%"></i></div><b>${rel > 0 ? '+' : ''}${rel}</b></div>
        <div class="ie">Aliança: ${effLines(A.ally).map(esc).join(' · ')}</div>
        ${acts.map((x) => `<div class="ia">${costHTML(memo(() => { const y = game.alienActions(a).find((z) => z.id === x.id); return y ? y.cost : x.cost; }))}<button class="btn ${x.danger ? 'war' : ''}" data-act="alien" data-id="${A.id}" data-x="${x.id}" data-tip="${esc(x.desc)}" ${x.ok ? `id="${bind(() => { const y = game.alienActions(a).find((z) => z.id === x.id); return { d: !y || !y.ok || !afford(y.cost) }; })}"` : 'disabled'}>${esc(x.name)}</button></div>`).join('')}`}</div>`;
    }).join(''));
    return h;
  };

  // ---- CRÔNICA ----
  R.cronica = function () {
    const s = game.s;
    return `<div class="chron">${s.chronicle.map((c) => `<div class="ce ${c.k}"><span class="cy">${G.fmtYear(c.y)}</span><p>${esc(c.t)}</p></div>`).join('')}</div>`;
  };

  // ---- IMPÉRIO ----
  R.imperio = function () {
    const s = game.s;
    let h = `<div class="emp-card">${G.flagSVG(s.flag, 120, 80)}<div><div class="emp-big">${esc(game.empireName())}</div><div class="id">Capital: ${esc((s.settlements.find((x) => x.capital && x.owner === 0) || {}).name || '—')}</div><button class="btn ghost sm" data-act="editflag">Editar bandeira e nome</button></div></div>`;
    const st = s.stats;
    h += sec('Registro', `
      <div class="kv"><span>Tempo de jogo</span><b id="${bind(() => G.fmtTime(game.s.stats.played))}"></b></div>
      <div class="kv"><span>Maior população</span><b>${G.fmtInt(st.peakPop)}</b></div>
      <div class="kv"><span>Terras anexadas</span><b>${G.fmtInt(st.tilesClaimed)}</b></div>
      <div class="kv"><span>Povos incorporados</span><b>${st.absorbed}</b></div>
      <div class="kv"><span>Tecnologias</span><b>${Object.keys(s.techs).length} de ${G.TECHS.length}</b></div>
      <div class="kv"><span>Maravilhas</span><b>${game.d.glory} de ${G.WONDERS.length}</b></div>`);
    h += sec(`Marcos <small>${Object.keys(s.milestones).length} de ${G.MILESTONES.length}</small>`, `<div class="miles">${G.MILESTONES.map((m) => `<span class="mile ${s.milestones[m.id] != null ? 'on' : ''}" data-tip="${esc(m.desc)}${s.milestones[m.id] != null ? ' — ' + G.fmtYear(s.milestones[m.id]) : ''}">${esc(m.name)}</span>`).join('')}</div>`);
    h += sec('Arquivo', UI.saveMenuHTML());
    return h;
  };

  // ---------------- ações ----------------
  const ACT = {
    tab: (d) => UI.setTab(d.id),
    buy: (d) => game.buy(d.id, 1),
    buymax: (d) => game.buy(d.id, game.maxBuy(d.id)),
    research: (d) => game.research(d.id),
    tree: () => UI.openTree(),
    wonder: (d) => game.buildWonder(d.id),
    expand: () => game.expand(),
    annex: (d) => game.annex(+d.id, d.mode),
    annexpart: (d) => game.annexPart(+d.id, d.mode),
    gov: (d) => game.setGov(d.id),
    policy: (d) => game.togglePolicy(d.id),
    gene: (d) => game.buyGene(d.id),
    body: (d) => game.advanceBody(d.id),
    selbody: (d, e) => { if (e.target.closest('button')) return; G.main.setView('solar'); G.spaceview.solar.sel = d.id; },
    colonize: () => game.colonizeBest(),
    alien: (d) => game.alienAct(d.id, d.x),
    effort: (d) => game.effort(d.id),
    goto: (d) => { G.main.setView('earth'); const [x, y] = G.hexCenter(+d.id); G.mapview.flyTo(x, y, Math.max(G.mapview.cam.z, 2.6), 1.2); },
    view: (d) => G.main.setView(d.id),
    save: () => { game.save(); UI.toast('Jogo salvo'); },
    menu: () => UI.modal('<h2>Jogo</h2>' + UI.saveMenuHTML() + '<div class="btnrow"><button class="btn ghost" data-act="close">Fechar</button></div>', { onAct: (a, id, el) => { if (ACT[a]) { UI.closeModal(); ACT[a](el.dataset); } } }),
    download: () => {
      const str = game.serialize();
      const blob = new Blob([str], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      const nm = (game.s.civName || 'imperio').normalize('NFD').replace(/[^A-Za-z0-9]+/g, '-').toLowerCase();
      a.download = 'fogueira-' + nm + '-' + new Date().toISOString().slice(0, 10) + '.json';
      document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
      UI.toast('Save baixado: ' + a.download);
    },
    upload: () => {
      const inp = document.createElement('input');
      inp.type = 'file'; inp.accept = '.json,.txt,application/json,text/plain';
      inp.onchange = () => {
        const f = inp.files && inp.files[0];
        if (!f) return;
        const rd = new FileReader();
        rd.onload = () => { const txt = String(rd.result || ''); let data = null; try { data = JSON.parse(txt); } catch (e) { data = game.importStr(txt); } UI.confirmLoad(data); };
        rd.readAsText(f);
      };
      inp.click();
    },
    export: () => { const str = game.exportStr(); UI.modal('<h2>Código do save</h2><p class="hint">Guarde este texto (num bloco de notas, num e-mail…). Ele contém todo o seu império e pode ser colado em outro navegador ou no celular.</p><textarea class="io" readonly>' + str + '</textarea><div class="btnrow"><button class="btn" data-act="copy">Copiar</button><button class="btn ghost" data-act="close">Fechar</button></div>', { onAct: (a) => { if (a === 'copy') { try { navigator.clipboard.writeText(str); UI.toast('Código copiado'); } catch (e) { UI.toast('Selecione o texto e copie', 'bad'); } } } }); },
    import: () => UI.modal('<h2>Colar código do save</h2><p class="hint">Cole o código copiado antes. O império atual será substituído.</p><textarea class="io" id="impTxt"></textarea><div class="btnrow"><button class="btn" data-act="doimport">Carregar</button><button class="btn ghost" data-act="close">Cancelar</button></div>', { onAct: (a) => { if (a === 'doimport') { const txt = $('#impTxt').value; let data = game.importStr(txt); if (!data) { try { data = JSON.parse(txt); } catch (e) {} } UI.closeModal(); UI.confirmLoad(data); } } }),
    wipe: () => UI.modal(`<h2>Começar um novo mundo?</h2><p>O império atual será apagado para sempre. Exporte antes se quiser guardá-lo.</p><div class="btnrow"><button class="btn war" data-act="dowipe">Apagar e recomeçar</button><button class="btn ghost" data-act="close">Cancelar</button></div>`, { onAct: (a) => { if (a === 'dowipe') { game.wipe(); location.reload(); } } }),
    editflag: () => UI.empireEditor(),
  };
  function onClick(e) {
    const el = e.target.closest('[data-act]');
    if (!el || el.disabled) return;
    const fn = ACT[el.dataset.act];
    if (!fn) return;
    const act = el.dataset.act;
    fn(el.dataset, e);
    if (act === 'expand' || act === 'annex' || act === 'annexpart') G.mapview.terrDirty = true;
    // ações que mudam a aba atual: redesenha já, sem esperar o próximo ciclo
    const noRender = { tab: 1, tree: 1, menu: 1, editflag: 1, export: 1, import: 1, wipe: 1, upload: 1, download: 1, view: 1, goto: 1, selbody: 1 };
    if (!noRender[act]) UI.renderTab();
    else UI.dirtyTab = true;
    UI.refresh();
  }
  UI.wire = function () {
    setupTip();
    document.getElementById('hud').addEventListener('click', onClick);
    const panel = document.getElementById('panel');
    panel.addEventListener('click', onClick);
    panel.addEventListener('pointerdown', () => (UI.panelDown = true));
    addEventListener('pointerup', () => setTimeout(() => (UI.panelDown = false), 60));
    panel.addEventListener('input', (e) => {
      const t = e.target;
      if (t.dataset.weight) { game.s.weights[t.dataset.weight] = +t.value; game.rates(); }
      if (t.dataset.margin) { game.s.margin = +t.value / 100; game.rates(); }
      UI.refresh();
    });
    panel.addEventListener('change', (e) => {
      const t = e.target;
      if (t.dataset.auto) { game.s.auto[t.dataset.auto] = t.checked; }
    });
    $('#ticker').addEventListener('click', () => UI.setTab('cronica'));
    $('#notice').addEventListener('click', () => UI.openNotice());
    $('#panel-toggle').addEventListener('click', () => document.body.classList.toggle('panel-open'));
  };

  // ---------------- erros visíveis ----------------
  UI.reportError = function (msg) {
    if (UI._errShown) return;
    UI._errShown = true;
    const d = document.createElement('div');
    d.className = 'errbox';
    d.innerHTML = '<b>Algo deu errado.</b><span>' + esc(msg) + '</span><small>Tire um print desta mensagem e mande para quem fez o jogo. Recarregar a página costuma resolver.</small><button class="btn sm">Fechar</button>';
    d.querySelector('button').onclick = () => d.remove();
    document.body.appendChild(d);
  };
  UI.fatal = function (msg) {
    const ld = document.getElementById('loading');
    if (ld) { ld.hidden = false; ld.querySelector('span').textContent = msg; }
    UI.reportError(msg);
  };

  UI.diagnostic = function () {
    if (document.querySelector('.diag')) return;
    const M = G.main, MV = G.mapview;
    const info = [
      'etapa: ' + (MV.stage || 'nenhuma'),
      'progresso: ' + Math.round((M.loadProg || 0) * 100) + '%',
      'tempo: ' + Math.round((performance.now() - (M.loadStart || 0)) / 1000) + 's',
      'resolução do mapa: ' + MV.TS + (MV.simple ? ' (modo simples)' : ''),
      'tela: ' + innerWidth + '×' + innerHeight + ' @' + (window.devicePixelRatio || 1),
      'navegador: ' + navigator.userAgent,
      'erros: ' + (M.errors && M.errors.length ? M.errors.join(' | ') : 'nenhum'),
    ].join(String.fromCharCode(10));
    const d = document.createElement('div');
    d.className = 'diag';
    d.innerHTML = '<b>O mapa está demorando mais que o normal.</b><p>Tente o modo simples (desenho mais leve). Se não resolver, copie o diagnóstico e mande para quem fez o jogo.</p><pre>' + esc(info) + '</pre><div class="btnrow"><button class="btn" data-d="simples">Usar modo simples</button><button class="btn ghost" data-d="copiar">Copiar diagnóstico</button></div>';
    d.onclick = (e) => {
      const b = e.target.closest('[data-d]');
      if (!b) return;
      if (b.dataset.d === 'simples') { d.remove(); M.simpleMode(); }
      if (b.dataset.d === 'copiar') { try { navigator.clipboard.writeText(info); b.textContent = 'Copiado!'; } catch (er) { b.textContent = 'Selecione o texto acima'; } }
    };
    document.getElementById('stage').appendChild(d);
  };

  // ---------------- arquivo do jogo ----------------
  UI.saveMenuHTML = () => '<p class="hint">O jogo salva sozinho a cada 20 segundos neste navegador e continua de onde parou quando você volta.</p>' +
    '<div class="savegrid">' +
    '<button class="btn" data-act="save">' + G.ICON.save + ' Salvar agora</button>' +
    '<button class="btn" data-act="download">Baixar save (arquivo)</button>' +
    '<button class="btn" data-act="upload">Carregar save (arquivo)</button>' +
    '<button class="btn ghost" data-act="export">Copiar código do save</button>' +
    '<button class="btn ghost" data-act="import">Colar código do save</button>' +
    '<button class="btn war ghost" data-act="wipe">Começar um novo mundo</button>' +
    '</div>';
  UI.confirmLoad = function (data) {
    if (!data || !data.s || data.s.seed == null) { UI.toast('Esse arquivo não é um save válido do jogo', 'bad'); return; }
    const s = data.s;
    const quando = s.savedAt ? new Date(s.savedAt).toLocaleString('pt-BR') : 'data desconhecida';
    const kv = (k, v) => '<div class="kv"><span>' + k + '</span><b>' + v + '</b></div>';
    UI.modal('<h2>Carregar este império?</h2>' + kv('Povo', esc(s.civName || '?')) + kv('Era', esc((G.ERAS[s.era] || {}).name || '?')) + kv('Ano', G.fmtYear(s.year || 0)) + kv('População', G.fmt(s.pop || 0)) + kv('Salvo em', esc(quando)) +
      '<p class="hint">O império atual será substituído. Se quiser guardá-lo, baixe o save dele antes.</p><div class="btnrow"><button class="btn" data-act="doload">Carregar</button><button class="btn ghost" data-act="close">Cancelar</button></div>',
    { onAct: (a) => { if (a === 'doload') { UI.closeModal(); G.main.loadData(data); } } });
  };

  // ---------------- modais ----------------
  UI.modal = function (html, opts) {
    opts = opts || {};
    const m = $('#modal');
    m.className = 'modal ' + (opts.cls || '');
    m.innerHTML = `<div class="mbox">${html}</div>`;
    m.hidden = false;
    m.onclick = (e) => {
      if (e.target === m && !opts.locked) { UI.closeModal(); return; }
      const el = e.target.closest('[data-act]');
      if (!el || el.disabled) return;
      if (el.dataset.act === 'close') { UI.closeModal(); return; }
      if (opts.onAct) opts.onAct(el.dataset.act, el.dataset.id, el);
    };
    if (opts.onOpen) opts.onOpen(m);
    UI.modalOpen = true;
  };
  UI.closeModal = function () { const m = $('#modal'); m.hidden = true; m.innerHTML = ''; UI.modalOpen = false; if (UI.afterModal) { const f = UI.afterModal; UI.afterModal = null; f(); } };

  UI.toast = function (text, kind) {
    const t = document.createElement('div');
    t.className = 'toast ' + (kind || '');
    t.textContent = text;
    $('#toasts').appendChild(t);
    setTimeout(() => t.classList.add('out'), 4200);
    setTimeout(() => t.remove(), 5000);
  };

  UI.updateTicker = function () {
    const s = game.s;
    $('#ticker').innerHTML = s.chronicle.slice(0, 3).map((c, i) => `<div class="tk ${c.k}" style="opacity:${1 - i * 0.28}"><span>${G.fmtYear(c.y)}</span>${esc(c.t)}</div>`).join('');
  };

  // avisos (evento pendente / contato)
  UI.updateNotice = function () {
    const s = game.s, n = $('#notice');
    if (s.contactQueue && s.contactQueue.length) { n.hidden = false; n.innerHTML = `<b>Primeiro contato</b><span>Um sinal foi respondido.</span>`; n.className = 'notice alien'; return; }
    if (s.event) { const ev = G.EVENTS.find((e) => e.id === s.event); n.hidden = false; n.innerHTML = `<b>${esc(ev.title)}</b><span>Uma decisão aguarda o seu povo.</span>`; n.className = 'notice'; return; }
    n.hidden = true;
  };
  UI.openNotice = function () {
    const s = game.s;
    if (s.contactQueue && s.contactQueue.length) { UI.contact(s.contactQueue[0]); return; }
    if (s.event) UI.eventModal();
  };
  UI.eventModal = function () {
    const s = game.s;
    const ev = G.EVENTS.find((e) => e.id === s.event);
    if (!ev) return;
    UI.modal(`<div class="letter"><div class="ly">${G.fmtYear(s.year)}</div><h2>${esc(ev.title)}</h2><p>${esc(ev.text)}</p>
      <div class="choices">${ev.choices.map((c, i) => `<button class="choice" data-act="choose" data-id="${i}"><b>${esc(c.t)}</b><small>${esc(c.d.replace(/(d+)s de /g, (m, n) => (n % 60 === 0 ? n / 60 + ' min de ' : n + ' s de ')))}</small></button>`).join('')}</div>
      <button class="btn ghost sm later" data-act="close">Decidir depois</button></div>`, { cls: 'event-modal', onAct: (a, id) => { if (a === 'choose') { game.chooseEvent(+id); UI.closeModal(); UI.updateNotice(); } } });
  };
  function sigil(A) {
    const r = G.rng(A.id.length * 997 + A.id.charCodeAt(0));
    let p = '';
    const n = 3 + Math.floor(r() * 4);
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; p += `<circle cx="${50 + Math.cos(a) * 26}" cy="${50 + Math.sin(a) * 26}" r="${5 + r() * 7}"/>`; }
    p += `<circle cx="50" cy="50" r="${10 + r() * 8}" fill="none" stroke-width="3"/>`;
    if (r() < 0.6) p += `<path d="M50 ${12 + r() * 10} L50 ${78 + r() * 10}" stroke-width="2.4"/>`;
    return `<svg viewBox="0 0 100 100" width="120" height="120" fill="${A.color}" stroke="${A.color}">${p}</svg>`;
  }
  UI.contact = function (id) {
    const A = G.ALIEN[id];
    UI.modal(`<div class="contact"><div class="sig">${sigil(A)}</div><div class="ct-k">Primeiro contato</div><h2>${esc(A.full)}</h2><p>${esc(A.desc)}</p><blockquote>“${esc(A.greet)}”</blockquote>
      <p class="hint">Temperamento: ${esc(A.temper)}. Abra a aba Galáxia para a diplomacia.</p><div class="btnrow"><button class="btn" data-act="ok">Registrar na crônica</button></div></div>`,
    { cls: 'contact-modal', locked: true, onAct: (a) => { if (a === 'ok') { game.s.contactQueue.shift(); UI.closeModal(); UI.updateNotice(); } } });
  };

  // ---------------- nota discreta de nova era ----------------
  UI.eraNote = function (e) {
    const E = G.ERAS[e], el = $('#eranote');
    el.innerHTML = `<div class="en-k">${e === 0 ? 'O começo' : 'Nova era'} · ${ROMAN[e]}</div><div class="en-n">${esc(E.name)}<small>${G.fmtYear(game.s.year)}</small></div><p>${esc(E.text)}</p>`;
    el.hidden = false;
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('show')));
    clearTimeout(UI._enT);
    const hide = () => { el.classList.remove('show'); setTimeout(() => { if (!el.classList.contains('show')) el.hidden = true; }, 1300); };
    UI._enT = setTimeout(hide, 16000);
    el.onclick = hide;
  };

  // ---------------- cinematográfica de era (não usada) ----------------
  UI.cinematic = function (e, cb) {
    const E = G.ERAS[e];
    const c = $('#cine');
    c.innerHTML = `<div class="cine-in"><div class="cn">${ROMAN[e]}</div><div class="ck">Começa a</div><h1>${esc(E.name)}</h1><div class="cyear">${G.fmtYear(E.y0)}</div><p>${esc(E.text)}</p><button class="btn" data-act="go">Continuar</button></div>`;
    c.hidden = false;
    requestAnimationFrame(() => c.classList.add('show'));
    let done = false;
    const close = () => { if (done) return; done = true; c.classList.remove('show'); setTimeout(() => { c.hidden = true; }, 900); cb && cb(); };
    c.onclick = (ev) => { if (ev.target.closest('[data-act="go"]')) close(); };
    setTimeout(close, 14000);
  };

  // ---------------- editor de bandeira ----------------
  UI.flagEditorHTML = function (f) {
    const pat = G.FLAG_PATTERNS.map((p) => `<button class="fp ${f.pattern === p ? 'on' : ''}" data-fp="${p}">${G.flagSVG(Object.assign({}, f, { pattern: p, emblem: 'nenhum' }), 42, 28)}</button>`).join('');
    const colRow = (k, label) => `<div class="fc-row"><span>${label}</span>${G.FLAG_COLORS.map((c) => `<button class="fc ${f[k] === c.id ? 'on' : ''}" data-fc="${k}" data-v="${c.id}" style="background:${c.hex}" title="${c.name}"></button>`).join('')}</div>`;
    const em = Object.keys(G.EMBLEMS).map((k) => `<button class="fe ${f.emblem === k ? 'on' : ''}" data-fe="${k}" title="${G.EMBLEMS[k].name}"><svg viewBox="0 0 40 40" width="26" height="26" fill="currentColor" stroke="currentColor">${G.EMBLEMS[k].svg || '<path d="M8 8l24 24M32 8L8 32" stroke-width="2"/>'}</svg></button>`).join('');
    return `<div class="flag-editor"><div class="fprev">${G.flagSVG(f, 180, 120)}</div><div class="fopts">
      <div class="fgroup"><span class="fl">Campo</span><div class="fps">${pat}</div></div>
      ${colRow('c1', 'Cor 1')}${colRow('c2', 'Cor 2')}${colRow('c3', 'Cor 3')}
      <div class="fgroup"><span class="fl">Emblema</span><div class="fes">${em}</div></div>
      ${colRow('ec', 'Emblema')}
      <button class="btn ghost sm" data-frand="1">${G.ICON.dice} Sortear</button></div></div>`;
  };
  UI.wireFlagEditor = function (root, f, onChange) {
    root.addEventListener('click', (e) => {
      const b = e.target.closest('[data-fp],[data-fc],[data-fe],[data-frand]');
      if (!b) return;
      if (b.dataset.fp) f.pattern = b.dataset.fp;
      if (b.dataset.fc) f[b.dataset.fc] = b.dataset.v;
      if (b.dataset.fe) f.emblem = b.dataset.fe;
      if (b.dataset.frand) Object.assign(f, G.defaultFlag());
      const host = root.querySelector('.flag-editor');
      host.outerHTML = UI.flagEditorHTML(f);
      onChange && onChange(f);
    });
  };
  UI.empireEditor = function () {
    const s = game.s;
    const f = Object.assign({}, s.flag);
    UI.modal(`<h2>Bandeira e nome</h2><div class="fe-host">${UI.flagEditorHTML(f)}</div>
      <div class="form-row"><label>Nome do povo<input id="eName" maxlength="24" value="${esc(s.civName)}"></label><label>Título <small>(vazio = conforme o governo)</small><input id="eTitle" maxlength="28" placeholder="${esc((() => { const c = s.customTitle; s.customTitle = null; const t = game.empireTitle(); s.customTitle = c; return t; })())}" value="${esc(s.customTitle || '')}"></label></div>
      <div class="btnrow"><button class="btn" data-act="okflag">Guardar</button><button class="btn ghost" data-act="close">Cancelar</button></div>`, {
      cls: 'flag-modal',
      onOpen: (m) => UI.wireFlagEditor($('.fe-host', m), f),
      onAct: (a) => {
        if (a !== 'okflag') return;
        s.flag = f;
        s.color = G.flagMapColor(f);
        const nm = $('#eName').value.trim();
        if (nm) s.civName = nm;
        s.customTitle = $('#eTitle').value.trim() || null;
        G.mapview.terrDirty = true;
        UI.closeModal();
        UI.buildHUD();
        UI.dirtyTab = true;
      },
    });
  };

  // ---------------- tela inicial ----------------
  const VOICE_NAMES = { rio: 'Dos rios', mar: 'Do mar', gelo: 'Do norte gelado', sol: 'Do sol alto', estepe: 'Das estepes', mata: 'Da mata', jade: 'Do oriente', deserto: 'Do deserto' };
  UI.showStart = function (hasSave, onNew, onContinue) {
    const st = $('#start');
    st.hidden = false;
    const r = Math.random;
    const opts = { seed: Math.floor(r() * 1e9), voice: Math.floor(r() * 8), flag: G.defaultFlag(), civName: '' };
    const voiceNames = (v) => { const rr = G.rng(v * 13 + 5); return [0, 1, 2].map(() => G.makeName(rr, v)).join(', '); };
    opts.civName = G.makeName(G.rng(opts.seed), opts.voice);
    const render = () => {
      st.innerHTML = `<canvas id="fire"></canvas><div class="start-in">
        <div class="title"><div class="tk">um jogo sobre a humanidade</div><h1>Da Fogueira<br>às Estrelas</h1></div>
        ${hasSave ? `<div class="cont"><button class="btn big" data-s="continue">Continuar o império</button><span class="hint">ou funde uma nova civilização abaixo (o império salvo será substituído)</span></div>` : ''}
        <div class="found">
          <div class="fcol">
            <h3>Seu povo</h3>
            <label class="fname">Nome<div class="inrow"><input id="sName" maxlength="24" value="${esc(opts.civName)}"><button class="btn ghost sm" data-s="rname">${G.ICON.dice}</button></div></label>
            <div class="voices"><span class="fl">Tradição dos nomes</span>${G.VOICES.map((v, i) => `<button class="voice ${opts.voice === i ? 'on' : ''}" data-v="${i}"><b>${VOICE_NAMES[v.id]}</b><small>${voiceNames(i)}</small></button>`).join('')}</div>
            <h3>O mundo</h3>
            <div class="world"><canvas id="wprev" width="340" height="185"></canvas><button class="btn ghost sm" data-s="rworld">${G.ICON.dice} Outro mundo</button></div>
          </div>
          <div class="fcol"><h3>Bandeira</h3><div class="fe-host">${UI.flagEditorHTML(opts.flag)}</div>
          <button class="btn big go" data-s="go">Acender a primeira fogueira</button></div>
        </div></div>`;
      UI.wireFlagEditor($('.fe-host', st), opts.flag);
      drawPreview();
      startFire();
    };
    let prevTimer = null;
    const drawPreview = () => {
      const cv = $('#wprev');
      const x = cv.getContext('2d');
      x.fillStyle = '#2b2118'; x.fillRect(0, 0, cv.width, cv.height);
      x.fillStyle = '#c9b48a'; x.font = "italic 14px 'IM Fell English', serif"; x.textAlign = 'center'; x.fillText('desenhando o mundo…', cv.width / 2, cv.height / 2);
      clearTimeout(prevTimer);
      prevTimer = setTimeout(() => {
        const w = G.genWorld(opts.seed);
        opts.world = w;
        const img = G.mapview.renderPreview(w, cv.width, cv.height, 'parchment');
        x.drawImage(img, 0, 0);
        const [sx, sy] = G.hexCenter(w.start);
        const px = (sx / G.HEX.MW) * cv.width, py = (sy / G.HEX.MH) * cv.height;
        x.strokeStyle = '#7a1e10'; x.lineWidth = 1.5; x.beginPath(); x.arc(px, py, 6, 0, 7); x.stroke();
        x.fillStyle = '#7a1e10'; x.beginPath(); x.arc(px, py, 2, 0, 7); x.fill();
      }, 30);
    };
    st.onclick = (e) => {
      const b = e.target.closest('[data-s],[data-v]');
      if (!b) return;
      if (b.dataset.v != null) { opts.voice = +b.dataset.v; opts.civName = G.makeName(G.rng(Math.random() * 1e9 | 0), opts.voice); $('#sName').value = opts.civName; st.querySelectorAll('.voice').forEach((x) => x.classList.toggle('on', +x.dataset.v === opts.voice)); return; }
      const k = b.dataset.s;
      if (k === 'rname') { opts.civName = G.makeName(G.rng(Math.random() * 1e9 | 0), opts.voice); $('#sName').value = opts.civName; }
      if (k === 'rworld') { opts.seed = Math.floor(Math.random() * 1e9); drawPreview(); }
      if (k === 'continue') { stopFire(); st.hidden = true; onContinue(); }
      if (k === 'go') {
        opts.civName = ($('#sName').value || '').trim() || opts.civName;
        stopFire(); st.hidden = true;
        onNew(opts);
      }
    };
    render();
  };
  // fogueira animada do fundo
  let fireRAF = 0;
  function startFire() {
    const cv = $('#fire');
    if (!cv) return;
    const x = cv.getContext('2d');
    const sparks = [];
    const stars = Array.from({ length: 220 }, () => [Math.random(), Math.random() * 0.7, Math.random()]);
    const loop = (t) => {
      const W = (cv.width = innerWidth), H = (cv.height = innerHeight);
      const g = x.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#05060c'); g.addColorStop(0.7, '#0e0b10'); g.addColorStop(1, '#1d1009');
      x.fillStyle = g; x.fillRect(0, 0, W, H);
      for (const [sx, sy, a] of stars) { x.fillStyle = `rgba(230,225,255,${0.25 + 0.5 * a * (0.6 + 0.4 * Math.sin(t / 900 + a * 40))})`; x.fillRect(sx * W, sy * H, 1.3, 1.3); }
      const fx = W * 0.5, fy = H * 0.98;
      const fl = 0.85 + 0.15 * Math.sin(t / 130) * Math.sin(t / 77);
      const gl = x.createRadialGradient(fx, fy, 0, fx, fy, H * 0.75 * fl);
      gl.addColorStop(0, 'rgba(255,150,60,0.42)'); gl.addColorStop(0.35, 'rgba(200,80,30,0.13)'); gl.addColorStop(1, 'rgba(120,40,20,0)');
      x.fillStyle = gl; x.fillRect(0, 0, W, H);
      if (sparks.length < 90 && Math.random() < 0.6) sparks.push({ x: fx + (Math.random() - 0.5) * 40, y: fy - 10, vx: (Math.random() - 0.5) * 0.6, vy: -1 - Math.random() * 1.8, l: 1 });
      for (const sp of sparks) { sp.x += sp.vx + Math.sin(t / 400 + sp.y / 40) * 0.3; sp.y += sp.vy; sp.l -= 0.006; x.fillStyle = `rgba(255,${150 + sp.l * 90},70,${Math.max(0, sp.l)})`; x.fillRect(sp.x, sp.y, 2, 2); }
      for (let i = sparks.length - 1; i >= 0; i--) if (sparks[i].l <= 0) sparks.splice(i, 1);
      fireRAF = requestAnimationFrame(loop);
    };
    cancelAnimationFrame(fireRAF);
    fireRAF = requestAnimationFrame(loop);
  }
  function stopFire() { cancelAnimationFrame(fireRAF); }

  // ---------------- cartão do mapa ----------------
  UI.hoverCard = function (h, sx, sy) {
    const el = $('#hovercard');
    if (h < 0 || !game.explored[h]) { el.hidden = true; return; }
    const w = game.world, s = game.s;
    const t = G.TERRAIN[G.TERR[w.terr[h]]];
    const o = game.owner[h];
    let html = `<b>${esc(t.name)}</b>`;
    if (w.river[h] && !t.water) html += ' · rio';
    const stl = s.settlements.find((x) => x.h === h && x.owner >= 0);
    if (stl) { const p = game.settlementPop(stl); html = `<b>${esc(stl.name)}</b><span class="hk">${game.TIERS[game.tierOf(p)].name}${stl.capital ? ' · capital' : ''}</span><div>${G.fmt(p)} habitantes</div>${stl.born != null ? `<div class="hk">fundada em ${G.fmtYear(stl.born)}</div>` : ''}<div class="hk">${esc(t.name)}</div>`; }
    if (o === 0) html += `<div class="own me">${esc(game.empireName())}</div>`;
    else if (o > 0) html += `<div class="own">${esc(game.rivalName(s.rivals[o - 1]))}</div>`;
    const f = game.frontier();
    if (o === -1 && f.mark[h]) {
      const c = game.tileCost(h);
      html += `<div class="hc">${f.mark[h] === 2 ? 'Além-mar · ' : ''}Clique para anexar</div><div class="hcost">${Object.keys(c).map((k) => `<span class="${s.res[k] < c[k] ? 'no' : ''}">${G.ICON[k]}${G.fmt(c[k])}</span>`).join('')}</div>`;
    } else if (o === -1 && !t.water) {
      const needs = t.needs && !game.d.fl[t.needs];
      html += `<div class="hk">${needs ? (t.needs === 'mountains' ? 'Montanhas exigem Alvenaria' : 'O gelo exige o Motor a Combustão') : 'Terra livre'}</div>`;
    }
    el.innerHTML = html;
    el.hidden = false;
    const W = el.offsetWidth, Hh = el.offsetHeight, par = el.parentElement.getBoundingClientRect();
    let x = sx + 18, y = sy + 14;
    if (x + W > par.width - 6) x = sx - W - 14;
    if (y + Hh > par.height - 6) y = sy - Hh - 10;
    el.style.transform = `translate(${x}px,${y}px)`;
  };

  // cartão de seleção (sistema solar / galáxia)
  UI.selCard = function () {
    const el = $('#selcard');
    const v = G.main.view;
    UI.tabBindsSel = [];
    if (v === 'solar' && G.spaceview.solar.sel) {
      const b = G.BODY[G.spaceview.solar.sel];
      if (!b) { el.hidden = true; return; }
      const prev = curList; curList = UI.selBinds = [];
      if (!game.bodyUnlocked(b)) el.innerHTML = `<button class="x" data-act="unsel">${G.ICON.close}</button><div class="ih"><b>${esc(b.name)}</b></div><div class="id">${esc(b.desc)}</div><div class="hint">Ainda fora de alcance.</div>`;
      else el.innerHTML = `<button class="x" data-act="unsel">${G.ICON.close}</button>` + bodyCard(b);
      curList = prev;
      el.hidden = false;
      return;
    }
    if (v === 'galaxy' && G.spaceview.galaxy.sel != null && G.spaceview.galaxy.sel >= 0 && game.gal) {
      const j = G.spaceview.galaxy.sel, sy = game.gal.sys[j], o = game.gown[j];
      const tp = G.STAR_TYPES.find((t) => t.id === sy.type);
      const prev = curList; curList = UI.selBinds = [];
      let h = `<button class="x" data-act="unsel">${G.ICON.close}</button><div class="ih"><b>${esc(sy.name)}</b><span class="tag">${esc(tp.name)}</span></div>`;
      h += `<div class="kv"><span>Habitabilidade</span><b>${Math.round(sy.hab * 100)}%</b></div><div class="kv"><span>Planetas</span><b>${sy.planets}</b></div>`;
      if (o === 0) h += `<div class="done-line">Sistema humano · ${G.fmt(sy.hab * 3e9 + 3e8)} habitantes possíveis</div>`;
      else if (o > 0) { const a = game.s.galaxy.aliens[o - 1]; h += `<div class="id">${a.contact ? 'Território de ' + esc(G.ALIENS[o - 1].full) : 'Um sinal estranho vem deste sistema.'}</div>`; }
      else {
        const fr = game.galFrontier().find((x) => x.j === j);
        if (fr) { const c = game.sysCost(j, fr.d); h += `<div class="ia">${costHTML(c)}<button class="btn" data-act="colsys" data-id="${j}" id="${bind(() => ({ d: !afford(c) }))}">Colonizar</button></div>`; }
        else h += '<div class="hint">Fora do alcance das nossas naves.</div>';
      }
      el.innerHTML = h;
      curList = prev;
      el.hidden = false;
      return;
    }
    el.hidden = true;
  };
  UI.wireSel = function () {
    const el = $('#selcard');
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (!b || b.disabled) return;
      const a = b.dataset.act;
      if (a === 'unsel') { G.spaceview.solar.sel = null; G.spaceview.galaxy.sel = null; }
      if (a === 'body') game.advanceBody(b.dataset.id);
      if (a === 'colsys') game.colonize(+b.dataset.id);
      UI.selCard(); UI.dirtyTab = true;
    });
  };
  UI.refreshSel = function () { if (UI.selBinds) applyBinds(UI.selBinds); };
})();
