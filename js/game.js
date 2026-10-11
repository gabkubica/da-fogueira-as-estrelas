/* Da Fogueira às Estrelas — motor do jogo (sem DOM: roda também no simulador) */
(function () {
  'use strict';
  const G = (globalThis.G = globalThis.G || {});
  const BAL = G.BAL;
  const SAVE_KEY = 'fogueira-estrelas-v1';
  const RES = G.RES_ORDER;

  const game = (G.game = { s: null, listeners: {}, dirty: {}, flips: [], galFlash: {} });
  game.on = (ev, fn) => (game.listeners[ev] = game.listeners[ev] || []).push(fn);
  game.emit = (ev, d) => (game.listeners[ev] || []).forEach((f) => { try { f(d); } catch (e) { console.error(e); } });

  // ---------- utilidades ----------
  function rle(arr) {
    const out = [];
    let prev = arr[0], n = 1;
    for (let i = 1; i < arr.length; i++) {
      if (arr[i] === prev) n++;
      else { out.push(prev, n); prev = arr[i]; n = 1; }
    }
    out.push(prev, n);
    return out;
  }
  function unrle(a, T, N) {
    const r = new T(N);
    let p = 0;
    for (let i = 0; i < a.length; i += 2) { r.fill(a[i], p, p + a[i + 1]); p += a[i + 1]; }
    return r;
  }
  const afford = (cost) => { for (const k in cost) if ((game.s.res[k] || 0) < cost[k] - 1e-9) return false; return true; };
  const pay = (cost) => { for (const k in cost) game.s.res[k] -= cost[k]; };
  game.afford = afford;
  game.lvl = (id) => (game.s.legacy.levels[id] || 0);

  // ---------- estado novo ----------
  game.newState = function (o) {
    const leg = o.legacy || { points: 0, levels: {}, cycles: 0, earned: 0 };
    return {
      v: 2, seed: o.seed, civName: o.civName, color: o.color, voice: o.voice, flag: o.flag || null, genes: {},
      time: 0, savedAt: Date.now(), era: 0, year: G.ERAS[0].y0,
      pop: 12, res: { food: 40, materials: 15, knowledge: 0, culture: 0, military: 0, wealth: 0, energy: 0 },
      weights: { materials: 5, knowledge: 3, culture: 2, military: 1, wealth: 3, energy: 3 },
      margin: 0.2,
      buildings: {}, techs: {}, gov: 'anciaos', policies: [], wonders: {},
      settlements: [], rivals: [], nameCount: 0,
      space: { bodies: {} }, galaxy: null,
      auto: { culture: true, expand: false, build: false, research: false, colonize: false },
      perm: {}, permGrowth: 1, buffs: [], milestones: {}, chronicle: [],
      event: null, nextEvent: 160, recentEvents: [],
      cd: { effort: 0 },
      stats: { absorbed: 0, peakPop: 12, tilesClaimed: 0, played: 0 },
      legacy: leg, victory: false, contactQueue: [],
    };
  };

  // ---------- carregar / iniciar ----------
  game.start = function (s, saved) {
    game.s = s;
    game.world = G.genWorld(s.seed);
    const N = G.HEX.N;
    game.owner = saved && saved.owner ? unrle(saved.owner, Int16Array, N) : new Int16Array(N).fill(-1);
    game.explored = saved && saved.explored ? unrle(saved.explored, Uint8Array, N) : new Uint8Array(N);
    game.flips = [];
    game.campaigns = [];
    game.acc = { sec: 0, creep: 0, found: 0, auto: 0 };
    if (!saved) setupNewWorld();
    else (s.rivals || []).forEach((rv) => { rv.partBusy = false; if (rv.campaign && rv.alive) rv.campaign = null; });
    game.rebuildCounts();
    game.gal = null;
    if (s.era >= 10) game.initGalaxy(saved && saved.gown);
    game.recalc();
    game.dirty.frontier = true;
    game.updateExplore();
    game.rates();
  };

  function setupNewWorld() {
    const s = game.s, w = game.world, own = game.owner;
    const okStart = (h) => h >= 0 && !w.isWater(h) && w.terr[h] !== G.TI.mountain && w.terr[h] !== G.TI.ice;
    own[w.start] = 0;
    for (let k = 0; k < 6; k++) { const nb = G.NB[w.start * 6 + k]; if (okStart(nb)) own[nb] = 0; }
    s.rivals = w.rivals.map((r) => ({ id: r.id, name: r.name, color: r.color, voice: r.voice, temper: r.temper, seed: r.seed, alive: true }));
    s.rivals.forEach((rv) => {
      own[rv.seed] = rv.id;
      growRival(rv.id, w.rivals[rv.id - 1].size0, false);
    });
    const nr = game.nameRng();
    s.settlements.push({ h: w.start, name: G.makeName(nr, s.voice), owner: 0, t: 0, w: 3, capital: true });
    s.rivals.forEach((rv) => {
      const r2 = G.rng(s.seed + rv.id * 977);
      s.settlements.push({ h: rv.seed, name: G.makeName(r2, rv.voice), owner: rv.id, t: 0, w: 2, capital: true });
    });
    s.stats.capital = s.settlements[0].name;
    game.log(`Às margens de um rio sem nome, o povo de ${s.civName} acende sua primeira fogueira. Chamam o lugar de ${s.settlements[0].name}.`, 'era');
  }

  game.nameRng = function () { const s = game.s; s.nameCount = (s.nameCount || 0) + 1; return G.rng(s.seed * 31 + s.nameCount * 7919); };

  game.capOf = function (h) {
    const w = game.world, t = G.TERRAIN[G.TERR[w.terr[h]]];
    return (t.cap || 0) * (w.river[h] ? 1.4 : 1) * (w.coast[h] ? 1.1 : 1);
  };

  game.rebuildCounts = function () {
    const own = game.owner, w = game.world;
    game.ownedLand = 0; game.ownedIce = 0; game.landCap = 0;
    game.rivalTiles = new Int32Array(game.s.rivals.length + 1);
    for (let i = 0; i < own.length; i++) {
      const o = own[i];
      if (o === 0) { game.ownedLand++; if (w.terr[i] === G.TI.ice) game.ownedIce++; game.landCap += game.capOf(i); }
      else if (o > 0) game.rivalTiles[o]++;
    }
  };
  game.landFrac = () => Math.min(1, (game.ownedLand - game.ownedIce) / game.world.landTotal);

  // ---------- multiplicadores derivados ----------
  game.recalc = function () {
    const s = game.s;
    const add = {}, mult = {};
    RES.forEach((k) => { add[k] = 0; mult[k] = 1; });
    let capAdd = 0, capMult = 1, growth = s.permGrowth || 1, spaceCap = 0;
    const mods = { build: 1, tech: 1, tiles: 1, overseas: 1, absorb: 1, conquest: 1, space: 1, diplomacy: 1 };
    const fl = { seaRange: 0, seaAdd: 0, range: 0, rangeAdd: 0, overseasDiscount: 0, spaceDiscount: 0, diplomacy: 1 };
    let slots = 0;
    const govs = new Set(['anciaos']), pols = new Set(G.START_POLICIES);
    let bodyCap = 1;
    const sc = (v, f) => 1 + (v - 1) * f;
    const applyEff = (eff, f) => {
      if (!eff) return;
      if (f == null) f = 1;
      if (eff.mult) for (const k in eff.mult) mult[k] *= sc(eff.mult[k], f);
      if (eff.cap) capMult *= sc(eff.cap, f);
      if (eff.growth) growth *= sc(eff.growth, f);
      if (eff.bodyCap) bodyCap *= sc(eff.bodyCap, f);
      for (const m in mods) if (eff[m]) mods[m] *= sc(eff[m], f);
      if (eff.flags && f >= 1) for (const f in eff.flags) {
        const v = eff.flags[f];
        if (f === 'seaRange' || f === 'range' || f === 'overseasDiscount' || f === 'spaceDiscount') fl[f] = Math.max(fl[f], v);
        else if (f === 'seaAdd' || f === 'rangeAdd') fl[f] += v;
        else if (f === 'diplomacy') fl.diplomacy *= v;
        else fl[f] = 1;
      }
    };
    for (const id in s.techs) {
      const t = G.TECH[id];
      if (!t) continue;
      applyEff(t.eff);
      (t.eff.gov || []).forEach((g) => govs.add(g));
      (t.eff.pol || []).forEach((p) => pols.add(p));
      if (t.eff.slots) slots += t.eff.slots;
    }
    for (const id in s.buildings) {
      const b = G.BUILDING[id], n = s.buildings[id];
      if (!b || !n) continue;
      const bon = G.buildingBonus(b.era);
      for (const k in b.s) add[k] += n * b.s[k] * bon;
      if (b.cap) capAdd += n * b.cap * G.buildingCapBonus(b.era);
    }
    applyEff(G.GOV[s.gov] && G.GOV[s.gov].eff);
    s.policies.forEach((p) => applyEff(G.POLICY[p] && G.POLICY[p].eff));
    let glory = 0;
    for (const id in s.wonders) {
      const st = s.wonders[id].stage || 3;
      applyEff(G.WONDER[id] && G.WONDER[id].eff, st / 3);
      if (st >= 3) glory++;
    }
    for (const id in s.genes) applyEff(G.GENE[id] && G.GENE[id].eff);
    for (const k in s.perm) mult[k] *= s.perm[k];
    G.BODIES.forEach((b) => {
      const st = s.space.bodies[b.id] || 0;
      if (st >= 3) {
        const lvl = st - 2;
        if (b.eff.mult) for (const k in b.eff.mult) mult[k] *= 1 + (b.eff.mult[k] - 1) * lvl;
        if (b.eff.cap) spaceCap += b.eff.cap * lvl * bodyCap;
      }
    });
    let global = (1 + G.MILESTONE_BONUS * Object.keys(s.milestones).length) * (1 + G.GLORY_BONUS * glory);
    global *= 1 + 0.3 * game.lvl('memoria');
    growth *= 1 + 0.2 * game.lvl('fertilidade');
    capMult *= 1 + 0.1 * game.lvl('fertilidade');
    mods.tech *= Math.pow(0.92, game.lvl('oralidade'));
    mods.build *= Math.pow(0.92, game.lvl('maos'));
    mods.tiles *= Math.pow(0.9, game.lvl('passos'));
    mods.absorb *= Math.pow(0.9, game.lvl('diplomatas'));
    mods.conquest *= Math.pow(0.9, game.lvl('diplomatas'));
    mods.space *= Math.pow(0.9, game.lvl('estrelas'));
    if (s.galaxy) {
      s.galaxy.aliens.forEach((a) => { if (a.allied || a.gone) applyEff(G.ALIEN[a.id].ally); });
      global *= 1 + 0.02 * Math.max(0, (game.galCount || 1) - 1);
    }
    mods.space *= 1 - fl.spaceDiscount;
    mods.overseas *= 1 - fl.overseasDiscount;
    RES.forEach((k) => { mult[k] = (1 + add[k]) * mult[k] * global; });
    game.d = { glory, mult, add, global, capMult: (1 + capAdd) * capMult, growth, mods, fl, slots: Math.min(7, slots), govs, pols, spaceCap };
    game.emit('recalc');
  };

  game.seaRange = function () { const f = game.d.fl; return f.seaRange >= 999 ? 999 : f.seaRange > 0 ? f.seaRange + f.seaAdd : 0; };
  // alcance: propulsão + rede de faróis (cada colônia estende um pouco o alcance das naves)
  game.galRange = function () { const f = game.d.fl; if (f.rangeAdd >= 999) return 1e9; if (!f.range) return 0; return f.range + f.rangeAdd + 4 * Math.sqrt(Math.max(0, (game.galCount || 1) - 1)); };

  game.capacity = function () {
    const s = game.s;
    return (game.landCap * BAL.capPerTile[s.era] + game.d.spaceCap + (game.galCap || 0)) * game.d.capMult;
  };

  game.buffMult = function (k) {
    let m = 1;
    for (const b of game.s.buffs) if (b.mult[k]) m *= b.mult[k];
    return m;
  };

  // produtividade agrícola com ganhos decrescentes: a fração de agricultores cai aos poucos, como na história
  game.foodPer = () => G.SECTOR.food.base * Math.pow(game.d.mult.food, 0.35) * game.buffMult('food');
  game.fractions = function () {
    const s = game.s, d = game.d;
    const fpw = game.foodPer();
    const ff = G.clamp((BAL.eat * (1 + s.margin)) / fpw, 0.004, 0.97);
    const fr = { food: ff };
    const unl = G.SECTORS.filter((x) => x.id !== 'food' && s.era >= x.unlock);
    let ws = 0;
    unl.forEach((x) => (ws += s.weights[x.id] || 0));
    G.SECTORS.forEach((x) => {
      if (x.id === 'food') return;
      if (s.era < x.unlock) { fr[x.id] = 0; return; }
      fr[x.id] = (1 - ff) * (ws > 0 ? (s.weights[x.id] || 0) / ws : 1 / unl.length);
    });
    return fr;
  };

  game.rates = function () {
    const s = game.s, d = game.d;
    const fr = game.fractions();
    const gross = {}, net = {};
    G.SECTORS.forEach((x) => {
      gross[x.id] = x.id === 'food' ? s.pop * fr.food * game.foodPer() : s.pop * fr[x.id] * x.base * d.mult[x.id] * game.buffMult(x.id);
      net[x.id] = gross[x.id];
    });
    net.food -= s.pop * BAL.eat;
    game.fr = fr; game.gross = gross; game.rate = net;
    return net;
  };

  // ---------- território ----------
  game.claimable = function (h) {
    const w = game.world;
    if (h < 0 || game.owner[h] !== -1 || w.isWater(h) || !game.explored[h]) return false;
    const t = G.TERRAIN[G.TERR[w.terr[h]]];
    if (t.needs && !game.d.fl[t.needs]) return false;
    return true;
  };

  game.frontier = function () {
    if (!game.dirty.frontier && game.front) return game.front;
    const w = game.world, own = game.owner, N = G.HEX.N, NB = G.NB;
    const land = [], sea = [], touch = new Set();
    const mark = new Uint8Array(N);
    for (let i = 0; i < N; i++) {
      if (own[i] !== 0) continue;
      for (let k = 0; k < 6; k++) {
        const nb = NB[i * 6 + k];
        if (nb < 0) continue;
        const o = own[nb];
        if (o > 0) touch.add(o);
        else if (o === -1 && !mark[nb] && game.claimable(nb)) { mark[nb] = 1; land.push(nb); }
      }
    }
    const range = game.seaRange();
    if (range > 0) {
      const dist = new Int16Array(N).fill(-1);
      const q = [];
      for (let i = 0; i < N; i++) {
        if (own[i] !== 0 || !w.coast[i]) continue;
        for (let k = 0; k < 6; k++) {
          const nb = NB[i * 6 + k];
          if (nb >= 0 && w.isWater(nb) && dist[nb] < 0) { dist[nb] = 1; q.push(nb); }
        }
      }
      let qi = 0;
      while (qi < q.length) {
        const c = q[qi++];
        for (let k = 0; k < 6; k++) {
          const nb = NB[c * 6 + k];
          if (nb < 0) continue;
          if (w.isWater(nb)) {
            if (dist[nb] < 0 && dist[c] < range) { dist[nb] = dist[c] + 1; q.push(nb); }
          } else {
            const o = own[nb];
            if (o > 0) touch.add(o);
            else if (o === -1 && !mark[nb] && game.claimable(nb)) { mark[nb] = 2; sea.push(nb); }
          }
        }
      }
    }
    game.front = { land, sea, mark, touch };
    game.dirty.frontier = false;
    return game.front;
  };

  // escala contínua: interpola geometricamente da era anterior para a atual conforme as tecnologias da era avançam
  game.scale = function () {
    const s = game.s, e = s.era;
    if (game._scT === s.time && game._scE === e) return game._sc;
    const ts = game.eraTechs(e);
    const frac = ts.filter((t) => s.techs[t.id]).length / ts.length;
    const a = e > 0 ? BAL.SC[e - 1] : BAL.SC[0] / 2.5, b = BAL.SC[e];
    game._sc = a * Math.pow(b / a, frac); game._scT = s.time; game._scE = e;
    return game._sc;
  };
  // potencial produtivo: o que 30% do povo produziria neste setor (independe da divisão de trabalho)
  game.pot = (k) => Math.max(1e-9, game.s.pop * 0.3 * G.SECTOR[k].base * game.d.mult[k]);
  game.landT = (n) => Math.pow(1 + n / 40, 0.6);
  game.tileCostVal = function (h) {
    const s = game.s, w = game.world, d = game.d;
    const t = G.TERRAIN[G.TERR[w.terr[h]]];
    // c = segundos de capacidade produtiva
    let c = BAL.TC[s.era] * (t.cost || 1) * game.landT(game.ownedLand) * d.mods.tiles;
    const f = game.frontier();
    if (f.mark[h] === 2) c *= 1.6 * d.mods.overseas;
    return c;
  };
  game.tileCost = function (h) { const c = game.tileCostVal(h); return { food: c * game.s.pop * 0.15 * BAL.eat, materials: c * game.pot('materials') }; };
  game.tileCultureCost = (h) => game.tileCostVal(h) * game.pot('culture') * 2;

  game.bestTile = function (byCulture) {
    const f = game.frontier();
    let best = -1, bv = -1;
    const all = f.land.length ? f.land.concat(f.sea) : f.sea;
    const own = game.owner;
    for (const h of all) {
      if (own[h] !== -1 || !f.mark[h]) continue;
      const v = (game.capOf(h) + 0.15) / game.tileCostVal(h);
      if (v > bv) { bv = v; best = h; }
    }
    return best;
  };

  game.setOwner = function (h, o) {
    const prev = game.owner[h];
    if (prev === o) return;
    const w = game.world;
    if (prev === 0) { game.ownedLand--; if (w.terr[h] === G.TI.ice) game.ownedIce--; game.landCap -= game.capOf(h); }
    else if (prev > 0) game.rivalTiles[prev]--;
    game.owner[h] = o;
    if (o === 0) { game.ownedLand++; if (w.terr[h] === G.TI.ice) game.ownedIce++; game.landCap += game.capOf(h); game.s.stats.tilesClaimed++; }
    else if (o > 0) game.rivalTiles[o]++;
    for (const st of game.s.settlements) if (st.h === h) st.owner = o;
    const F = game.front;
    if (o === 0 && F && !game.dirty.frontier) {
      F.mark[h] = 0;
      for (let k = 0; k < 6; k++) {
        const nb = G.NB[h * 6 + k];
        if (nb < 0) continue;
        const on = game.owner[nb];
        if (on > 0) F.touch.add(on);
        else if (on === -1 && !F.mark[nb] && game.claimable(nb)) { F.mark[nb] = 1; F.land.push(nb); }
      }
      game.frontStale = true;
    } else if (prev === 0 || !F) game.dirty.frontier = true;
    else game.frontStale = true;
    game.dirty.explore = true; game.dirty.terr = true;
    game.flips.push({ h, t: game.s.time, o });
    if (game.flips.length > 400) game.flips.splice(0, game.flips.length - 400);
    if (prev > 0 && game.rivalTiles[prev] === 0) rivalGone(prev);
  };

  game.claimTile = function (h, opts) {
    const f = game.frontier();
    if (!f.mark[h] || game.owner[h] !== -1) return false;
    if (!(opts && opts.free)) {
      if (opts && opts.culture) {
        const c = game.tileCultureCost(h);
        if (game.s.res.culture < c) return false;
        game.s.res.culture -= c;
      } else {
        const cost = game.tileCost(h);
        if (!afford(cost)) return false;
        pay(cost);
      }
    }
    game.setOwner(h, 0);
    game.emit('territory');
    return true;
  };
  game.expand = function () { const h = game.bestTile(); return h >= 0 && game.claimTile(h); };
  function claimFree(n, overseas) {
    let got = 0;
    for (let i = 0; i < n; i++) {
      const f = game.frontier();
      const valid = (x) => game.owner[x] === -1 && f.mark[x];
      let pool = (overseas && f.sea.some(valid) ? f.sea : f.land.concat(f.sea)).filter(valid);
      if (!pool.length) break;
      let best = pool[0], bv = -1;
      for (const h of pool) { const v = game.capOf(h) + Math.random() * 0.3; if (v > bv) { bv = v; best = h; } }
      game.setOwner(best, 0);
      got++;
    }
    if (got) game.emit('territory');
    return got;
  }

  game.exploreRadius = function () {
    const s = game.s;
    const base = [4, 5, 6, 7, 8, 13, 99, 99, 99, 99, 99, 99][s.era];
    let r = base + game.lvl('passos');
    if (game.d.fl.cartography) r = Math.max(r, 36);
    return r;
  };
  game.updateExplore = function () {
    const N = G.HEX.N, own = game.owner, ex = game.explored;
    const r = game.exploreRadius();
    let changed = false;
    if (r >= 99) {
      for (let i = 0; i < N; i++) if (!ex[i]) { ex[i] = 1; changed = true; }
    } else {
      const dist = new Int16Array(N).fill(-1);
      const q = [];
      for (let i = 0; i < N; i++) if (own[i] === 0) { dist[i] = 0; q.push(i); }
      let qi = 0;
      while (qi < q.length) {
        const c = q[qi++];
        const rr = r + Math.floor(G.hash2(c, 5, 77) * 3) - 1;
        if (dist[c] <= rr && !ex[c]) { ex[c] = 1; changed = true; }
        if (dist[c] >= r + 1) continue;
        for (let k = 0; k < 6; k++) {
          const nb = G.NB[c * 6 + k];
          if (nb >= 0 && dist[nb] < 0) { dist[nb] = dist[c] + 1; q.push(nb); }
        }
      }
    }
    game.dirty.explore = false;
    if (changed) { game.dirty.frontier = true; game.emit('explore'); }
  };

  // ---------- povos rivais ----------
  function growRival(id, n, announce) {
    const own = game.owner, w = game.world, s = game.s;
    const era = s ? s.era : 0;
    const okT = (h) => {
      if (h < 0 || own[h] !== -1 || w.isWater(h)) return false;
      const t = w.terr[h];
      if (t === G.TI.ice) return era >= 7;
      if (t === G.TI.mountain) return era >= 2;
      return true;
    };
    let added = 0;
    const cand = [];
    for (let i = 0; i < own.length; i++) {
      if (own[i] !== id) continue;
      for (let k = 0; k < 6; k++) { const nb = G.NB[i * 6 + k]; if (okT(nb)) cand.push(nb); }
    }
    const r = Math.random;
    while (added < n && cand.length) {
      const j = Math.floor(r() * cand.length);
      const h = cand[j];
      cand[j] = cand[cand.length - 1]; cand.pop();
      if (!okT(h)) continue;
      if (game.rivalTiles) game.setOwner(h, id); else own[h] = id;
      added++;
      for (let k = 0; k < 6; k++) { const nb = G.NB[h * 6 + k]; if (okT(nb)) cand.push(nb); }
    }
    return added;
  }
  game.rivalName = function (rv) {
    const e = game.s.era;
    const t = rv.temper;
    let title;
    if (e <= 1) title = 'Tribo';
    else if (e <= 4) title = t > 0.66 ? 'Império' : t > 0.33 ? 'Reino' : 'Cidades';
    else if (e <= 6) title = t > 0.6 ? 'Império' : t > 0.3 ? 'Reino' : 'República';
    else title = t > 0.5 ? 'Federação' : 'República';
    const prep = title === 'Cidades' ? 'de' : (title === 'República' || title === 'Federação' || title === 'Tribo') ? 'de' : 'de';
    return title + ' ' + prep + ' ' + rv.name;
  };
  game.rivalStrength = function (id) {
    const s = game.s, n = game.rivalTiles[id] || 0;
        return n * BAL.TC[s.era] * game.landT(game.ownedLand) * BAL.RIV;
  };
  game.rivalCost = function (id, mode) {
    const base = game.rivalStrength(id), d = game.d;
    if (mode === 'military') return { military: base * game.pot('military') * d.mods.conquest };
    return { culture: base * 1.6 * game.pot('culture') * d.mods.absorb };
  };
  game.canAnnex = function (id) {
    const rv = game.s.rivals[id - 1];
    return rv && rv.alive && !rv.campaign && game.frontier().touch.has(id) && game.s.era >= 1;
  };
  // fronteira: só a faixa mais próxima de nós
  game.partCount = (id) => { const n = game.rivalTiles[id] || 0; return Math.min(n, Math.max(4, Math.ceil(n * 0.2))); };
  game.rivalPartCost = function (id, mode) {
    const n = game.rivalTiles[id] || 1, k = game.partCount(id);
    const full = game.rivalCost(id, mode), out = {};
    for (const r in full) out[r] = (full[r] * k / n) * 1.25;
    return out;
  };
  game.annexPart = function (id, mode) {
    if (!game.canAnnex(id) || game.s.rivals[id - 1].partBusy) return false;
    const k = game.partCount(id);
    if (k >= (game.rivalTiles[id] || 0)) return game.annex(id, mode);
    const cost = game.rivalPartCost(id, mode);
    if (!afford(cost)) return false;
    pay(cost);
    const rv = game.s.rivals[id - 1];
    rv.partBusy = true;
    game.campaigns.push({ id, order: annexOrder(id).slice(0, k), i: 0, mode, part: true });
    game.log(mode === 'military' ? `Nossas tropas avançam sobre a fronteira da ${game.rivalName(rv)}.` : `Aldeias da fronteira da ${game.rivalName(rv)} passam a se considerar parte do nosso povo.`, mode === 'military' ? 'war' : 'info');
    game.emit('rivals');
    return true;
  };
  function annexOrder(id) {
    const own = game.owner, N = G.HEX.N;
    const dist = new Int32Array(N).fill(-1);
    const q = [];
    for (let i = 0; i < N; i++) if (own[i] === 0) { dist[i] = 0; q.push(i); }
    let qi = 0;
    const order = [];
    while (qi < q.length) {
      const c = q[qi++];
      for (let k = 0; k < 6; k++) {
        const nb = G.NB[c * 6 + k];
        if (nb < 0 || dist[nb] >= 0) continue;
        dist[nb] = dist[c] + 1;
        q.push(nb);
        if (own[nb] === id) order.push(nb);
      }
    }
    for (let i = 0; i < N; i++) if (own[i] === id && dist[i] < 0) order.push(i);
    return order;
  }
  game.annex = function (id, mode) {
    if (!game.canAnnex(id)) return false;
    const cost = game.rivalCost(id, mode);
    if (!afford(cost)) return false;
    pay(cost);
    const rv = game.s.rivals[id - 1];
    rv.campaign = mode;
    const order = annexOrder(id);
    game.campaigns.push({ id, order, i: 0, mode });
    const nm = game.rivalName(rv);
    game.log(mode === 'military'
      ? `Nossos exércitos marcham sobre as terras da ${nm}.`
      : `Mercadores, sacerdotes e casamentos: a ${nm} começa a se unir ao nosso povo.`, 'war');
    game.emit('rivals');
    return true;
  };
  function rivalGone(id) {
    const rv = game.s.rivals[id - 1];
    if (!rv || !rv.alive) return;
    rv.alive = false;
    game.s.stats.absorbed++;
    const how = rv.campaign === 'military' ? 'foi conquistada. Seu povo agora é nosso.' : 'deixou de existir como povo separado. Suas cidades agora falam a nossa língua — com sotaque.';
    game.log(`A ${game.rivalName(rv)} ${how}`, 'war');
    rv.campaign = null;
    game.emit('toast', { text: `${rv.name} incorporados ao império`, kind: 'war' });
    game.emit('rivals');
  }

  // ---------- assentamentos ----------
  function foundSettlement(owner) {
    const s = game.s, own = game.owner, w = game.world;
    let best = -1, bv = -1;
    const blocked = new Uint8Array(own.length);
    for (const x of s.settlements) {
      blocked[x.h] = 1;
      for (let k = 0; k < 6; k++) { const a = G.NB[x.h * 6 + k]; if (a < 0) continue; blocked[a] = 1; for (let j = 0; j < 6; j++) { const b = G.NB[a * 6 + j]; if (b >= 0) blocked[b] = 1; } }
    }
    for (let i = 0; i < own.length; i++) {
      if (own[i] !== owner) continue;
      const t = w.terr[i];
      if (t === G.TI.ice || t === G.TI.mountain) continue;
      if (blocked[i]) continue;
      const v = game.capOf(i) + (w.river[i] ? 0.8 : 0) + (w.coast[i] ? 0.5 : 0) + G.hash2(i, s.settlements.length, s.seed) * 0.6;
      if (v > bv) { bv = v; best = i; }
    }
    if (best < 0) return null;
    const voice = owner === 0 ? s.voice : s.rivals[owner - 1].voice;
    const nr = game.nameRng();
    const st = { h: best, name: G.makeName(nr, voice), owner, t: s.time, w: 0.6 + nr() * 0.9, born: s.year };
    if (w.river[best]) st.w *= 1.3;
    if (w.coast[best]) st.w *= 1.2;
    s.settlements.push(st);
    if (owner === 0) {
      const lines = [
        `Famílias partem rumo ao ${['norte', 'sul', 'leste', 'oeste'][Math.floor(nr() * 4)]} e fundam ${st.name}.`,
        `Um novo assentamento nasce: ${st.name}.`,
        `Às margens de terras férteis surge ${st.name}.`,
        `Colonos erguem as primeiras casas de ${st.name}.`,
      ];
      game.log(w.river[best] ? `Junto ao rio, nasce ${st.name}.` : G.pick(nr, lines), 'city');
    }
    game.emit('settlements');
    return st;
  }
  game.settlementPop = function (st) {
    const s = game.s;
    if (st.owner === 0) {
      if (!game._wsum || game._wsumT !== s.time) {
        let ws = 0;
        for (const x of s.settlements) if (x.owner === 0) ws += game.stWeight(x);
        game._wsum = ws; game._wsumT = s.time;
      }
      return (s.pop * game.stWeight(st)) / game._wsum;
    }
    const n = game.rivalTiles[st.owner] || 0;
    const rp = n * BAL.capPerTile[Math.max(0, s.era - 1)] * 0.7;
    let cnt = 0;
    for (const x of s.settlements) if (x.owner === st.owner) cnt++;
    return (rp * (st.capital ? 2 : 1)) / (cnt + 1);
  };
  game.stWeight = function (st) {
    const age = Math.min(3, (game.s.time - st.t) / 900);
    return st.w * (st.capital ? 3 : 1) * (1 + age);
  };
  game.TIERS = [
    { min: 0, name: 'Acampamento' }, { min: 150, name: 'Aldeia' }, { min: 1500, name: 'Vila' },
    { min: 12000, name: 'Cidade' }, { min: 100000, name: 'Cidade grande' }, { min: 900000, name: 'Metrópole' },
    { min: 8e6, name: 'Megalópole' }, { min: 8e7, name: 'Ecumenópole' },
  ];
  game.tierOf = function (pop) { let t = 0; for (let i = 0; i < game.TIERS.length; i++) if (pop >= game.TIERS[i].min) t = i; return t; };

  // ---------- construções ----------
  game.buildingCost = function (id, n) {
    const b = G.BUILDING[id];
    if (n == null) n = game.s.buildings[id] || 0;
    const base = b.era === 0 ? BAL.SC[0] * 0.6 : BAL.SC[b.era - 1] * BAL.BF;
    const sc = base * b.c * Math.pow(BAL.buildGrowth, n) * game.d.mods.build;
    const c = { materials: sc };
    if (b.era >= 2) c.wealth = sc * BAL.RW[b.era] * 0.25;
    if (b.era >= 7) c.energy = sc * BAL.RE[b.era] * 0.3;
    return c;
  };
  // a versão mais avançada da linha disponível nesta era
  game.lineCurrent = function (line) {
    const L = G.LINES[line] || [];
    let cur = null;
    for (const b of L) if (b.era <= game.s.era) cur = b;
    return cur;
  };
  game.lineNext = function (line) { return (G.LINES[line] || []).find((b) => b.era > game.s.era) || null; };
  game.buildingUnlocked = (b) => b.era <= game.s.era && game.lineCurrent(b.line) === b;
  game.buy = function (id, count) {
    const b = G.BUILDING[id];
    if (!b || !game.buildingUnlocked(b)) return 0;
    let n = 0;
    for (let i = 0; i < (count || 1); i++) {
      const c = game.buildingCost(id);
      if (!afford(c)) break;
      pay(c);
      game.s.buildings[id] = (game.s.buildings[id] || 0) + 1;
      n++;
    }
    if (n) { game.recalc(); game.emit('buildings'); }
    return n;
  };
  game.maxBuy = function (id) {
    const s = game.s;
    let n = s.buildings[id] || 0, cnt = 0;
    const res = Object.assign({}, s.res);
    while (cnt < 500) {
      const c = game.buildingCost(id, n);
      let ok = true;
      for (const k in c) if (res[k] < c[k]) { ok = false; break; }
      if (!ok) break;
      for (const k in c) res[k] -= c[k];
      n++; cnt++;
    }
    return cnt;
  };

  // ---------- tecnologias ----------
  game.techCost = (t) => ({ knowledge: BAL.KC[t.era] * t.c * game.d.mods.tech });
  game.eraTechs = (e) => G.TECHS.filter((t) => t.era === e);
  game.techState = function (t) {
    const s = game.s;
    if (s.techs[t.id]) return 'done';
    if (t.era > s.era) return 'future';
    if (!t.req.every((r) => s.techs[r])) return 'locked';
    if (t.eff.era) {
      const others = game.eraTechs(t.era).filter((x) => x.id !== t.id);
      if (!others.every((x) => s.techs[x.id])) return 'locked';
      if (!game.needMet(t.eff.need)) return 'need';
    }
    return 'open';
  };
  game.needMet = function (need) {
    if (!need) return true;
    const s = game.s;
    if (need.tiles && game.landFrac() < need.tiles - 1e-9) return false;
    if (need.bodies && !need.bodies.every((b) => (s.space.bodies[b] || 0) >= 3)) return false;
    if (need.systems && game.galFrac() < need.systems) return false;
    return true;
  };
  game.needText = function (need) {
    if (!need) return '';
    const parts = [];
    if (need.tiles) parts.push(`${Math.ceil(need.tiles * game.world.landTotal)} territórios (${Math.round(need.tiles * 100)}% da terra firme) — você tem ${game.ownedLand - game.ownedIce}`);
    if (need.bodies) parts.push('Colônias em: ' + need.bodies.map((b) => G.BODY[b].name).join(', '));
    if (need.systems) parts.push(`${Math.ceil(need.systems * G.GAL.N)} sistemas estelares — você tem ${game.galCount || 0}`);
    return parts.join(' · ');
  };
  game.research = function (id) {
    const t = G.TECH[id];
    if (!t || game.techState(t) !== 'open') return false;
    const c = game.techCost(t);
    if (!afford(c)) return false;
    pay(c);
    game.s.techs[id] = 1;
    game.recalc();
    game.dirty.frontier = true;
    game.log(`Descobrimos: ${t.name}.`, 'tech');
    if (t.eff.bodies) game.emit('space');
    if (t.eff.era) advanceEra(t.eff.era);
    game.emit('techs');
    return true;
  };
  function advanceEra(e) {
    const s = game.s;
    if (e <= s.era) return;
    s.era = e;
    const E = G.ERAS[e];
    game.log(`— Começa a ${E.name}. —`, 'era');
    if (e <= 7) s.rivals.forEach((rv) => { if (rv.alive && !rv.campaign) growRival(rv.id, 2 + Math.round((game.rivalTiles[rv.id] || 0) * 0.35), false); });
    if (e === 10) { game.initGalaxy(); }
    game.recalc();
    game.dirty.frontier = true;
    game.updateExplore();
    game.emit('era', e);
    game.emit('territory');
  }

  // ---------- governo e políticas ----------
  game.changeCost = (mul) => ({ culture: Math.max(10, (game.gross ? game.gross.culture : 0) * mul) });
  game.setGov = function (id) {
    const s = game.s;
    if (s.gov === id || !game.d.govs.has(id)) return false;
    const c = game.changeCost(60);
    if (!afford(c)) return false;
    pay(c);
    s.gov = id;
    game.recalc();
    game.log(`Uma nova ordem: o povo agora vive sob ${G.GOV[id].name}.`, 'gov');
    game.emit('gov');
    return true;
  };
  game.togglePolicy = function (id) {
    const s = game.s;
    const i = s.policies.indexOf(id);
    if (i >= 0) { s.policies.splice(i, 1); game.recalc(); game.emit('gov'); return true; }
    if (!game.d.pols.has(id) || s.policies.length >= game.d.slots) return false;
    const c = game.changeCost(30);
    if (!afford(c)) return false;
    pay(c);
    s.policies.push(id);
    game.recalc();
    game.log(`Nova política adotada: ${G.POLICY[id].name}.`, 'gov');
    game.emit('gov');
    return true;
  };

  // ---------- maravilhas ----------
  game.WSTAGE = [0.25, 0.33, 0.42];
  game.WSTAGE_NAMES = ['Fundação', 'Construção', 'Conclusão'];
  game.wonderStage = (id) => (game.s.wonders[id] ? game.s.wonders[id].stage || 3 : 0);
  game.wonderCost = function (w, stage) {
    if (stage == null) stage = game.wonderStage(w.id);
    const sc = BAL.SC[w.era] * w.c * 9 * game.d.mods.build * game.WSTAGE[Math.min(2, stage)];
    const c = { materials: sc, culture: sc * 0.25 };
    if (w.era >= 2) c.wealth = sc * BAL.RW[w.era] * 0.35;
    if (w.era >= 6) c.energy = sc * BAL.RE[w.era] * 0.4;
    return c;
  };
  game.wonderState = function (w) {
    const s = game.s;
    if (game.wonderStage(w.id) >= 3) return 'done';
    if (w.era > s.era) return 'future';
    if (!game.needMet(w.need)) return 'need';
    return 'open';
  };
  game.buildWonder = function (id) {
    const w = G.WONDER[id];
    if (!w || game.wonderState(w) !== 'open') return false;
    const c = game.wonderCost(w);
    if (!afford(c)) return false;
    pay(c);
    let rec = game.s.wonders[id];
    if (!rec) {
      rec = { stage: 0 };
      if (!w.where) rec.h = placeWonder();
      game.s.wonders[id] = rec;
    }
    rec.stage = (rec.stage || 0) + 1;
    if (rec.stage >= 3) rec.year = game.s.year;
    game.recalc();
    game.dirty.frontier = true;
    if (rec.stage === 1) game.log(`Começam as obras: ${w.name}.`, 'wonder');
    else if (rec.stage >= 3) game.log(`Concluída: ${w.name}. ${w.desc}`, 'wonder');
    game.emit('wonder', { id, stage: rec.stage });
    return true;
  };
  function placeWonder() {
    const s = game.s, w = game.world;
    const cap = s.settlements.find((x) => x.capital && x.owner === 0) || s.settlements.find((x) => x.owner === 0);
    const used = new Set(s.settlements.map((x) => x.h));
    for (const id in s.wonders) if (s.wonders[id].h != null) used.add(s.wonders[id].h);
    let best = -1, bd = 1e9;
    for (let i = 0; i < game.owner.length; i++) {
      if (game.owner[i] !== 0 || used.has(i) || w.isWater(i)) continue;
      const d = cap ? G.hexDist(cap.h, i) : 0;
      const score = d + G.hash2(i, 3, s.seed) * 1.5 + (d < 1 ? 5 : 0);
      if (score < bd) { bd = score; best = i; }
    }
    return best;
  }

  // ---------- evolução humana ----------
  game.geneCost = (x) => ({ knowledge: BAL.KC[x.era] * x.c * 2.2 * game.d.mods.tech, food: BAL.SC[x.era] * x.c * 3 });
  game.geneState = function (x) {
    const s = game.s;
    if (s.genes[x.id]) return 'done';
    if (!game.d.fl.genes || x.era > s.era) return 'future';
    if (!x.req.every((r) => s.genes[r])) return 'locked';
    return 'open';
  };
  game.buyGene = function (id) {
    const x = G.GENE[id];
    if (!x || game.geneState(x) !== 'open') return false;
    const c = game.geneCost(x);
    if (!afford(c)) return false;
    pay(c);
    game.s.genes[id] = 1;
    game.recalc();
    game.log(`Evolução humana: ${x.name}. ${x.desc}`, 'tech');
    game.emit('genes');
    return true;
  };

  // ---------- nome do império ----------
  game.empireTitle = () => {
    const s = game.s;
    if (s.customTitle) return s.customTitle;
    const t = (G.GOV[s.gov] && G.GOV[s.gov].title) || 'Povo';
    // um povo que nunca mudou de governo ainda cresce: o título acompanha a era
    if (t === 'Tribo' && s.era >= 2) return s.era <= 4 ? 'Reino' : s.era <= 6 ? 'Nação' : s.era <= 7 ? 'República' : 'Federação';
    return t;
  };
  game.empireName = () => game.empireTitle() + ' de ' + game.s.civName;

  // ---------- sistema solar ----------
  game.bodyEra = function (b) {
    for (const t of G.TECHS) if (t.eff.bodies && t.eff.bodies.includes(b.id)) return t.eff.era || t.era;
    return 8;
  };
  game.bodyUnlocked = function (b) {
    for (const t of G.TECHS) if (t.eff.bodies && t.eff.bodies.includes(b.id)) return !!game.s.techs[t.id];
    return false;
  };
  game.bodyStage = (id) => game.s.space.bodies[id] || 0;
  game.bodyMaxStage = (b) => 2 + b.max;
  game.bodyCost = function (b, st) {
    const e = game.bodyEra(b), d = 1 + (b.diff - 1) * 0.15, m = game.d.mods.space * (BAL.BC[e] || 1);
    const sc = BAL.SC[e] * d * m, kc = BAL.KC[e] * d * m;
    const re = BAL.RE[e] || 0.003, rw = BAL.RW[e] || 0.04;
    if (st === 0) return { knowledge: kc * 1.2, energy: sc * re * 2 };
    if (st === 1) return { materials: sc * 3, energy: sc * 3 * re * 0.8 };
    const L = st - 2;
    const f = 8 * Math.pow(2.3, L);
    return { materials: sc * f, energy: sc * f * re * 0.5, wealth: sc * f * rw * 0.3 };
  };
  game.stageLabel = function (b, st) {
    if (st <= 0) return 'Desconhecido';
    if (b.kind === 'orbit') return ['', 'Satélites', 'Estação orbital', 'Cidade orbital'][Math.min(3, st)] + (st > 3 ? ' — nível ' + (st - 2) : '');
    if (b.kind === 'giant') return ['', 'Sondado', 'Estação atmosférica', 'Refinarias'][Math.min(3, st)] + (st > 3 ? ' — nível ' + (st - 2) : '');
    return G.STAGE_NAMES[Math.min(3, st)] + (st > 3 ? ' — nível ' + (st - 2) : '');
  };
  game.actionLabel = function (b, st) {
    if (st === 0) return b.kind === 'orbit' ? 'Lançar satélites' : 'Enviar sonda';
    if (st === 1) return b.kind === 'orbit' ? 'Montar estação' : 'Posto avançado';
    if (st === 2) return b.kind === 'orbit' ? 'Cidade orbital' : 'Fundar colônia';
    return 'Desenvolver';
  };
  game.advanceBody = function (id) {
    const b = G.BODY[id];
    if (!b || !game.bodyUnlocked(b)) return false;
    const st = game.bodyStage(id);
    if (st >= game.bodyMaxStage(b)) return false;
    const c = game.bodyCost(b, st);
    if (!afford(c)) return false;
    pay(c);
    game.s.space.bodies[id] = st + 1;
    const lines = {
      1: b.kind === 'orbit' ? 'Os primeiros satélites entram em órbita.' : `Uma sonda chega a ${b.name} e transmite as primeiras imagens.`,
      2: `Um posto avançado é montado em ${b.name}.`,
      3: `${b.name} recebe seus primeiros colonos permanentes.`,
    };
    game.log(lines[st + 1] || `${b.name} cresce: nível ${st - 1}.`, 'space');
    game.recalc();
    game.emit('space', { body: id, stage: st + 1 });
    return true;
  };

  // ---------- galáxia ----------
  game.initGalaxy = function (savedOwner) {
    const s = game.s;
    game.gal = G.genGalaxy(s.seed);
    const N = game.gal.sys.length;
    if (!s.galaxy) {
      s.galaxy = { aliens: G.ALIENS.map((a) => ({ id: a.id, rel: a.base, contact: false, allied: false, war: false, gone: false, how: null, cd: 0, nextRaid: 0 })) };
      game.gown = Int8Array.from(game.gal.owner);
      game.log('Os telescópios do Sistema Solar começam a mapear a galáxia. São centenas de estrelas ao alcance — e algumas delas parecem estar falando.', 'space');
    } else {
      game.gown = savedOwner ? unrle(savedOwner, Int8Array, N) : Int8Array.from(game.gal.owner);
    }
    game.countGalaxy();
    game.dirty.gal = true;
  };
  game.countGalaxy = function () {
    if (!game.gal) return;
    const sys = game.gal.sys, own = game.gown;
    let c = 0, cap = 0;
    const per = new Int32Array(G.ALIENS.length + 1);
    for (let i = 0; i < sys.length; i++) {
      const o = own[i];
      if (o === 0) { c++; if (i !== game.gal.sol) cap += sys[i].hab * 3e9 + 3e8; }
      else if (o > 0) per[o]++;
    }
    if (game.galCount !== c) game.dirty.gal = true;
    game.galCount = c; game.galCap = cap; game.alienSys = per;
  };
  game.galFrac = () => (game.gal ? (game.galCount || 0) / game.gal.sys.length : 0);
  game.sysDist = (a, b) => { const A = game.gal.sys[a], B = game.gal.sys[b]; return Math.hypot(A.x - B.x, A.y - B.y); };
  game.galFrontier = function () {
    if (!game.gal) return [];
    if (!game.dirty.gal && game._gf) return game._gf;
    const sys = game.gal.sys, own = game.gown, R = game.galRange();
    const humans = [];
    for (let i = 0; i < sys.length; i++) if (own[i] === 0) humans.push(i);
    const out = [], far = [];
    for (let j = 0; j < sys.length; j++) {
      if (own[j] !== -1) continue;
      let md = 1e9;
      for (const h of humans) { const d = Math.hypot(sys[h].x - sys[j].x, sys[h].y - sys[j].y); if (d < md) md = d; }
      if (md <= R) out.push({ j, d: md });
      else far.push({ j, d: md, far: true });
    }
    if (!out.length && far.length) { far.sort((a, b) => a.d - b.d); out.push(...far.slice(0, 3)); }
    game._gf = out;
    game.dirty.gal = false;
    return out;
  };
  game.sysCost = function (j, d) {
    const s = game.gal.sys[j];
    const R = Math.min(game.galRange(), 400);
    const c = game.scale() * (BAL.BC[game.s.era] || 1) * 2.2 * Math.pow(1 + (game.galCount || 1) / 5, 1.3) * (1 + (d / Math.max(R, 1)) * 0.4) * (1.25 - 0.45 * s.hab) * game.d.mods.space;
    const e = game.s.era;
    return { materials: c, energy: c * BAL.RE[e] * 0.5, wealth: c * BAL.RW[e] * 0.3 };
  };
  game.colonize = function (j) {
    const f = game.galFrontier().find((x) => x.j === j);
    if (!f) return false;
    const c = game.sysCost(j, f.d);
    if (!afford(c)) return false;
    pay(c);
    setSys(j, 0);
    const sy = game.gal.sys[j];
    if ((game.galCount || 0) <= 12 || Math.random() < 0.12) game.log(`Colonos humanos chegam a ${sy.name}.`, 'space');
    if (sy.ruins) {
      sy.ruins = false;
      game.s.perm.knowledge = (game.s.perm.knowledge || 1) * 1.1;
      game.log(`Em ${sy.name}, encontramos ruínas de uma civilização que morreu antes da Terra nascer. O que aprendemos ali muda tudo.`, 'space');
      game.emit('toast', { text: `Ruínas precursoras em ${sy.name}: +10% de saber`, kind: 'space' });
      game.recalc();
    }
    return true;
  };
  game.colonizeBest = function () {
    const f = game.galFrontier();
    let best = null, bc = Infinity;
    for (const x of f) { const c = game.sysCost(x.j, x.d).materials; if (c < bc) { bc = c; best = x; } }
    return best ? game.colonize(best.j) : false;
  };
  function setSys(j, o) {
    game.gown[j] = o;
    game.galFlash[j] = game.s.time;
    game.dirty.gal = true;
    game.countGalaxy();
    game.recalc();
    game.emit('galaxy');
    checkVictory();
  }
  game.alienOf = (id) => game.s.galaxy.aliens.find((a) => a.id === id);
  game.alienIdx = (id) => G.ALIENS.findIndex((a) => a.id === id) + 1;
  // segundos de produção por sistema (escala com o tamanho da espécie e o seu poder)
  game.alienSecs = function (a) {
    const cnt = game.alienSys ? game.alienSys[game.alienIdx(a.id)] : 1;
    return 25 * Math.sqrt(cnt + 1) * (BAL.AF[game.s.era] || 1);
  };
  game.alienBase = function (a) { return game.alienSecs(a); };
  game.alienPer = function (a) { return 40 * G.ALIEN[a.id].power * (BAL.AF[game.s.era] || 1); };
  game.dip = () => game.d.fl.diplomacy * game.d.mods.diplomacy;
  game.alienActions = function (a) {
    const A = G.ALIEN[a.id], s = game.s;
    const cnt = game.alienSys[game.alienIdx(a.id)];
    const out = [];
    if (a.gone || !a.contact) return out;
    const cd = a.cd > s.time;
    const hostileOnly = A.id === 'krrath';
    if (!a.war && !hostileOnly) {
      out.push({ id: 'gift', name: 'Enviar presentes', desc: '+12 de relação', cost: { wealth: game.alienBase(a) * game.pot('wealth') }, ok: !cd });
      out.push({ id: 'exchange', name: 'Intercâmbio cultural', desc: '+9 de relação e saber', cost: { culture: game.alienBase(a) * game.pot('culture') }, ok: !cd });
      if (!a.allied) out.push({ id: 'ally', name: 'Propor aliança', desc: `Exige relação ${A.id === 'sarn' ? 75 : 60}+. Concede bônus permanente.`, cost: {}, ok: a.rel >= (A.id === 'sarn' ? 75 : 60) });
      if (a.allied) {
        const need = A.id === 'lumen' ? !!s.techs.transferencia : true;
        out.push({ id: 'integrate', name: 'Integração pacífica', desc: `Exige aliança e relação 85+${A.id === 'lumen' ? ' e Transferência de Consciência' : ''}. Todos os ${cnt} sistemas tornam-se humanos.`, cost: { culture: game.alienPer(a) * cnt * 0.9 * game.pot('culture') * game.d.mods.absorb }, ok: a.rel >= 85 && need });
      }
      out.push({ id: 'war', name: 'Declarar guerra', desc: 'Relação vai a −100. Outras espécies desaprovam.', cost: {}, ok: true, danger: true });
    } else {
      if (!a.war) out.push({ id: 'war', name: 'Iniciar ofensiva', desc: 'O Enxame não negocia.', cost: {}, ok: true, danger: true });
      else {
        const k = Math.min(3, cnt);
        out.push({ id: 'attack', name: `Ofensiva (${k} sistema${k > 1 ? 's' : ''})`, desc: 'Conquista os sistemas mais próximos.', cost: { military: game.alienPer(a) * k * game.pot('military') * game.d.mods.conquest }, ok: !cd, danger: true });
        if (!hostileOnly) out.push({ id: 'peace', name: 'Propor paz', desc: 'Encerra a guerra. Relação volta a −30.', cost: { wealth: game.alienBase(a) * 2 * game.pot('wealth') }, ok: !cd });
      }
    }
    return out;
  };
  game.alienAct = function (id, act) {
    const a = game.alienOf(id), s = game.s;
    const opt = game.alienActions(a).find((x) => x.id === act);
    if (!opt || !opt.ok || !afford(opt.cost)) return false;
    pay(opt.cost);
    const A = G.ALIEN[id];
    const dip = game.dip();
    switch (act) {
      case 'gift': a.rel = Math.min(100, a.rel + 12 * dip); a.cd = s.time + 15; break;
      case 'exchange': a.rel = Math.min(100, a.rel + 9 * dip); a.cd = s.time + 15; s.res.knowledge += (game.gross.knowledge || 0) * 40; break;
      case 'ally':
        a.allied = true; a.rel = Math.min(100, a.rel + 10);
        game.log(`Aliança firmada com ${A.full}. ${A.full} e a humanidade agora caminham juntos.`, 'alien');
        game.recalc(); break;
      case 'integrate': {
        const idx = game.alienIdx(id);
        for (let j = 0; j < game.gown.length; j++) if (game.gown[j] === idx) { game.gown[j] = 0; game.galFlash[j] = s.time; }
        a.gone = true; a.how = 'integração';
        game.log(`${A.full} votam por se unir à humanidade. Pela primeira vez, ser humano deixa de ser uma questão de espécie.`, 'alien');
        game.dirty.gal = true; game.countGalaxy(); game.recalc(); game.emit('galaxy'); checkVictory();
        break;
      }
      case 'war':
        a.war = true; a.allied = false; a.rel = -100;
        s.galaxy.aliens.forEach((o) => { if (o !== a && o.id !== 'krrath' && !o.gone) o.rel = Math.max(-100, o.rel - 8); });
        game.log(`A humanidade declara guerra a ${A.full}.`, 'war');
        game.recalc(); break;
      case 'peace': a.war = false; a.rel = -30; a.cd = s.time + 30; game.log(`Paz assinada com ${A.full}.`, 'alien'); break;
      case 'attack': {
        const idx = game.alienIdx(id);
        const sys = game.gal.sys;
        const humans = [];
        for (let j = 0; j < sys.length; j++) if (game.gown[j] === 0) humans.push(j);
        const theirs = [];
        for (let j = 0; j < sys.length; j++) if (game.gown[j] === idx) {
          let md = 1e9;
          for (const h of humans) md = Math.min(md, Math.hypot(sys[h].x - sys[j].x, sys[h].y - sys[j].y));
          theirs.push([md, j]);
        }
        theirs.sort((x, y) => x[0] - y[0]);
        theirs.slice(0, 3).forEach(([, j]) => { game.gown[j] = 0; game.galFlash[j] = s.time; });
        a.cd = s.time + 6;
        if (theirs.length <= 3) {
          a.gone = true; a.how = 'conquista'; a.war = false;
          game.log(`O último mundo de ${A.full} cai. Sua história continua — sob a bandeira humana.`, 'war');
        }
        game.dirty.gal = true; game.countGalaxy(); game.recalc(); game.emit('galaxy'); checkVictory();
        break;
      }
    }
    game.emit('aliens');
    return true;
  };
  function galaxyTick(dt) {
    const s = game.s;
    if (!game.gal || !s.galaxy) return;
    const sys = game.gal.sys, own = game.gown;
    const R = game.galRange();
    s.galaxy.aliens.forEach((a, k) => {
      if (a.gone) return;
      const A = G.ALIENS[k];
      const idx = k + 1;
      if (!a.contact) {
        let hit = !!game.d.fl.reveal || (game.galCount || 0) >= 20;
        if (!hit) {
          outer: for (let j = 0; j < sys.length; j++) {
            if (own[j] !== idx) continue;
            for (let h = 0; h < sys.length; h++) if (own[h] === 0 && Math.hypot(sys[h].x - sys[j].x, sys[h].y - sys[j].y) < R + 90) { hit = true; break outer; }
          }
        }
        if (hit) {
          a.contact = true;
          game.log(`Primeiro contato: ${A.full}. "${A.greet}"`, 'alien');
          s.contactQueue.push(A.id);
          game.emit('contact', A.id);
        }
        return;
      }
      // deriva da relação
      const target = A.base + (a.allied ? 30 : 0);
      if (!a.war) a.rel += Math.sign(target - a.rel) * Math.min(Math.abs(target - a.rel), 0.25 * dt / 60 * 4);
      // ataques
      const hostile = A.id === 'krrath' || a.war || (A.id === 'sarn' && a.rel < -20);
      if (hostile && game.alienSys[idx] > 0) {
        if (!a.nextRaid) a.nextRaid = s.time + 120 + Math.random() * 120;
        if (s.time >= a.nextRaid) {
          a.nextRaid = s.time + 150 + Math.random() * 150;
          const power = game.alienPer(a) * 1.2 * game.pot('military');
          if (s.res.military >= power) {
            s.res.military -= power * 0.5;
            game.emit('toast', { text: `Ataque de ${A.full} repelido pela frota`, kind: 'war' });
            game.log(`Uma frota de ${A.full} atacou nossa fronteira e foi repelida.`, 'war');
          } else {
            // ataque não repelido: saque nas colônias da fronteira (não toma sistemas)
            for (const k of ['materials', 'energy', 'wealth']) s.res[k] *= 0.88;
            s.res.military = 0;
            game.emit('toast', { text: `${A.full} saquearam colônias da fronteira`, kind: 'bad' });
            game.log(`Uma frota de ${A.full} saqueou colônias humanas da fronteira. Mais força militar teria evitado o ataque.`, 'war');
          }
        }
      }
    });
  }
  function checkVictory() {
    const s = game.s;
    if (s.victory || !game.gal) return;
    for (let j = 0; j < game.gown.length; j++) if (game.gown[j] !== 0) return;
    s.victory = true;
    game.log('Não resta uma estrela sequer fora do alcance humano. Da primeira fogueira à última estrela, a jornada está completa.', 'era');
    game.emit('victory');
  }

  // ---------- eventos ----------
  game.minAmt = () => game.scale() * 0.4;
  function applyEff(eff, title) {
    const s = game.s;
    if (eff.give) for (const k in eff.give) s.res[k] += Math.max(game.minAmt(), eff.give[k] * (game.gross[k] || 0));
    if (eff.cost) for (const k in eff.cost) s.res[k] = Math.max(0, s.res[k] - Math.max(game.minAmt() * 0.5, eff.cost[k] * (game.gross[k] || 0)));
    if (eff.buff) s.buffs.push({ mult: eff.buff.mult, until: s.time + eff.buff.dur, name: title });
    if (eff.perm) { for (const k in eff.perm) { if (k === 'growth') s.permGrowth *= eff.perm[k]; else s.perm[k] = (s.perm[k] || 1) * eff.perm[k]; } }
    if (eff.pop) s.pop = Math.max(1, s.pop * (1 + eff.pop));
    if (eff.tiles) claimFree(eff.tiles, eff.overseas);
    if (eff.relAll && s.galaxy) s.galaxy.aliens.forEach((a) => (a.rel = Math.min(100, a.rel + eff.relAll)));
    game.recalc();
  }
  game.chooseEvent = function (i) {
    const s = game.s;
    const ev = G.EVENTS.find((e) => e.id === s.event);
    if (!ev) { s.event = null; return; }
    const ch = ev.choices[i];
    applyEff(ch.eff, ev.title);
    game.log(`${ev.title}: ${ch.t.toLowerCase()}.`, 'event');
    s.recentEvents.push(ev.id);
    if (s.recentEvents.length > 6) s.recentEvents.shift();
    s.event = null;
    s.nextEvent = s.time + 180 + Math.random() * 180;
    game.emit('event', null);
  };
  function maybeEvent() {
    const s = game.s;
    if (s.event || s.time < s.nextEvent) return;
    const pool = G.EVENTS.filter((e) => s.era >= e.e0 && s.era <= e.e1 && !s.recentEvents.includes(e.id) && (!e.need || e.need(game)));
    if (!pool.length) { s.nextEvent = s.time + 120; return; }
    const ev = pool[Math.floor(Math.random() * pool.length)];
    s.event = ev.id;
    game.emit('event', ev.id);
  }

  // ---------- mutirão ----------
  // mutirão: um empurrão de ~1 minuto de produção, a cada 45 segundos (não exige cliques frenéticos)
  game.effortCd = () => 45;
  game.effortAmt = (k) => Math.max(game.scale() * (k === 'food' || k === 'materials' ? 0.12 : 0.04), 60 * (game.gross[k] || 0));
  game.effort = function (k) {
    const s = game.s;
    if (s.cd.effort > s.time) return false;
    s.res[k] += game.effortAmt(k);
    s.cd.effort = s.time + game.effortCd();
    return true;
  };

  // ---------- marcos ----------
  function checkMilestones() {
    const s = game.s;
    let any = false;
    for (const m of G.MILESTONES) {
      if (s.milestones[m.id]) continue;
      if (m.test(game)) {
        s.milestones[m.id] = s.year;
        any = true;
        game.emit('toast', { text: `Marco: ${m.name} (+${Math.round(G.MILESTONE_BONUS * 100)}% produção)`, kind: 'milestone' });
      }
    }
    if (any) game.recalc();
  }

  // ---------- automação ----------
  function autoStuff() {
    const s = game.s, d = game.d;
    if (s.auto.expand && d.fl.autoExpand) {
      for (let i = 0; i < 6; i++) { const h = game.bestTile(); if (h < 0 || !game.claimTile(h)) break; }
    }
    if (s.auto.build && d.fl.autoBuild) {
      let best = null, bc = Infinity;
      for (const b of G.BUILDINGS) {
        if (!game.buildingUnlocked(b)) continue;
        const c = game.buildingCost(b.id);
        let ok = true, tot = 0;
        for (const k in c) { if (s.res[k] * 0.3 < c[k]) ok = false; tot += c[k] / (BAL.SC[b.era] || 1); }
        if (ok && tot < bc) { bc = tot; best = b.id; }
      }
      if (best) game.buy(best, 1);
    }
    if (s.auto.research && d.fl.autoResearch) {
      const open = G.TECHS.filter((t) => game.techState(t) === 'open').sort((a, b) => game.techCost(a).knowledge - game.techCost(b).knowledge);
      if (open.length) game.research(open[0].id);
    }
    if (s.auto.colonize && d.fl.autoColonize && game.gal) {
      for (let i = 0; i < 3; i++) if (!game.colonizeBest()) break;
    }
  }

  // ---------- passo de simulação ----------
  game.tick = function (dt, offline) {
    const s = game.s;
    s.time += dt;
    s.stats.played += dt;
    if (s.buffs.length) s.buffs = s.buffs.filter((b) => b.until > s.time);
    game.rates();
    for (const k of RES) s.res[k] += game.rate[k] * dt;
    if (s.res.food < 0) { s.pop = Math.max(1, s.pop * (1 - Math.min(0.5, 0.03 * dt))); s.res.food = 0; }
    const C = game.capacity();
    if (s.pop < C) {
      const g = BAL.growth * game.d.growth;
      s.pop = Math.min(C, s.pop + (g * s.pop * (1 - s.pop / C) + 0.05) * dt);
    } else s.pop -= (s.pop - C) * Math.min(1, 0.05 * dt);
    if (s.pop > s.stats.peakPop) s.stats.peakPop = s.pop;

    // expansão cultural
    if (s.auto.culture) {
      for (let i = 0; i < (offline ? 40 : 3); i++) {
        const h = game.bestTile();
        if (h < 0) break;
        if (s.res.culture < game.tileCultureCost(h)) break;
        game.claimTile(h, { culture: true });
      }
    }
    // campanhas
    for (const c of game.campaigns) {
      const n = offline ? c.order.length : Math.max(1, Math.ceil(dt * 26));
      for (let k = 0; k < n && c.i < c.order.length; k++) {
        const h = c.order[c.i++];
        if (game.owner[h] === c.id) game.setOwner(h, 0);
      }
      if (c.i >= c.order.length) {
        // sobras (terras conquistadas pelo rival durante a campanha)
        if (!c.part) for (let h = 0; h < game.owner.length; h++) if (game.owner[h] === c.id) game.setOwner(h, 0);
        else { const rv = game.s.rivals[c.id - 1]; if (rv) rv.partBusy = false; }
        c.done = true;
      }
      game.emit('territory');
    }
    if (game.campaigns.length) game.campaigns = game.campaigns.filter((c) => !c.done);

    const A = game.acc;
    A.sec += dt; A.creep += dt; A.found += dt; A.auto += dt;
    if (A.found >= 2) {
      A.found = 0;
      const mine = s.settlements.filter((x) => x.owner === 0).length;
      if (mine < 1 + Math.floor(game.ownedLand / 9)) foundSettlement(0);
      for (const rv of s.rivals) {
        if (!rv.alive) continue;
        const cnt = s.settlements.filter((x) => x.owner === rv.id).length;
        if (cnt < 1 + Math.floor((game.rivalTiles[rv.id] || 0) / 14)) foundSettlement(rv.id);
      }
    }
    if (A.creep >= 40) {
      A.creep = 0;
      if (s.era <= 7) s.rivals.forEach((rv) => { if (rv.alive && !rv.campaign) growRival(rv.id, s.era >= 3 ? 2 : 1, false); });
      game.emit('territory');
    }
    if (A.auto >= 1) { A.auto = 0; autoStuff(); }
    if (A.sec >= 1) {
      A.sec = 0;
      checkMilestones();
      if (!offline) maybeEvent();
      galaxyTick(1);
      if (game.dirty.explore) game.updateExplore();
      if (game.frontStale) { game.frontStale = false; game.dirty.frontier = true; }
    }
    // ano
    const E = G.ERAS[s.era];
    const techs = game.eraTechs(s.era);
    const done = techs.filter((t) => s.techs[t.id]).length;
    const target = E.y0 + (E.y1 - E.y0) * (done / techs.length);
    s.year += (target - s.year) * Math.min(1, dt * 0.5);
  };

  // ---------- crônica ----------
  game.log = function (text, kind) {
    const s = game.s;
    s.chronicle.unshift({ y: Math.round(s.year), t: text, k: kind || 'info' });
    if (s.chronicle.length > 300) s.chronicle.length = 300;
    game.emit('chronicle');
  };

  // ---------- legado ----------
  game.legacyGain = function () {
    const s = game.s;
    if (s.era < 6) return 0;
    return Math.floor(4 * Math.pow(s.era, 1.6) + Object.keys(s.milestones).length * 0.6 + s.stats.absorbed + game.galFrac() * 90 + (s.victory ? 150 : 0));
  };
  game.legacyCost = (id) => { const L = G.LEGACY_DEF[id]; return Math.ceil(L.base * Math.pow(L.growth, game.lvl(id))); };
  game.buyLegacy = function (id) {
    const L = G.LEGACY_DEF[id], leg = game.s.legacy;
    if (game.lvl(id) >= L.max) return false;
    const c = game.legacyCost(id);
    if (leg.points < c) return false;
    leg.points -= c;
    leg.levels[id] = game.lvl(id) + 1;
    game.recalc();
    game.emit('legacy');
    return true;
  };

  // ---------- salvar ----------
  game.serialize = function () {
    const s = game.s;
    s.savedAt = Date.now();
    const o = { s, owner: rle(game.owner), explored: rle(game.explored) };
    if (game.gown) o.gown = rle(game.gown);
    return JSON.stringify(o);
  };
  game.save = function () {
    if (!globalThis.localStorage || !game.s) return;
    try { localStorage.setItem(SAVE_KEY, game.serialize()); } catch (e) { console.warn('save failed', e); }
  };
  game.loadSaved = function (str) {
    const raw = str || (globalThis.localStorage && localStorage.getItem(SAVE_KEY));
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  };
  game.hasSave = () => !!(globalThis.localStorage && localStorage.getItem(SAVE_KEY));
  game.wipe = () => { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} };
  game.exportStr = () => btoa(unescape(encodeURIComponent(game.serialize())));
  game.importStr = function (b64) {
    try { return JSON.parse(decodeURIComponent(escape(atob(b64.trim())))); } catch (e) { return null; }
  };
  game.resume = function (data) {
    const s = data.s;
    // compatibilidade de campos
    const base = game.newState({ seed: s.seed, civName: s.civName, color: s.color, voice: s.voice, legacy: s.legacy });
    for (const k in base) if (s[k] === undefined) s[k] = base[k];
    game.start(s, data);
  };

  // ---------- progresso offline ----------
  game.offline = function (secs) {
    secs = Math.min(secs, 24 * 3600);
    if (secs < 20) return null;
    const s = game.s;
    const before = { pop: s.pop, land: game.ownedLand, res: Object.assign({}, s.res), year: s.year };
    const steps = Math.min(4000, Math.ceil(secs / 1.5));
    const dt = secs / steps;
    for (let i = 0; i < steps; i++) game.tick(dt, true);
    return { secs, before, after: { pop: s.pop, land: game.ownedLand, res: Object.assign({}, s.res), year: s.year } };
  };

  // ---------- prestígio ----------
  game.newCycle = function (opts) {
    const s = game.s;
    const gain = game.legacyGain();
    const leg = s.legacy;
    leg.points += gain;
    leg.earned = (leg.earned || 0) + gain;
    leg.cycles = (leg.cycles || 0) + 1;
    const ns = game.newState({ seed: opts.seed, civName: opts.civName || s.civName, color: opts.color || s.color, voice: opts.voice != null ? opts.voice : s.voice, legacy: leg });
    game.start(ns, null);
    game.log(`Um novo ciclo começa. Ninguém lembra do império anterior — mas algo dele vive em cada gesto deste povo. (${leg.cycles}º ciclo)`, 'era');
    return gain;
  };
})();
