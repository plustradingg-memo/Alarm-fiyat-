/* RAY ARASI — çekirdek yardımcılar: matematik, rastgelelik, kayıt, ses, yollar, geometri */
(function () {
  'use strict';
  const RA = (window.RA = window.RA || {});
  const T = THREE;
  // Renkleri sRGB olarak yorumla (r149'da varsayılan doğrusal; soluk görünümü önler)
  if (T.ColorManagement && 'legacyMode' in T.ColorManagement) T.ColorManagement.legacyMode = false;

  /* ---------- matematik ---------- */
  RA.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  RA.lerp = (a, b, t) => a + (b - a) * t;
  RA.smooth = (t) => { t = RA.clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  RA.damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
  RA.wrapAngle = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
  RA.dampAngle = (a, b, k, dt) => a + RA.wrapAngle(b - a) * (1 - Math.exp(-k * dt));

  /* ---------- tohumlu rastgelelik (günlük trafik) ---------- */
  RA.rng = function (seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  RA.hashStr = function (s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  };
  const pad = (n) => (n < 10 ? '0' : '') + n;
  RA.todayKey = function () {
    const d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  };
  RA.todayLabel = function () {
    const ay = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
    const d = new Date();
    return d.getDate() + ' ' + ay[d.getMonth()];
  };
  RA.dailySeed = (mode) => RA.hashStr('rayarasi|' + (RA.seedOverride || RA.todayKey()) + '|' + mode);
  RA.shuffle = function (arr, rnd) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  };
  RA.pick = (arr, rnd) => arr[Math.floor(rnd() * arr.length) % arr.length];

  /* ---------- kalıcı kayıt (rekorlar, ses) ---------- */
  RA.store = {
    get(key, def) {
      try { const v = window.localStorage.getItem('rayarasi.' + key); return v == null ? def : JSON.parse(v); } catch (e) { return def; }
    },
    set(key, val) {
      try { window.localStorage.setItem('rayarasi.' + key, JSON.stringify(val)); return true; } catch (e) { return false; }
    },
  };
  RA.records = {
    get(mode) { const r = RA.store.get('records', {}); return (r && r[mode]) || 0; },
    submit(mode, score) {
      const r = RA.store.get('records', {}) || {};
      const prev = r[mode] || 0;
      if (score > prev) { r[mode] = score; RA.store.set('records', r); return { prev, best: score, isNew: true }; }
      return { prev, best: prev, isNew: false };
    },
  };

  /* ---------- ses (WebAudio ile üretilen kısa efektler) ---------- */
  const audio = (RA.audio = {
    ctx: null, master: null, enabled: RA.store.get('sound', true), noiseBuf: null,
    unlock() {
      if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try {
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.enabled ? 0.55 : 0;
        this.master.connect(this.ctx.destination);
        const len = this.ctx.sampleRate * 1.5;
        this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      } catch (e) { this.ctx = null; }
    },
    setEnabled(on) {
      this.enabled = on; RA.store.set('sound', on);
      if (this.master) this.master.gain.value = on ? 0.55 : 0;
    },
    tone(freq, dur, type, vol, when, slideTo) {
      const c = this.ctx; if (!c) return;
      const t0 = c.currentTime + (when || 0);
      const o = c.createOscillator(); const g = c.createGain();
      o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t0);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol || 0.3, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(this.master); o.start(t0); o.stop(t0 + dur + 0.05);
    },
    noise(dur, freq, q, vol, when, type) {
      const c = this.ctx; if (!c || !this.noiseBuf) return;
      const t0 = c.currentTime + (when || 0);
      const s = c.createBufferSource(); s.buffer = this.noiseBuf;
      const f = c.createBiquadFilter(); f.type = type || 'bandpass'; f.frequency.value = freq; f.Q.value = q || 1;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol || 0.3, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      s.connect(f); f.connect(g); g.connect(this.master); s.start(t0); s.stop(t0 + dur + 0.05);
    },
    play(name) {
      if (!this.ctx || !this.enabled) return;
      switch (name) {
        case 'switch': this.noise(0.09, 1800, 2, 0.35); this.tone(140, 0.12, 'square', 0.12); this.noise(0.06, 900, 3, 0.25, 0.07); break;
        case 'locked': this.tone(150, 0.09, 'square', 0.14); this.tone(120, 0.12, 'square', 0.14, 0.11); break;
        case 'horn':
          this.tone(311, 0.32, 'sawtooth', 0.09); this.tone(392, 0.32, 'sawtooth', 0.07);
          this.tone(311, 0.42, 'sawtooth', 0.09, 0.42); this.tone(392, 0.42, 'sawtooth', 0.07, 0.42); break;
        case 'brake': this.noise(1.1, 3200, 18, 0.22); this.noise(0.9, 4100, 22, 0.14, 0.1); break;
        case 'point': this.tone(988, 0.1, 'sine', 0.16); this.tone(1319, 0.16, 'sine', 0.13, 0.07); break;
        case 'warn': this.tone(740, 0.12, 'square', 0.08); break;
        case 'light': this.noise(0.04, 2500, 4, 0.18); this.tone(660, 0.08, 'triangle', 0.1, 0.02); break;
        case 'clear': this.tone(784, 0.1, 'triangle', 0.12); this.tone(1047, 0.14, 'triangle', 0.1, 0.08); break;
        case 'denied': this.tone(330, 0.1, 'square', 0.1); this.tone(247, 0.16, 'square', 0.1, 0.12); break;
        case 'select': this.tone(587, 0.08, 'triangle', 0.12); this.tone(880, 0.12, 'triangle', 0.1, 0.06); break;
        case 'land': this.noise(0.18, 2600, 3, 0.25); this.noise(0.12, 1800, 3, 0.18, 0.12); break;
        case 'rumble': this.noise(0.9, 160, 1, 0.25, 0, 'lowpass'); break;
        case 'divert': this.tone(523, 0.18, 'triangle', 0.12); this.tone(392, 0.22, 'triangle', 0.12, 0.16); this.tone(294, 0.4, 'triangle', 0.12, 0.34); break;
        case 'end': this.tone(659, 0.14, 'triangle', 0.13); this.tone(523, 0.14, 'triangle', 0.13, 0.13); this.tone(392, 0.3, 'triangle', 0.13, 0.26); break;
        case 'record': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.18, 'triangle', 0.12, i * 0.09)); break;
        case 'tap': this.tone(440, 0.05, 'triangle', 0.06); break;
      }
    },
  });
  RA.vibrate = (ms) => { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* yok */ } };

  /* ---------- yol (eşit aralıklı örneklenmiş çoklu çizgi) ---------- */
  const STEP = 0.05;
  class Path {
    constructor(pts) {
      // pts: [{x,z}] yoğun nokta listesi -> eşit aralıkla yeniden örnekle
      const cum = [0];
      for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z));
      const L = cum[cum.length - 1];
      const n = Math.max(2, Math.ceil(L / STEP) + 1);
      const xs = new Float32Array(n), zs = new Float32Array(n);
      let j = 0;
      for (let i = 0; i < n; i++) {
        const s = (i / (n - 1)) * L;
        while (j < pts.length - 2 && cum[j + 1] < s) j++;
        const seg = cum[j + 1] - cum[j] || 1;
        const t = RA.clamp((s - cum[j]) / seg, 0, 1);
        xs[i] = pts[j].x + (pts[j + 1].x - pts[j].x) * t;
        zs[i] = pts[j].z + (pts[j + 1].z - pts[j].z) * t;
      }
      this.xs = xs; this.zs = zs; this.n = n; this.length = L; this.ds = L / (n - 1);
    }
    at(s, out) {
      out = out || { x: 0, z: 0 };
      const n = this.n;
      if (s <= 0) { const t = this.tan(0); out.x = this.xs[0] + t.x * s; out.z = this.zs[0] + t.z * s; return out; }
      if (s >= this.length) { const t = this.tan(this.length); const e = s - this.length; out.x = this.xs[n - 1] + t.x * e; out.z = this.zs[n - 1] + t.z * e; return out; }
      const f = s / this.ds; const i = Math.floor(f); const t = f - i;
      out.x = this.xs[i] + (this.xs[i + 1] - this.xs[i]) * t;
      out.z = this.zs[i] + (this.zs[i + 1] - this.zs[i]) * t;
      return out;
    }
    tan(s, out) {
      out = out || { x: 0, z: 0 };
      const n = this.n;
      let i = Math.floor(RA.clamp(s, 0, this.length) / this.ds);
      i = RA.clamp(i, 0, n - 2);
      const dx = this.xs[i + 1] - this.xs[i], dz = this.zs[i + 1] - this.zs[i];
      const l = Math.hypot(dx, dz) || 1;
      out.x = dx / l; out.z = dz / l; return out;
    }
    heading(s) { const t = this.tan(s); return Math.atan2(t.z, t.x); }
    points() { const a = []; for (let i = 0; i < this.n; i++) a.push({ x: this.xs[i], z: this.zs[i] }); return a; }
    offset(d) {
      // sağa (+) / sola (-) paralel yol; sağ vektör = (-tz, tx)
      const a = [];
      for (let i = 0; i < this.n; i++) {
        const t = this.tan(i * this.ds);
        a.push({ x: this.xs[i] - t.z * d, z: this.zs[i] + t.x * d });
      }
      return new Path(a);
    }
    reversed() { return new Path(this.points().reverse()); }
    slice(s0, s1) {
      const a = []; const p = {};
      const n = Math.max(2, Math.ceil((s1 - s0) / STEP) + 1);
      for (let i = 0; i < n; i++) { this.at(s0 + ((s1 - s0) * i) / (n - 1), p); a.push({ x: p.x, z: p.z }); }
      return new Path(a);
    }
    // en yakın noktanın s değeri (kaba arama)
    nearest(x, z) {
      let best = 1e9, bi = 0;
      for (let i = 0; i < this.n; i += 2) { const d = (this.xs[i] - x) ** 2 + (this.zs[i] - z) ** 2; if (d < best) { best = d; bi = i; } }
      return { s: bi * this.ds, d: Math.sqrt(best) };
    }
  }
  Path.concat = function (paths) {
    const a = [];
    paths.forEach((p, k) => { const pts = p.points(); a.push(...(k === 0 ? pts : pts.slice(1))); });
    return new Path(a);
  };
  RA.Path = Path;

  // Kaplumbağa tarzı yol kurucu: θ açısı, yön = (cos θ, sin θ) (x, z düzleminde; θ artışı = ekranda saat yönü / sağa dönüş)
  class PathBuilder {
    constructor(x, z, theta) { this.x = x; this.z = z; this.th = theta; this.pts = [{ x, z }]; }
    line(len) {
      const n = Math.max(1, Math.ceil(len / 0.1));
      const dx = Math.cos(this.th), dz = Math.sin(this.th);
      for (let i = 1; i <= n; i++) this.pts.push({ x: this.x + (dx * len * i) / n, z: this.z + (dz * len * i) / n });
      this.x += dx * len; this.z += dz * len; return this;
    }
    arc(r, ang) {
      const sign = ang >= 0 ? 1 : -1;
      const rx = -Math.sin(this.th), rz = Math.cos(this.th);
      const cx = this.x + sign * r * rx, cz = this.z + sign * r * rz;
      const vx = this.x - cx, vz = this.z - cz;
      const n = Math.max(4, Math.ceil((Math.abs(ang) * r) / 0.08));
      for (let i = 1; i <= n; i++) {
        const a = (ang * i) / n; const c = Math.cos(a), s = Math.sin(a);
        this.pts.push({ x: cx + vx * c - vz * s, z: cz + vx * s + vz * c });
      }
      const last = this.pts[this.pts.length - 1];
      this.x = last.x; this.z = last.z; this.th += ang; return this;
    }
    // kübik Hermite ile hedef noktaya, hedef yönle
    to(x, z, theta, k) {
      const d = Math.hypot(x - this.x, z - this.z);
      const m = (k || 1) * d;
      const p0x = this.x, p0z = this.z, m0x = Math.cos(this.th) * m, m0z = Math.sin(this.th) * m;
      const m1x = Math.cos(theta) * m, m1z = Math.sin(theta) * m;
      const n = Math.max(8, Math.ceil(d / 0.06));
      for (let i = 1; i <= n; i++) {
        const t = i / n, t2 = t * t, t3 = t2 * t;
        const h00 = 2 * t3 - 3 * t2 + 1, h10 = t3 - 2 * t2 + t, h01 = -2 * t3 + 3 * t2, h11 = t3 - t2;
        this.pts.push({ x: h00 * p0x + h10 * m0x + h01 * x + h11 * m1x, z: h00 * p0z + h10 * m0z + h01 * z + h11 * m1z });
      }
      this.x = x; this.z = z; this.th = theta; return this;
    }
    build() { return new Path(this.pts); }
  }
  RA.PathBuilder = PathBuilder;

  /* ---------- geometri yardımcıları ---------- */
  // Bir profil (yanal, yükseklik çiftleri) bir yol boyunca süpürülür. Keskin kenarlar için her profil kenarı ayrı şerit.
  RA.extrude = function (path, profile, opts) {
    opts = opts || {};
    const s0 = opts.s0 || 0, s1 = opts.s1 == null ? path.length : opts.s1;
    const step = opts.step || 0.15;
    const vScale = opts.vScale || 1;
    const n = Math.max(2, Math.ceil((s1 - s0) / step) + 1);
    const pos = [], nor = [], uv = [], idx = [];
    const P = {}, Tn = {};
    const segs = profile.length - 1 + (opts.closed ? 1 : 0);
    let base = 0;
    for (let k = 0; k < segs; k++) {
      const a = profile[k], b = profile[(k + 1) % profile.length];
      // profil kenarının normali (yanal, y)
      // Profil soldan yukarı, üstten sağa, sağdan aşağı tanımlanır; dış normal (-dy, dx)
      let nx = -(b[1] - a[1]), ny = b[0] - a[0];
      const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
      const inward = !!opts.inward;
      if (inward) { nx = -nx; ny = -ny; }
      for (let i = 0; i < n; i++) {
        const s = s0 + ((s1 - s0) * i) / (n - 1);
        path.at(s, P); path.tan(s, Tn);
        const rx = -Tn.z, rz = Tn.x; // sağ vektör
        for (const pt of [a, b]) {
          pos.push(P.x + rx * pt[0], pt[1], P.z + rz * pt[0]);
          nor.push(rx * nx, ny, rz * nx);
          uv.push(pt === a ? k / segs : (k + 1) / segs, s * vScale);
        }
        if (i > 0) {
          const q = base + (i - 1) * 2;
          if (inward) idx.push(q, q + 2, q + 1, q + 1, q + 2, q + 3);
          else idx.push(q, q + 1, q + 2, q + 1, q + 3, q + 2);
        }
      }
      base += n * 2;
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new T.Float32BufferAttribute(nor, 3));
    g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    return g;
  };
  // düz şerit (üst yüzey)
  RA.ribbon = function (path, width, y, opts) {
    opts = opts || {};
    const off = opts.offset || 0;
    return RA.extrude(path, [[off - width / 2, y], [off + width / 2, y]], opts);
  };
  // dikdörtgen kesitli ray / bordür
  RA.barAlong = function (path, off, w, h, y0, opts) {
    const a = off - w / 2, b = off + w / 2;
    return RA.extrude(path, [[a, y0], [a, y0 + h], [b, y0 + h], [b, y0]], opts);
  };

  // Yuvarlatılmış kutu (oyuncak görünümü)
  const geoCache = {};
  RA.rbox = function (w, h, d, r) {
    r = Math.min(r == null ? 0.06 : r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001);
    const key = 'rb' + [w, h, d, r].map((v) => v.toFixed(3)).join(',');
    if (geoCache[key]) return geoCache[key];
    let g;
    if (r <= 0.005) g = new T.BoxGeometry(w, h, d);
    else {
      const sw = w - 2 * r, sd = d - 2 * r, cr = Math.min(r * 0.6, sw / 2 - 0.0005, sd / 2 - 0.0005);
      const sh = new T.Shape();
      const x0 = -sw / 2, y0 = -sd / 2;
      if (cr > 0.002) {
        sh.moveTo(x0 + cr, y0); sh.lineTo(x0 + sw - cr, y0); sh.quadraticCurveTo(x0 + sw, y0, x0 + sw, y0 + cr);
        sh.lineTo(x0 + sw, y0 + sd - cr); sh.quadraticCurveTo(x0 + sw, y0 + sd, x0 + sw - cr, y0 + sd);
        sh.lineTo(x0 + cr, y0 + sd); sh.quadraticCurveTo(x0, y0 + sd, x0, y0 + sd - cr);
        sh.lineTo(x0, y0 + cr); sh.quadraticCurveTo(x0, y0, x0 + cr, y0);
      } else { sh.moveTo(x0, y0); sh.lineTo(x0 + sw, y0); sh.lineTo(x0 + sw, y0 + sd); sh.lineTo(x0, y0 + sd); sh.lineTo(x0, y0); }
      g = new T.ExtrudeGeometry(sh, { depth: Math.max(0.001, h - 2 * r), bevelEnabled: true, bevelSize: r, bevelThickness: r, bevelSegments: 2, curveSegments: 3 });
      g.rotateX(-Math.PI / 2);
      g.translate(0, -(h - 2 * r) / 2, 0);
      g.computeVertexNormals();
    }
    geoCache[key] = g; return g;
  };
  RA.geo = function (key, make) { if (!geoCache[key]) geoCache[key] = make(); return geoCache[key]; };

  /* ---------- malzemeler ---------- */
  const matCache = {};
  RA.mat = function (color, opts) {
    opts = opts || {};
    const key = 'm' + color + JSON.stringify(opts);
    if (matCache[key]) return matCache[key];
    const m = new T.MeshStandardMaterial(Object.assign({ color, roughness: 0.62, metalness: 0.0 }, opts));
    matCache[key] = m; return m;
  };
  RA.glow = function (color, intensity) {
    const key = 'g' + color + '|' + intensity;
    if (matCache[key]) return matCache[key];
    const m = new T.MeshStandardMaterial({ color: 0x111111, emissive: color, emissiveIntensity: intensity == null ? 1.4 : intensity, roughness: 0.4 });
    matCache[key] = m; return m;
  };
  RA.basic = function (color, opts) {
    const key = 'b' + color + JSON.stringify(opts || {});
    if (matCache[key]) return matCache[key];
    const m = new T.MeshBasicMaterial(Object.assign({ color }, opts || {}));
    matCache[key] = m; return m;
  };
  RA.mesh = function (geo, mat, x, y, z, shadow) {
    const m = new T.Mesh(geo, mat);
    m.position.set(x || 0, y || 0, z || 0);
    if (shadow !== false) { m.castShadow = true; m.receiveShadow = true; }
    return m;
  };

  /* ---------- tuval dokuları ---------- */
  const texCache = {};
  function canvasTex(key, size, draw, repeat) {
    if (texCache[key]) return texCache[key];
    const c = document.createElement('canvas'); c.width = c.height = size;
    const g = c.getContext('2d'); draw(g, size);
    const t = new T.CanvasTexture(c);
    t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 4;
    t.encoding = T.sRGBEncoding;
    if (repeat) t.repeat.set(repeat, repeat);
    texCache[key] = t; return t;
  }
  function speckle(g, size, base, cols, count, rmin, rmax, seed) {
    const rnd = RA.rng(seed || 7);
    g.fillStyle = base; g.fillRect(0, 0, size, size);
    for (let i = 0; i < count; i++) {
      g.fillStyle = cols[Math.floor(rnd() * cols.length)];
      const r = rmin + rnd() * (rmax - rmin); const x = rnd() * size, y = rnd() * size;
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
      // kenarlarda dikişsiz tekrar
      if (x < r) { g.beginPath(); g.arc(x + size, y, r, 0, Math.PI * 2); g.fill(); }
      if (y < r) { g.beginPath(); g.arc(x, y + size, r, 0, Math.PI * 2); g.fill(); }
    }
  }
  RA.tex = {
    grass: () => canvasTex('grass', 256, (g, s) => speckle(g, s, '#7fae46', ['#76a53f', '#8bbb52', '#6e9a3b', '#97c35d', '#7aa944'], 2600, 1, 3.2, 11)),
    grassDusk: () => canvasTex('grassDusk', 256, (g, s) => speckle(g, s, '#56785c', ['#4f7057', '#5e8263', '#486650', '#668a69'], 2400, 1, 3.2, 12)),
    gravel: () => canvasTex('gravel', 256, (g, s) => speckle(g, s, '#9a8f84', ['#8a8076', '#b2a89c', '#7a7168', '#a69b8e', '#6d655e', '#c2b8ab'], 5200, 0.8, 2.6, 13)),
    asphalt: () => canvasTex('asphalt', 256, (g, s) => speckle(g, s, '#4a4e57', ['#454952', '#50545e', '#3f434b', '#575b65'], 4200, 0.6, 1.8, 14)),
    sidewalk: () => canvasTex('sidewalk', 128, (g, s) => {
      speckle(g, s, '#d9d2c4', ['#d2cbbd', '#ded8cb', '#cec6b7'], 600, 0.6, 1.6, 15);
      g.strokeStyle = 'rgba(120,110,95,0.35)'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(0, 1); g.lineTo(s, 1); g.moveTo(1, 0); g.lineTo(1, s); g.stroke();
    }),
    sand: () => canvasTex('sand', 256, (g, s) => speckle(g, s, '#c9b48a', ['#c2ad83', '#d1bd94', '#bba57c'], 2000, 0.7, 2, 16)),
    water: () => canvasTex('water', 256, (g, s) => {
      const rnd = RA.rng(17);
      g.fillStyle = '#3f86b8'; g.fillRect(0, 0, s, s);
      for (let i = 0; i < 160; i++) {
        g.strokeStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.20)' : 'rgba(20,60,110,0.25)';
        g.lineWidth = 1 + rnd() * 2;
        const x = rnd() * s, y = rnd() * s, l = 8 + rnd() * 26;
        g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + l / 2, y - 3, x + l, y); g.stroke();
      }
    }),
    seaDusk: () => canvasTex('seaDusk', 256, (g, s) => {
      const rnd = RA.rng(18);
      g.fillStyle = '#28497a'; g.fillRect(0, 0, s, s);
      for (let i = 0; i < 180; i++) {
        g.strokeStyle = rnd() < 0.5 ? 'rgba(180,200,255,0.16)' : 'rgba(5,15,40,0.3)';
        g.lineWidth = 1 + rnd() * 1.6;
        const x = rnd() * s, y = rnd() * s, l = 10 + rnd() * 30;
        g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + l / 2, y - 2, x + l, y); g.stroke();
      }
    }),
    glow: () => canvasTex('glow', 128, (g, s) => {
      const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.55)');
      gr.addColorStop(0.6, 'rgba(255,255,255,0.12)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, s, s);
    }),
    blob: () => canvasTex('blob', 128, (g, s) => {
      const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      gr.addColorStop(0, 'rgba(0,0,0,0.75)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.4)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(0, 0, s, s);
    }),
    dash: () => canvasTex('dash', 64, (g, s) => {
      g.clearRect(0, 0, s, s); g.fillStyle = '#fff'; g.fillRect(0, 0, s, s * 0.55);
    }),
  };
  RA.tex.clone = function (t, rx, ry) { const c = t.clone(); c.needsUpdate = true; c.repeat.set(rx, ry); return c; };

  // Işık halesi (billboard sprite)
  RA.glowSprite = function (color, size, opacity) {
    const m = new T.SpriteMaterial({ map: RA.tex.glow(), color, transparent: true, opacity: opacity == null ? 0.9 : opacity, depthWrite: false, blending: T.AdditiveBlending });
    const s = new T.Sprite(m); s.scale.set(size, size, 1); return s;
  };
  // Zemine yatırılmış hale (ışık havuzu)
  RA.glowDecal = function (color, w, h, opacity) {
    const m = new T.MeshBasicMaterial({ map: RA.tex.glow(), color, transparent: true, opacity: opacity == null ? 0.6 : opacity, depthWrite: false, blending: T.AdditiveBlending });
    const p = new T.Mesh(new T.PlaneGeometry(w, h), m); p.rotation.x = -Math.PI / 2; p.renderOrder = 2; return p;
  };
  RA.blobShadow = function (w, h, opacity) {
    const m = new T.MeshBasicMaterial({ map: RA.tex.blob(), transparent: true, opacity: opacity == null ? 0.5 : opacity, depthWrite: false });
    const p = new T.Mesh(new T.PlaneGeometry(w, h), m); p.rotation.x = -Math.PI / 2; p.renderOrder = 1; return p;
  };

  /* ---------- statik geometriyi malzemeye göre birleştir (çizim çağrısı azaltma) ---------- */
  RA.mergeStatic = function (root, opts) {
    opts = opts || {};
    root.updateMatrixWorld(true);
    const groups = new Map();
    const remove = [];
    root.traverse((o) => {
      if (!o.isMesh || o.userData.keep || o.isInstancedMesh) return;
      if (Array.isArray(o.material)) return;
      const key = o.material.uuid + '|' + (o.castShadow ? 1 : 0) + (o.receiveShadow ? 1 : 0);
      if (!groups.has(key)) groups.set(key, { mat: o.material, cast: o.castShadow, recv: o.receiveShadow, geos: [] });
      let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      if (!g.attributes.uv) { g.setAttribute('uv', new T.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); }
      if (!g.attributes.normal) g.computeVertexNormals();
      g.applyMatrix4(o.matrixWorld);
      groups.get(key).geos.push(g);
      remove.push(o);
    });
    remove.forEach((o) => o.parent && o.parent.remove(o));
    const out = new T.Group();
    groups.forEach((gr) => {
      let total = 0; gr.geos.forEach((g) => (total += g.attributes.position.count));
      const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), uv = new Float32Array(total * 2);
      let o3 = 0, o2 = 0;
      gr.geos.forEach((g) => {
        pos.set(g.attributes.position.array, o3); nor.set(g.attributes.normal.array, o3); uv.set(g.attributes.uv.array.subarray(0, g.attributes.position.count * 2), o2);
        o3 += g.attributes.position.count * 3; o2 += g.attributes.position.count * 2; g.dispose();
      });
      const bg = new T.BufferGeometry();
      bg.setAttribute('position', new T.BufferAttribute(pos, 3));
      bg.setAttribute('normal', new T.BufferAttribute(nor, 3));
      bg.setAttribute('uv', new T.BufferAttribute(uv, 2));
      bg.computeBoundingSphere();
      const m = new T.Mesh(bg, gr.mat); m.castShadow = gr.cast; m.receiveShadow = gr.recv; m.matrixAutoUpdate = false;
      out.add(m);
    });
    return out;
  };

  // Bir modelin hareketsiz parçalarını malzemeye göre birleştir (çizim çağrısı azaltır). keep(o) true dönenler ayrı kalır.
  RA.compact = function (g, keep) {
    g.traverse((o) => { if (o.isMesh && keep && keep(o)) o.userData.keep = true; });
    const merged = RA.mergeStatic(g);
    merged.children.forEach((m) => { m.castShadow = true; m.receiveShadow = false; });
    g.add(merged);
    return g;
  };

  /* ---------- kamera sığdırma ---------- */
  // Kamerayı verilen yönden hedefe bakarken, noktalar ekranın izin verilen bölgesine sığacak şekilde konumlar.
  RA.fitCamera = function (camera, opts) {
    const dir = new T.Vector3().copy(opts.dir).normalize();
    const target = new T.Vector3().copy(opts.target);
    const pts = opts.points.map((p) => new T.Vector3(p[0], p[1] || 0, p[2]));
    const m = Object.assign({ top: 0.1, bottom: 0.05, left: 0.04, right: 0.04 }, opts.margin || {});
    // NDC sınırları
    const xmin = -1 + 2 * m.left, xmax = 1 - 2 * m.right, ymin = -1 + 2 * m.bottom, ymax = 1 - 2 * m.top;
    const v = new T.Vector3();
    function bbox(dist) {
      camera.position.copy(target).addScaledVector(dir, dist);
      camera.lookAt(target); camera.updateMatrixWorld(true); camera.updateProjectionMatrix();
      let a = 1e9, b = -1e9, c = 1e9, d = -1e9;
      for (const p of pts) { v.copy(p).project(camera); a = Math.min(a, v.x); b = Math.max(b, v.x); c = Math.min(c, v.y); d = Math.max(d, v.y); }
      return { x0: a, x1: b, y0: c, y1: d };
    }
    let dist = opts.start || 30;
    for (let iter = 0; iter < 4; iter++) {
      let lo = 2, hi = 400;
      for (let k = 0; k < 40; k++) {
        const mid = (lo + hi) / 2; const bb = bbox(mid);
        if (bb.x1 - bb.x0 <= xmax - xmin && bb.y1 - bb.y0 <= ymax - ymin) hi = mid; else lo = mid;
      }
      dist = hi;
      const bb = bbox(dist);
      // hedefi kaydır: kutunun merkezini izinli bölgenin merkezine getir
      const cx = (bb.x0 + bb.x1) / 2, cy = (bb.y0 + bb.y1) / 2;
      const tx = (xmin + xmax) / 2, ty = (ymin + ymax) / 2;
      const right = new T.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
      const up = new T.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
      const hView = 2 * dist * Math.tan(T.MathUtils.degToRad(camera.fov / 2));
      const wView = hView * camera.aspect;
      target.addScaledVector(right, ((cx - tx) / 2) * wView).addScaledVector(up, ((cy - ty) / 2) * hView);
    }
    bbox(dist);
    return { target, dist };
  };

  RA.project = function (v3, camera, w, h, out) {
    const v = RA._pv || (RA._pv = new T.Vector3());
    v.copy(v3).project(camera);
    out = out || {};
    out.x = (v.x * 0.5 + 0.5) * w; out.y = (-v.y * 0.5 + 0.5) * h; out.behind = v.z > 1;
    return out;
  };
  // Ekran noktasından y=h düzlemine ışın
  RA.screenToGround = function (x, y, camera, w, h, planeY) {
    const ndc = new T.Vector2((x / w) * 2 - 1, -(y / h) * 2 + 1);
    const rc = RA._rc || (RA._rc = new T.Raycaster());
    rc.setFromCamera(ndc, camera);
    const pl = new T.Plane(new T.Vector3(0, 1, 0), -(planeY || 0));
    const out = new T.Vector3();
    return rc.ray.intersectPlane(pl, out) ? out : null;
  };

  /* ---------- yönlendirilmiş kutu çakışması (SAT, 2B) ---------- */
  RA.obbOverlap = function (a, b) {
    // a,b: {x,z,ang,hl,hw}
    const axes = [a.ang, a.ang + Math.PI / 2, b.ang, b.ang + Math.PI / 2];
    for (const ang of axes) {
      const ax = Math.cos(ang), az = Math.sin(ang);
      const pa = proj(a, ax, az), pb = proj(b, ax, az);
      if (pa[1] < pb[0] || pb[1] < pa[0]) return false;
    }
    return true;
    function proj(o, ax, az) {
      const c = o.x * ax + o.z * az;
      const ux = Math.cos(o.ang), uz = Math.sin(o.ang);
      const r = Math.abs(ux * ax + uz * az) * o.hl + Math.abs(-uz * ax + ux * az) * o.hw;
      return [c - r, c + r];
    }
  };

  /* ---------- sahne ışığı ---------- */
  RA.makeLights = function (scene, o) {
    const hemi = new T.HemisphereLight(o.sky, o.ground, o.hemi);
    scene.add(hemi);
    const sun = new T.DirectionalLight(o.sun, o.sunI);
    sun.position.set(o.sunPos[0], o.sunPos[1], o.sunPos[2]);
    sun.target.position.set(o.sunTarget ? o.sunTarget[0] : 0, 0, o.sunTarget ? o.sunTarget[2] : 0);
    sun.castShadow = true;
    const sz = o.shadowSize || 20;
    const cam = sun.shadow.camera;
    cam.left = -sz; cam.right = sz; cam.top = sz; cam.bottom = -sz; cam.near = 1; cam.far = 120;
    sun.shadow.mapSize.set(RA.quality.shadow, RA.quality.shadow);
    sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.02; sun.shadow.radius = 4;
    scene.add(sun); scene.add(sun.target);
    if (o.fill) { const f = new T.DirectionalLight(o.fill, o.fillI || 0.3); f.position.set(-o.sunPos[0], o.sunPos[1] * 0.6, -o.sunPos[2]); scene.add(f); }
    return { hemi, sun };
  };

  // Mobil cihazlar için kalite ayarı
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && Math.min(screen.width, screen.height) < 820);
  RA.quality = { mobile, shadow: mobile ? 1024 : 2048, dpr: Math.min(window.devicePixelRatio || 1, mobile ? 2 : 2) };
})();
