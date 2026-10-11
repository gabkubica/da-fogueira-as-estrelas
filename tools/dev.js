// Ajudante de testes: só carrega com ?dev na URL. G.dev.ate(era) avança o jogo com o jogador-robô.
(function () {
  const G = globalThis.G, game = G.game;
  const sc = document.createElement('script'); sc.src = 'tools/bot.js'; document.head.appendChild(sc);
  G.dev = {
    ate(era, maxMin) {
      const s = game.s, M = G.main;
      M.offline = true;
      const lim = s.time + (maxMin || 600) * 60;
      let next = s.time;
      while (s.era < era && s.time < lim) {
        game.tick(0.5, false);
        if (s.event) game.chooseEvent(0);
        if (s.time >= next) { G.botStep(s); next = s.time + 1; }
      }
      s.contactQueue = [];
      M.offline = false;
      G.mapview.setStyle(G.mapview.styleForEra(s.era));
      G.mapview.terrDirty = G.mapview.fogDirty = G.mapview.lightsDirty = G.mapview.roadsDirty = true;
      G.spaceview.galDirty = true;
      G.ui.buildHUD(); G.ui.dirtyTab = true;
      return `era ${s.era}, ${Math.round(s.time / 60)} min, pop ${G.fmt(s.pop)}, terras ${game.ownedLand}`;
    },
  };
})();
