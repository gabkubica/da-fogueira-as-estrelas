// Jogador-robô: usado pelo simulador (node) e pelo ajudante de testes no navegador (?dev).
(function () {
  const G = globalThis.G, game = G.game;
  function botStep(s) {
    const d = game.d;
    if (s.cd.effort <= s.time) game.effort(s.era < 1 ? 'materials' : 'knowledge');
    const open = G.TECHS.filter((t) => game.techState(t) === 'open').sort((a, b) => game.techCost(a).knowledge - game.techCost(b).knowledge);
    if (open.length) game.research(open[0].id);
    if (s.policies.length < d.slots) { const p = [...d.pols].find((x) => !s.policies.includes(x)); if (p) game.togglePolicy(p); }
    for (const rv of s.rivals) if (game.canAnnex(rv.id)) { if (!game.annex(rv.id, 'military') && !game.annex(rv.id, 'culture')) { if (!game.annexPart(rv.id, 'military')) game.annexPart(rv.id, 'culture'); } }
    for (const w of G.WONDERS) if (game.wonderState(w) === 'open') game.buildWonder(w.id);
    {
      // primeiro, as colônias que a era exige; depois, o resto só se sobrar
      const key = G.TECHS.find((t) => t.era === s.era && t.eff.era);
      const needB = (key && key.eff.need && key.eff.need.bodies) || [];
      for (const id of needB) { let k = 0; while (k++ < 5 && game.bodyStage(id) < 3 && game.advanceBody(id)); }
      for (const b of G.BODIES) {
        if (!game.bodyUnlocked(b) || needB.includes(b.id)) continue;
        const st = game.bodyStage(b.id);
        if (st >= game.bodyMaxStage(b)) continue;
        const c = game.bodyCost(b, st);
        if (Object.keys(c).every((k) => s.res[k] * 0.3 >= c[k])) game.advanceBody(b.id);
      }
    }
    for (const x of G.GENES) if (game.geneState(x) === 'open') game.buyGene(x.id);
    if (game.gal) {
      for (let i = 0; i < 5; i++) if (!game.colonizeBest()) break;
      s.galaxy.aliens.forEach((a) => {
        if (!a.contact || a.gone) return;
        a.botT = a.botT || s.time;
        const acts = game.alienActions(a);
        const tryAct = (id) => { const x = acts.find((y) => y.id === id); return x && x.ok && game.alienAct(a.id, id); };
        if (tryAct('integrate') || tryAct('ally') || tryAct('attack')) return;
        // se em 5 minutos a aliança não sair, parte para a guerra
        if (!a.war && !a.allied && s.time - a.botT > 300) { game.alienAct(a.id, 'war'); return; }
        if (!a.war) { if (!tryAct('gift')) tryAct('exchange'); }
        if (!a.war && a.rel < 0) game.alienAct(a.id, 'war');
      });
    }
    for (let i = 0; i < 4; i++) {
      let best = null, bc = Infinity;
      for (const b of G.BUILDINGS) { if (!game.buildingUnlocked(b)) continue; const c = game.buildingCost(b.id); let tot = 0; for (const k in c) tot += c[k] / Math.max(1, s.res[k]); if (tot < bc) { bc = tot; best = b.id; } }
      if (!best || bc > 0.5 || !game.buy(best, 1)) break;
    }
    for (let i = 0; i < 3; i++) { const h = game.bestTile(); if (h < 0) break; if (!game.claimTile(h)) break; }
    s.weights.military = game.frontier().touch.size || (s.galaxy && s.galaxy.aliens.some((a) => a.war)) ? 4 : 1;
    s.auto.expand = s.auto.build = s.auto.research = s.auto.colonize = true;
  }
  G.botStep = botStep;
})();
