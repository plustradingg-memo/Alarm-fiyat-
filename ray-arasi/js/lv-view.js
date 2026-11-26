/* RAY ARASI — Bölümler: 3B maket (tahta, binalar, nehir, ray, serbest yollar, köprüler, ışıklar, işaretler) */
(function () {
  'use strict';
  const RA = window.RA;
  const LV = RA.LV;
  const WS = RA.WS;
  const T = THREE;
  const M = RA.M;
  const rb = RA.rbox, mesh = RA.mesh;
  const BW = 20, BD = 32, GH = 0.6;

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
      water: new T.MeshStandardMaterial({ color: 0x3f8fd0, roughness: 0.25, metalness: 0.05, transparent: true, opacity: 0.92 }),
      bank: RA.mat(0xc8b98f, { roughness: 1 }),
      gravel: new T.MeshStandardMaterial({ map: RA.tex.clone(RA.tex.gravel(), 1, 1), roughness: 1 }),
      steel: RA.mat(0x9aa1aa, { roughness: 0.35, metalness: 0.6 }),
      sleeper: RA.mat(0x6b4e3a, { roughness: 0.9 }),
      wood: RA.mat(0x9a6b43, { roughness: 0.8 }),
      table: RA.mat(0x3a4a52, { roughness: 1 }),
      drive: RA.mat(0x5a5e66, { roughness: 0.9 }),
    };
    return MAT;
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
    constructor(scene) { this.scene = scene; this.base = null; this.roads = null; this.prev = null; this.anims = []; this.lastNow = 0; }

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
      // binalar
      for (const b of level.blds) root.add(this.building(b));
      // süs ağaçları (yolların altında kalanlar gizlenir)
      const rnd = RA.rng(level.id * 977 + 13);
      this.trees = [];
      for (let k = 0; k < 140 && this.trees.length < 70; k++) {
        const x = -9.4 + rnd() * 18.8, z = -15.4 + rnd() * 30.8;
        if (level.blds.some((b) => Math.hypot(b.x - x, b.z - z) < 2.6 || Math.hypot(b.ex - x, b.ez - z) < 1.4)) continue;
        if ((level.water || []).some((p) => LV.geo.inPoly(p, x, z))) continue;
        if (net.rails.some((r) => LV.geo.nearest(r, x, z).d < 1.4)) continue;
        this.trees.push({ x, z, kind: rnd() < 0.6 ? 'round' : 'cone', s: 0.9 + rnd() * 0.5, seed: Math.floor(rnd() * 1e6), bush: rnd() < 0.25 });
      }
      // demiryolu
      net.rails.forEach((r, k) => root.add(this.railMesh(r, (s) => net.railY[k](s))));
      root.add(RA.mergeStatic(stat));
      this.scene.add(root);
      this.base = root;
      this.railRoot = null;
    }
    building(b) {
      const g = new T.Group();
      const col = LV.COLORS[b.color];
      const ang = Math.atan2(b.ux, b.uz); // yerel +z giriş yönü
      const body = new T.Group(); body.position.set(b.x, 0, b.z); body.rotation.y = ang; g.add(body);
      // renkli taban
      body.add(mesh(rb(b.w + 0.3, 0.06, b.d + 0.3, 0.05), RA.mat(col.hex, { roughness: 0.7 }), 0, 0.03, 0, false));
      body.add(mesh(rb(b.w + 0.05, 0.07, b.d + 0.05, 0.05), RA.mat(0xe9e4d6, { roughness: 0.9 }), 0, 0.045, 0, false));
      const rnd = RA.rng(Math.round(b.x * 31 + b.z * 7));
      if (b.kind === 'house') {
        const walls = [0xf2d7b6, 0xe9e3d3, 0xf5e6c4, 0xdfe7ea];
        for (const x of [-0.82, 0, 0.82]) { const h = M.house(0.74, 0.7, 0.5 + rnd() * 0.16, RA.pick(walls, rnd), col.roof, rnd); h.position.set(x, 0.07, -0.2); body.add(h); }
      } else {
        const pm = WS.placeModel(b.type || 'fabrika', Math.round(b.x * 13 + b.z));
        pm.scale.setScalar(1.5); pm.position.set(0, 0.07, -0.1); body.add(pm);
        body.add(mesh(rb(b.w * 0.9, 0.12, 0.06, 0.02), RA.mat(col.hex), 0, 0.5, b.d / 2 + 0.02, false));
      }
      // giriş yolu
      const drive = mesh(rb(0.9, 0.05, 0.9, 0.02), mats().drive, 0, 0.03, b.d / 2 + 0.45, false); body.add(drive);
      // tabela ve giriş işareti
      const label = b.kind === 'house' ? 'EVLER' : ({ fabrika: 'FABRİKA', okul: 'OKUL', avm: 'AVM', ofis: 'OFİS', hastane: 'HASTANE' }[b.type] || 'İŞ YERİ');
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
        g.add(new T.Mesh(wallY(sub, -hw - 0.08, yy, 0.02, -0.28, 0.25, true), m.deck));
        g.add(new T.Mesh(wallY(sub, hw + 0.08, yy, 0.02, -0.28, 0.25, false), m.deck));
        // korkuluk (açık renk, üstten bakınca köprü belli olsun)
        for (const x of [-hw - 0.04, hw + 0.04]) g.add(new T.Mesh(ribbonY(sub, x - 0.07, x + 0.07, (s) => yy(s) + 0.22, 0, 0.25), m.parapet));
        for (const [x, f] of [[-hw - 0.11, true], [hw + 0.11, false], [-hw + 0.03, false], [hw - 0.03, true]]) g.add(new T.Mesh(wallY(sub, x, yy, 0.22, 0.02, 0.25, f), m.parapet));
        g.add(new T.Mesh(ribbonY(sub, -hw - 0.08, hw + 0.08, (s) => yy(s) - 0.28, 0, 0.25), m.deck));
        for (let s = 0.6; s < sub.length - 0.3; s += 1.7) {
          const y = yy(s); if (y < 0.55) continue;
          const P = sub.at(s), Tn = sub.tan(s);
          const pl = mesh(rb(0.32, y - 0.25, 0.32, 0.04), m.pillar, P.x, (y - 0.25) / 2, P.z); pl.rotation.y = -Math.atan2(Tn.z, Tn.x); g.add(pl);
        }
      }
    }

    /* ---------- yollar (her çizimde yeniden kurulur) ---------- */
    buildRoads(level, net) {
      this.spots(null);
      this.dispose(this.roads);
      const m = mats();
      const root = new T.Group(), stat = new T.Group();
      for (const e of net.edges) {
        const path = new RA.Path(LV.geo.slicePts(e.st, e.s0, e.s1));
        const yf = (s) => e.y(e.s0 + (s / path.length) * e.len);
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
      // türü seçilmemiş kesişim: iki yolun üst üste binen çizgi ve kaldırımları yerine temiz bir asfalt yüzey
      for (const c of net.crossings) {
        if (c.type !== 'pending' || c.kind !== 'road' || !c.ta) continue;
        const k = 0.97 / Math.max(0.45, Math.abs(c.ta.x * c.tb.z - c.ta.z * c.tb.x));
        const P = [[1, 1], [1, -1], [-1, -1], [-1, 1]].map(([i, j]) => new T.Vector2(c.x + (c.ta.x * i + c.tb.x * j) * k, -(c.z + (c.ta.z * i + c.tb.z * j) * k)));
        const geo = new T.ShapeGeometry(new T.Shape(P)); geo.rotateX(-Math.PI / 2);
        const pad = new T.Mesh(geo, m.asphalt); pad.position.y = 0.068; pad.receiveShadow = true; stat.add(pad);
      }
      // kavşak ve birleşme yerleri
      for (const n of net.nodes) {
        if (n.kind === 'j' || n.kind === 'joint') {
          // kavşak zemini: kolların arasını dolduran düz asfalt
          const r = n.kind === 'j' ? LV.C.JR + 0.02 : 0.9;
          const pad = mesh(RA.geo('jpad' + r, () => { const c = new T.CircleGeometry(r, 32); c.rotateX(-Math.PI / 2); return c; }), m.asphalt, n.x, 0.05, n.z, false); pad.receiveShadow = true; stat.add(pad);
          // kolların arasındaki köşeler: kaldırım kavisi
          if (n.kind === 'j') {
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
        if (n.kind === 'j') {
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
      // ışıklar: her kavşak kolunda (gelen şeridin sağında) bir lamba
      this.lamps = [];
      for (const n of net.nodes) {
        if (n.kind !== 'j' || n.deg < 4) continue; // 3 kollu kavşaklar ışıksız: önce gelen geçer
        for (const arm of n.arms) {
          const ang = arm.ang; const rx = -Math.sin(ang), rz = Math.cos(ang);
          const x = n.x + Math.cos(ang) * 1.35 - rx * 1.05, z = n.z + Math.sin(ang) * 1.35 - rz * 1.05;
          const pole = mesh(RA.geo('lpole', () => new T.CylinderGeometry(0.035, 0.035, 0.75, 6)), RA.mat(0x3d4249), x, 0.375, z); root.add(pole);
          const mat = new T.MeshStandardMaterial({ color: 0x111111, emissive: 0xff2a1f, emissiveIntensity: 2.4 });
          const lamp = new T.Mesh(RA.geo('lbulb', () => new T.SphereGeometry(0.11, 12, 8)), mat); lamp.position.set(x, 0.82, z); root.add(lamp);
          this.lamps.push({ n, e: arm.e.id, mat });
        }
      }
      // hemzemin geçit bariyerleri
      this.gates = [];
      for (const gt of net.gates) {
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

    /* ---------- köprü / alt geçit yapılabilecek yerler (parlayan işaretler) ---------- */
    spots(list, kind) {
      if (this.spotG) { this.scene.remove(this.spotG); this.spotG.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } else if (o.isSprite) o.material.dispose(); }); this.spotG = null; }
      this.spotL = list || null;
      if (this.marks) for (const mk of this.marks) mk.sp.visible = !list;
      if (!list) return;
      const g = new T.Group(), col = kind === 'bridge' ? 0x3d8bff : 0xa061f0;
      for (const s of list) {
        const add = s.act !== 'unset';
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
        L.mat.emissive.setHex(st === 'green' ? 0x22e06a : st === 'amber' ? 0xffb400 : 0xff2a1f);
      }
      if (this.gates) for (const gt of this.gates) {
        const gs = sim.gateSt && sim.gateSt.get(gt.key); const a = gs ? gs.arm : 0;
        gt.arm.rotation.z = (Math.PI / 2) * (1 - a) * 0.95;
        gt.lm.emissiveIntensity = gs && gs.closed && Math.floor(now * 3) % 2 === 0 ? 3 : 0;
      }
      for (const h of sim.houses || []) {
        const b = h.b; if (!b.pend) continue;
        const n = Math.min(h.pending, LV.Sim.PENDING_CAP);
        if (n !== b.pendN) { b.pendN = n; b.pend.material.map = pendTex(n, LV.Sim.PENDING_CAP); b.pend.material.needsUpdate = true; }
        b.pend.visible = running || n > 0;
      }
      if (this.spotL) for (const s of this.spotL) {
        if (s.act === 'unset') continue;
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
