// Ajudante de testes: só carrega com ?dev na URL. G.dev.ate(era) avança o jogo com o robô.
(function () {
  const G = globalThis.G, game = G.game;
  function botStep(s) {
    const d = game.d;
    if (s.cd.effort <= s.time) game.effort('knowledge');
    const open = G.TECHS.filter((t) => game.techState(t) === 'open').sort((a, b) => game.techCost(a).knowledge - game.techCost(b).knowledge);
    if (open.length) game.research(open[0].id);
    if (s.policies.length < d.slots) { const p = [...d.pols].find((x) => !s.policies.includes(x)); if (p) game.togglePolicy(p); }
    for (const rv of s.rivals) if (game.canAnnex(rv.id)) { if (!game.annex(rv.id, 'military') && !game.annex(rv.id, 'culture')) { if (!game.annexPart(rv.id, 'military')) game.annexPart(rv.id, 'culture'); } }
    for (const w of G.WONDERS) if (game.wonderState(w) === 'open') game.buildWonder(w.id);
    for (const b of G.BODIES) if (game.bodyUnlocked(b)) game.advanceBody(b.id);
    for (const x of G.GENES) if (game.geneState(x) === 'open') game.buyGene(x.id);
    if (game.gal) {
      for (let i = 0; i < 5; i++) if (!game.colonizeBest()) break;
      s.galaxy.aliens.forEach((a) => { const acts = game.alienActions(a); for (const id of ['integrate', 'ally', 'attack', 'gift', 'exchange']) { const x = acts.find((y) => y.id === id); if (x && x.ok && game.alienAct(a.id, id)) break; } });
    }
    for (let i = 0; i < 3; i++) { const h = game.bestTile(); if (h < 0 || !game.claimTile(h)) break; }
    for (let i = 0; i < 4; i++) {
      let best = null, bc = Infinity;
      for (const b of G.BUILDINGS) { if (b.era > s.era || b.era < s.era - 2) continue; const c = game.buildingCost(b.id); let tot = 0; for (const k in c) tot += c[k] / Math.max(1, s.res[k]); if (tot < bc) { bc = tot; best = b.id; } }
      if (!best || bc > 0.5 || !game.buy(best, 1)) break;
    }
    s.weights.military = game.frontier().touch.size ? 4 : 1;
  }
  G.dev = {
    ate(era, maxMin) {
      const s = game.s, M = G.main;
      M.offline = true;
      const lim = s.time + (maxMin || 600) * 60;
      let next = s.time;
      while (s.era < era && s.time < lim) {
        game.tick(0.5, false);
        if (s.event) game.chooseEvent(0);
        if (s.time >= next) { botStep(s); next = s.time + 1; }
      }
      s.contactQueue = [];
      M.offline = false;
      document.body.dataset.theme = M.themeFor(s.era);
      G.mapview.setStyle(G.mapview.styleForEra(s.era));
      G.mapview.terrDirty = G.mapview.fogDirty = G.mapview.lightsDirty = G.mapview.roadsDirty = true;
      G.spaceview.galDirty = true;
      G.ui.buildHUD(); G.ui.dirtyTab = true;
      return `era ${s.era}, ${Math.round(s.time / 60)} min, pop ${G.fmt(s.pop)}, terras ${game.ownedLand}`;
    },
  };
})();
