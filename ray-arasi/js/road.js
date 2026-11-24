/* RAY ARASI — 2. Mod: KARAYOLU — Kavşak sende */
(function () {
  'use strict';
  const RA = window.RA;
  const T = THREE;
  const M = RA.M;
  const rb = RA.rbox, mesh = RA.mesh;

  const B = 1.1;        // kavşak kutusunun yarı genişliği
  const LANE = 0.55;    // şerit ekseni (yol ekseninden)
  const SL = 2.45;      // dur çizgisinin merkeze uzaklığı
  const OVER_T = 3;     // kuyruk uyarısında oyuncuya verilen süre
  const ARMS = ['N', 'S', 'W', 'E'];
  const OPP = { N: 'S', S: 'N', W: 'E', E: 'W' };
  const AXIS = { N: 'NS', S: 'NS', W: 'EW', E: 'EW' };
  const NAME = { N: 'Kuzey', S: 'Güney', W: 'Batı', E: 'Doğu' };
  const TYPES = {
    car: { L: 1.45, ovF: 0.3, ovR: 0.3, v0: 3.5, a: 3.0, b: 3.0, T: 0.42, s0: 0.42 },
    taxi: { L: 1.45, ovF: 0.3, ovR: 0.3, v0: 3.7, a: 3.2, b: 3.0, T: 0.4, s0: 0.42 },
    bus: { L: 3.3, ovF: 0.62, ovR: 0.78, v0: 3.0, a: 2.0, b: 2.6, T: 0.5, s0: 0.48 },
  };
  const CAR_COLORS = [0xd8432f, 0x2f6fd6, 0xeeeeee, 0x2f9e5a, 0xf08a24, 0x8a96a3, 0x1a9e9a, 0x7a4fc2];
  const BUS_COLORS = [0x2a7fb8, 0x1c9a6a, 0xe0662a];

  class RoadMode {
    constructor(app) {
      this.app = app;
      this.id = 'road';
      this.title = 'Karayolu';
      this.hint = 'Işığa dokun: geçiş hakkı kuzey-güney ile doğu-batı arasında değişir.';
      this.unitLabel = 'araç';
      this.scene = new T.Scene();
      this.scene.background = new T.Color(0xc9d3d6);
      this.camera = new T.PerspectiveCamera(32, 0.5, 0.5, 200);
      this.vehicles = [];
      this.buildRoads();
      this.buildScenery();
      this.buildDynamic();
    }

    buildRoads() {
      const PB = RA.PathBuilder;
      const A = (this.arms = {});
      A.N = new PB(0, -B, -Math.PI / 2).line(17).build();
      A.S = new PB(0, B, Math.PI / 2).line(15).build();
      A.W = new PB(-B, 0, Math.PI).line(2.2).arc(2.6, -Math.PI / 2).line(14).build();
      A.E = new PB(B, 0, 0).line(2.2).arc(2.6, -Math.PI / 2).line(16).build();
      this.lanes = {};
      const cap = { N: 11.4, S: 10.6, W: 11.6, E: 11.6 };
      ARMS.forEach((k) => {
        const inb = A[k].offset(-LANE).reversed();
        const out = A[OPP[k]].offset(LANE);
        const route = RA.Path.concat([inb, out]);
        const sStop = inb.length - (SL - B);
        this.lanes[k] = {
          key: k, route, inLen: inb.length, sStop, sBoxIn: inb.length, sBoxOut: inb.length + 2 * B,
          sWarn: sStop - cap[k], over: 0, overOn: false, spawnQ: [],
        };
      });
    }

    buildScenery() {
      const sc = this.scene;
      RA.makeLights(sc, { sky: 0xeef4ff, ground: 0x8f8778, hemi: 0.7, sun: 0xfff0d8, sunI: 2.0, sunPos: [10, 24, 12], sunTarget: [0, 0, 0], shadowSize: 20, fill: 0xbfd4ff, fillI: 0.2 });
      const stat = new T.Group();
      const rnd = RA.rng(21);
      const sideTex = RA.tex.clone(RA.tex.sidewalk(), 46, 46);
      const sidewalk = new T.MeshStandardMaterial({ map: sideTex, roughness: 0.9 });
      const asphalt = new T.MeshStandardMaterial({ map: RA.tex.clone(RA.tex.asphalt(), 1, 1), roughness: 0.95 });
      const grass = new T.MeshStandardMaterial({ map: RA.tex.clone(RA.tex.grass(), 6, 6), roughness: 1 });
      // kaldırım zemini
      const base = mesh(new T.BoxGeometry(46, 0.3, 46), sidewalk, 0, -0.15, 0); base.castShadow = false; stat.add(base);
      // yollar (asfalt + bordür)
      const curb = RA.mat(0xb9b4aa, { roughness: 0.8 });
      ARMS.forEach((k) => {
        const p = this.arms[k];
        const road = new T.Mesh(RA.ribbon(p, 2.3, 0.02, { step: 0.12, vScale: 0.35 }), asphalt); road.receiveShadow = true; stat.add(road);
        for (const o of [-1.2, 1.2]) { const c = new T.Mesh(RA.barAlong(p, o, 0.12, 0.07, 0.0, { s0: 1.25, step: 0.12 }), curb); c.receiveShadow = true; stat.add(c); }
      });
      const box = mesh(new T.BoxGeometry(2 * B + 0.2, 0.02, 2 * B + 0.2), asphalt, 0, 0.011, 0); box.castShadow = false; stat.add(box);
      // köşe bordür yuvarlakları
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const c = mesh(RA.geo('curbc', () => new T.CylinderGeometry(0.16, 0.16, 0.07, 10)), curb, sx * 1.2, 0.035, sz * 1.2); stat.add(c); }
      // şerit çizgileri: kesik orta çizgi
      const white = RA.mat(0xf4f4ee, { roughness: 0.6 });
      const dashG = RA.geo('dash', () => new T.BoxGeometry(0.42, 0.012, 0.07));
      ARMS.forEach((k) => {
        const p = this.arms[k]; const P = {}, Tn = {};
        for (let s = SL - B + 0.9; s < p.length; s += 0.9) { p.at(s, P); p.tan(s, Tn); const d = mesh(dashG, white, P.x, 0.035, P.z, false); d.rotation.y = -Math.atan2(Tn.z, Tn.x); stat.add(d); }
        // yaya geçidi (zebra)
        const a = p.at(0.15 + 0.55), t = p.tan(0.5);
        for (let i = 0; i < 7; i++) {
          const off = -0.96 + i * 0.32;
          const z = mesh(RA.geo('zebra', () => new T.BoxGeometry(0.85, 0.012, 0.17)), white, a.x - t.z * off, 0.034, a.z + t.x * off, false);
          z.rotation.y = -Math.atan2(t.z, t.x); stat.add(z);
        }
      });
      // dur çizgileri
      ARMS.forEach((k) => {
        const L = this.lanes[k];
        const P = L.route.at(L.sStop + 0.08), Tn = L.route.tan(L.sStop);
        const bar = mesh(RA.geo('stopbar', () => new T.BoxGeometry(0.12, 0.014, 1.0)), white, P.x, 0.036, P.z, false);
        bar.rotation.y = -Math.atan2(Tn.z, Tn.x); stat.add(bar);
      });

      // --- çevre: yapılar düşük, karar noktalarını kapatmaz ---
      const blocks = [
        // [x, z, w, d, h, renk, tente]
        [-4.6, -4.4, 2.6, 2.0, 1.25, 0xe9c9a5, 0xc0392b], [-4.4, -8.2, 2.4, 2.4, 1.6, 0xb9d3dc, null], [-4.3, -12.4, 2.6, 2.6, 1.3, 0xf0dcc0, 0x2f6fd6],
        [-8.6, -6.0, 2.4, 3.2, 1.8, 0xd8c3e3, null], [-8.4, -11.0, 2.4, 3.0, 1.4, 0xf2e3b3, null],
        [4.4, 4.4, 2.6, 2.2, 1.2, 0xf3d4b0, 0x1f9d61], [4.6, 8.4, 2.6, 2.4, 1.0, 0xcfe0d2, null], [8.6, 5.4, 2.6, 3.0, 1.7, 0xe7c3a8, null],
        [-2.9, 6.8, 1.3, 2.2, 0.95, 0xf0e0c8, 0xe0662a], [-2.9, 10.6, 1.3, 2.4, 1.0, 0xcad7e6, null],
        [2.9, -6.6, 1.3, 2.2, 0.95, 0xf3e1c1, 0x7a4fc2], [2.9, -10.6, 1.3, 2.4, 1.05, 0xe4d1c3, null],
      ];
      blocks.forEach(([x, z, w, d, h, c, aw]) => { const b = M.block(w, d, h, c, rnd, { awning: aw }); b.position.set(x, 0, z); b.rotation.y = (x < 0) === (z < 0) ? 0 : Math.PI; stat.add(b); });
      // park (güneydoğu)
      const park = mesh(new T.BoxGeometry(3.0, 0.06, 3.0), grass, 8.2, 0.03, 10.4, false); park.receiveShadow = true; stat.add(park);
      const fountain = new T.Group(); fountain.position.set(8.2, 0, 10.4);
      fountain.add(mesh(RA.geo('fnt', () => new T.CylinderGeometry(0.7, 0.75, 0.18, 20)), RA.mat(0xd9d2c4), 0, 0.09, 0));
      fountain.add(mesh(RA.geo('fntw', () => new T.CylinderGeometry(0.6, 0.6, 0.04, 20)), RA.mat(0x5fb0de, { roughness: 0.15 }), 0, 0.17, 0, false));
      fountain.add(mesh(RA.geo('fntc', () => new T.CylinderGeometry(0.08, 0.12, 0.45, 10)), RA.mat(0xd9d2c4), 0, 0.3, 0));
      stat.add(fountain);
      // kaldırım ağaçları (yol kenarı boyunca, saksılı)
      const pit = RA.mat(0x6b5a48, { roughness: 1 });
      const treeAlong = (p, off, a, b, step) => {
        const P = {}, Tn = {};
        for (let s = a; s < b; s += step) {
          p.at(s, P); p.tan(s, Tn);
          const x = P.x - Tn.z * off, z = P.z + Tn.x * off;
          if (Math.abs(x) < 1.9 && Math.abs(z) < 1.9) continue;
          stat.add(mesh(RA.geo('pit', () => new T.BoxGeometry(0.36, 0.04, 0.36)), pit, x, 0.02, z, false));
          const t = M.tree(rnd, 'round', 0.6 + rnd() * 0.15); t.position.set(x, 0, z); stat.add(t);
        }
      };
      treeAlong(this.arms.N, -1.65, 3.2, 16, 2.1); treeAlong(this.arms.N, 1.65, 3.6, 16, 2.4);
      treeAlong(this.arms.S, -1.65, 3.0, 14, 2.2); treeAlong(this.arms.S, 1.65, 3.5, 14, 2.3);
      treeAlong(this.arms.W, -1.65, 7.0, 20, 2.2); treeAlong(this.arms.E, 1.65, 7.0, 22, 2.2);
      // sokak lambaları
      [[-1.75, -3.2], [1.75, 3.2], [-6.9, 4.2], [6.9, -4.2], [1.75, -9.0], [-1.75, 9.0]].forEach(([x, z]) => { const l = M.lamp(false); l.position.set(x, 0, z); l.rotation.y = x < 0 ? 0 : Math.PI; stat.add(l); });
      // köşe direkleri ve kablolar (merkez ışığı taşır)
      const poleM = RA.mat(0x3d4249, { roughness: 0.5 });
      const cableM = RA.mat(0x24272c);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        stat.add(mesh(RA.geo('cpole', () => new T.CylinderGeometry(0.045, 0.055, 2.3, 8)), poleM, sx * 1.55, 1.15, sz * 1.55));
        const a = new T.Vector3(sx * 1.55, 2.25, sz * 1.55), b = new T.Vector3(sx * 0.3, 1.85, sz * 0.3);
        const len = a.distanceTo(b);
        const c = new T.Mesh(RA.geo('cable' + len.toFixed(2), () => new T.CylinderGeometry(0.014, 0.014, len, 4)), cableM);
        c.position.copy(a).add(b).multiplyScalar(0.5);
        c.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), b.clone().sub(a).normalize());
        stat.add(c);
      }
      sc.add(RA.mergeStatic(stat));
    }

    buildDynamic() {
      const sc = this.scene;
      // merkez ışık (askıda)
      this.light = M.trafficLight(); this.light.scale.setScalar(1.45); this.light.position.set(0, 1.55, 0); sc.add(this.light);
      this.lightShadow = RA.blobShadow(1.4, 1.4, 0.35); this.lightShadow.position.set(-0.4, 0.04, -0.3); sc.add(this.lightShadow);
      this.lightWorld = new T.Vector3(0, 1.55, 0);
      // asfalt okları (eksen başına malzeme)
      const arrowShape = new T.Shape();
      arrowShape.moveTo(-0.5, -0.09); arrowShape.lineTo(0.12, -0.09); arrowShape.lineTo(0.12, -0.22); arrowShape.lineTo(0.5, 0); arrowShape.lineTo(0.12, 0.22); arrowShape.lineTo(0.12, 0.09); arrowShape.lineTo(-0.5, 0.09); arrowShape.lineTo(-0.5, -0.09);
      const arrowG = new T.ShapeGeometry(arrowShape); arrowG.rotateX(-Math.PI / 2);
      this.arrowMat = {
        NS: new T.MeshStandardMaterial({ color: 0xeeeeee, emissive: 0x22e06a, emissiveIntensity: 0, roughness: 0.6 }),
        EW: new T.MeshStandardMaterial({ color: 0xeeeeee, emissive: 0x22e06a, emissiveIntensity: 0, roughness: 0.6 }),
      };
      this.stopMat = {
        NS: new T.MeshBasicMaterial({ color: 0xff3020, transparent: true, opacity: 0, depthWrite: false }),
        EW: new T.MeshBasicMaterial({ color: 0xff3020, transparent: true, opacity: 0, depthWrite: false }),
      };
      this.warnMats = {};
      ARMS.forEach((k) => {
        const L = this.lanes[k];
        for (const ds of [1.4, 3.4]) {
          const P = L.route.at(L.sStop - ds), Tn = L.route.tan(L.sStop - ds);
          const a = new T.Mesh(arrowG, this.arrowMat[AXIS[k]]); a.position.set(P.x, 0.04, P.z); a.rotation.y = -Math.atan2(Tn.z, Tn.x); sc.add(a);
        }
        const P = L.route.at(L.sStop + 0.08), Tn = L.route.tan(L.sStop);
        const gp = new T.Group(); gp.position.set(P.x, 0.045, P.z); gp.rotation.y = -Math.atan2(Tn.z, Tn.x);
        const gm = new T.Mesh(RA.geo('stopglow2', () => { const g = new T.PlaneGeometry(0.24, 1.04); g.rotateX(-Math.PI / 2); return g; }), this.stopMat[AXIS[k]]); gp.add(gm); sc.add(gp);
        // kuyruk uyarı çizgisi (kırmızı-beyaz)
        const wm = new T.MeshStandardMaterial({ color: 0xffffff, emissive: 0xff2a1a, emissiveIntensity: 0, roughness: 0.6, map: this.warnTex() });
        this.warnMats[k] = wm;
        const W = L.route.at(L.sWarn), WT = L.route.tan(L.sWarn);
        const wg = new T.Group(); wg.position.set(W.x, 0.045, W.z); wg.rotation.y = -Math.atan2(WT.z, WT.x);
        const wl = new T.Mesh(RA.geo('warnl', () => { const g = new T.PlaneGeometry(0.2, 1.05); g.rotateX(-Math.PI / 2); return g; }), wm); wg.add(wl); sc.add(wg);
        L.warnPos = new T.Vector3(W.x, 0.1, W.z);
      });
      // kavşak kutusu "boşalıyor" çerçevesi
      const fr = new T.Group();
      const frM = new T.MeshBasicMaterial({ color: 0xffb400, transparent: true, opacity: 0, depthWrite: false });
      for (const [x, z, w, d] of [[0, -B, 2 * B, 0.08], [0, B, 2 * B, 0.08], [-B, 0, 0.08, 2 * B], [B, 0, 0.08, 2 * B]]) { const m = new T.Mesh(new T.PlaneGeometry(w, d), frM); m.rotation.x = -Math.PI / 2; m.position.set(x, 0.05, z); fr.add(m); }
      this.boxFrameMat = frM; sc.add(fr);
    }
    warnTex() {
      if (this._wt) return this._wt;
      const c = document.createElement('canvas'); c.width = 16; c.height = 64; const g = c.getContext('2d');
      for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#ffffff' : '#e5372d'; g.fillRect(0, i * 8, 16, 8); }
      const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; this._wt = t; return t;
    }

    /* ================= GÜNLÜK AKIŞ ================= */
    makeSchedule(seed) {
      const rnd = RA.rng(seed);
      // Sabit zorluk: grup zamanları ve büyüklükleri her gün aynı; yön ve araç türü sırası güne göre değişir.
      const groups = [
        [4.0, 1, 0], [6.5, 2, 0], [9.0, 1, 0], [10.5, 3, 1], [13.0, 1, 0], [14.5, 2, 0], [16.5, 3, 1], [19.0, 1, 0],
        [20.5, 2, 0], [22.5, 2, 0], [24.0, 4, 1], [26.5, 1, 0], [28.0, 2, 0], [30.0, 3, 1], [32.0, 2, 0], [34.0, 2, 0],
        [35.5, 1, 0], [37.0, 3, 1], [39.0, 2, 0], [41.0, 2, 0], [43.0, 1, 0],
      ];
      const cycleA = ['N', 'W', 'S', 'E'], cycleB = ['S', 'E', 'N', 'W'];
      let order = [];
      while (order.length < groups.length) order = order.concat(RA.shuffle(rnd() < 0.5 ? cycleA : cycleB, rnd));
      // aynı yönün art arda gelmesini engelle
      for (let i = 1; i < order.length; i++) if (order[i] === order[i - 1]) { const j = (i + 1) % order.length; const t = order[i]; order[i] = order[j]; order[j] = t; }
      const ev = [];
      groups.forEach((g, i) => {
        const lane = order[i];
        let t = g[0];
        for (let k = 0; k < g[1]; k++) {
          const type = g[2] && k === 0 ? 'bus' : (rnd() < 0.3 ? 'taxi' : 'car');
          ev.push({ t, lane, type, color: Math.floor(rnd() * 1000) });
          t += type === 'bus' ? 1.35 : 0.8 + rnd() * 0.35;
        }
      });
      ev.sort((a, b) => a.t - b.t);
      return ev;
    }

    reset(seed) {
      this.vehicles.forEach((v) => this.scene.remove(v.g));
      this.vehicles = [];
      this.green = 'NS'; this.pending = null; this.clearingFrom = null; this.clearT = 0;
      this.firstTap = false; this.failed = false;
      ARMS.forEach((k) => { const L = this.lanes[k]; L.over = 0; L.overOn = false; L.spawnQ = []; });
      this.queue = this.makeSchedule(seed);
      // açılış: batıda ışıkta bekleyen iki araç + yaklaşan taksi (ilk karar)
      this.addVehicle('W', 'car', 3, this.lanes.W.sStop - 0.05, 0);
      this.addVehicle('W', 'car', 6, this.lanes.W.sStop - 0.05 - 1.45 - 0.5, 0);
      this.addVehicle('W', 'taxi', 0, this.lanes.W.sStop - 7.5, 2.6);
      this.setupLabels();
      this.updateLights(0);
      this.frame(0);
    }
    setupLabels() {
      const L = this.app.labels;
      this.ring = document.createElement('div'); this.ring.className = 'tap-ring pulse'; this.ring.innerHTML = '<span class="tap-lbl">Işık</span>'; L.appendChild(this.ring);
      this.chip = document.createElement('div'); this.chip.className = 'clear-chip'; this.chip.textContent = 'Kavşak boşalıyor'; this.chip.hidden = true; L.appendChild(this.chip);
      ARMS.forEach((k) => { const el = document.createElement('div'); el.className = 'q-warn'; el.innerHTML = '<span>3</span>'; el.hidden = true; L.appendChild(el); this.lanes[k].warnEl = el; });
    }

    addVehicle(lane, type, colorIdx, s, v) {
      const P = TYPES[type];
      let g;
      if (type === 'bus') g = M.bus(BUS_COLORS[colorIdx % BUS_COLORS.length]);
      else if (type === 'taxi') g = M.taxi();
      else g = M.car(CAR_COLORS[colorIdx % CAR_COLORS.length]);
      g.traverse((o) => { if (o.isMesh && !o.material.transparent) o.castShadow = true; });
      this.scene.add(g);
      const L = this.lanes[lane];
      const fa = L.route.at(s - P.ovF);
      const ra = L.route.at(s - P.ovF - (P.L - P.ovF - P.ovR));
      const veh = { lane, L, type, P, g, s, v, acc: 0, rear: { x: ra.x, z: ra.z }, committed: false, scored: false, wheelA: 0, id: Math.random() };
      this.vehicles.push(veh);
      this.placeVehicle(veh);
      return veh;
    }

    tap(x, y) {
      const p = RA.project(this.lightWorld, this.camera, this.app.w, this.app.h);
      const r = Math.max(90, this.app.w * 0.3);
      if (Math.hypot(x - p.x, y - p.y) > r) { RA.audio.play('tap'); return false; }
      this.toggle();
      return true;
    }
    key(k) { if (k === ' ' || k === 'Enter') { this.toggle(); return true; } return false; }
    toggle() {
      if (this.failed) return;
      this.firstTap = true;
      RA.vibrate(12);
      if (this.pending) {
        // geçiş sürerken tekrar dokunmak: eski yöne yeşil geri ver
        this.green = this.clearingFrom; this.pending = null; this.clearingFrom = null;
        RA.audio.play('light');
        return;
      }
      const from = this.green;
      this.clearingFrom = from; this.pending = from === 'NS' ? 'EW' : 'NS'; this.green = null; this.clearT = 0;
      // durma mesafesi yetmeyen araçlar geçmeye devam eder
      for (const v of this.vehicles) {
        if (AXIS[v.lane] !== from || v.s > v.L.sStop) continue;
        const d = v.L.sStop - v.s;
        if (d < 0.25 || (v.v * v.v) / (2 * Math.max(0.01, d)) > 4.6) v.committed = true;
      }
      RA.audio.play('light');
      this.checkClear();
    }
    inConflict(v) {
      if (v.s - v.P.L > v.L.sBoxOut + 0.2) return false;
      return v.s > v.L.sStop || v.committed;
    }
    checkClear() {
      if (!this.pending) return;
      const busy = this.vehicles.some((v) => AXIS[v.lane] === this.clearingFrom && this.inConflict(v));
      if (!busy) {
        this.green = this.pending; this.pending = null; this.clearingFrom = null;
        RA.audio.play('clear');
      }
    }

    /* ================= SİMÜLASYON ================= */
    update(dt, t, ending) {
      // geliş
      if (!ending) while (this.queue.length && this.queue[0].t <= t) { const e = this.queue.shift(); this.lanes[e.lane].spawnQ.push(e); }
      ARMS.forEach((k) => {
        const L = this.lanes[k];
        if (!L.spawnQ.length) return;
        const last = this.lastInLane(k);
        const e = L.spawnQ[0];
        if (last && last.s - last.P.L < TYPES[e.type].L + 0.6) return; // giriş dolu: bekle
        L.spawnQ.shift();
        this.addVehicle(k, e.type, e.color, 0, Math.min(TYPES[e.type].v0, last ? Math.max(0, last.v) + 0.5 : TYPES[e.type].v0));
      });
      if (this.pending) this.checkClear();
      // araç takip (IDM)
      const byLane = {};
      for (const v of this.vehicles) (byLane[v.lane] = byLane[v.lane] || []).push(v);
      for (const k in byLane) byLane[k].sort((a, b) => b.s - a.s);
      for (const k in byLane) {
        const arr = byLane[k];
        for (let i = 0; i < arr.length; i++) {
          const v = arr[i], P = v.P, L = v.L;
          let gap = 1e9, dv = 0;
          if (i > 0) { const ld = arr[i - 1]; gap = ld.s - ld.P.L - v.s; dv = v.v - ld.v; }
          const green = this.green === AXIS[k];
          if (!green && !v.committed && v.s <= L.sStop + 0.02) {
            const g2 = L.sStop + 0.05 - v.s;
            if (g2 < gap) { gap = g2; dv = v.v; }
          }
          if (this.failed) { gap = Math.min(gap, 0.01); dv = v.v; }
          const sStar = P.s0 + Math.max(0, v.v * P.T + (v.v * dv) / (2 * Math.sqrt(P.a * P.b)));
          let acc = P.a * (1 - Math.pow(v.v / P.v0, 4) - Math.pow(sStar / Math.max(gap, 0.01), 2));
          acc = Math.max(acc, -9);
          v.acc = acc;
          v.v = Math.max(0, v.v + acc * dt);
          if (gap < 0.05 && v.v > 0) v.v = Math.max(0, v.v - 12 * dt);
          v.s += v.v * dt;
          v.wheelA += (v.v * dt) / 0.14;
          if (!v.scored && v.s - P.L > L.sBoxOut && !ending) {
            v.scored = true;
            const pp = L.route.at(L.sBoxOut + 0.6);
            this.app.addScore(1, new T.Vector3(pp.x, 1.0, pp.z));
            if (!this.firstScore) { this.firstScore = true; this.app.hintDone(); }
          }
        }
      }
      // çıkışta kaldır
      for (let i = this.vehicles.length - 1; i >= 0; i--) { const v = this.vehicles[i]; if (v.s - v.P.L > v.L.route.length) { this.scene.remove(v.g); this.vehicles.splice(i, 1); } }
      // kuyruk uyarısı
      if (!ending && !this.failed) {
        ARMS.forEach((k) => {
          const L = this.lanes[k];
          const arr = byLane[k] || [];
          let on = L.spawnQ.length > 0 && arr.some((v) => v.s - v.P.L < 1.0);
          for (const v of arr) { if (v.s - v.P.L < L.sWarn && v.v < 0.6) { on = true; break; } }
          if (on) {
            if (!L.overOn) { L.overOn = true; L.over = 0; RA.audio.play('warn'); }
            // süre yalnızca bu yön kırmızıyken işler: oyuncu yolu açtıysa (yeşil ya da sırada) sayaç durur
            L.served = this.green === AXIS[k] || this.pending === AXIS[k];
            const before = Math.ceil(OVER_T - L.over);
            if (!L.served) L.over += dt;
            const after = Math.ceil(OVER_T - L.over);
            if (after !== before && after > 0) RA.audio.play('warn');
            if (L.over >= OVER_T) {
              this.failed = true;
              this.app.fail('Kuyruk doldu', NAME[k] + ' yolundaki kuyruk doldu.', 1.2);
              RA.audio.play('denied');
            }
          } else { L.overOn = false; L.over = 0; }
        });
      }
      this.clearT += dt;
    }
    lastInLane(k) { let m = null; for (const v of this.vehicles) if (v.lane === k && (!m || v.s < m.s)) m = v; return m; }

    /* ================= GÖRSEL ================= */
    placeVehicle(v) {
      const P = v.P;
      const F = v.L.route.at(v.s - P.ovF);
      const wb = P.L - P.ovF - P.ovR;
      let dx = F.x - v.rear.x, dz = F.z - v.rear.z; const d = Math.hypot(dx, dz) || 1;
      v.rear.x = F.x - (dx / d) * wb; v.rear.z = F.z - (dz / d) * wb;
      dx /= d; dz /= d;
      const cx = v.rear.x + dx * (P.L / 2 - P.ovR), cz = v.rear.z + dz * (P.L / 2 - P.ovR);
      const yaw = Math.atan2(dz, dx);
      v.g.position.set(cx, 0, cz); v.g.rotation.y = -yaw;
      const ph = v.L.route.heading(v.s - P.ovF);
      const steer = RA.clamp(RA.wrapAngle(ph - yaw), -0.6, 0.6);
      v.g.userData.steer.forEach((s) => (s.rotation.y = -steer));
      v.g.userData.wheels.forEach((w) => (w.rotation.y = -v.wheelA));
      const braking = v.acc < -0.6 || v.v < 0.05;
      v.g.userData.brake.emissiveIntensity = braking ? 3.0 : 0.35;
      v.g.userData.brakeHalo.material.opacity = braking ? 0.75 : 0;
    }
    updateLights(dt) {
      const st = (ax) => (this.green === ax ? 'green' : this.clearingFrom === ax ? 'yellow' : 'red');
      this.light.userData.setAxis('NS', st('NS')); this.light.userData.setAxis('EW', st('EW'));
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 160);
      ['NS', 'EW'].forEach((ax) => {
        const g = this.green === ax;
        this.arrowMat[ax].emissiveIntensity = g ? 1.1 : 0;
        this.arrowMat[ax].color.setHex(g ? 0x2bd96b : 0x8a8f96);
        this.stopMat[ax].opacity = g ? 0 : (this.clearingFrom === ax ? 0.55 : 0.85);
        this.stopMat[ax].color.setHex(this.clearingFrom === ax ? 0xffb400 : 0xff3020);
      });
      this.boxFrameMat.opacity = this.pending ? 0.5 + 0.45 * pulse : 0;
      ARMS.forEach((k) => {
        const L = this.lanes[k];
        this.warnMats[k].emissiveIntensity = L.overOn ? (Math.sin(performance.now() / 90) > 0 ? 2.2 : 0.2) : 0;
      });
    }
    frame(dt) {
      for (const v of this.vehicles) this.placeVehicle(v);
      this.updateLights(dt);
      const w = this.app.w, h = this.app.h;
      if (!this.ring) return;
      const p = RA.project(this.lightWorld, this.camera, w, h);
      const size = Math.round(Math.max(96, w * 0.3));
      this.ring.style.width = this.ring.style.height = size + 'px';
      this.ring.style.margin = (-size / 2) + 'px 0 0 ' + (-size / 2) + 'px';
      this.ring.style.left = p.x + 'px'; this.ring.style.top = p.y + 'px';
      const pulse = !this.firstTap;
      this.ring.classList.toggle('pulse', pulse);
      this.ring.querySelector('.tap-lbl').hidden = !pulse;
      this.chip.hidden = !this.pending;
      if (this.pending) { this.chip.style.left = p.x + 'px'; this.chip.style.top = (p.y - size / 2 - 14) + 'px'; }
      ARMS.forEach((k) => {
        const L = this.lanes[k];
        L.warnEl.hidden = !L.overOn;
        if (L.overOn) {
          const q = RA.project(L.warnPos, this.camera, w, h);
          L.warnEl.style.left = RA.clamp(q.x, 30, w - 30) + 'px'; L.warnEl.style.top = RA.clamp(q.y, 30, h - 30) + 'px';
          L.warnEl.style.setProperty('--p', (1 - L.over / OVER_T).toFixed(3));
          L.warnEl.firstChild.textContent = L.served ? '✓' : Math.max(1, Math.ceil(OVER_T - L.over));
          L.warnEl.classList.toggle('served', !!L.served);
        }
      });
    }

    resize(w, h) {
      this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
      const tilt = T.MathUtils.degToRad(54);
      const pts = [[0, 0, 0]];
      ARMS.forEach((k) => { const L = this.lanes[k]; const p = L.route.at(L.sWarn - 0.6); pts.push([p.x, 0, p.z]); const q = L.route.at(L.sWarn - 0.6); pts.push([q.x + (k === 'W' ? -1.1 : k === 'E' ? 1.1 : 0), 0, q.z]); });
      pts.push([-6.4, 0, 0], [6.4, 0, 0]);
      RA.fitCamera(this.camera, {
        dir: new T.Vector3(0, Math.sin(tilt), Math.cos(tilt)), target: new T.Vector3(0, 0, 0), points: pts,
        margin: { top: this.app.topInset() / h, bottom: 0.01, left: 0.0, right: 0.0 },
      });
    }
    scoreSentence(score, secs, fail) {
      if (fail) return score > 0 ? secs + ' saniyede ' + score + ' aracı geçirmiştin.' : 'Henüz hiç araç geçirememiştin.';
      return score > 0 ? secs + ' saniyede ' + score + ' aracı geçirdin.' : secs + ' saniyede hiç araç geçiremedin.';
    }
  }
  RA.RoadMode = RoadMode;
})();
