/* Da Fogueira às Estrelas — utilidades: aleatoriedade, ruído, formatação, nomes */
(function () {
  'use strict';
  const G = (globalThis.G = globalThis.G || {});

  // ---------- aleatoriedade determinística ----------
  G.rng = function (seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  G.hash2 = function (x, y, s) {
    let h = (x * 374761393 + y * 668265263 + (s | 0) * 2147483647) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  G.pick = (r, arr) => arr[Math.floor(r() * arr.length)];
  G.shuffle = function (r, arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };
  G.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  G.lerp = (a, b, t) => a + (b - a) * t;
  G.smooth = (t) => t * t * (3 - 2 * t);

  // ---------- ruído simplex 3D ----------
  G.makeNoise = function (seed) {
    const r = G.rng(seed);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      const t = p[i]; p[i] = p[j]; p[j] = t;
    }
    const perm = new Uint8Array(512), pm12 = new Uint8Array(512);
    for (let i = 0; i < 512; i++) { perm[i] = p[i & 255]; pm12[i] = perm[i] % 12; }
    const g3 = new Float32Array([1,1,0,-1,1,0,1,-1,0,-1,-1,0,1,0,1,-1,0,1,1,0,-1,-1,0,-1,0,1,1,0,-1,1,0,1,-1,0,-1,-1]);
    const F3 = 1 / 3, G3 = 1 / 6;
    return function (x, y, z) {
      const s = (x + y + z) * F3;
      const i = Math.floor(x + s), j = Math.floor(y + s), k = Math.floor(z + s);
      const t = (i + j + k) * G3;
      const x0 = x - (i - t), y0 = y - (j - t), z0 = z - (k - t);
      let i1, j1, k1, i2, j2, k2;
      if (x0 >= y0) {
        if (y0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
        else if (x0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1; }
        else { i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1; }
      } else {
        if (y0 < z0) { i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1; }
        else if (x0 < z0) { i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1; }
        else { i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
      }
      const x1 = x0 - i1 + G3, y1 = y0 - j1 + G3, z1 = z0 - k1 + G3;
      const x2 = x0 - i2 + 2 * G3, y2 = y0 - j2 + 2 * G3, z2 = z0 - k2 + 2 * G3;
      const x3 = x0 - 1 + 3 * G3, y3 = y0 - 1 + 3 * G3, z3 = z0 - 1 + 3 * G3;
      const ii = i & 255, jj = j & 255, kk = k & 255;
      let n = 0, tt, gi;
      tt = 0.6 - x0 * x0 - y0 * y0 - z0 * z0;
      if (tt > 0) { gi = pm12[ii + perm[jj + perm[kk]]] * 3; tt *= tt; n += tt * tt * (g3[gi] * x0 + g3[gi + 1] * y0 + g3[gi + 2] * z0); }
      tt = 0.6 - x1 * x1 - y1 * y1 - z1 * z1;
      if (tt > 0) { gi = pm12[ii + i1 + perm[jj + j1 + perm[kk + k1]]] * 3; tt *= tt; n += tt * tt * (g3[gi] * x1 + g3[gi + 1] * y1 + g3[gi + 2] * z1); }
      tt = 0.6 - x2 * x2 - y2 * y2 - z2 * z2;
      if (tt > 0) { gi = pm12[ii + i2 + perm[jj + j2 + perm[kk + k2]]] * 3; tt *= tt; n += tt * tt * (g3[gi] * x2 + g3[gi + 1] * y2 + g3[gi + 2] * z2); }
      tt = 0.6 - x3 * x3 - y3 * y3 - z3 * z3;
      if (tt > 0) { gi = pm12[ii + 1 + perm[jj + 1 + perm[kk + 1]]] * 3; tt *= tt; n += tt * tt * (g3[gi] * x3 + g3[gi + 1] * y3 + g3[gi + 2] * z3); }
      return 32 * n;
    };
  };
  G.fbm = function (noise, x, y, z, oct, lac, gain) {
    let a = 1, f = 1, sum = 0, norm = 0;
    for (let o = 0; o < oct; o++) {
      sum += a * noise(x * f, y * f, z * f);
      norm += a; a *= gain || 0.5; f *= lac || 2;
    }
    return sum / norm;
  };

  // ---------- formatação ----------
  const SUF = ['', ' mil', ' mi', ' bi', ' tri', ' quatri', ' quinti', ' sexti', ' septi', ' octi', ' noni', ' deci'];
  function dec(v, d) { return v.toFixed(d).replace('.', ','); }
  G.fmt = function (n) {
    if (n == null || isNaN(n)) return '0';
    if (!isFinite(n)) return '∞';
    const neg = n < 0; n = Math.abs(n);
    let s;
    if (n < 10) s = n === Math.floor(n) ? String(n) : dec(n, n < 1 ? 2 : 1);
    else if (n < 1000) s = String(Math.floor(n));
    else {
      const tier = Math.floor(Math.log10(n) / 3);
      if (tier < SUF.length) {
        const v = n / Math.pow(1000, tier);
        s = dec(v, v < 10 ? 2 : v < 100 ? 1 : 0) + SUF[tier];
      } else {
        const e = Math.floor(Math.log10(n));
        s = dec(n / Math.pow(10, e), 2) + 'e' + e;
      }
    }
    return (neg ? '−' : '') + s;
  };
  G.fmtInt = function (n) {
    n = Math.floor(n);
    if (n < 100000) return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return G.fmt(n);
  };
  G.fmtRate = (n) => (n >= 0 ? '+' : '') + G.fmt(n) + '/s';
  G.fmtPct = (m) => {
    const p = (m - 1) * 100;
    return (p >= 0 ? '+' : '−') + (Math.abs(p) < 10 ? dec(Math.abs(p), 0) : Math.round(Math.abs(p))) + '%';
  };
  G.fmtYear = function (y) {
    y = Math.round(y);
    if (y < 0) {
      const a = -y;
      return (a >= 1000 ? String(a).replace(/\B(?=(\d{3})+(?!\d))/g, '.') : a) + ' a.C.';
    }
    if (y < 1000) return y + ' d.C.';
    if (y >= 10000) return String(y).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return String(y);
  };
  G.fmtTime = function (s) {
    s = Math.max(0, Math.floor(s));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
    if (h > 0) return h + 'h ' + String(m).padStart(2, '0') + 'min';
    if (m > 0) return m + 'min ' + String(ss).padStart(2, '0') + 's';
    return ss + 's';
  };

  // ---------- nomes procedurais ----------
  // Cada "voz" é uma tradição sonora diferente, para que povos soem distintos entre si.
  G.VOICES = [
    { id: 'rio', on: ['k', 'sh', 'n', 'b', 'd', 'm', 'r', 'z', 'l', 'g', 'h', 'ur', 'as', 'en'], vo: ['a', 'u', 'i', 'e', 'a', 'u'], co: ['', '', 'r', 'n', 'k', 'sh', 'd', 'm'], end: ['ur', 'ash', 'ad', 'um', 'is', 'ek', 'a', 'il', 'esh'] },
    { id: 'mar', on: ['t', 'l', 'v', 'm', 's', 'c', 'p', 'n', 'r', 'th', 'ph', 'd', 'k'], vo: ['a', 'e', 'o', 'i', 'a', 'e', 'y'], co: ['', '', '', 'l', 'n', 'r', 's'], end: ['os', 'ia', 'ene', 'ion', 'ara', 'on', 'is', 'ea', 'ope', 'ida'] },
    { id: 'gelo', on: ['b', 'h', 'sk', 'th', 'v', 'gr', 'st', 'k', 'r', 'f', 'j', 'br', 'dr'], vo: ['a', 'e', 'i', 'o', 'y', 'a', 'u'], co: ['', 'r', 'n', 'ld', 'rn', 'g', 'k', 'll'], end: ['heim', 'vik', 'gard', 'borg', 'und', 'ar', 'a', 'stad', 'fjord', 'by'] },
    { id: 'sol', on: ['tl', 'x', 'ch', 'qu', 't', 'm', 'n', 'c', 'y', 'h', 'p', 'z'], vo: ['a', 'e', 'i', 'o', 'a', 'o'], co: ['', '', 'l', 'n', 'c', 'x'], end: ['tlan', 'co', 'pan', 'que', 'atl', 'ixco', 'ala', 'tepec', 'cán'] },
    { id: 'estepe', on: ['q', 't', 'b', 'k', 's', 'ar', 'ul', 'er', 'j', 'ch', 'y', 'm', 'ad'], vo: ['a', 'u', 'e', 'i', 'o', 'a'], co: ['r', 'n', 'l', 'k', 't', 'gh', '', ''], end: ['an', 'ar', 'ai', 'ul', 'tash', 'gir', 'khan', 'stan', 'ug'] },
    { id: 'mata', on: ['p', 't', 'j', 'm', 'y', 'g', 'c', 'b', 'ar', 'ub', 'ip', 'it', 'g', 'cur'], vo: ['a', 'i', 'u', 'o', 'e', 'y', 'a'], co: ['', '', '', 'r', 'm', 'n'], end: ['ra', 'ba', 'tã', 'ema', 'guá', 'ty', 'pora', 'tiba', 'una', 'iú', 'aba', 'mirim'] },
    { id: 'jade', on: ['k', 's', 't', 'n', 'h', 'm', 'y', 'r', 'w', 'sh', 'ch', 'ts', 'l', 'f'], vo: ['a', 'i', 'u', 'e', 'o', 'ao', 'ei'], co: ['', '', 'n', 'ng'], end: ['', '', 'an', 'ing', 'ou', 'ei', 'ko', 'ra'] },
    { id: 'deserto', on: ['q', 'z', 'm', 's', 'f', 'h', 'b', 'd', 'n', 'kh', 'al', 'r', 'j'], vo: ['a', 'i', 'u', 'a', 'ee', 'aa'], co: ['', 'r', 'm', 'b', 'd', 'h', 's'], end: ['ah', 'iya', 'un', 'ar', 'ad', 'ira', 'abad', 'is'] },
  ];
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  G.makeName = function (r, voice, opts) {
    const v = typeof voice === 'number' ? G.VOICES[voice % G.VOICES.length] : voice;
    const syl = 1 + Math.floor(r() * 2) + (opts && opts.long ? 1 : 0);
    let s = '';
    for (let i = 0; i < syl; i++) {
      s += G.pick(r, v.on) + G.pick(r, v.vo);
      if (i === syl - 1 || r() < 0.35) s += G.pick(r, v.co);
    }
    if (r() < 0.6) s += G.pick(r, v.end);
    s = s.replace(/(.)\1\1+/g, '$1$1').replace(/([aeiouy])\1+/g, '$1');
    if (s.length < 4) s += G.pick(r, v.end) || 'a';
    if (s.length > 11) s = s.slice(0, 9 + Math.floor(r() * 2));
    return cap(s);
  };

  // ---------- cores ----------
  G.hexToRgb = function (h) {
    const n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  G.rgba = function (h, a) {
    const c = G.hexToRgb(h);
    return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
  };
  G.mixHex = function (a, b, t) {
    const A = G.hexToRgb(a), B = G.hexToRgb(b);
    const c = A.map((v, i) => Math.round(v + (B[i] - v) * t));
    return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
  };
})();
