/* RAY ARASI — Bölümler: 3B maket (tahta, binalar, nehir, ray, serbest yollar, köprüler, ışıklar, işaretler) */
(function () {
  'use strict';
  const RA = window.RA;
  const LV = RA.LV;
  const WS = RA.WS;
  const T = THREE;
  const M = RA.M;
  const rb = RA.rbox, mesh = RA.mesh;
  const GH = 0.6;

  let MAT = null;
  function mats() {
    if (MAT) return MAT;
    MAT = {
      grass: new T.MeshStandardMaterial({ map: RA.tex.clone(RA.tex.grass(), 5, 8), roughness: 0.95 }),
      asphalt: new T.MeshStandardMaterial({ map: RA.tex.clone(RA.tex.asphalt(), 1, 1), roughness: 0.92 }),
      curb: RA.mat(0xd9d6cc, { roughness: 0.9 }),
      deck: RA.mat(0x8f8b82, { roughness: 0.85 }),
      parapet: RA.mat(0xe8e4da, { roughness: 0.8 }),
      pillar: RA.mat(0xa9a59b, { roughness: 0.85 }),
      rail: RA.mat(0xf2f2ec, { roughness: 0.6 }),
      line: RA.mat(0xf4f4ee, { roughness: 0.7 }),
      dash: new T.MeshBasicMaterial({ map: RA.tex.dash(), transparent: true, depthWrite: false }),
      railing: RA.mat(0x7f8a96, { roughness: 0.4, metalness: 0.5 }),
      lampHead: new T.MeshStandardMaterial({ color: 0xfff6d8, emissive: 0xffe9a8, emissiveIntensity: 0.9 }),
      water: new T.MeshStandardMaterial({ color: 0x3f8fd0, roughness: 0.25, metalness: 0.05, transparent: true, opacity: 0.92 }),
      bank: RA.mat(0xc8b98f, { roughness: 1 }),
      gravel: new T.MeshStandardMaterial({ map: RA.tex.clone(RA.tex.gravel(), 1, 1), roughness: 1 }),
      steel: RA.mat(0x9aa1aa, { roughness: 0.35, metalness: 0.6 }),
      sleeper: RA.mat(0x6b4e3a, { roughness: 0.9 }),
      wood: RA.mat(0x9a6b43, { roughness: 0.8 }),
      table: RA.mat(0xf1e3c6, { roughness: 1 }),
      cloud: new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: true, emissive: 0xdfe8f5, emissiveIntensity: 0.25 }),
      drive: RA.mat(0x5a5e66, { roughness: 0.9 }),
      // demiryolu
      ballast: new T.MeshStandardMaterial({ map: RA.tex.clone(RA.tex.gravel(), 1, 1), color: 0xcfc6b8, roughness: 1 }),
      railSteel: RA.mat(0x8d949c, { roughness: 0.3, metalness: 0.7 }),
      tie: RA.mat(0x6b4e3a, { roughness: 0.9 }),
      hill: RA.mat(0x6e9b48, { roughness: 1, flatShading: true }),
      rock: RA.mat(0x8c8579, { roughness: 1, flatShading: true }),
      portal: RA.mat(0xb7ab96, { roughness: 0.95 }),
      dark: new T.MeshBasicMaterial({ color: 0x0d0f12 }),
      // havalimanı
      concrete: RA.mat(0xbfc0bc, { roughness: 0.9 }),
      apron: RA.mat(0xa9aba7, { roughness: 0.95 }),
      runway: RA.mat(0x3a3d44, { roughness: 0.9 }),
      yline: RA.mat(0xf2c230, { roughness: 0.6 }),
      blueL: new T.MeshStandardMaterial({ color: 0x0a1630, emissive: 0x3b6dff, emissiveIntensity: 1.6 }),
      glass: RA.mat(0x8fc3e0, { roughness: 0.15, metalness: 0.3 }),
    };
    return MAT;
  }
  // moda göre yol genişliği (yarım): kenar, köprü korkuluğu, belirsiz kesişim yüzeyi
  const HALF = { road: 0.86, rail: 0.66, air: 1.14 };
  // çokgenin kenarlarına en kısa uzaklık
  function polyDist(poly, x, z) {
    let d = 1e9;
    for (let i = 0; i < poly.length; i++) {
      const [ax, az] = poly[i], [bx, bz] = poly[(i + 1) % poly.length];
      const vx = bx - ax, vz = bz - az, l2 = vx * vx + vz * vz || 1, t = RA.clamp(((x - ax) * vx + (z - az) * vz) / l2, 0, 1);
      d = Math.min(d, Math.hypot(ax + vx * t - x, az + vz * t - z));
    }
    return d;
  }
  const HILL_B = 0.9; // dağın eteği: çokgenden bu kadar taşar
  const clipHill = (poly) => poly.map(([x, z]) => [RA.clamp(x, -LV.C.W / 2 + 0.05 + HILL_B, LV.C.W / 2 - 0.05 - HILL_B), RA.clamp(z, -LV.C.D / 2 + 0.05 + HILL_B, LV.C.D / 2 - 0.05 - HILL_B)]);
  // dağ yüksekliği: kenardan içeri doğru yumuşakça yükselir (eteği çokgenden HILL_B taşar), tepesi hafif engebeli
  function hillHeight(poly, x, z) {
    const inside = LV.geo.inPoly(poly, x, z), d = polyDist(poly, x, z), sd = inside ? d : -d;
    const k = RA.clamp((sd + HILL_B) / 1.6, 0, 1);
    const n = Math.sin(x * 1.7 + z * 0.6) * 0.5 + Math.sin(z * 1.3 - x * 0.9) * 0.5;
    return k <= 0 ? -0.05 : (k * k * (3 - 2 * k)) * (1.9 + Math.min(1, Math.max(0, sd) / 2.5) * 0.9) + (inside ? n * 0.18 * Math.min(1, sd) : 0);
  }

  // yüksekliği değişen şerit: üst yüzey (sağ vektör = (-tz, tx))
  function ribbonY(path, x0, x1, yf, lift, step, vScale) {
    const n = Math.max(2, Math.ceil(path.length / (step || 0.2)) + 1);
    const pos = [], nor = [], uv = [], idx = [];
    const P = {}, Tn = {};
    for (let i = 0; i < n; i++) {
      const s = (path.length * i) / (n - 1);
      path.at(s, P); path.tan(s, Tn);
      const rx = -Tn.z, rz = Tn.x, y = yf(s) + lift;
      pos.push(P.x + rx * x0, y, P.z + rz * x0, P.x + rx * x1, y, P.z + rz * x1);
      nor.push(0, 1, 0, 0, 1, 0);
      uv.push(0, s * (vScale || 1), 1, s * (vScale || 1));
      if (i > 0) { const q = (i - 1) * 2; idx.push(q, q + 1, q + 2, q + 1, q + 3, q + 2); }
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new T.Float32BufferAttribute(nor, 3));
    g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    return g;
  }
  // dikey yan yüzey (köprü kenarı): x ofsetinde y(s)+top ile y(s)+bot arası
  function wallY(path, x, yf, top, bot, step, flip) {
    const n = Math.max(2, Math.ceil(path.length / (step || 0.25)) + 1);
    const pos = [], idx = [];
    const P = {}, Tn = {};
    for (let i = 0; i < n; i++) {
      const s = (path.length * i) / (n - 1);
      path.at(s, P); path.tan(s, Tn);
      const rx = -Tn.z, rz = Tn.x, y = yf(s);
      pos.push(P.x + rx * x, y + top, P.z + rz * x, P.x + rx * x, Math.max(0.01, y + bot), P.z + rz * x);
      if (i > 0) { const q = (i - 1) * 2; if (flip) idx.push(q, q + 2, q + 1, q + 1, q + 2, q + 3); else idx.push(q, q + 1, q + 2, q + 1, q + 3, q + 2); }
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    g.setIndex(idx); g.computeVertexNormals();
    return g;
  }

  const texCache = {};
  function canvasTex(key, w, h, draw) {
    if (texCache[key]) return texCache[key];
    const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
    draw(g, w, h);
    const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; texCache[key] = t; return t;
  }
  function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  // gökyüzü: yukarıdan aşağı açılan mavi (menü için bulutlu ve tepeli)
  RA.skyTexture = function (menu) {
    return canvasTex('sky' + (menu ? 'm' : ''), menu ? 512 : 16, menu ? 1024 : 256, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#5fb8ff'); gr.addColorStop(0.55, '#a9dcff'); gr.addColorStop(1, '#e6f7ff');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      if (!menu) return;
      const cloud = (x, y, s) => { g.fillStyle = 'rgba(255,255,255,0.92)'; for (const [dx, dy, r] of [[0, 0, 1], [0.9, 0.15, 0.8], [-0.9, 0.2, 0.75], [0.35, -0.45, 0.75], [-0.4, -0.3, 0.6]]) { g.beginPath(); g.arc(x + dx * s * 40, y + dy * s * 40, r * s * 34, 0, Math.PI * 2); g.fill(); } };
      cloud(90, 120, 1.1); cloud(400, 70, 0.9); cloud(300, 300, 0.7); cloud(60, 520, 0.8); cloud(450, 640, 1.0); cloud(220, 820, 0.7);
      const hill = (y, col, amp, ph) => { g.fillStyle = col; g.beginPath(); g.moveTo(0, h); for (let x = 0; x <= w; x += 8) g.lineTo(x, y + Math.sin(x / w * Math.PI * 2 + ph) * amp + Math.sin(x / w * Math.PI * 5 + ph * 2) * amp * 0.35); g.lineTo(w, h); g.fill(); };
      hill(h - 120, '#8fd36b', 26, 0.4); hill(h - 70, '#6cc251', 22, 2.1);
    });
  };
  function popTex(css) {
    return canvasTex('pop' + css, 128, 80, (g) => {
      g.fillStyle = '#ffffff'; rr(g, 6, 8, 116, 64, 30); g.fill();
      g.fillStyle = css; rr(g, 12, 14, 104, 52, 24); g.fill();
      g.fillStyle = '#ffffff'; g.font = '900 40px Overpass, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('+1', 64, 43);
    });
  }
  // kesişim işareti: kavşak (artı), köprü (kemer), alt geçit (tünel), hemzemin (bariyer)
  // köprü / alt geçit modunda var olanın işaretinde kaldırma rozeti (×) olur
  function removeTex(type) {
    return canvasTex('mkx' + type, 128, 128, (g) => {
      g.drawImage(markTex(type).image, 0, 0);
      g.fillStyle = '#ffffff'; g.beginPath(); g.arc(100, 26, 22, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#e8453c'; g.beginPath(); g.arc(100, 26, 17, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#ffffff'; g.lineWidth = 6; g.lineCap = 'round'; g.beginPath(); g.moveTo(92, 18); g.lineTo(108, 34); g.moveTo(108, 18); g.lineTo(92, 34); g.stroke();
    });
  }
  function markTex(type) {
    return canvasTex('mk' + type, 128, 128, (g) => {
      const col = { junction: '#ffc531', level: '#ffc531', bridge: '#3d8bff', tunnel: '#a061f0', pending: '#ff7a1a' }[type];
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.arc(64, 68, 54, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#ffffff'; g.beginPath(); g.arc(64, 62, 54, 0, Math.PI * 2); g.fill();
      g.fillStyle = col; g.beginPath(); g.arc(64, 62, 46, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#ffffff'; g.lineWidth = 10; g.lineCap = 'round';
      if (type === 'pending') { g.fillStyle = '#ffffff'; g.font = '900 68px Overpass, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('?', 64, 68); return; }
      g.beginPath();
      if (type === 'junction') { g.moveTo(64, 34); g.lineTo(64, 90); g.moveTo(36, 62); g.lineTo(92, 62); }
      else if (type === 'level') { g.moveTo(36, 46); g.lineTo(92, 78); g.moveTo(36, 78); g.lineTo(92, 46); }
      else if (type === 'bridge') { g.moveTo(30, 52); g.lineTo(98, 52); g.moveTo(40, 86); g.quadraticCurveTo(64, 46, 88, 86); }
      else { g.moveTo(30, 84); g.lineTo(98, 84); g.moveTo(42, 84); g.lineTo(42, 66); g.quadraticCurveTo(64, 34, 86, 66); g.lineTo(86, 84); }
      g.stroke();
    });
  }
  function signTex(text, css) {
    return canvasTex('sg' + text + css, 256, 96, (g) => {
      g.fillStyle = '#ffffff'; rr(g, 0, 0, 256, 96, 22); g.fill();
      g.fillStyle = css; rr(g, 7, 7, 242, 82, 16); g.fill();
      g.fillStyle = '#ffffff'; g.textAlign = 'center'; g.textBaseline = 'middle';
      let fs = 50; g.font = '900 ' + fs + 'px Overpass, Arial, sans-serif';
      while (g.measureText(text).width > 220 && fs > 22) { fs -= 2; g.font = '900 ' + fs + 'px Overpass, Arial, sans-serif'; }
      g.fillText(text, 128, 54);
    });
  }
  function anchorTex(css) {
    return canvasTex('an' + css, 128, 128, (g) => {
      g.strokeStyle = css; g.lineWidth = 12; g.setLineDash([16, 10]); g.beginPath(); g.arc(64, 64, 50, 0, Math.PI * 2); g.stroke();
      g.fillStyle = css; g.beginPath(); g.arc(64, 64, 18, 0, Math.PI * 2); g.fill();
    });
  }
  // evde bekleyenler: 8 nokta
  function pendTex(n, cap) {
    return canvasTex('pd' + n + '/' + cap, 256, 64, (g) => {
      g.fillStyle = 'rgba(20,28,35,0.78)'; rr(g, 2, 6, 252, 52, 26); g.fill();
      const col = n >= cap - 2 ? '#ff4b3e' : n >= cap / 2 ? '#ffb400' : '#3ddc84';
      for (let k = 0; k < cap; k++) { g.fillStyle = k < n ? col : 'rgba(255,255,255,0.22)'; g.beginPath(); g.arc(30 + k * 28, 32, 10, 0, Math.PI * 2); g.fill(); }
    });
  }
  function heartTex() {
    return canvasTex('heart', 128, 128, (g) => {
      g.fillStyle = '#ff4d7a'; g.strokeStyle = '#ffffff'; g.lineWidth = 9;
      g.beginPath(); g.moveTo(64, 108); g.bezierCurveTo(10, 72, 12, 26, 42, 22); g.bezierCurveTo(56, 20, 62, 30, 64, 40); g.bezierCurveTo(66, 30, 72, 20, 86, 22); g.bezierCurveTo(116, 26, 118, 72, 64, 108); g.closePath();
      g.stroke(); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.55)'; g.beginPath(); g.ellipse(44, 44, 9, 6, -0.6, 0, Math.PI * 2); g.fill();
    });
  }
  LV.tex = { markTex, signTex, pendTex, heartTex };

  class LvView {
    constructor(scene) { this.scene = scene; this.base = null; this.roads = null; this.prev = null; this.anims = []; this.lastNow = 0; this.pops = 0; }

    /* ---------- şenlik: teslimat parıltısı, kazanınca konfeti ---------- */
    pop(x, z, css) {
      const now = performance.now(); if (now - this.pops < 120) return; this.pops = now; // çok sık olmasın
      const sp = new T.Sprite(new T.SpriteMaterial({ map: popTex(css || '#ffc531'), transparent: true, depthTest: false })); sp.renderOrder = 25; sp.scale.set(1.1, 0.7, 1);
      const grp = new T.Group(); grp.position.set(x, 1.6, z); grp.add(sp); this.scene.add(grp);
      const stars = []; for (let k = 0; k < 6; k++) { const s = RA.glowSprite(k % 2 ? 0xffe27a : 0xffffff, 0.35, 1); s.renderOrder = 24; grp.add(s); const a = (k / 6) * Math.PI * 2; stars.push({ s, vx: Math.cos(a) * 2, vz: Math.sin(a) * 2 }); }
      this.anims.push({ t: 0, step: (a, dt) => {
        a.t += dt; const t = a.t;
        sp.position.y = t * 1.4; sp.material.opacity = t < 0.6 ? 1 : Math.max(0, 1 - (t - 0.6) / 0.4); const sc = t < 0.15 ? t / 0.15 : 1; sp.scale.set(1.1 * sc, 0.7 * sc, 1);
        for (const q of stars) { q.s.position.set(q.vx * t, 0.4 + 2 * t - 3 * t * t, q.vz * t); q.s.material.opacity = Math.max(0, 1 - t / 0.6); }
        if (t > 1) { this.scene.remove(grp); sp.material.dispose(); stars.forEach((q) => q.s.material.dispose()); return false; }
        return true;
      } });
    }
    confetti() {
      const W = LV.C.W, D = LV.C.D, n = 160, cols = [0xff5a5f, 0xffc531, 0x2fbf71, 0x2f7fe0, 0x9050d8, 0xff8a1f, 0x12a8a0];
      const geo = new T.PlaneGeometry(0.32, 0.18);
      const ps = [];
      const grp = new T.Group(); this.scene.add(grp);
      for (let i = 0; i < n; i++) {
        const mesh = new T.Mesh(geo, new T.MeshBasicMaterial({ color: cols[i % cols.length], side: T.DoubleSide, transparent: true }));
        mesh.position.set((Math.random() - 0.5) * W, 8 + Math.random() * 10, (Math.random() - 0.5) * D);
        grp.add(mesh); ps.push({ mesh, vy: -2.5 - Math.random() * 2.5, sx: (Math.random() - 0.5) * 2, rx: Math.random() * 6, rz: Math.random() * 6 });
      }
      this.anims.push({ t: 0, step: (a, dt) => {
        a.t += dt;
        for (const q of ps) { q.mesh.position.y += q.vy * dt; q.mesh.position.x += Math.sin(a.t * 3 + q.rx) * q.sx * dt; q.mesh.rotation.x += q.rx * dt; q.mesh.rotation.z += q.rz * dt; if (a.t > 3) q.mesh.material.opacity = Math.max(0, 1 - (a.t - 3) / 1); }
        if (a.t > 4) { this.scene.remove(grp); geo.dispose(); ps.forEach((q) => q.mesh.material.dispose()); return false; }
        return true;
      } });
    }
    // maketin çevresinde süzülen bulutlar
    clouds() {
      if (this.cloudG) this.scene.remove(this.cloudG);
      const g = new T.Group(), m = mats(), rnd = RA.rng(77), W = LV.C.W, D = LV.C.D;
      const spots = [[-W / 2 - 6, -D / 4], [W / 2 + 6, D / 6], [-W / 2 - 8, D / 3], [W / 2 + 7, -D / 3], [0, -D / 2 - 9], [-W / 3, D / 2 + 7], [W / 3, D / 2 + 8]];
      for (const [x, z] of spots) {
        const c = new T.Group();
        const k = 3 + Math.floor(rnd() * 3);
        for (let i = 0; i < k; i++) { const s = new T.Mesh(RA.geo('cloudball', () => new T.IcosahedronGeometry(1, 1)), m.cloud); const r = 1.2 + rnd() * 1.3; s.scale.set(r * 1.3, r * 0.8, r); s.position.set((i - k / 2) * 1.6, rnd() * 0.6, (rnd() - 0.5) * 1.2); c.add(s); }
        c.position.set(x, 4 + rnd() * 3, z); c.userData.v = 0.15 + rnd() * 0.2; c.userData.x0 = x; g.add(c);
      }
      g.children.forEach((c) => c.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } }));
      this.scene.add(g); this.cloudG = g;
    }

    /* ---------- animasyonlar: yolun serilmesi ve yolların öpüşmesi ---------- */
    sweep(pts) {
      const path = new RA.Path(pts); if (path.length < 0.5) return;
      const g = ribbonY(path, -0.85, 0.85, () => 0, 0.32, 0.15);
      const n = g.index.count;
      const m = new T.Mesh(g, new T.MeshBasicMaterial({ color: 0xfff1a8, transparent: true, opacity: 0.85, depthWrite: false, blending: T.AdditiveBlending }));
      m.renderOrder = 21; g.setDrawRange(0, 0); this.scene.add(m);
      const dur = RA.clamp(path.length / 40, 0.25, 0.6);
      this.anims.push({ t: 0, step: (a, dt) => {
        a.t += dt;
        g.setDrawRange(0, Math.min(n, Math.floor((a.t / dur) * n / 6) * 6));
        if (a.t > dur) m.material.opacity = Math.max(0, 0.85 * (1 - (a.t - dur) / 0.35));
        if (a.t > dur + 0.35) { this.scene.remove(m); g.dispose(); m.material.dispose(); return false; }
        return true;
      } });
    }
    kiss(x, z, y) {
      y = y || 0.12;
      const grp = new T.Group(); grp.position.set(x, y, z); this.scene.add(grp);
      const ring = (col, r0) => { const r = new T.Mesh(RA.geo('kring', () => { const q = new T.RingGeometry(0.55, 0.75, 40); q.rotateX(-Math.PI / 2); return q; }), new T.MeshBasicMaterial({ color: col, transparent: true, opacity: 1, depthWrite: false, depthTest: false })); r.renderOrder = 22; r.scale.setScalar(r0); grp.add(r); return r; };
      const r1 = ring(0xffffff, 0.6), r2 = ring(0xff6f9a, 0.3);
      const sparks = [];
      for (let k = 0; k < 9; k++) { const sp = RA.glowSprite(k % 2 ? 0xffe27a : 0xff8fb0, 0.5, 1); sp.renderOrder = 23; grp.add(sp); const a = (k / 9) * Math.PI * 2; sparks.push({ sp, vx: Math.cos(a) * 3.2, vz: Math.sin(a) * 3.2, vy: 2 + (k % 3) }); }
      const heart = new T.Sprite(new T.SpriteMaterial({ map: heartTex(), transparent: true, depthTest: false })); heart.renderOrder = 24; heart.scale.set(0.2, 0.2, 1); grp.add(heart);
      this.anims.push({ t: 0, step: (a, dt) => {
        a.t += dt; const t = a.t;
        r1.scale.setScalar(0.6 + t * 4.5); r1.material.opacity = Math.max(0, 1 - t / 0.55);
        const t2 = Math.max(0, t - 0.1); r2.scale.setScalar(0.3 + t2 * 3.5); r2.material.opacity = t < 0.1 ? 0 : Math.max(0, 1 - t2 / 0.6);
        for (const s of sparks) { s.sp.position.set(s.vx * t, s.vy * t - 4 * t * t, s.vz * t); s.sp.material.opacity = Math.max(0, 1 - t / 0.6); }
        const hs = t < 0.25 ? RA.smooth(t / 0.25) * 1.25 : 1.25 - Math.min(0.15, (t - 0.25) * 0.4);
        heart.scale.set(hs, hs, 1); heart.position.y = 0.8 + t * 1.6; heart.material.opacity = t < 0.7 ? 1 : Math.max(0, 1 - (t - 0.7) / 0.35);
        if (t > 1.05) { this.scene.remove(grp); r1.material.dispose(); r2.material.dispose(); heart.material.dispose(); sparks.forEach((s) => s.sp.material.dispose()); return false; }
        return true;
      } });
    }
    dispose(g) { if (!g) return; this.scene.remove(g); g.traverse((o) => { if (o.isMesh && o.geometry && !o.geometry.userData.cached && !o.geometry.parameters) o.geometry.dispose(); }); }

    /* ---------- bölüm sahnesi (değişmeyen kısım) ---------- */
    buildBase(level, net) {
      this.dispose(this.base);
      const m = mats();
      const root = new T.Group(), stat = new T.Group();
      const BW = LV.C.W, BD = LV.C.D;
      const table = mesh(new T.BoxGeometry(BW + 40, 0.4, BD + 40), m.table, 0, -GH - 0.5, 0); table.castShadow = false; root.add(table);
      for (const [x, z, w, d] of [[0, -BD / 2 - 0.3, BW + 1.2, 0.6], [0, BD / 2 + 0.3, BW + 1.2, 0.6], [-BW / 2 - 0.3, 0, 0.6, BD], [BW / 2 + 0.3, 0, 0.6, BD]]) stat.add(mesh(rb(w, GH + 0.3, d, 0.08), m.wood, x, -GH / 2 + 0.05, z));
      const ground = mesh(new T.BoxGeometry(BW, GH, BD), m.grass, 0, -GH / 2, 0); ground.castShadow = false; root.add(ground);
      // su
      for (const poly of level.water || []) {
        const cx = poly.reduce((q, p) => q + p[0], 0) / poly.length, cz = poly.reduce((q, p) => q + p[1], 0) / poly.length;
        const shape = (sc) => new T.Shape(poly.map(([x, z]) => new T.Vector2(cx + (x - cx) * sc, -(cz + (z - cz) * sc))));
        const bank = new T.Mesh(new T.ShapeGeometry(shape(1)), m.bank); bank.rotation.x = -Math.PI / 2; bank.position.y = 0.012; bank.receiveShadow = true; root.add(bank);
        const wm = new T.Mesh(new T.ShapeGeometry(shape(0.88)), m.water); wm.rotation.x = -Math.PI / 2; wm.position.y = 0.03; wm.receiveShadow = true; root.add(wm);
      }
      this.mode = level.mode || 'road';
      // dağlar (demiryolu): içinden geçen hat tünel olur
      for (const poly of level.hills || []) root.add(this.hillMesh(poly, level));
      // havalimanı: kapıların önünde apron
      if (this.mode === 'air') {
        for (const b of level.blds) if (b.role === 'gate') { const ap = mesh(new T.BoxGeometry(b.ux ? 4.2 : b.w + 2.2, 0.03, b.uz ? 4.2 : b.d + 2.6), m.apron, b.x + b.ux * 1.2, 0.012, b.z + b.uz * 1.2, false); ap.receiveShadow = true; root.add(ap); }
      }
      // binalar
      for (const b of level.blds) root.add(this.building(b));
      // süs ağaçları (yolların altında kalanlar gizlenir)
      const rnd = RA.rng(level.id * 977 + 13);
      this.trees = [];
      const nT = Math.round(70 * (BW * BD) / 640);
      for (let k = 0; k < nT * 2 && this.trees.length < nT; k++) {
        const x = -BW / 2 + 0.6 + rnd() * (BW - 1.2), z = -BD / 2 + 0.6 + rnd() * (BD - 1.2);
        if (level.blds.some((b) => Math.hypot(b.x - x, b.z - z) < 2.6 || Math.hypot(b.ex - x, b.ez - z) < 1.4)) continue;
        if ((level.water || []).some((p) => LV.geo.inPoly(p, x, z))) continue;
        if ((level.hills || []).some((p) => LV.geo.inPoly(p, x, z) || polyDist(p, x, z) < HILL_B + 0.4)) continue;
        if (net.rails.some((r) => LV.geo.nearest(r, x, z).d < (r.def.runway ? 2.4 : 1.4))) continue;
        if (this.mode === 'air' && rnd() < 0.55) continue; // havalimanı daha açık
        this.trees.push({ x, z, kind: rnd() < 0.6 ? 'round' : 'cone', s: 0.9 + rnd() * 0.5, seed: Math.floor(rnd() * 1e6), bush: rnd() < 0.25 });
      }
      // demiryolu
      net.rails.forEach((r, k) => root.add(r.def.runway ? this.runwayMesh(r) : this.railMesh(r, (s) => net.railY[k](s))));
      root.add(RA.mergeStatic(stat));
      this.scene.add(root);
      this.base = root;
      this.railRoot = null;
    }
    building(b) {
      const g = new T.Group();
      const mode = this.mode || 'road', m = mats();
      const col = LV.COLORS[b.color] || { hex: 0x5d6d7e, css: '#3f5163', roof: 0x4a5a6a };
      const ang = Math.atan2(b.ux, b.uz); // yerel +z giriş yönü
      const body = new T.Group(); body.position.set(b.x, 0, b.z); body.rotation.y = ang; g.add(body);
      // renkli taban
      body.add(mesh(rb(b.w + 0.3, 0.06, b.d + 0.3, 0.05), RA.mat(col.hex, { roughness: 0.7 }), 0, 0.03, 0, false));
      body.add(mesh(rb(b.w + 0.05, 0.07, b.d + 0.05, 0.05), RA.mat(0xe9e4d6, { roughness: 0.9 }), 0, 0.045, 0, false));
      const rnd = RA.rng(Math.round(b.x * 31 + b.z * 7));
      const front = b.d / 2;
      if (b.role === 'arr' || b.role === 'dep') {
        // pist çıkışı / kalkış noktası: beton bekleme yeri ve sarı yön levhası
        body.add(mesh(rb(b.w, 0.05, b.d, 0.03), m.concrete, 0, 0.06, 0, false));
        for (const x of [-0.6, 0.6]) body.add(mesh(rb(0.06, 0.4, 0.06, 0.01), RA.mat(0x3d4249), x, 0.26, -0.2));
        body.add(mesh(rb(1.5, 0.34, 0.08, 0.03), m.yline, 0, 0.55, -0.2));
        body.add(mesh(rb(0.5, 0.06, 0.09, 0.01), RA.mat(0x1d2126), b.role === 'arr' ? -0.2 : 0.2, 0.55, -0.15, false));
      } else if (b.role === 'gate') {
        // terminal kapısı: camlı bina, renkli şerit, körük
        body.add(mesh(rb(b.w, 0.85, 1.1, 0.05), m.glass, 0, 0.5, -0.25));
        body.add(mesh(rb(b.w + 0.12, 0.1, 1.24, 0.04), RA.mat(0xf2f2ee), 0, 0.97, -0.25));
        body.add(mesh(rb(b.w + 0.02, 0.12, 0.04, 0.02), RA.mat(col.hex), 0, 0.78, 0.31, false));
        const jb = mesh(rb(0.26, 0.26, 1.0, 0.04), RA.mat(0xdfe3e6), 0.7, 0.55, 0.75); body.add(jb);
        body.add(mesh(rb(0.08, 0.42, 0.08, 0.02), RA.mat(0x5a6068), 0.7, 0.22, 1.1));
        const pk = M.plane(col.hex); pk.userData.gear.visible = true; pk.scale.setScalar(0.46); pk.rotation.y = Math.PI / 2; pk.position.set(0.1, 0.17, 1.45); pk.visible = false; body.add(pk);
        b.parked = pk;
      } else if (mode === 'rail' && b.kind === 'house') {
        // istasyon: peron, sundurma, küçük bina
        body.add(mesh(rb(b.w * 0.95, 0.2, 0.75, 0.03), RA.mat(0xc9c1b2), 0, 0.1, front - 0.45));
        body.add(mesh(rb(b.w * 0.95, 0.02, 0.07, 0.01), m.yline, 0, 0.21, front - 0.1, false));
        const h = M.house(1.5, 0.75, 0.55, 0xf1dfc0, col.roof, rnd, { door: true }); h.position.set(0, 0.07, -0.35); body.add(h);
        body.add(mesh(rb(b.w * 0.8, 0.05, 0.55, 0.02), RA.mat(col.hex), 0, 0.62, front - 0.45));
        for (const x of [-0.9, 0, 0.9]) body.add(mesh(RA.geo('cpost', () => new T.CylinderGeometry(0.025, 0.025, 0.42, 6)), RA.mat(0x5a4636), x, 0.41, front - 0.2));
      } else if (mode === 'rail') {
        if (b.type === 'liman') {
          body.add(mesh(rb(b.w + 0.2, 0.06, 0.6, 0.02), RA.mat(0x3f8fd0), 0, 0.04, -b.d / 2 + 0.15, false));
          const cc = [0xd8432f, 0x2f7fe0, 0x22a45a, 0xf2c230, 0x9050d8];
          for (let i = 0; i < 6; i++) { const x = -0.95 + (i % 3) * 0.75, y = 0.27 + Math.floor(i / 3) * 0.34; body.add(mesh(rb(0.68, 0.32, 0.36, 0.02), RA.mat(RA.pick(cc, rnd)), x, y, 0.15)); }
          for (const x of [-1.2, 1.2]) body.add(mesh(rb(0.1, 1.5, 0.1, 0.02), RA.mat(0xf2c230), x, 0.78, -0.45));
          body.add(mesh(rb(2.6, 0.12, 0.14, 0.02), RA.mat(0xf2c230), 0, 1.52, -0.45));
          body.add(mesh(rb(0.14, 0.12, 1.2, 0.02), RA.mat(0xf2c230), 0.4, 1.52, -0.3));
        } else if (b.type === 'maden') {
          for (const [x, z] of [[-0.4, -0.5], [0.4, -0.5], [-0.4, 0.1], [0.4, 0.1]]) { const l = mesh(rb(0.07, 1.6, 0.07, 0.01), RA.mat(0x5a3f30), x * 0.7 - 0.6, 0.8, z * 0.7 - 0.1); l.rotation.z = x * 0.1; body.add(l); }
          const wh = mesh(RA.geo('mwheel', () => new T.TorusGeometry(0.26, 0.04, 6, 16)), RA.mat(0x3a3f45), -0.6, 1.6, -0.2); body.add(wh);
          for (const [x, z, r] of [[0.5, 0, 0.5], [1.05, -0.35, 0.38]]) body.add(mesh(new T.ConeGeometry(r, r * 1.1, 9), RA.mat(0x2d2a28, { flatShading: true }), x, r * 0.55, z));
          const sh = M.block(1.0, 0.7, 0.55, 0xb9ad98, rnd); sh.position.set(-0.3, 0, 0.2); body.add(sh);
        } else {
          const bl = M.block(2.4, 1.1, 0.95, 0xe9dcc5, rnd); bl.position.set(-0.2, 0, -0.15); body.add(bl);
          body.add(mesh(rb(0.55, 1.7, 0.55, 0.04), RA.mat(0xd9c8a8), 1.15, 0.85, -0.3));
          body.add(mesh(RA.geo('clock', () => new T.CylinderGeometry(0.18, 0.18, 0.04, 16)), RA.mat(0xffffff), 1.15, 1.4, -0.02).rotateX(Math.PI / 2));
          body.add(mesh(rb(0.6, 0.12, 0.6, 0.04), RA.mat(col.roof), 1.15, 1.76, -0.3));
        }
        body.add(mesh(rb(b.w * 0.9, 0.12, 0.06, 0.02), RA.mat(col.hex), 0, 0.42, b.d / 2 + 0.02, false));
      } else if (b.kind === 'house') {
        const walls = [0xf2d7b6, 0xe9e3d3, 0xf5e6c4, 0xdfe7ea];
        for (const x of [-0.82, 0, 0.82]) { const h = M.house(0.74, 0.7, 0.5 + rnd() * 0.16, RA.pick(walls, rnd), col.roof, rnd); h.position.set(x, 0.07, -0.2); body.add(h); }
      } else {
        const pm = WS.placeModel(b.type || 'fabrika', Math.round(b.x * 13 + b.z));
        pm.scale.setScalar(1.5); pm.position.set(0, 0.07, -0.1); body.add(pm);
        body.add(mesh(rb(b.w * 0.9, 0.12, 0.06, 0.02), RA.mat(col.hex), 0, 0.5, b.d / 2 + 0.02, false));
      }
      // giriş yolu
      const drive = mesh(rb(mode === 'air' ? 1.5 : 0.9, 0.05, 0.9, 0.02), mode === 'rail' ? m.ballast : mode === 'air' ? m.concrete : m.drive, 0, 0.03, b.d / 2 + 0.45, false); body.add(drive);
      // tabela ve giriş işareti
      const label = b.role === 'arr' ? 'İNİŞ' : b.role === 'dep' ? 'KALKIŞ' : b.role === 'gate' ? 'KAPI ' + (RA.LV.GATE_L[b.color] || '') :
        mode === 'rail' ? (b.kind === 'house' ? 'İSTASYON' : ({ gar: 'GAR', liman: 'LİMAN', maden: 'MADEN' }[b.type] || 'GAR')) :
        b.kind === 'house' ? 'EVLER' : ({ fabrika: 'FABRİKA', okul: 'OKUL', avm: 'AVM', ofis: 'OFİS', hastane: 'HASTANE', stadyum: 'STADYUM' }[b.type] || 'İŞ YERİ');
      const sp = new T.Sprite(new T.SpriteMaterial({ map: signTex(label, col.css), depthTest: false, transparent: true }));
      sp.center.set(0.5, 0); sp.scale.set(2.6, 0.98, 1); sp.position.set(b.x - b.ux * 0.6, 2.1, b.z - b.uz * 0.6); sp.renderOrder = 15; g.add(sp);
      const an = new T.Mesh(new T.PlaneGeometry(1.5, 1.5), new T.MeshBasicMaterial({ map: anchorTex(col.css), transparent: true, depthWrite: false }));
      an.rotation.x = -Math.PI / 2; an.position.set(b.ex, 0.05, b.ez); an.renderOrder = 5; g.add(an);
      b.anchor = an; b.sign = sp;
      if (b.kind === 'house') {
        const pd = new T.Sprite(new T.SpriteMaterial({ map: pendTex(0, LV.Sim.PENDING_CAP), depthTest: false, transparent: true }));
        pd.center.set(0.5, 1); pd.scale.set(2.6, 0.65, 1); pd.position.set(b.x - b.ux * 0.6, 2.05, b.z - b.uz * 0.6); pd.renderOrder = 16; g.add(pd);
        b.pend = pd; b.pendN = -1;
      }
      return g;
    }
    // dağ: yuvarlak tepeli kabarık şekil (eteği çokgenden HILL_B taşar); üstünde kaya ve ağaçlar
    hillMesh(poly0, level) {
      const m = mats();
      const poly = clipHill(poly0);
      const g = new T.Group();
      const xs0 = poly.map((p) => p[0]), zs0 = poly.map((p) => p[1]);
      const x0 = Math.max(-LV.C.W / 2, Math.min(...xs0) - HILL_B - 0.3), x1 = Math.min(LV.C.W / 2, Math.max(...xs0) + HILL_B + 0.3), z0 = Math.max(-LV.C.D / 2, Math.min(...zs0) - HILL_B - 0.3), z1 = Math.min(LV.C.D / 2, Math.max(...zs0) + HILL_B + 0.3);
      const nx = Math.max(2, Math.ceil((x1 - x0) / 0.4)), nz = Math.max(2, Math.ceil((z1 - z0) / 0.4));
      const geo = new T.PlaneGeometry(x1 - x0, z1 - z0, nx, nz); geo.rotateX(-Math.PI / 2); geo.translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) pos.setY(i, hillHeight(poly, pos.getX(i), pos.getZ(i)));
      geo.computeVertexNormals();
      const hm = new T.Mesh(geo, m.hill); hm.castShadow = true; hm.receiveShadow = true; g.add(hm);
      const rnd = RA.rng(Math.round(poly[0][0] * 7 + poly[0][1] * 13) + 5);
      const xs = poly.map((p) => p[0]), zs = poly.map((p) => p[1]);
      for (let k = 0; k < 60; k++) {
        const x = Math.min(...xs) + rnd() * (Math.max(...xs) - Math.min(...xs)), z = Math.min(...zs) + rnd() * (Math.max(...zs) - Math.min(...zs));
        if (!LV.geo.inPoly(poly, x, z) || polyDist(poly, x, z) < 0.6) continue;
        const y = hillHeight(poly, x, z) - 0.05;
        if (rnd() < 0.35) { const r = mesh(RA.geo('hrock', () => new T.DodecahedronGeometry(0.35, 0)), m.rock, x, y + 0.1, z); r.scale.set(1 + rnd(), 0.6 + rnd() * 0.5, 1 + rnd()); r.rotation.y = rnd() * 3; g.add(r); }
        else { const t = M.tree(rnd, rnd() < 0.7 ? 'cone' : 'round', 0.8 + rnd() * 0.4); t.position.set(x, y, z); g.add(t); }
      }
      return RA.mergeStatic(g);
    }
    // pist: koyu asfalt, kenar ve orta çizgiler, kenar ışıkları
    runwayMesh(r) {
      const m = mats();
      const g = new T.Group(), path = new RA.Path(r.pts), y0 = () => 0;
      g.add(new T.Mesh(ribbonY(path, -1.5, 1.5, y0, 0.02, 0.5), m.concrete));
      g.add(new T.Mesh(ribbonY(path, -1.2, 1.2, y0, 0.04, 0.5), m.runway));
      for (const x of [-1.08, 1.08]) g.add(new T.Mesh(ribbonY(path, x - 0.04, x + 0.04, y0, 0.05, 0.5), m.line));
      for (let s = 0.6; s < path.length - 0.6; s += 1.9) {
        const P = path.at(s), Tn = path.tan(s);
        const d = mesh(RA.geo('rwdash', () => new T.BoxGeometry(1.0, 0.012, 0.09)), m.line, P.x, 0.052, P.z, false); d.rotation.y = -Math.atan2(Tn.z, Tn.x); g.add(d);
        for (const x of [-1.32, 1.32]) { const l = mesh(RA.geo('rwl', () => new T.SphereGeometry(0.05, 8, 6)), RA.glow(0xfff1c8, 1.6), P.x - Tn.z * x, 0.08, P.z + Tn.x * x, false); g.add(l); }
      }
      // pist başı işaretleri (piyano tuşları) iki uçta
      for (const end of [0, 1]) {
        const s = end ? path.length - 2.2 : 2.2, P = path.at(s), Tn = path.tan(s);
        for (let k = -3; k <= 3; k++) { if (!k) continue; const b = mesh(RA.geo('rwkey', () => new T.BoxGeometry(1.1, 0.012, 0.12)), m.line, P.x - Tn.z * k * 0.27, 0.052, P.z + Tn.x * k * 0.27, false); b.rotation.y = -Math.atan2(Tn.z, Tn.x); g.add(b); }
      }
      return RA.mergeStatic(g);
    }
    railMesh(r, yf) {
      const m = mats();
      const g = new T.Group();
      const path = new RA.Path(r.pts);
      g.add(new T.Mesh(ribbonY(path, -0.62, 0.62, yf, 0.04, 0.25), m.gravel));
      for (const off of [-0.22, 0.22]) g.add(new T.Mesh(ribbonY(path, off - 0.035, off + 0.035, yf, 0.16, 0.25), m.steel));
      for (let s = 0.2; s < path.length; s += 0.42) {
        const P = path.at(s), Tn = path.tan(s);
        const sl = mesh(M.sleeperGeo(), m.sleeper, P.x, yf(s) + 0.1, P.z); sl.rotation.y = -Math.atan2(Tn.z, Tn.x); sl.scale.set(1, 1, 0.8); g.add(sl);
      }
      // ray köprüsü ayakları ve kenarları
      this.elevated(g, path, yf, 0.62);
      return RA.mergeStatic(g);
    }
    // yükseltilmiş kısımlar: yan duvarlar, korkuluk, ayaklar
    elevated(g, path, yf, hw) {
      const m = mats();
      let any = false;
      for (let s = 0; s < path.length; s += 0.3) if (yf(s) > 0.15) { any = true; break; }
      if (!any) return;
      // sadece yüksek kısımları kapsayan alt yol
      let a = null; const parts = [];
      for (let s = 0; s <= path.length + 0.001; s += 0.1) {
        const up = yf(Math.min(s, path.length)) > 0.12;
        if (up && a == null) a = s;
        if ((!up || s + 0.1 > path.length) && a != null) { parts.push([a, Math.min(s, path.length)]); a = null; }
      }
      for (const [s0, s1] of parts) {
        if (s1 - s0 < 0.3) continue;
        const sub = path.slice(s0, s1), yy = (s) => yf(s0 + s);
        // güverte yanları ve altı (kutu kiriş)
        g.add(new T.Mesh(wallY(sub, -hw - 0.08, yy, 0.02, -0.3, 0.25, true), m.deck));
        g.add(new T.Mesh(wallY(sub, hw + 0.08, yy, 0.02, -0.3, 0.25, false), m.deck));
        g.add(new T.Mesh(ribbonY(sub, -hw - 0.08, hw + 0.08, (s) => yy(s) - 0.3, 0, 0.25), m.deck));
        // alçak bordür
        for (const [x, f] of [[-hw - 0.08, true], [hw + 0.08, false]]) g.add(new T.Mesh(wallY(sub, x, yy, 0.1, 0.02, 0.25, f), m.parapet));
        for (const x of [-hw - 0.03, hw + 0.03]) g.add(new T.Mesh(ribbonY(sub, x - 0.06, x + 0.06, (s) => yy(s) + 0.1, 0, 0.25), m.parapet));
        // metal korkuluk: dikmeler ve üst küpeşte
        for (let s = 0.15; s < sub.length - 0.1; s += 0.42) {
          const P = sub.at(s), Tn = sub.tan(s), y = yy(s), a = -Math.atan2(Tn.z, Tn.x);
          for (const x of [-hw - 0.03, hw + 0.03]) { const po = mesh(RA.geo('rpost', () => new T.BoxGeometry(0.045, 0.24, 0.045)), m.railing, P.x - Tn.z * x, y + 0.22, P.z + Tn.x * x, false); po.rotation.y = a; g.add(po); }
        }
        for (const x of [-hw - 0.03, hw + 0.03]) g.add(new T.Mesh(ribbonY(sub, x - 0.035, x + 0.035, (s) => yy(s) + 0.34, 0, 0.2), m.railing));
        // ayaklar: iki sütun ve üstte başlık kirişi
        for (let s = 0.9; s < sub.length - 0.5; s += 2.3) {
          const y = yy(s); if (y < 0.6) continue;
          const P = sub.at(s), Tn = sub.tan(s), a = -Math.atan2(Tn.z, Tn.x), h = y - 0.42;
          for (const x of [-hw * 0.55, hw * 0.55]) { const c = mesh(RA.geo('pcol', () => new T.CylinderGeometry(0.1, 0.12, 1, 10)), m.pillar, P.x - Tn.z * x, h / 2, P.z + Tn.x * x); c.scale.y = h; g.add(c); }
          const cap = mesh(RA.geo('pcap' + hw.toFixed(2), () => new T.BoxGeometry(0.34, 0.14, hw * 2 + 0.2)), m.pillar, P.x, y - 0.37, P.z); cap.rotation.y = a; g.add(cap);
        }
        // uzun köprüde lamba direkleri (bir sağ, bir sol)
        if (sub.length > 4.5) {
          let side = 1;
          for (let s = 1.4; s < sub.length - 1; s += 3.2) {
            const P = sub.at(s), Tn = sub.tan(s), y = yy(s), x = (hw + 0.03) * side, a = -Math.atan2(Tn.z, Tn.x);
            const lp = mesh(RA.geo('blpole', () => new T.CylinderGeometry(0.025, 0.03, 0.9, 6)), m.railing, P.x - Tn.z * x, y + 0.55, P.z + Tn.x * x); g.add(lp);
            const hd = mesh(RA.geo('blhead', () => new T.BoxGeometry(0.1, 0.05, 0.26)), m.lampHead, P.x - Tn.z * (x - side * 0.12), y + 1.0, P.z + Tn.x * (x - side * 0.12), false); hd.rotation.y = a; g.add(hd);
            side = -side;
          }
        }
      }
    }

    /* ---------- yollar (her çizimde yeniden kurulur) ---------- */
    buildRoads(level, net) {
      this.spots(null);
      this.dispose(this.roads);
      const m = mats();
      const root = new T.Group(), stat = new T.Group();
      const mode = this.mode || 'road', HW = HALF[mode];
      for (const e of net.edges) {
        const path = new RA.Path(LV.geo.slicePts(e.st, e.s0, e.s1));
        const yf = (s) => e.y(e.s0 + (s / path.length) * e.len);
        if (mode === 'rail') { stat.add(new T.Mesh(ribbonY(path, -0.66, 0.66, yf, 0.04, 0.2), m.ballast)); this.elevated(stat, path, yf, HW); continue; }
        if (mode === 'air') {
          stat.add(new T.Mesh(ribbonY(path, -1.14, 1.14, yf, 0.045, 0.2), m.concrete));
          // mavi kenar ışıkları (kavşak ağızlarında yok)
          for (let s = e.ta + 0.6; s < path.length - e.tb - 0.4; s += 1.5) {
            const P = path.at(s), Tn = path.tan(s), y = yf(s);
            for (const x of [-1.18, 1.18]) stat.add(mesh(RA.geo('twl', () => new T.SphereGeometry(0.05, 8, 6)), m.blueL, P.x - Tn.z * x, y + 0.09, P.z + Tn.x * x, false));
          }
          this.elevated(stat, path, yf, HW);
          continue;
        }
        stat.add(new T.Mesh(ribbonY(path, -0.78, 0.78, yf, 0.045, 0.2), m.asphalt));
        // kaldırım kavşağın içine girmez
        const c0 = e.ta, c1 = path.length - e.tb;
        if (c1 - c0 > 0.2) {
          const cp = path.slice(c0, c1), cy = (s) => yf(c0 + s);
          for (const x of [-0.86, 0.86]) stat.add(new T.Mesh(ribbonY(cp, x - 0.09, x + 0.09, cy, 0.06, 0.25), m.curb));
          for (const x of [-0.64, 0.64]) stat.add(new T.Mesh(ribbonY(cp, x - 0.03, x + 0.03, cy, 0.05, 0.25), m.line)); // kenar çizgisi
        }
        // orta çizgi (kavşak ağızlarında kesik)
        const s0 = e.ta > 0 ? e.ta : 0.3, s1 = path.length - (e.tb > 0 ? e.tb : 0.3);
        if (s1 - s0 > 0.6) { const dm = new T.Mesh(ribbonY(path.slice(s0, s1), -0.045, 0.045, (s) => yf(s0 + s), 0.052, 0.2, 1 / 0.9), m.dash); dm.renderOrder = 3; root.add(dm); }
        this.elevated(stat, path, yf, 0.86);
      }
      // raylar (her şeridin iki rayı ve traversleri) / taksi yolu sarı rehber çizgileri; kavşak içinde dönüş yolları boyunca
      {
        const tracks = net.lanes.map((l) => ({ path: l.path, y: l.y })).concat(net.turns.map((t) => ({ path: t.path, y: () => 0, turn: true })));
        if (mode !== 'road') for (const tr of tracks) {
          if (tr.path.length < 0.05) continue;
          if (mode === 'air') { stat.add(new T.Mesh(ribbonY(tr.path, -0.035, 0.035, tr.y, 0.058, 0.15), m.yline)); continue; }
          for (const x of [-0.12, 0.12]) stat.add(new T.Mesh(ribbonY(tr.path, x - 0.022, x + 0.022, tr.y, 0.125, 0.15), m.railSteel));
          for (let s = 0.12; s < tr.path.length; s += 0.34) {
            const P = tr.path.at(s), Tn = tr.path.tan(s);
            const sl = mesh(RA.geo('lvtie', () => new T.BoxGeometry(0.08, 0.04, 0.36)), m.tie, P.x, tr.y(s) + 0.09, P.z, false); sl.rotation.y = -Math.atan2(Tn.z, Tn.x); stat.add(sl);
          }
        }
        // dağın içinden geçen hattın tünel ağızları
        if (net.strokeTun) {
          const hills = (level.hills || []).map(clipHill);
          const under = (p) => hills.some((q) => hillHeight(q, p.x, p.z) > 0.85);
          for (const st of net.S) for (const t of net.strokeTun.get(st.id) || []) {
            for (const [s0, dir] of [[t.a, -1], [t.b, 1]]) {
              let s = s0; while (s > 0 && s < st.len && under(LV.geo.at(st, s))) s += dir * 0.1;
              const P = LV.geo.at(st, s), Tn = LV.geo.tan(st, s);
              const pg = new T.Group(); pg.position.set(P.x, 0, P.z); pg.rotation.y = -Math.atan2(Tn.z, Tn.x);
              pg.add(mesh(rb(0.3, 1.0, 1.7, 0.05), m.portal, -dir * 0.05, 0.5, 0));
              pg.add(mesh(rb(0.32, 0.74, 1.3, 0.04), m.dark, -dir * 0.06, 0.37, 0, false));
              stat.add(pg);
            }
          }
        }
      }
      // türü seçilmemiş kesişim: iki yolun üst üste binen çizgi ve kaldırımları yerine temiz bir yüzey
      const padM = mode === 'rail' ? m.ballast : mode === 'air' ? m.concrete : m.asphalt;
      for (const c of net.crossings) {
        if (c.type !== 'pending' || c.kind !== 'road' || !c.ta) continue;
        const k = (HW + 0.11) / Math.max(0.45, Math.abs(c.ta.x * c.tb.z - c.ta.z * c.tb.x));
        const P = [[1, 1], [1, -1], [-1, -1], [-1, 1]].map(([i, j]) => new T.Vector2(c.x + (c.ta.x * i + c.tb.x * j) * k, -(c.z + (c.ta.z * i + c.tb.z * j) * k)));
        const geo = new T.ShapeGeometry(new T.Shape(P)); geo.rotateX(-Math.PI / 2);
        const pad = new T.Mesh(geo, padM); pad.position.y = mode === 'road' ? 0.068 : 0.14; pad.receiveShadow = true; stat.add(pad);
      }
      // kavşak ve birleşme yerleri
      for (const n of net.nodes) {
        if (mode === 'road' && n.kind === 'j') { this.roadJunction(stat, n, net, m); continue; }
        if (n.kind === 'j' || n.kind === 'joint') {
          // kavşak zemini: kolların arasını dolduran düz asfalt / balast / beton
          const r = mode === 'rail' ? (n.kind === 'j' ? LV.C.JR + 0.25 : 0.7) : mode === 'air' ? (n.kind === 'j' ? LV.C.JR + 0.35 : 1.15) : n.kind === 'j' ? LV.C.JR + 0.02 : 0.9;
          const pad = mesh(RA.geo('jpad' + r, () => { const c = new T.CircleGeometry(r, 32); c.rotateX(-Math.PI / 2); return c; }), padM, n.x, mode === 'road' ? 0.05 : 0.045, n.z, false); pad.receiveShadow = true; stat.add(pad);
          // kolların arasındaki köşeler: kaldırım kavisi
          if (n.kind === 'j' && mode === 'road') {
            const angs = n.arms.map((a) => a.ang).sort((p, q) => p - q);
            for (let k = 0; k < angs.length; k++) {
              const a0 = angs[k], a1 = k === angs.length - 1 ? angs[0] + Math.PI * 2 : angs[k + 1];
              const g0 = a0 + Math.asin(Math.min(1, 0.86 / (LV.C.JR + 0.02))), g1 = a1 - Math.asin(Math.min(1, 0.86 / (LV.C.JR + 0.02)));
              if (g1 - g0 < 0.05) continue;
              const pts = []; for (let t = 0; t <= 8; t++) { const a = g0 + ((g1 - g0) * t) / 8; pts.push({ x: n.x + Math.cos(a) * (LV.C.JR + 0.02), z: n.z + Math.sin(a) * (LV.C.JR + 0.02) }); }
              stat.add(new T.Mesh(ribbonY(new RA.Path(pts), -0.09, 0.09, () => 0, 0.06, 0.1), m.curb));
            }
          }
        }
        if (n.kind === 'j' && mode === 'road') {
          // her kolda yaya geçidi (zebra)
          for (const arm of n.arms) {
            const ang = arm.ang, dx = Math.cos(ang), dz = Math.sin(ang), rx = -dz, rz = dx;
            const cx = n.x + dx * (LV.C.JR + 0.32), cz = n.z + dz * (LV.C.JR + 0.32);
            for (let k = -2; k <= 2; k++) {
              const zb = mesh(RA.geo('zebra', () => new T.BoxGeometry(0.42, 0.012, 0.15)), m.line, cx + rx * k * 0.27, 0.058, cz + rz * k * 0.27, false);
              zb.rotation.y = -ang; stat.add(zb);
            }
          }
        }
      }
      const merged = RA.mergeStatic(stat);
      merged.children.forEach((o) => { o.castShadow = true; o.receiveShadow = true; }); // köprüler alttaki yola gölge düşürür
      root.add(merged);
      // trafik ışıkları: her kolda gelen şeridin sağında direk, şeridin üstüne uzanan kol ve üç renkli lamba başlığı
      this.lamps = [];
      const poleM = RA.mat(0x3d4249, { roughness: 0.5 }), headM = RA.mat(0x1c1f24, { roughness: 0.6 });
      for (const n of net.nodes) {
        if (n.kind !== 'j' || n.deg < 4) continue; // 3 kollu kavşaklar ışıksız: önce gelen geçer
        for (const arm of n.arms) {
          const dx = Math.cos(arm.ang), dz = Math.sin(arm.ang), rx = -dz, rz = dx;
          const ln = net.lanes.find((l) => l.e === arm.e && l.to === n);
          let side = -1;
          if (ln) { const E = ln.path.at(ln.len); side = Math.sign((E.x - n.x) * rx + (E.z - n.z) * rz) || -1; }
          const R = (mode === 'road' ? LV.C.JR : LV.C.JR + 0.2) + 0.75, off = mode === 'air' ? 1.35 : mode === 'rail' ? 0.95 : 1.12;
          const x = n.x + dx * R + rx * side * off, z = n.z + dz * R + rz * side * off;
          const grp = new T.Group(); grp.position.set(x, 0, z); grp.rotation.y = -Math.atan2(dz, dx); // yerel +x: koldan dışarı (gelen araca bakar)
          grp.add(mesh(RA.geo('tlpole', () => new T.CylinderGeometry(0.035, 0.045, 1.25, 8)), poleM, 0, 0.625, 0));
          grp.add(mesh(RA.geo('tlbase', () => new T.CylinderGeometry(0.08, 0.1, 0.06, 10)), poleM, 0, 0.03, 0));
          const armL = off - 0.32;
          const am = mesh(RA.geo('tlarm' + armL.toFixed(2), () => new T.BoxGeometry(0.05, 0.05, armL)), poleM, 0, 1.2, -side * armL / 2); grp.add(am);
          const hz = -side * (armL - 0.02);
          grp.add(mesh(RA.geo('tlhead', () => RA.rbox(0.1, 0.36, 0.13, 0.025)), headM, 0.03, 1.02, hz));
          grp.add(mesh(RA.geo('tlback', () => RA.rbox(0.02, 0.44, 0.2, 0.01)), headM, -0.03, 1.02, hz));
          const mk = (col) => new T.MeshStandardMaterial({ color: 0x111111, emissive: col, emissiveIntensity: 0.08, roughness: 0.3 });
          const red = mk(0xff2a1f), amber = mk(0xffb400), green = mk(0x22e06a);
          [[red, 1.13], [amber, 1.02], [green, 0.91]].forEach(([mt, y]) => { const b = new T.Mesh(RA.geo('tlbulb', () => new T.SphereGeometry(0.038, 10, 8)), mt); b.position.set(0.09, y, hz); grp.add(b); });
          const glow = RA.glowSprite(0xff3b2f, 0.42, 0.6); glow.position.set(0.14, 1.02, hz); grp.add(glow);
          root.add(grp);
          this.lamps.push({ n, e: arm.e.id, red, amber, green, glow });
        }
      }
      // hemzemin geçit bariyerleri
      this.gates = [];
      for (const gt of net.gates) {
        if (gt.runway) {
          // pist bekleme çizgisi: sarı çift çizgi ve kırmızı durma ışıkları (pistte trafik varken yanar)
          const lm = new T.MeshStandardMaterial({ color: 0x220000, emissive: 0xff2010, emissiveIntensity: 0.1 });
          for (const sg of [-1, 1]) {
            const s = gt.s + sg * gt.hold, P = LV.geo.at(gt.st, RA.clamp(s, 0, gt.st.len)), Tn = LV.geo.tan(gt.st, RA.clamp(s, 0, gt.st.len)), ang = -Math.atan2(Tn.z, Tn.x);
            for (const off of [0, 0.16]) { const bar = mesh(RA.geo('hbar', () => new T.BoxGeometry(0.05, 0.012, 2.2)), m.yline, P.x + Tn.x * sg * off, 0.065, P.z + Tn.z * sg * off, false); bar.rotation.y = ang; root.add(bar); }
            for (let k = -2; k <= 2; k++) { const l = new T.Mesh(RA.geo('hlamp', () => new T.SphereGeometry(0.07, 10, 8)), lm); l.position.set(P.x - sg * Tn.x * 0.12 - Tn.z * k * 0.5, 0.1, P.z - sg * Tn.z * 0.12 + Tn.x * k * 0.5); root.add(l); }
          }
          this.gates.push({ key: gt.key, bar: true, lm });
          continue;
        }
        const t = LV.geo.tan(gt.st, gt.s); const nx = -t.z, nz = t.x;
        for (const sgn of [-1, 1]) {
          const bx = gt.x + t.x * 1.15 * sgn + nx * 1.0 * sgn, bz = gt.z + t.z * 1.15 * sgn + nz * 1.0 * sgn;
          const grp = new T.Group(); grp.position.set(bx, 0, bz); grp.rotation.y = -Math.atan2(-nz * sgn, -nx * sgn);
          grp.add(mesh(rb(0.12, 0.55, 0.12, 0.03), RA.mat(0xf2f2ec), 0, 0.275, 0));
          const arm = new T.Group(); arm.position.set(0, 0.5, 0);
          arm.add(mesh(RA.geo('garm', () => { const b = new T.BoxGeometry(1.6, 0.06, 0.05); b.translate(0.8, 0, 0); return b; }), RA.mat(0xf2f2ec), 0, 0, 0));
          for (const ox of [0.3, 0.75, 1.2]) arm.add(mesh(RA.geo('gst', () => new T.BoxGeometry(0.16, 0.065, 0.055)), RA.mat(0xd23b2f), ox, 0, 0, false));
          grp.add(arm);
          const lm = new T.MeshStandardMaterial({ color: 0x220000, emissive: 0xff2010, emissiveIntensity: 0 });
          grp.add(new T.Mesh(RA.geo('gl', () => new T.SphereGeometry(0.07, 10, 8)), lm).translateY(0.62));
          root.add(grp);
          this.gates.push({ key: gt.key, arm, lm });
        }
      }
      // ağaçlar: yolların altında kalanlar konmaz
      const tg = new T.Group();
      const S = net.S;
      for (const tr of this.trees || []) {
        if (S.some((st) => LV.geo.nearest(st, tr.x, tr.z).d < 1.5)) continue;
        const r2 = RA.rng(tr.seed);
        const o = tr.bush ? M.bush(r2, 0.7) : M.tree(r2, tr.kind, tr.s);
        o.position.set(tr.x, 0, tr.z); tg.add(o);
      }
      root.add(RA.mergeStatic(tg));
      // bağlanan binaların giriş işareti kaybolur
      for (const bn of net.bNodes) if (bn.bld.anchor) bn.bld.anchor.visible = bn.deg === 0;
      // kesişim işaretleri (dokununca türü değişir)
      this.marks = [];
      for (const c of net.crossings) {
        const sp = new T.Sprite(new T.SpriteMaterial({ map: markTex(c.type), depthTest: false, transparent: true }));
        sp.scale.set(1.25, 1.25, 1); sp.position.set(c.x, 2.0, c.z); sp.renderOrder = 18; root.add(sp);
        this.marks.push({ c, sp });
      }
      this.scene.add(root);
      this.roads = root;
    }

    // gerçekçi kavşak: kolların ağızlarını kavisli köşelerle birleştiren asfalt, köşe kaldırımları, yaya geçitleri, dur çizgileri
    roadJunction(stat, n, net, m) {
      const R = LV.C.JR, HA = 0.8, HC = 0.86;
      const arms = n.arms.slice().sort((p, q) => p.ang - q.ang);
      const D = arms.map((a) => ({ x: Math.cos(a.ang), z: Math.sin(a.ang) }));
      const P = (k, h, sg) => ({ x: n.x + D[k].x * R - D[k].z * h * sg, z: n.z + D[k].z * R + D[k].x * h * sg });
      const meet = (A, da, B, db) => { const det = da.x * -db.z - da.z * -db.x; if (Math.abs(det) < 1e-3) return null; const t = ((B.x - A.x) * -db.z - (B.z - A.z) * -db.x) / det; return { x: A.x + da.x * t, z: A.z + da.z * t }; };
      // köşe eğrisi: k kolunun yanından k+1 kolunun yanına (yol kenarlarının buluştuğu köşeye doğru kıvrılır)
      const corner = (k, h) => {
        const j = (k + 1) % arms.length;
        let gap = arms[j].ang - arms[k].ang; if (j === 0) gap += Math.PI * 2;
        const A = P(k, h, 1), B = P(j, h, -1);
        let C = gap > 1.2 && gap < 2.75 ? meet(A, { x: -D[k].x, z: -D[k].z }, B, { x: -D[j].x, z: -D[j].z }) : null;
        if (C && Math.hypot(C.x - n.x, C.z - n.z) > R * 1.6) C = null;
        if (!C) C = { x: (A.x + B.x) / 2, z: (A.z + B.z) / 2 };
        const pts = []; for (let i = 0; i <= 10; i++) { const t = i / 10, u = 1 - t; pts.push({ x: u * u * A.x + 2 * u * t * C.x + t * t * B.x, z: u * u * A.z + 2 * u * t * C.z + t * t * B.z }); }
        return pts;
      };
      const poly = [];
      for (let k = 0; k < arms.length; k++) { poly.push(P(k, HA, -1)); poly.push(...corner(k, HA)); }
      const shp = new T.Shape(poly.map((p) => new T.Vector2(p.x, -p.z)));
      const geo = new T.ShapeGeometry(shp); geo.rotateX(-Math.PI / 2);
      const pad = new T.Mesh(geo, m.asphalt); pad.position.y = 0.05; pad.receiveShadow = true; stat.add(pad);
      // köşe kaldırımları
      for (let k = 0; k < arms.length; k++) stat.add(new T.Mesh(ribbonY(new RA.Path(corner(k, HC)), -0.09, 0.09, () => 0, 0.06, 0.08), m.curb));
      // yaya geçidi ve dur çizgisi
      for (let k = 0; k < arms.length; k++) {
        const ang = arms[k].ang, dx = D[k].x, dz = D[k].z, rx = -dz, rz = dx;
        const cx = n.x + dx * (R + 0.32), cz = n.z + dz * (R + 0.32);
        for (let q = -2; q <= 2; q++) {
          const zb = mesh(RA.geo('zebra', () => new T.BoxGeometry(0.42, 0.012, 0.15)), m.line, cx + rx * q * 0.27, 0.058, cz + rz * q * 0.27, false);
          zb.rotation.y = -ang; stat.add(zb);
        }
        const ln = net.lanes.find((l) => l.e === arms[k].e && l.to === n);
        if (ln && ln.len > 1.2) {
          const S = ln.path.at(Math.max(0, ln.len - 0.68)), Tn = ln.path.tan(Math.max(0, ln.len - 0.68));
          const bar = mesh(RA.geo('stopbar', () => new T.BoxGeometry(0.07, 0.012, 0.66)), m.line, S.x, 0.058, S.z, false); bar.rotation.y = -Math.atan2(Tn.z, Tn.x); stat.add(bar);
        }
      }
    }

    /* ---------- önceden kurulmuş köprü / alt geçit (henüz yolu yok): yarı saydam taslak ---------- */
    plans(list) {
      if (this.planG) { this.scene.remove(this.planG); this.planG.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } else if (o.isSprite) o.material.dispose(); }); this.planG = null; }
      if (!list || !list.length) return;
      const g = new T.Group();
      for (const pl of list) {
        const col = pl.type === 'bridge' ? 0x3d8bff : 0xa061f0;
        const mat = new T.MeshStandardMaterial({ color: col, transparent: true, opacity: 0.6, emissive: col, emissiveIntensity: 0.35, depthWrite: false, roughness: 0.5 });
        const grp = new T.Group(); grp.position.set(pl.x, 0, pl.z);
        // köprüde güverte planın yönünde; alt geçitte yön boyunca giden yol alttan geçer, güverte ona diktir
        const a = Math.atan2(pl.dz, pl.dx) + (pl.type === 'tunnel' ? Math.PI / 2 : 0);
        grp.rotation.y = -a;
        const H = 1.15;
        grp.add(new T.Mesh(new T.BoxGeometry(2.2, 0.16, 1.8), mat).translateY(H));
        for (const sg of [-1, 1]) {
          const ramp = new T.Mesh(new T.BoxGeometry(2.5, 0.14, 1.8), mat); ramp.position.set(sg * 2.25, H / 2, 0); ramp.rotation.z = -sg * Math.atan2(H, 2.3); grp.add(ramp);
          for (const zz of [-0.95, 0.95]) { const rail = new T.Mesh(new T.BoxGeometry(2.2, 0.22, 0.08), mat); rail.position.set(0, H + 0.18, zz); grp.add(rail); }
          const pier = new T.Mesh(new T.BoxGeometry(0.3, H, 1.4), mat); pier.position.set(sg * 0.85, H / 2, 0); grp.add(pier);
        }
        const ring = new T.Mesh(new T.RingGeometry(2.6, 2.85, 48), new T.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.55, depthWrite: false }));
        ring.rotation.x = -Math.PI / 2; ring.position.y = 0.07; grp.add(ring);
        g.add(grp);
        const sp = new T.Sprite(new T.SpriteMaterial({ map: markTex(pl.type), depthTest: false, transparent: true }));
        sp.scale.set(1.1, 1.1, 1); sp.position.set(pl.x, 2.7, pl.z); sp.renderOrder = 18; sp.userData.bob = pl.id || 0; g.add(sp);
      }
      this.scene.add(g); this.planG = g;
    }

    /* ---------- köprü / alt geçit yapılabilecek yerler (parlayan işaretler) ---------- */
    spots(list, kind) {
      if (this.spotG) { this.scene.remove(this.spotG); this.spotG.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } else if (o.isSprite) o.material.dispose(); }); this.spotG = null; }
      this.spotL = list || null;
      if (this.marks) for (const mk of this.marks) mk.sp.visible = !list;
      if (!list) return;
      const g = new T.Group(), col = kind === 'bridge' ? 0x3d8bff : 0xa061f0;
      for (const s of list) {
        const add = s.act === 'set' || s.act === 'merge';
        const sp = new T.Sprite(new T.SpriteMaterial({ map: add ? markTex(kind) : removeTex(kind), depthTest: false, transparent: true }));
        sp.position.set(s.x, 2.0, s.z); sp.renderOrder = 19; sp.scale.set(1.25, 1.25, 1); g.add(sp); s.sp = sp;
        if (add) {
          const ring = new T.Mesh(new T.RingGeometry(0.95, 1.35, 40), new T.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.6, depthWrite: false, blending: T.AdditiveBlending }));
          ring.rotation.x = -Math.PI / 2; ring.position.set(s.x, 0.14, s.z); ring.renderOrder = 6; g.add(ring); s.ring = ring;
          const beam = new T.Mesh(new T.CylinderGeometry(0.08, 0.3, 1.7, 12, 1, true), new T.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.35, depthWrite: false, blending: T.AdditiveBlending }));
          beam.position.set(s.x, 1.0, s.z); g.add(beam);
        }
      }
      this.scene.add(g); this.spotG = g;
    }

    /* ---------- çizim önizlemesi ---------- */
    preview(pts, ok) {
      if (this.prev) { this.scene.remove(this.prev); this.prev.geometry.dispose(); this.prev = null; }
      if (!pts || pts.length < 2) return;
      const path = new RA.Path(pts);
      if (path.length < 0.1) return;
      const g = ribbonY(path, -0.75, 0.75, () => 0, 0.2, 0.15);
      this.prev = new T.Mesh(g, new T.MeshBasicMaterial({ color: ok ? 0xffffff : 0xff4433, transparent: true, opacity: ok ? 0.55 : 0.6, depthWrite: false }));
      this.prev.renderOrder = 20;
      this.scene.add(this.prev);
    }
    // ipucu: çözüm yolları yarı saydam
    hint(paths) {
      if (this.hintG) { this.dispose(this.hintG); this.hintG = null; }
      if (!paths) return;
      const g = new T.Group();
      for (const pts of paths) { const path = new RA.Path(pts); g.add(new T.Mesh(ribbonY(path, -0.5, 0.5, () => 0, 0.22, 0.15), new T.MeshBasicMaterial({ color: 0x7dff9a, transparent: true, opacity: 0.55, depthWrite: false }))); }
      g.children.forEach((c) => (c.renderOrder = 19));
      this.scene.add(g); this.hintG = g;
    }

    /* ---------- her kare: ışıklar, bariyerler, bekleyen sayıları ---------- */
    frame(sim, now, running) {
      const dt = this.lastNow ? Math.min(0.05, Math.max(0, now - this.lastNow)) : 0.016; this.lastNow = now;
      if (this.anims.length) this.anims = this.anims.filter((a) => a.step(a, dt));
      if (this.lamps) for (const L of this.lamps) {
        const ctl = L.n.ctl; if (!ctl) continue;
        const ph = ctl.n.phases.findIndex((p) => p.includes(L.e));
        const st = ph === ctl.cur ? (ctl.clearing ? 'amber' : 'green') : 'red';
        L.red.emissiveIntensity = st === 'red' ? 2.6 : 0.08; L.amber.emissiveIntensity = st === 'amber' ? 2.6 : 0.08; L.green.emissiveIntensity = st === 'green' ? 2.6 : 0.08;
        L.glow.material.color.setHex(st === 'green' ? 0x3bff7a : st === 'amber' ? 0xffc23a : 0xff3b2f); L.glow.position.y = st === 'red' ? 1.13 : st === 'amber' ? 1.02 : 0.91;
      }
      if (this.gates) for (const gt of this.gates) {
        const gs = sim.gateSt && sim.gateSt.get(gt.key); const a = gs ? gs.arm : 0;
        if (gt.bar) { gt.lm.emissiveIntensity = gs && gs.closed ? 2.6 : 0.1; continue; }
        gt.arm.rotation.z = (Math.PI / 2) * (1 - a) * 0.95;
        gt.lm.emissiveIntensity = gs && gs.closed && Math.floor(now * 3) % 2 === 0 ? 3 : 0;
      }
      for (const h of sim.houses || []) {
        const b = h.b;
        if (b.parked) b.parked.visible = h.queue.length + h.pending > 0; // kapıda yanaşmış uçak
        if (!b.pend) continue;
        const n = Math.min(h.pending, LV.Sim.PENDING_CAP);
        if (n !== b.pendN) { b.pendN = n; b.pend.material.map = pendTex(n, LV.Sim.PENDING_CAP); b.pend.material.needsUpdate = true; }
        b.pend.visible = running || n > 0;
      }
      if (this.cloudG) for (const c of this.cloudG.children) c.position.x = c.userData.x0 + Math.sin(now * c.userData.v * 0.3) * 2.5;
      if (this.planG) for (const o of this.planG.children) if (o.isSprite) o.position.y = 2.7 + Math.sin(now * 3 + o.userData.bob) * 0.15;
      if (this.spotL) for (const s of this.spotL) {
        if (s.act !== 'set' && s.act !== 'merge') continue;
        const k = 0.5 + 0.5 * Math.sin(now * 6), sc = 1.3 + k * 0.3;
        s.sp.scale.set(sc, sc, 1); s.ring.scale.setScalar(1 + k * 0.35); s.ring.material.opacity = 0.35 + 0.4 * k;
      }
      if (this.marks && !this.spotL) for (const mk of this.marks) {
        if (mk.c.type === 'pending') { const sc = 1.35 + Math.sin(now * 5) * 0.15; mk.sp.scale.set(sc, sc, 1); mk.sp.material.opacity = 1; continue; } // seçilmeyi bekliyor
        mk.sp.material.opacity = running ? 0.6 : 1; const sc = running ? 0.9 : 1.25; mk.sp.scale.set(sc, sc, 1);
      }
      if (sim.level) for (const b of sim.level.blds) {
        if (b.pulse > 0) { b.pulse = Math.max(0, b.pulse - 0.04); b.sign.scale.set(2.6 * (1 + b.pulse * 0.25), 0.98 * (1 + b.pulse * 0.25), 1); }
        if (b.anchor && b.anchor.visible) b.anchor.material.opacity = 0.65 + Math.sin(now * 4) * 0.35;
      }
    }
  }
  LV.View = LvView;
})();
