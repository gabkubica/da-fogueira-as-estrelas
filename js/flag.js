/* Da Fogueira às Estrelas — bandeiras e ícones */
(function () {
  'use strict';
  const G = (globalThis.G = globalThis.G || {});

  // Emblemas desenhados numa caixa 0..40 (centro 20,20)
  G.EMBLEMS = {
    nenhum: { name: 'Nenhum', svg: '' },
    sol: { name: 'Sol', svg: '<circle cx="20" cy="20" r="7"/>' + Array.from({ length: 12 }, (_, i) => { const a = (i * Math.PI) / 6; return `<path d="M${20 + Math.cos(a) * 9.5} ${20 + Math.sin(a) * 9.5} L${20 + Math.cos(a + 0.12) * 15} ${20 + Math.sin(a + 0.12) * 15} L${20 + Math.cos(a - 0.12) * 15} ${20 + Math.sin(a - 0.12) * 15}Z"/>`; }).join('') },
    estrela: { name: 'Estrela', svg: '<path d="M20 4 L24.1 15.6 L36.4 15.9 L26.6 23.3 L30.2 35.1 L20 28.1 L9.8 35.1 L13.4 23.3 L3.6 15.9 L15.9 15.6Z"/>' },
    lua: { name: 'Lua', svg: '<path d="M25 5 A15 15 0 1 0 25 35 A12 12 0 1 1 25 5Z"/>' },
    arvore: { name: 'Árvore', svg: '<path d="M18.5 36 L18.5 24 L12 27 L18 21 L9 20 L17.5 16 L12 10 L19 12.5 L20 4 L21 12.5 L28 10 L22.5 16 L31 20 L22 21 L28 27 L21.5 24 L21.5 36Z"/>' },
    montanha: { name: 'Montanha', svg: '<path d="M2 33 L14 12 L19 20 L25 9 L38 33Z"/><path d="M25 9 L28.5 15 L26 14 L23.5 16Z" fill-opacity="0.35" fill="#fff"/>' },
    chama: { name: 'Chama', svg: '<path d="M20 4 C24 11 30 14 29 23 C28.5 30 24 35 20 35 C15 35 11 31 11 25 C11 19 15 17 15 12 C18 15 18 18 19.5 20 C21 15 22 10 20 4Z"/>' },
    roda: { name: 'Roda', svg: '<circle cx="20" cy="20" r="13" fill="none" stroke-width="3.2"/><circle cx="20" cy="20" r="3"/>' + Array.from({ length: 8 }, (_, i) => { const a = (i * Math.PI) / 4; return `<path d="M20 20 L${20 + Math.cos(a) * 13} ${20 + Math.sin(a) * 13}" stroke-width="2"/>`; }).join('') },
    olho: { name: 'Olho', svg: '<path d="M3 20 C10 10 30 10 37 20 C30 30 10 30 3 20Z"/><circle cx="20" cy="20" r="6" fill="#000" fill-opacity="0.45"/><circle cx="20" cy="20" r="2.6"/>' },
    espiral: { name: 'Espiral', svg: '<path d="M20 20 m0 0 a2 2 0 0 1 4 0 a4 4 0 0 1 -8 0 a6 6 0 0 1 12 0 a8 8 0 0 1 -16 0 a10 10 0 0 1 20 0 a12 12 0 0 1 -24 0" fill="none" stroke-width="2.6" stroke-linecap="round"/>' },
    coroa: { name: 'Coroa', svg: '<path d="M6 30 L4 12 L12 20 L20 8 L28 20 L36 12 L34 30Z"/><rect x="6" y="31.5" width="28" height="3.5"/>' },
    onda: { name: 'Ondas', svg: '<path d="M3 15 Q9.5 9 16 15 T29 15 T42 15" fill="none" stroke-width="3"/><path d="M-2 23 Q4.5 17 11 23 T24 23 T37 23" fill="none" stroke-width="3"/><path d="M3 31 Q9.5 25 16 31 T29 31 T42 31" fill="none" stroke-width="3"/>' },
    mao: { name: 'Mão', svg: '<path d="M14 36 L12 22 L8 16 L10 14 L14 18 L14 6 L17 6 L17.5 17 L18 4 L21 4 L21.5 17 L22.5 5.5 L25.5 6 L25 18 L27 8 L30 8.5 L29 24 L26 36Z"/>' },
    passaro: { name: 'Pássaro', svg: '<path d="M2 14 C10 12 15 15 19 21 C21 15 28 9 38 8 C31 13 27 18 25 25 L30 31 L22 29 L17 34 L17 27 C11 25 6 20 2 14Z"/>' },
    atomo: { name: 'Átomo', svg: '<circle cx="20" cy="20" r="3"/><ellipse cx="20" cy="20" rx="16" ry="6" fill="none" stroke-width="1.8"/><ellipse cx="20" cy="20" rx="16" ry="6" fill="none" stroke-width="1.8" transform="rotate(60 20 20)"/><ellipse cx="20" cy="20" rx="16" ry="6" fill="none" stroke-width="1.8" transform="rotate(120 20 20)"/>' },
  };

  const col = (id) => (G.FLAG_COLORS.find((c) => c.id === id) || G.FLAG_COLORS[0]).hex;
  G.flagColor = col;

  G.defaultFlag = function (r) {
    r = r || Math.random;
    const ids = G.FLAG_COLORS.map((c) => c.id);
    const a = G.pick(r, ids);
    let b = G.pick(r, ids); while (b === a) b = G.pick(r, ids);
    let c = G.pick(r, ids); while (c === a || c === b) c = G.pick(r, ids);
    const em = Object.keys(G.EMBLEMS).filter((k) => k !== 'nenhum');
    return { pattern: G.pick(r, G.FLAG_PATTERNS), c1: a, c2: b, c3: c, emblem: G.pick(r, em), ec: G.pick(r, ['or', 'argent', 'sable', b]) };
  };

  // Cor do império no mapa: a cor mais forte da bandeira
  G.flagMapColor = function (f) {
    const cand = [f.c1, f.c2, f.c3].map((id) => G.FLAG_COLORS.find((c) => c.id === id)).filter((c) => c && !c.light && c.id !== 'sable');
    return (cand[0] || G.FLAG_COLORS[0]).hex;
  };

  G.flagSVG = function (f, w, h, extra) {
    if (!f) f = { pattern: 'liso', c1: 'gules', c2: 'or', c3: 'argent', emblem: 'nenhum', ec: 'or' };
    const W = 60, H = 40;
    const a = col(f.c1), b = col(f.c2), c = col(f.c3);
    let body = '';
    switch (f.pattern) {
      case 'faixa': body = `<rect width="60" height="20" fill="${a}"/><rect y="20" width="60" height="20" fill="${b}"/>`; break;
      case 'pala': body = `<rect width="30" height="40" fill="${a}"/><rect x="30" width="30" height="40" fill="${b}"/>`; break;
      case 'tribanda': body = `<rect width="60" height="14" fill="${a}"/><rect y="13.3" width="60" height="13.4" fill="${b}"/><rect y="26.6" width="60" height="13.4" fill="${c}"/>`; break;
      case 'triparte': body = `<rect width="20.1" height="40" fill="${a}"/><rect x="20" width="20.1" height="40" fill="${b}"/><rect x="40" width="20" height="40" fill="${c}"/>`; break;
      case 'cruz': body = `<rect width="60" height="40" fill="${a}"/><rect x="25" width="10" height="40" fill="${b}"/><rect y="15" width="60" height="10" fill="${b}"/>`; break;
      case 'nordica': body = `<rect width="60" height="40" fill="${a}"/><rect x="17" width="9" height="40" fill="${b}"/><rect y="15.5" width="60" height="9" fill="${b}"/><rect x="19.5" width="4" height="40" fill="${c}"/><rect y="18" width="60" height="4" fill="${c}"/>`; break;
      case 'diagonal': body = `<rect width="60" height="40" fill="${b}"/><path d="M0 0 L60 0 L0 40Z" fill="${a}"/>`; break;
      case 'quartel': body = `<rect width="60" height="40" fill="${a}"/><rect x="30" width="30" height="20" fill="${b}"/><rect y="20" width="30" height="20" fill="${b}"/>`; break;
      case 'bordadura': body = `<rect width="60" height="40" fill="${b}"/><rect x="5" y="5" width="50" height="30" fill="${a}"/>`; break;
      case 'chevron': body = `<rect width="60" height="40" fill="${a}"/><path d="M0 0 L26 20 L0 40Z" fill="${b}"/>`; break;
      case 'sol': body = `<rect width="60" height="40" fill="${a}"/><circle cx="30" cy="20" r="13" fill="${b}"/>`; break;
      default: body = `<rect width="60" height="40" fill="${a}"/>`;
    }
    const em = G.EMBLEMS[f.emblem] || G.EMBLEMS.nenhum;
    let emb = '';
    if (em.svg) {
      const e = col(f.ec);
      const cx = f.pattern === 'chevron' ? 9 : f.pattern === 'nordica' ? 21.5 : 30;
      const sc = f.pattern === 'chevron' ? 0.4 : 0.6;
      emb = `<g transform="translate(${cx - 20 * sc} ${20 - 20 * sc}) scale(${sc})" fill="${e}" stroke="${e}">${em.svg}</g>`;
    }
    return `<svg class="flag" viewBox="0 0 ${W} ${H}" width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg" ${extra || ''}>${body}${emb}<rect width="60" height="40" fill="url(#flagShade)" opacity="0.18"/><rect x="0.4" y="0.4" width="59.2" height="39.2" fill="none" stroke="rgba(0,0,0,0.35)" stroke-width="0.8"/></svg>`;
  };

  // ---------- ícones de traço (16×16) ----------
  const I = (d, extra) => `<svg class="ico" viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" ${extra || ''}>${d}</svg>`;
  G.ICON = {
    food: I('<path d="M8 15V5"/><path d="M8 5c0-2 1-3 2.5-3.5C10.5 3.5 9.5 5 8 5zM8 5C8 3 7 2 5.5 1.5 5.5 3.5 6.5 5 8 5z"/><path d="M8 9c0-1.8 1.2-3 3-3.3C11 7.6 9.8 9 8 9zM8 9c0-1.8-1.2-3-3-3.3C5 7.6 6.2 9 8 9z"/><path d="M8 13c0-1.8 1.2-3 3-3.3 0 1.9-1.2 3.3-3 3.3zM8 13c0-1.8-1.2-3-3-3.3 0 1.9 1.2 3.3 3 3.3z"/>'),
    materials: I('<path d="M2 13.5h12"/><rect x="2.5" y="9" width="5" height="4.5"/><rect x="8.5" y="9" width="5" height="4.5"/><rect x="5.5" y="4.5" width="5" height="4.5"/>'),
    knowledge: I('<path d="M8 4c-1.5-1.2-3.5-1.6-6-1.4v10c2.5-.2 4.5.2 6 1.4 1.5-1.2 3.5-1.6 6-1.4v-10c-2.5-.2-4.5.2-6 1.4z"/><path d="M8 4v10"/>'),
    culture: I('<path d="M3 3c0 5 2 8 5 8s5-3 5-8"/><path d="M3 3c1.5.8 3 1.2 5 1.2S11.5 3.8 13 3"/><path d="M6 6.5h.01M10 6.5h.01"/><path d="M6.3 8.7c1 .7 2.4.7 3.4 0"/><path d="M8 11v3M6 14h4"/>'),
    military: I('<path d="M8 1.8l5 2v4.2c0 3.2-2.2 5.4-5 6.4-2.8-1-5-3.2-5-6.4V3.8z"/><path d="M8 4.5v7"/>'),
    wealth: I('<circle cx="8" cy="8" r="5.8"/><circle cx="8" cy="8" r="3.4"/><path d="M8 6.2v3.6"/>'),
    energy: I('<path d="M9.2 1.5L3.5 9h4l-1 5.5L12.5 7h-4z"/>'),
    pop: I('<circle cx="5.5" cy="5" r="2.2"/><path d="M1.5 14c0-2.6 1.8-4.4 4-4.4s4 1.8 4 4.4"/><circle cx="11.2" cy="5.6" r="1.8"/><path d="M10.6 9.8c2 0 3.9 1.5 3.9 4"/>'),
    glory: I('<path d="M8 2l1.7 3.6 3.9.5-2.9 2.7.8 3.9L8 10.8l-3.5 1.9.8-3.9-2.9-2.7 3.9-.5z"/>'),
    land: I('<path d="M2 12l3-5 2.5 3L10 5l4 7z"/><path d="M1.5 14h13"/>'),
    gear: I('<circle cx="8" cy="8" r="2.4"/><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4"/>'),
    plus: I('<path d="M8 3v10M3 8h10"/>'),
    minus: I('<path d="M3 8h10"/>'),
    home: I('<circle cx="8" cy="8" r="5.5"/><circle cx="8" cy="8" r="1.6"/><path d="M8 1v2.5M8 12.5V15M1 8h2.5M12.5 8H15"/>'),
    tree: I('<circle cx="8" cy="3" r="1.6"/><circle cx="3.5" cy="12.5" r="1.6"/><circle cx="12.5" cy="12.5" r="1.6"/><path d="M8 4.6v3.4M8 8L3.5 11M8 8l4.5 3"/>'),
    close: I('<path d="M3.5 3.5l9 9M12.5 3.5l-9 9"/>'),
    dice: I('<rect x="2" y="2" width="12" height="12" rx="2"/><circle cx="5.3" cy="5.3" r=".7" fill="currentColor"/><circle cx="10.7" cy="10.7" r=".7" fill="currentColor"/><circle cx="8" cy="8" r=".7" fill="currentColor"/>'),
    save: I('<path d="M3 2h8l2 2v10H3z"/><path d="M5 2v4h5V2M5 14v-4h6v4"/>'),
  };
})();
