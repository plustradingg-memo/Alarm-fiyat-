/* RAY ARASI — 3. Mod: HAVA TRAFİĞİ — İniş sırasını sen ver */
(function () {
  'use strict';
  const RA = window.RA;
  const T = THREE;
  const M = RA.M;
  const rb = RA.rbox, mesh = RA.mesh;

  const RX = 0.9;                 // pist ekseni (x)
  const R_THR = -2.2, R_END = -13.4; // eşik ve pist sonu (z)
  const TD = -3.3;                 // teker koyma noktası
  const EXIT_Z = -6.2;             // hızlı çıkış taksi yolu
  const FIX = { x: RX, z: 0.9, alt: 1.0 };
  const V_HOLD = 2.2, V_APP = 4.5, V_TD = 3.7, V_EXIT = 2.3, V_TAXI = 1.3;
  const SEA_Y = -0.15;
  const ORBITS = [
    { key: 'A', c: [-3.5, 4.3], r: 2.3, alt: 2.5, dir: -1, color: 0x3fd0ff, css: '#3fd0ff', entry: [-9, 1.5] },
    { key: 'B', c: [4.3, 3.1], r: 2.3, alt: 2.95, dir: 1, color: 0xffb400, css: '#ffb400', entry: [10, 0.5] },
    { key: 'C', c: [0.2, 9.9], r: 2.3, alt: 2.7, dir: -1, color: 0xff6fb0, css: '#ff6fb0', entry: [-6, 15] },
  ];
  const LIVERY = [0x2f6fd6, 0xe0402f, 0x1f9d61, 0x7a4fc2, 0xf08a24, 0x1a9e9a];

  class AirMode {
    constructor(app) {
      this.app = app;
      this.id = 'air';
      this.title = 'Hava Trafiği';
      this.hint = 'İndirmek istediğin uçağa dokun; halkalar kalan bekleme turunu gösterir.';
      this.unitLabel = 'uçak';
      this.scene = new T.Scene();
      this.scene.background = new T.Color(0x22355e);
      this.camera = new T.PerspectiveCamera(32, 0.5, 0.5, 200);
      this.planes = [];
      this.puffs = [];
      this.buildWorld();
      this.buildDynamic();
    }

    coastX(z) { return z < 5.0 ? -1.3 + 0.3 * Math.sin(z * 0.55) : -1.3 + 0.3 * Math.sin(5.0 * 0.55) + (z - 5.0) * 0.95; }

    buildWorld() {
      const sc = this.scene;
      RA.makeLights(sc, { sky: 0xa9bcf2, ground: 0x3a3d5a, hemi: 1.25, sun: 0xffa572, sunI: 1.6, sunPos: [-18, 9, 6], sunTarget: [1, 0, -2], shadowSize: 20, fill: 0x6f86d8, fillI: 0.35 });
      const stat = new T.Group();
      const rnd = RA.rng(31);
      // deniz
      this.seaTex = RA.tex.clone(RA.tex.seaDusk(), 9, 9);
      const sea = new T.Mesh(new T.PlaneGeometry(80, 80), new T.MeshStandardMaterial({ map: this.seaTex, color: 0xc4d2ff, transparent: true, opacity: 0.78, roughness: 0.3, metalness: 0.25 }));
      sea.rotation.x = -Math.PI / 2; sea.position.y = SEA_Y; sea.renderOrder = 1; sc.add(sea);
      const bed = new T.Mesh(new T.PlaneGeometry(80, 80), RA.basic(0x16264a)); bed.rotation.x = -Math.PI / 2; bed.position.y = -6; sc.add(bed);
      // kara (kıyı çizgisi dalgalı)
      const coast = [];
      for (let z = -30; z <= 30; z += 0.5) coast.push([this.coastX(z), z]);
      const landShape = (off) => {
        const sh = new T.Shape();
        sh.moveTo(40, -30);
        coast.forEach(([x, z]) => sh.lineTo(Math.min(40, x - off), z));
        sh.lineTo(40, 30); sh.lineTo(40, -30);
        return sh;
      };
      const mkLand = (off, depth, m, y) => {
        const g = new T.ExtrudeGeometry(landShape(off), { depth, bevelEnabled: false, curveSegments: 2 });
        g.rotateX(Math.PI / 2); // şekil xz düzlemine, yukarı yüz +y
        const me = new T.Mesh(g, m); me.position.y = y; me.receiveShadow = true; return me;
      };
      // ShapeGeometry y ekseni -> z ekseni dönüşümü: rotateX(+90) y->z
      const sand = mkLand(0.55, 0.5, RA.mat(0xb59b72, { roughness: 1 }), -0.06);
      const land = mkLand(0, 0.5, new T.MeshStandardMaterial({ map: RA.tex.clone(RA.tex.grassDusk(), 12, 12), roughness: 1 }), 0.0);
      stat.add(sand, land);
      // pist
      const RL = R_THR - R_END;
      const rw = mesh(new T.BoxGeometry(1.55, 0.04, RL + 0.6), RA.mat(0x2c2f36, { roughness: 0.9 }), RX, 0.02, (R_THR + R_END) / 2); rw.castShadow = false; stat.add(rw);
      const paint = RA.mat(0xe6e6e0, { roughness: 0.7 });
      for (let z = R_THR - 1.6; z > R_END + 1.2; z -= 0.9) stat.add(mesh(new T.BoxGeometry(0.06, 0.012, 0.45), paint, RX, 0.046, z, false));
      for (let i = 0; i < 6; i++) { const x = RX - 0.55 + i * 0.22; stat.add(mesh(new T.BoxGeometry(0.1, 0.012, 0.6), paint, x, 0.046, R_THR - 0.45, false)); stat.add(mesh(new T.BoxGeometry(0.1, 0.012, 0.6), paint, x, 0.046, R_END + 0.45, false)); }
      for (const z of [TD + 0.2, TD - 0.6]) for (const sx of [-1, 1]) stat.add(mesh(new T.BoxGeometry(0.2, 0.012, 0.5), paint, RX + sx * 0.38, 0.046, z, false));
      // taksi yolu ve apron
      const twM = RA.mat(0x3a3d44, { roughness: 0.9 });
      this.exitPath = new RA.PathBuilder(RX, EXIT_Z, -Math.PI / 2).to(2.95, EXIT_Z - 2.0, -Math.PI / 2, 0.9).line(2.6).build();
      stat.add(new T.Mesh(RA.ribbon(this.exitPath, 0.75, 0.025, { step: 0.1 }), twM));
      const apron = mesh(new T.BoxGeometry(4.6, 0.03, 3.2), twM, 5.0, 0.016, -12.4); apron.castShadow = false; stat.add(apron);
      stat.add(mesh(new T.BoxGeometry(0.75, 0.03, 2.4), twM, 2.95, 0.017, -10.6, false));
      // terminal
      const term = new T.Group(); term.position.set(5.1, 0, -14.6);
      term.add(mesh(rb(4.6, 0.75, 1.0, 0.06), RA.mat(0xd9d4c8), 0, 0.375, 0));
      term.add(mesh(rb(4.4, 0.36, 0.04, 0.01), RA.glow(0x9fd8ff, 0.9), 0, 0.42, 0.51, false));
      term.add(mesh(rb(4.8, 0.08, 1.2, 0.03), RA.mat(0x8f9aa8), 0, 0.79, 0));
      const tower = new T.Group(); tower.position.set(-2.8, 0, 0.4);
      tower.add(mesh(RA.geo('twr', () => new T.CylinderGeometry(0.16, 0.22, 1.9, 10)), RA.mat(0xd9d4c8), 0, 0.95, 0));
      tower.add(mesh(RA.geo('twrc', () => new T.CylinderGeometry(0.36, 0.3, 0.34, 10)), RA.glow(0x7fd0ff, 0.8), 0, 2.05, 0));
      tower.add(mesh(RA.geo('twrr', () => new T.CylinderGeometry(0.42, 0.42, 0.06, 10)), RA.mat(0x5a6270), 0, 2.25, 0));
      term.add(tower); stat.add(term);
      // kasaba (sağ tarafta, ışıklı pencereler)
      const blocks = [[4.8, -4.2, 1.6, 1.4, 1.0], [6.6, -6.2, 1.4, 1.8, 1.4], [6.8, -2.0, 1.2, 1.2, 0.8], [4.6, 7.4, 1.6, 1.4, 0.9], [6.8, 8.6, 1.4, 1.6, 1.2], [7.6, 5.2, 1.2, 1.4, 1.6], [3.6, -0.6, 1.0, 1.0, 0.7], [7.8, 0.8, 1.2, 1.2, 1.0]];
      blocks.forEach(([x, z, w, d, h], i) => { const b = M.block(w, d, h, RA.pick([0xe9d3b5, 0xd8c3e3, 0xc9dbe6, 0xf0dcc0, 0xd4c6b0], rnd), rnd, { lit: true }); b.position.set(x, 0, z); stat.add(b); });
      for (let i = 0; i < 34; i++) {
        const z = -16 + rnd() * 30, x = this.coastX(z) + 0.6 + rnd() * 1.2;
        if (Math.abs(x - RX) < 1.6 || (z < -8 && x > 2)) continue;
        const t = M.tree(rnd, 'palm', 0.7 + rnd() * 0.3); t.position.set(x, 0, z); stat.add(t);
      }
      for (let i = 0; i < 20; i++) { const x = 2.6 + rnd() * 6, z = -7 + rnd() * 18; if (blocks.some((b) => Math.hypot(b[0] - x, b[1] - z) < 1.3)) continue; const t = M.tree(rnd, 'round', 0.6); t.position.set(x, 0, z); stat.add(t); }
      // deniz feneri
      const lh = new T.Group(); lh.position.set(this.coastX(7.2) + 0.2, 0, 7.2);
      for (let i = 0; i < 4; i++) lh.add(mesh(RA.geo('lh' + i, () => new T.CylinderGeometry(0.2 - i * 0.025, 0.22 - i * 0.025, 0.36, 12)), RA.mat(i % 2 ? 0xd23b2f : 0xf2f0ea), 0, 0.18 + i * 0.36, 0));
      lh.add(mesh(RA.geo('lhl', () => new T.CylinderGeometry(0.16, 0.16, 0.22, 10)), RA.glow(0xfff0b0, 2.2), 0, 1.56, 0));
      lh.add(mesh(RA.geo('lhr', () => new T.ConeGeometry(0.2, 0.2, 10)), RA.mat(0x2b2f36), 0, 1.77, 0));
      stat.add(lh);
      this.lighthousePos = new T.Vector3(lh.position.x, 1.56, lh.position.z);
      sc.add(RA.mergeStatic(stat));
      // fener ışını
      const beamG = new T.ConeGeometry(0.7, 4.5, 16, 1, true); beamG.translate(0, -2.25, 0); beamG.rotateZ(Math.PI / 2);
      this.beam = new T.Mesh(beamG, new T.MeshBasicMaterial({ color: 0xfff0b0, transparent: true, opacity: 0.16, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide }));
      this.beam.position.copy(this.lighthousePos); sc.add(this.beam);
      const lhGlow = RA.glowSprite(0xfff0b0, 1.2, 0.9); lhGlow.position.copy(this.lighthousePos); sc.add(lhGlow);
      // pist ışıkları
      this.edgeMat = new T.SpriteMaterial({ map: RA.tex.glow(), color: 0xfff1c8, transparent: true, depthWrite: false, blending: T.AdditiveBlending, opacity: 0.95 });
      for (let z = R_THR; z >= R_END; z -= 0.75) for (const sx of [-0.85, 0.85]) { const s = new T.Sprite(this.edgeMat); s.scale.set(0.3, 0.3, 1); s.position.set(RX + sx, 0.08, z); sc.add(s); }
      const thr = new T.SpriteMaterial({ map: RA.tex.glow(), color: 0x44ff88, transparent: true, depthWrite: false, blending: T.AdditiveBlending });
      const end = new T.SpriteMaterial({ map: RA.tex.glow(), color: 0xff4433, transparent: true, depthWrite: false, blending: T.AdditiveBlending });
      for (let i = 0; i < 6; i++) { const x = RX - 0.75 + i * 0.3; const a = new T.Sprite(thr); a.scale.set(0.34, 0.34, 1); a.position.set(x, 0.08, R_THR + 0.05); sc.add(a); const b = new T.Sprite(end); b.scale.set(0.3, 0.3, 1); b.position.set(x, 0.08, R_END - 0.05); sc.add(b); }
      this.thrMat = thr;
      // yaklaşma ışıkları (sıralı çakar)
      this.rabbit = [];
      for (let i = 0; i < 7; i++) {
        const z = R_THR + 0.6 + i * 0.55;
        const bar = mesh(new T.BoxGeometry(0.5, 0.03, 0.05), RA.mat(0x444a55), RX, 0.06, z, false); sc.add(bar);
        const s = RA.glowSprite(0xfffbe8, 0.5, 0.2); s.position.set(RX, 0.12, z); sc.add(s); this.rabbit.push(s);
      }
      // taksi yolu ışıkları
      const twL = new T.SpriteMaterial({ map: RA.tex.glow(), color: 0x4a7dff, transparent: true, depthWrite: false, blending: T.AdditiveBlending, opacity: 0.9 });
      const P = {}, Tn = {};
      for (let s = 0.8; s < this.exitPath.length; s += 0.55) { this.exitPath.at(s, P); this.exitPath.tan(s, Tn); for (const o of [-0.45, 0.45]) { const sp = new T.Sprite(twL); sp.scale.set(0.2, 0.2, 1); sp.position.set(P.x - Tn.z * o, 0.07, P.z + Tn.x * o); sc.add(sp); } }
      // tekneler
      this.boats = [];
      [[-5.5, -4], [-7.2, 6.5], [-4.4, 12.5]].forEach(([x, z], i) => {
        const b = new T.Group(); b.position.set(x, SEA_Y, z);
        b.add(mesh(rb(0.7, 0.16, 0.26, 0.06), RA.mat(0xf2f0ea), 0, 0.06, 0));
        b.add(mesh(rb(0.26, 0.14, 0.18, 0.03), RA.mat(0x2f6fd6), -0.08, 0.18, 0));
        const l = RA.glowSprite(0xffd27a, 0.3, 0.9); l.position.set(0.2, 0.3, 0); b.add(l);
        sc.add(b); this.boats.push({ g: b, ph: i * 1.7 });
      });
    }

    buildDynamic() {
      const sc = this.scene;
      // bekleme rotaları: renkli kesikli halkalar (havada) + zeminde soluk iz
      this.orbitObjs = [];
      const dashTex = RA.tex.dash();
      ORBITS.forEach((o) => {
        const pts = [];
        for (let i = 0; i <= 120; i++) { const a = (i / 120) * Math.PI * 2; pts.push({ x: o.c[0] + Math.cos(a) * o.r, z: o.c[1] + Math.sin(a) * o.r }); }
        const path = new RA.Path(pts);
        const tex = dashTex.clone(); tex.needsUpdate = true; tex.wrapS = tex.wrapT = T.RepeatWrapping;
        const ring = new T.Mesh(RA.ribbon(path, 0.07, 0, { step: 0.08, vScale: 2.2 }), new T.MeshBasicMaterial({ color: o.color, map: tex, alphaMap: tex, transparent: true, opacity: 0.85, depthWrite: false }));
        ring.position.y = o.alt - 0.2; ring.renderOrder = 4; sc.add(ring);
        const ground = RA.glowDecal(o.color, o.r * 2.3, o.r * 2.3, 0.08); ground.position.set(o.c[0], 0.03, o.c[1]); sc.add(ground);
        this.orbitObjs.push({ ring, ground });
      });
      // yaklaşma çizgisi: uçağın önünde piste uzanan parlak kesik çizgi
      this.APP_N = 90;
      this.appDash = new T.InstancedMesh(new T.BoxGeometry(0.2, 0.035, 0.07), new T.MeshBasicMaterial({ color: 0xffffff }), this.APP_N);
      this.appDash.frustumCulled = false; this.appDash.count = 0; sc.add(this.appDash);
      this.appLine = { visible: false };
      // duman havuzu
      for (let i = 0; i < 16; i++) { const s = RA.glowSprite(0xd8d8e0, 0.4, 0); s.blending = T.NormalBlending; s.material.blending = T.NormalBlending; s.visible = false; sc.add(s); this.puffs.push({ s, life: 0, v: new T.Vector3() }); }
    }

    /* ================= GÜNLÜK AKIŞ ================= */
    makeSchedule(seed) {
      const rnd = RA.rng(seed);
      // sabit zorluk: geliş zamanları ve tur sayıları sabit; giriş yönü, renk ve çağrı kodu sırası günlük
      const times = [3.4, 8.4, 13.0, 17.6, 22.0, 26.4, 30.6, 34.8, 39.0];
      const laps = [2, 3, 2, 3, 2, 3, 2, 2, 2];
      const shuffledLaps = laps.slice(0, 2).concat(RA.shuffle(laps.slice(2), rnd));
      const codes = RA.shuffle([214, 307, 118, 452, 629, 735, 841, 963, 175, 286, 390, 517], rnd);
      const liv = RA.shuffle(LIVERY.concat(LIVERY), rnd);
      return times.map((t, i) => ({ t, laps: shuffledLaps[i], code: 'RA ' + codes[i + 2], livery: liv[i + 2], pref: Math.floor(rnd() * 3) }))
        .concat([{ init: true, slot: 0, laps: 1, prog: 0.4, code: 'RA ' + codes[0], livery: liv[0] }, { init: true, slot: 1, laps: 3, prog: 0.15, code: 'RA ' + codes[1], livery: liv[1] }]);
    }

    reset(seed) {
      this.planes.forEach((p) => this.removePlane(p));
      this.planes = [];
      this.runway = null; this.flash = 0; this.firstTap = false; this.diverted = null; this.lastFree = -5;
      this.slots = [null, null, null];
      const sch = this.makeSchedule(seed);
      this.queue = sch.filter((e) => !e.init).sort((a, b) => a.t - b.t);
      this.setupLabels();
      sch.filter((e) => e.init).forEach((e) => this.spawn(e, true));
      this.frame(0);
    }
    setupLabels() {
      const L = this.app.labels;
      this.rwTag = document.createElement('div'); this.rwTag.className = 'tag'; this.rwTag.hidden = true; L.appendChild(this.rwTag);
    }

    spawn(e, initial) {
      let slot = -1;
      if (initial) slot = e.slot;
      else {
        const pref = [e.pref, (e.pref + 1) % 3, (e.pref + 2) % 3];
        for (const k of pref) if (!this.slots[k]) { slot = k; break; }
        if (slot < 0) return false;
      }
      const o = ORBITS[slot];
      const g = M.plane(e.livery);
      const refl = M.plane(e.livery); refl.scale.y = -1;
      const shadow = RA.blobShadow(1.9, 1.7, 0.45);
      this.scene.add(g, refl, shadow);
      const el = document.createElement('div'); el.className = 'laps'; el.style.setProperty('--c', o.css);
      el.innerHTML = '<span class="code">' + e.code + '</span><span class="rings"></span>';
      this.app.labels.appendChild(el);
      const p = { code: e.code, livery: e.livery, slot, orbit: o, g, refl, shadow, el, laps: e.laps, prog: 0, phi: 0, state: 'hold', s: 0, path: null, v: V_HOLD, alt: o.alt, x: 0, z: 0, head: 0, roll: 0, pitch: 0, t: 0 };
      this.slots[slot] = p;
      if (initial) {
        p.prog = e.prog;
        p.phi = this.gatePhi(o) + o.dir * e.prog * Math.PI * 2;
        this.placeHold(p);
      } else {
        // ufuktan bekleme halkasına giriş
        const entryPhi = Math.atan2(o.entry[1] - o.c[1], o.entry[0] - o.c[0]);
        const ex = o.c[0] + Math.cos(entryPhi) * o.r, ez = o.c[1] + Math.sin(entryPhi) * o.r;
        const th = entryPhi + o.dir * Math.PI / 2;
        const startTh = Math.atan2(ez - o.entry[1], ex - o.entry[0]);
        p.path = new RA.PathBuilder(o.entry[0], o.entry[1], startTh).to(ex, ez, th, 0.8).build();
        p.state = 'arrive'; p.s = 0; p.phi = entryPhi; p.alt = o.alt + 0.6;
        p.lapStartPhi = entryPhi;
      }
      this.renderRings(p);
      this.planes.push(p);
      return true;
    }
    gatePhi(o) { return Math.atan2(FIX.z - o.c[1], FIX.x - o.c[0]); }
    removePlane(p) {
      this.scene.remove(p.g, p.refl, p.shadow);
      if (p.el) p.el.remove();
      if (this.slots[p.slot] === p) this.slots[p.slot] = null;
    }
    renderRings(p) {
      const rings = p.el.querySelector('.rings');
      const n = Math.max(1, p.laps);
      if (rings.childElementCount !== n) {
        rings.innerHTML = '';
        for (let i = 0; i < n; i++) { const r = document.createElement('span'); r.className = 'ring'; rings.appendChild(r); }
      }
      const items = rings.children;
      for (let i = 0; i < items.length; i++) {
        const last = p.laps === 1;
        items[i].className = 'ring ' + (last ? 'last' : 'full');
      }
      p.el.classList.toggle('final', p.laps === 1 && (p.state === 'hold' || p.state === 'arrive'));
    }

    /* ================= DOKUNMA ================= */
    tap(x, y) {
      const w = this.app.w, h = this.app.h;
      let best = null, bd = 1e9;
      for (const p of this.planes) {
        if (p.state !== 'hold' && p.state !== 'arrive') continue;
        const q = RA.project(new T.Vector3(p.x, p.alt, p.z), this.camera, w, h);
        let d = Math.hypot(x - q.x, y - q.y);
        if (p.labelX != null) d = Math.min(d, Math.hypot(x - p.labelX, y - p.labelY) * 1.1);
        if (d < bd) { bd = d; best = p; }
      }
      const R = Math.max(54, w * 0.15);
      if (!best || bd > R) { RA.audio.play('tap'); return false; }
      this.select(best);
      return true;
    }
    key(k) {
      const i = { 1: 0, 2: 1, 3: 2 }[k];
      if (i == null) return false;
      const p = this.slots[i]; if (p) this.select(p);
      return true;
    }
    select(p) {
      if (this.diverted) return;
      this.firstTap = true;
      if (this.runway) {
        // pist dolu: ışıklar kısa süre yanıp söner, uçak beklemeye devam eder
        this.flash = 0.8;
        RA.audio.play('denied'); RA.vibrate([25, 40, 25]);
        p.el.classList.remove('deny'); void p.el.offsetWidth; p.el.classList.add('deny');
        p.roll = p.orbit.dir * -0.1; p.wobble = 0.6;
        this.app.popText('Pist dolu · beklemede', new T.Vector3(p.x, p.alt + 0.9, p.z), 'pop-warn');
        return;
      }
      RA.audio.play('select'); RA.vibrate(12);
      this.clear(p);
    }
    clear(p) {
      this.runway = p;
      if (this.slots[p.slot] === p) this.slots[p.slot] = null;
      p.state = 'app';
      p.el.classList.add('cleared'); p.el.classList.remove('final');
      // dönüşü tamamla, piste hizalan, teker koy, taksi yoluna dön
      const head = p.head;
      const brg = Math.atan2(FIX.z - p.z, FIX.x - p.x);
      const dTh = RA.wrapAngle(brg - head);
      const pb = new RA.PathBuilder(p.x, p.z, head);
      if (Math.abs(dTh) > 0.5) pb.arc(1.5, dTh * 0.7);
      pb.to(FIX.x, FIX.z, -Math.PI / 2, 0.75);
      const sFix = pb.build().length;
      pb.line(FIX.z - TD);
      const sTD = pb.build().length;
      pb.line(TD - EXIT_Z);
      const sExit = pb.build().length;
      pb.to(2.95, EXIT_Z - 2.0, -Math.PI / 2, 0.9).line(2.6);
      // apron park yeri
      const gate = this.freeGate();
      pb.to(gate.x, gate.z, 0, 0.8);
      p.path = pb.build(); p.s = 0; p.sFix = sFix; p.sTD = sTD; p.sExit = sExit; p.gate = gate;
      p.alt0 = p.alt;
      // pisti boşaltma noktası: gövde pist kenarını geçince
      p.sVacate = p.path.length;
      for (let s = sExit; s < p.path.length; s += 0.05) { const q = p.path.at(s); if (q.x > RX + 1.6) { p.sVacate = s; break; } }
      // yaklaşma çizgisi (kesik parçalar)
      this.appS = [];
      for (let s = 0.45; s <= sTD + 0.1 && this.appS.length < this.APP_N; s += sTD / Math.min(this.APP_N, Math.ceil(sTD / 0.42))) this.appS.push(s);
      this.appDash.material.color.setHex(p.orbit.color);
      this.appLine.visible = true;
      p.el.querySelector('.rings').innerHTML = '<span class="land-chip">İNİŞ</span>';
      this.app.hintDone();
    }
    freeGate() {
      const gates = [{ x: 3.9, z: -12.3 }, { x: 5.2, z: -12.3 }, { x: 6.5, z: -12.3 }];
      this.gateIdx = ((this.gateIdx || 0) + 1) % gates.length;
      return gates[this.gateIdx];
    }
    altAt(p, s) {
      if (s <= p.sFix) { const k = RA.smooth(s / p.sFix); return RA.lerp(p.alt0, FIX.alt, k); }
      if (s >= p.sTD) return 0;
      const k = (s - p.sFix) / (p.sTD - p.sFix);
      // süzülüş + son anda burun kaldırma (flare)
      return FIX.alt * (1 - k) * (k > 0.8 ? 0.8 + (1 - k) : 1);
    }

    /* ================= SİMÜLASYON ================= */
    update(dt, t, ending) {
      this.t = t;
      // gelişler (boş halka bekler)
      if (!ending) while (this.queue.length && this.queue[0].t <= t) { if (!this.spawn(this.queue[0], false)) break; this.queue.shift(); }
      for (let i = this.planes.length - 1; i >= 0; i--) {
        const p = this.planes[i];
        p.t += dt;
        if (p.wobble) p.wobble = Math.max(0, p.wobble - dt);
        if (p.state === 'arrive') {
          p.s += V_HOLD * 1.15 * dt;
          p.alt = RA.damp(p.alt, p.orbit.alt, 2, dt);
          if (p.s >= p.path.length) { p.state = 'hold'; p.phi = Math.atan2(p.z - p.orbit.c[1], p.x - p.orbit.c[0]); p.lapStartPhi = p.phi; p.prog = 0; }
          else this.placePath(p, dt);
          if (p.state === 'hold') this.placeHold(p, dt);
        } else if (p.state === 'hold') {
          const o = p.orbit;
          const dphi = (V_HOLD / o.r) * dt;
          p.phi += o.dir * dphi;
          p.prog += dphi / (Math.PI * 2);
          if (p.prog >= 1) {
            p.prog -= 1; p.laps -= 1;
            if (p.laps <= 0 && !ending && !this.diverted) { this.divert(p); continue; }
            this.renderRings(p);
            if (p.laps === 1) RA.audio.play('warn');
          }
          this.placeHold(p, dt);
        } else if (p.state === 'app') {
          const sp = p.s < p.sFix ? V_APP : p.s < p.sTD ? RA.lerp(V_APP, V_TD, (p.s - p.sFix) / (p.sTD - p.sFix)) : null;
          if (sp != null) p.v = sp;
          else if (p.s < p.sVacate) p.v = Math.max(V_EXIT, p.v - 2.8 * dt);
          else p.v = Math.max(V_TAXI, p.v - 1.5 * dt);
          p.s += p.v * dt;
          if (!p.touched && p.s >= p.sTD) {
            p.touched = true; RA.audio.play('land'); RA.vibrate(15);
            if (!ending) this.app.addScore(1, new T.Vector3(RX + 0.9, 0.7, TD));
            for (let k = 0; k < 6; k++) this.puff(new T.Vector3(RX + (k % 2 ? 0.14 : -0.14), 0.08, TD + 0.3));
          }
          if (p.s >= p.sVacate && this.runway === p) { this.runway = null; this.lastFree = t; this.appLine.visible = false; RA.audio.play('clear'); }
          p.alt = this.altAt(p, p.s);
          if (p.s >= p.path.length) { p.state = 'parked'; p.parkT = 0; }
          else this.placePath(p, dt);
        } else if (p.state === 'parked') {
          p.parkT += dt;
          if (p.parkT > 2.5) { this.removePlane(p); this.planes.splice(i, 1); continue; }
        } else if (p.state === 'divert') {
          p.s += 4.2 * dt; p.alt = Math.min(5.5, p.alt + 0.9 * dt);
          if (p.s >= p.path.length) { p.g.visible = false; p.refl.visible = false; p.shadow.visible = false; }
          else this.placePath(p, dt);
        }
      }
      this.flash = Math.max(0, this.flash - dt);
      this.updatePuffs(dt);
    }
    divert(p) {
      this.diverted = p;
      p.state = 'divert'; p.s = 0;
      if (this.slots[p.slot] === p) this.slots[p.slot] = null;
      p.path = new RA.PathBuilder(p.x, p.z, p.head).to(-13, -19, -2.2, 0.9).build();
      p.el.classList.add('gone');
      RA.audio.play('divert');
      this.app.popText(p.code + ' başka meydana', new T.Vector3(p.x, p.alt + 0.6, p.z), 'pop-warn');
      this.app.fail('Uçak yöneldi', p.code + ' son bekleme turunu bitirdi ve başka meydana yöneldi.', 1.8);
    }
    puff(pos) {
      const f = this.puffs.find((q) => q.life <= 0); if (!f) return;
      f.s.position.copy(pos); f.v.set((Math.random() - 0.5) * 0.6, 0.3 + Math.random() * 0.3, 0.8 + Math.random() * 0.6);
      f.life = 0.9; f.s.visible = true; f.s.scale.setScalar(0.25);
    }
    updatePuffs(dt) {
      for (const f of this.puffs) {
        if (f.life <= 0) continue;
        f.life -= dt; f.s.position.addScaledVector(f.v, dt); f.s.scale.multiplyScalar(1 + dt * 1.6);
        f.s.material.opacity = Math.max(0, f.life * 0.8);
        if (f.life <= 0) f.s.visible = false;
      }
    }

    /* ================= YERLEŞTİRME ================= */
    placeHold(p, dt) {
      const o = p.orbit;
      p.x = o.c[0] + Math.cos(p.phi) * o.r; p.z = o.c[1] + Math.sin(p.phi) * o.r;
      p.head = p.phi + o.dir * Math.PI / 2;
      const targetRoll = o.dir * 0.42 + (p.wobble ? Math.sin(p.wobble * 30) * 0.25 : 0);
      p.roll = dt ? RA.damp(p.roll, targetRoll, 4, dt) : targetRoll;
      p.pitch = 0;
      p.alt = dt ? RA.damp(p.alt, o.alt, 2, dt) : o.alt;
    }
    placePath(p, dt) {
      const q = p.path.at(p.s);
      const prevHead = p.head;
      p.x = q.x; p.z = q.z; p.head = p.path.heading(p.s);
      const turn = dt ? RA.wrapAngle(p.head - prevHead) / dt : 0;
      const onGround = p.alt < 0.02;
      const targetRoll = onGround ? 0 : RA.clamp(turn * 0.35, -0.6, 0.6);
      p.roll = dt ? RA.damp(p.roll, targetRoll, 5, dt) : targetRoll;
      p.pitch = p.state === 'app' && p.s > p.sTD - 1.2 && p.s < p.sTD + 0.4 ? 0.08 : (p.state === 'divert' ? 0.12 : 0);
    }
    frame(dt) {
      const now = performance.now() / 1000;
      if (this.seaTex) { this.seaTex.offset.x = (now * 0.01) % 1; this.seaTex.offset.y = (now * 0.006) % 1; }
      this.beam.rotation.y = now * 0.9;
      this.boats.forEach((b) => { b.g.position.y = SEA_Y + Math.sin(now * 1.6 + b.ph) * 0.02; b.g.rotation.z = Math.sin(now * 1.2 + b.ph) * 0.05; });
      // yaklaşma ışıkları (tavşan)
      const k = Math.floor((now * 9) % 10);
      this.rabbit.forEach((s, i) => (s.material.opacity = i === 6 - k ? 1 : 0.15));
      // pist ışıkları: dolu iken dokunulursa kırmızı yanıp söner
      if (this.flash > 0) { const on = Math.sin(this.flash * 26) > 0; this.edgeMat.color.setHex(on ? 0xff3322 : 0x551111); }
      else this.edgeMat.color.setHex(0xfff1c8);
      const w = this.app.w, h = this.app.h;
      // ilk dokunuşa kadar en acil uçağı işaretle
      let urgent = null;
      if (!this.firstTap) for (const p of this.planes) if (p.state === 'hold' && (!urgent || p.laps - p.prog < urgent.laps - urgent.prog)) urgent = p;
      for (const p of this.planes) if (p.el) p.el.classList.toggle('tapme', p === urgent);
      for (const p of this.planes) {
        if (p.state === 'parked') { p.g.position.y = 0; p.el && (p.el.hidden = true); const f = Math.max(0, 1 - Math.max(0, p.parkT - 1.6) / 0.9); p.g.scale.setScalar(f || 0.001); p.shadow.material.opacity = 0.4 * f; continue; }
        const alt = p.alt;
        p.g.position.set(p.x, alt + 0.33, p.z);
        p.g.rotation.set(p.roll, -p.head, p.pitch);
        p.refl.position.set(p.x, 2 * SEA_Y - (alt + 0.33), p.z);
        p.refl.rotation.copy(p.g.rotation);
        p.refl.visible = p.g.visible && alt > 0.05;
        const ud = p.g.userData;
        const app = p.state === 'app' && !p.touched;
        ud.gear.visible = p.state === 'app' || p.state === 'parked';
        ud.landing.material.opacity = app ? 0.95 : 0.25;
        ud.strobe.material.opacity = (now * 1.3 + p.slot * 0.3) % 1 < 0.1 ? 1 : 0;
        ud.beacon.material.opacity = (now * 1.1 + p.slot * 0.5) % 1 < 0.5 ? 0.9 : 0.15;
        // zemindeki gölge: irtifa azaldıkça gövdeye yaklaşır
        const overSea = p.x < this.coastX(p.z) - 0.3;
        const gy = overSea ? SEA_Y + 0.02 : 0.05;
        p.shadow.position.set(p.x + alt * 0.42, gy, p.z + alt * 0.18);
        p.shadow.rotation.z = -p.head + Math.PI / 2;
        p.shadow.scale.setScalar(1 + alt * 0.1);
        p.shadow.material.opacity = RA.clamp(0.55 - alt * 0.09, 0.2, 0.55) * (overSea ? 0.6 : 1);
        // halka etiketi
        if (p.el && p.state !== 'divert') {
          const q = RA.project(new T.Vector3(p.x, alt + 0.33, p.z), this.camera, w, h);
          const side = q.x > w - 100 ? -1 : 1;
          const lx = RA.clamp(q.x + side * 54, 44, w - 44), ly = RA.clamp(q.y + 22, 30, h - 30);
          p.labelX = lx; p.labelY = ly;
          p.el.style.left = lx + 'px'; p.el.style.top = ly + 'px';
          const last = p.el.querySelector('.ring.last');
          if (last) last.style.setProperty('--p', (1 - p.prog).toFixed(3));
          if (p.state === 'app' && p.touched) p.el.classList.add('gone');
        }
      }
      // yaklaşma çizgisi: uçağın önündeki kısmı göster
      if (this.runway && this.appLine.visible && !this.runway.touched) {
        const p = this.runway, dm = this._dm || (this._dm = new T.Object3D());
        let n = 0;
        for (const s of this.appS) {
          if (s < p.s + 0.7) continue;
          const q = p.path.at(s), hd = p.path.heading(s);
          dm.position.set(q.x, this.altAt(p, s) + 0.06, q.z); dm.rotation.set(0, -hd, 0); dm.updateMatrix();
          this.appDash.setMatrixAt(n++, dm.matrix);
        }
        this.appDash.count = n; this.appDash.instanceMatrix.needsUpdate = true;
      } else this.appDash.count = 0;
      // pist durumu etiketi
      const tagPos = RA.project(new T.Vector3(RX + 1.9, 0.3, R_THR - 1.0), this.camera, w, h);
      this.rwTag.style.left = tagPos.x + 'px'; this.rwTag.style.top = tagPos.y + 'px';
      if (this.runway) { this.rwTag.hidden = false; this.rwTag.textContent = 'Pist dolu'; this.rwTag.style.background = 'var(--red)'; }
      else if (this.t != null && this.t - this.lastFree < 1.6) { this.rwTag.hidden = false; this.rwTag.textContent = 'Pist boş'; this.rwTag.style.background = 'var(--road)'; }
      else this.rwTag.hidden = true;
    }

    resize(w, h) {
      this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
      const tilt = T.MathUtils.degToRad(56);
      RA.fitCamera(this.camera, {
        dir: new T.Vector3(-0.1, Math.sin(tilt), Math.cos(tilt)), target: new T.Vector3(0.5, 0, 0),
        points: [[-6.0, 2.5, 4.3], [6.8, 3.0, 3.1], [0.2, 2.7, 12.4], [0.2, 0, 12.0], [RX, 0, R_END - 0.6], [5.1, 0.8, -15.2], [-3.4, 0, -14], [6.6, 0, -12]],
        margin: { top: this.app.topInset() / h, bottom: 0.02, left: 0.02, right: 0.02 },
      });
    }
    scoreSentence(score, secs, fail) {
      if (fail) return score > 0 ? secs + ' saniyede ' + score + ' uçağı indirmiştin.' : 'Henüz hiç uçak indirmemiştin.';
      return score > 0 ? secs + ' saniyede ' + score + ' uçağı indirdin.' : secs + ' saniyede hiç uçak indiremedin.';
    }
    leave() { }
  }
  RA.AirMode = AirMode;
})();
