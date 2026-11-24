/* RAY ARASI — 1. Mod: DEMİRYOLU — Makası sen yönet */
(function () {
  'use strict';
  const RA = window.RA;
  const T = THREE;
  const M = RA.M;

  const V_MAIN = 3.5, V_SIDING = 2.3, ACC = 1.5, ACC_E = 1.2, DEC = 3.2, BRAKE_MAX = 6, EDEC = 11;
  const GAP = 0.12;          // vagonlar arası
  const BLADE = 1.6;         // makas dili uzunluğu (kilit bölgesi)
  const LOOK = 4.2;          // makasa bu kadar yakın + makas ana hatta ise doğu treni bekletilir (~1.2 sn)
  const BRIDGE_A = 0.5, BRIDGE_B = 4.1; // M3 üzerinde köprü aralığı
  const RIVER_S = -5.5, RIVER_N = -8.7; // nehir kıyıları (z)
  const TUT_V = 2.0; // ilk trenin yavaş yaklaşması

  class Route {
    constructor(name, parts, segs) {
      this.name = name;
      let off = 0;
      this.parts = parts.map((p) => { const path = segs[p[0]]; const o = { id: p[0], rev: !!p[1], path, len: path.length, off }; off += path.length; return o; });
      this.length = off;
      this.path = RA.Path.concat(this.parts.map((p) => (p.rev ? p.path.reversed() : p.path)));
      this.byId = {}; this.parts.forEach((p) => (this.byId[p.id] = p));
    }
    locate(s) {
      let p = this.parts[0];
      for (const q of this.parts) { if (s >= q.off) p = q; }
      const local = s - p.off;
      return { id: p.id, c: p.rev ? p.len - local : local };
    }
    sOf(id, c) { const p = this.byId[id]; if (!p) return null; return p.off + (p.rev ? p.len - c : c); }
    has(id) { return !!this.byId[id]; }
  }

  class RailMode {
    constructor(app) {
      this.app = app;
      this.id = 'rail';
      this.title = 'Demiryolu';
      this.hint = 'Tünelden tren çıkıyorsa makasa dokun, treni yan hatta al.';
      this.unitLabel = 'tren';
      this.scene = new T.Scene();
      this.scene.background = new T.Color(0x9fc2a0);
      this.scene.fog = null;
      this.camera = new T.PerspectiveCamera(32, 0.5, 0.5, 200);
      this.trains = [];
      this.sparks = [];
      this.buildTrack();
      this.buildScenery();
      this.buildDynamic();
    }

    /* ================= HAT ================= */
    buildTrack() {
      const PB = RA.PathBuilder;
      const S = (this.segs = {});
      S.A = new PB(-7.6, 9.4, 0).line(4.6).arc(3, -Math.PI / 2).line(1.4).build();               // batı yaklaşımı -> makas S (0,5)
      S.M1 = new PB(0, 5.0, -Math.PI / 2).line(3.2).build();                                         // S -> K
      S.M2 = new PB(0, 1.8, -Math.PI / 2).line(6.6).build();                                         // K -> J
      S.M3 = new PB(0, -4.8, -Math.PI / 2).line(4.6).arc(3.2, Math.PI / 4).line(7.2).build();        // J -> köprü -> tünel
      S.SD = new PB(0, 5.0, -Math.PI / 2).to(-1.7, 1.8, -Math.PI / 2, 1.0).line(3.6).to(0, -4.8, -Math.PI / 2, 1.0).build(); // yan hat
      S.D = new PB(0, 1.8, Math.PI / 2).to(1.7, 5.4, Math.PI / 2, 1.0).line(1.0).arc(3, -Math.PI / 2).line(4.6).build();   // doğu trenlerinin çıkışı
      this.routes = {
        WM: new Route('WM', [['A'], ['M1'], ['M2'], ['M3']], S),
        WS: new Route('WS', [['A'], ['SD'], ['M3']], S),
        E: new Route('E', [['M3', true], ['M2', true], ['D']], S),
      };
      this.sS = S.A.length;
      this.sPortalM3 = 4.6 + 3.2 * Math.PI / 4 + 0.8;       // M3 üzerinde tünel ağzı
      this.chainOff = { M1: 0, M2: S.M1.length, M3: S.M1.length + S.M2.length };
      this.chainK = S.M1.length; this.chainJ = S.M1.length + S.M2.length;
      this.chainPortal = this.chainJ + this.sPortalM3;
      this.sdStop = S.SD.nearest(-1.7, -1.8).s - 0.1;       // yan hat sinyali (lokomotif burnu)
      this.sEPortal = S.M3.length - this.sPortalM3;         // E rotasında tünel ağzı
      this.sEStop = this.sEPortal - 0.35;                   // doğu treninin bekleme noktası (tünel içinde)
      this.sEK = S.M3.length + S.M2.length;                 // E rotasında K noktası
    }
    chainOf(route, s) {
      const L = route.locate(s);
      if (this.chainOff[L.id] == null) return null;
      return this.chainOff[L.id] + L.c;
    }

    // Tünel tepesi: yükseklik haritası; tünel ağzının önünde yarma (kesme)
    makeHill(pp, pt) {
      const cx = pp.x + pt.x * 3.9, cz = pp.z + pt.z * 3.9, R = 7.0, H = 3.3;
      const rn = RA.rng(77);
      const noise = []; for (let i = 0; i < 64; i++) noise.push(rn());
      const nz = (x, z) => 0.12 * Math.sin(x * 1.7 + noise[3] * 6) * Math.cos(z * 1.3 + noise[5] * 6) + 0.08 * Math.sin((x + z) * 2.3);
      this.inCut = (x, z) => {
        const dx = x - pp.x, dz = z - pp.z; const u = dx * pt.x + dz * pt.z; const v = Math.abs(-dx * pt.z + dz * pt.x);
        return u < 0.05 && v < 1.0 + Math.max(0, -u) * 0.55;
      };
      const h = (x, z) => {
        const d = Math.hypot(x - cx, z - cz);
        let y = H * (1 - (d / R) * (d / R)) * RA.smooth((RIVER_N - 0.3 - z) / 1.6);
        if (y <= 0) return 0;
        y += nz(x, z) * y;
        const dx = x - pp.x, dz = z - pp.z; const u = dx * pt.x + dz * pt.z; const v = Math.abs(-dx * pt.z + dz * pt.x);
        if (u < 0.05) { const w = 0.95 + Math.max(0, -u) * 0.55; y *= RA.smooth((v - w) / 1.3); }
        return Math.max(0, y);
      };
      const g = new T.PlaneGeometry(2 * R + 1, 2 * R + 1, 56, 56); g.rotateX(-Math.PI / 2); g.translate(cx, 0, cz);
      const pa = g.attributes.position;
      for (let i = 0; i < pa.count; i++) { const y = h(pa.getX(i), pa.getZ(i)); pa.setY(i, y > 0.001 ? y - 0.02 : -1.5); }
      const ng = g.toNonIndexed(); ng.computeVertexNormals();
      this.hillMesh = new T.Mesh(ng, new T.MeshStandardMaterial({ map: RA.tex.clone(RA.tex.grass(), 3.0, 3.0), color: 0xe8f0dc, flatShading: true, roughness: 1 }));
      this.hillMesh.castShadow = true; this.hillMesh.receiveShadow = true;
      return h;
    }

    buildScenery() {
      const sc = this.scene;
      RA.makeLights(sc, { sky: 0xdfeeff, ground: 0x7a6a4a, hemi: 0.62, sun: 0xffd9a0, sunI: 2.1, sunPos: [-16, 22, 9], sunTarget: [0, 0, -3], shadowSize: 21, fill: 0xb8d0ff, fillI: 0.25 });
      const stat = new T.Group();
      const rnd = RA.rng(42);
      const grassTex = RA.tex.clone(RA.tex.grass(), 14, 14);
      const grass = new T.MeshStandardMaterial({ map: grassTex, roughness: 0.95 });
      const bank = RA.mat(0x9a8468, { roughness: 1 });
      // zemin: nehir kanalının iki yanında iki blok
      const RW = RIVER_S - RIVER_N, RC = (RIVER_S + RIVER_N) / 2;
      const south = new T.Mesh(new T.BoxGeometry(70, 1.4, 42), [bank, bank, grass, bank, bank, bank]);
      south.position.set(0, -0.7, RIVER_S + 21); south.receiveShadow = true; sc.add(south);
      const north = new T.Mesh(new T.BoxGeometry(70, 1.4, 40), [bank, bank, grass, bank, bank, bank]);
      north.position.set(0, -0.7, RIVER_N - 20); north.receiveShadow = true; sc.add(north);
      // nehir
      const bed = new T.Mesh(new T.PlaneGeometry(70, RW), RA.mat(0x2f5d6b, { roughness: 1 })); bed.rotation.x = -Math.PI / 2; bed.position.set(0, -0.62, RC); sc.add(bed);
      this.waterTex = RA.tex.clone(RA.tex.water(), 10, 1);
      const water = new T.Mesh(new T.PlaneGeometry(70, RW), new T.MeshStandardMaterial({ map: this.waterTex, color: 0x9fd0ef, transparent: true, opacity: 0.88, roughness: 0.15, metalness: 0.1 }));
      water.rotation.x = -Math.PI / 2; water.position.set(0, -0.32, RC); water.receiveShadow = true; sc.add(water);
      for (let i = 0; i < 46; i++) {
        const side = i % 2 ? RIVER_S - 0.15 : RIVER_N + 0.15;
        const x = -16 + (i / 46) * 32 + rnd() * 0.6;
        if (Math.abs(x) < 1.2) continue;
        const r = mesh(RA.geo('rock', () => new T.DodecahedronGeometry(0.22, 0)), RA.mat(RA.pick([0x9e978c, 0x8b8378, 0xb1aa9e], rnd), { flatShading: true }), x, -0.3, side + (rnd() - 0.5) * 0.3);
        r.scale.set(0.8 + rnd() * 0.9, 0.6 + rnd() * 0.5, 0.8 + rnd() * 0.6); r.rotation.y = rnd() * 3; stat.add(r);
      }

      // --- hat: balast, traversler, raylar ---
      const S = this.segs;
      const gravel = new T.MeshStandardMaterial({ map: RA.tex.clone(RA.tex.gravel(), 1, 1), roughness: 1 });
      const steel = RA.mat(0x9aa1aa, { roughness: 0.35, metalness: 0.6 });
      const ballastProf = [[-0.66, 0], [-0.46, 0.13], [0.46, 0.13], [0.66, 0]];
      const segRanges = {
        A: [0, S.A.length], M1: [0, S.M1.length], M2: [0, S.M2.length], SD: [0, S.SD.length], D: [0, S.D.length],
        M3a: [0, BRIDGE_A], M3b: [BRIDGE_B, this.sPortalM3 + 0.6],
      };
      const pathOf = (k) => (k.startsWith('M3') ? S.M3 : S[k]);
      Object.keys(segRanges).forEach((k) => {
        const [a, b] = segRanges[k];
        const g = RA.extrude(pathOf(k), ballastProf, { s0: a, s1: b, step: 0.2, vScale: 0.6 });
        const m = new T.Mesh(g, gravel); m.receiveShadow = true; stat.add(m);
      });
      // traversler (örneklenmiş)
      const sleepers = [];
      const addSleepers = (path, a, b) => { const P = {}, Tn = {}; for (let s = a + 0.2; s < b; s += 0.42) { path.at(s, P); path.tan(s, Tn); sleepers.push([P.x, P.z, Math.atan2(Tn.z, Tn.x)]); } };
      ['A', 'M1', 'M2', 'SD', 'D'].forEach((k) => addSleepers(S[k], 0, S[k].length));
      addSleepers(S.M3, 0, this.sPortalM3 + 0.4);
      const slM = new T.InstancedMesh(M.sleeperGeo(), RA.mat(0x6b4e3a, { roughness: 0.9 }), sleepers.length);
      const dm = new T.Object3D();
      sleepers.forEach((sp, i) => { dm.position.set(sp[0], 0.155, sp[1]); dm.rotation.set(0, -sp[2], 0); dm.updateMatrix(); slM.setMatrixAt(i, dm.matrix); });
      slM.castShadow = false; slM.receiveShadow = true; sc.add(slM);
      // raylar (makas bölgesinde hareketli diller ayrı)
      const railBar = (path, off, a, b) => { const m = new T.Mesh(RA.barAlong(path, off, 0.06, 0.08, 0.17, { s0: a, s1: b, step: 0.12 }), steel); m.castShadow = true; m.receiveShadow = true; stat.add(m); };
      railBar(S.A, -0.3, 0, S.A.length); railBar(S.A, 0.3, 0, S.A.length);
      railBar(S.M1, 0.3, 0, S.M1.length); railBar(S.M1, -0.3, BLADE, S.M1.length);
      railBar(S.SD, -0.3, 0, S.SD.length); railBar(S.SD, 0.3, BLADE, S.SD.length);
      ['M2', 'D'].forEach((k) => { railBar(S[k], -0.3, 0, S[k].length); railBar(S[k], 0.3, 0, S[k].length); });
      railBar(S.M3, -0.3, 0, this.sPortalM3 + 0.6); railBar(S.M3, 0.3, 0, this.sPortalM3 + 0.6);

      // --- köprü ---
      const BL = RW + 0.4, BZ = RC;
      const deck = mesh(new T.BoxGeometry(1.25, 0.16, BL), RA.mat(0x4a4e55), 0, 0.06, BZ); stat.add(deck);
      const girder = RA.mat(0x2f6a57, { roughness: 0.55, metalness: 0.2 });
      for (const sx of [-0.68, 0.68]) {
        stat.add(mesh(rb(0.09, 0.09, BL - 0.1, 0.02), girder, sx, 0.62, BZ));
        stat.add(mesh(rb(0.12, 0.12, BL, 0.02), girder, sx, 0.14, BZ));
        const n = 6;
        for (let i = 0; i <= n; i++) {
          const z = BZ + BL / 2 - 0.05 - i * ((BL - 0.1) / n);
          stat.add(mesh(rb(0.07, 0.5, 0.07, 0.01), girder, sx, 0.38, z));
          if (i < n) { const d = mesh(rb(0.05, 0.64, 0.05, 0.01), girder, sx, 0.38, z - (BL - 0.1) / n / 2); d.rotation.x = (i % 2 ? 1 : -1) * 0.85; stat.add(d); }
        }
      }
      for (const z of [RIVER_S + 0.15, RIVER_N - 0.15]) stat.add(mesh(rb(1.9, 0.9, 0.6, 0.05), RA.mat(0xc8bba5), 0, -0.4, z));
      for (const x of [-0.5, 0.5]) { const pier = mesh(cyl(0.18, 0.9), RA.mat(0xbfb29c), x, -0.6, BZ); stat.add(pier); }

      // --- tünel tepesi ---
      const pp = S.M3.at(this.sPortalM3), pt = S.M3.tan(this.sPortalM3);
      this.hillH = this.makeHill(pp, pt);
      stat.add(this.hillMesh);
      // tünel ağzı (taş duvar + kemer)
      this.portalPos = new T.Vector3(pp.x, 0, pp.z);
      const portal = new T.Group();
      portal.position.set(pp.x, 0, pp.z);
      portal.rotation.y = -Math.atan2(pt.z, pt.x) + Math.PI / 2; // yerel -z = tünel içi, +z = dışarı
      const stone = RA.mat(0xb7aa94, { roughness: 0.95 });
      portal.add(mesh(rb(0.55, 1.5, 0.5, 0.04), stone, -0.85, 0.75, 0));
      portal.add(mesh(rb(0.55, 1.5, 0.5, 0.04), stone, 0.85, 0.75, 0));
      portal.add(mesh(rb(2.3, 0.42, 0.5, 0.04), stone, 0, 1.35, 0));
      portal.add(mesh(rb(2.6, 0.5, 0.45, 0.05), stone, 0, 1.45, -0.2));
      const arch = mesh(RA.geo('arch', () => new T.CylinderGeometry(0.58, 0.58, 0.52, 18, 1, false, 0, Math.PI)), stone, 0, 1.06, 0); arch.rotation.set(Math.PI / 2, Math.PI / 2, 0); arch.scale.set(1, 1, 0.5);
      const dark = new T.Mesh(new T.PlaneGeometry(1.16, 1.12), RA.basic(0x0b0d10)); dark.position.set(0, 0.56, -0.05); portal.add(dark);
      const dark2 = new T.Mesh(new T.BoxGeometry(1.16, 1.12, 1.6), RA.basic(0x0b0d10, { side: T.BackSide })); dark2.position.set(0, 0.56, -0.85); portal.add(dark2);
      portal.add(mesh(rb(1.16, 0.25, 0.6, 0.04), stone, 0, 1.2, 0.0));
      stat.add(portal);
      this.portalGroup = portal;
      // farların tünel ağzındaki ışığı
      this.portalGlow = RA.glowSprite(0xfff0c0, 2.4, 0); this.portalGlow.position.set(0, 0.55, 0.2); portal.add(this.portalGlow);
      this.portalPool = RA.glowDecal(0xfff0c0, 1.3, 3.2, 0); this.portalPool.position.set(0, 0.3, 1.6); portal.add(this.portalPool);

      // --- istasyon (yan hat boyunca) ---
      const st = M.station(); st.rotation.y = Math.PI / 2; st.position.set(-2.62, 0, 0.0); stat.add(st);
      // istasyon tabelası
      const signTex = (() => { const c = document.createElement('canvas'); c.width = 256; c.height = 64; const g = c.getContext('2d'); g.fillStyle = '#17304f'; g.fillRect(0, 0, 256, 64); g.strokeStyle = '#fff'; g.lineWidth = 5; g.strokeRect(5, 5, 246, 54); g.fillStyle = '#fff'; g.font = '900 34px Overpass, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('RAY ARASI', 128, 35); const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; return t; })();
      const sign = new T.Mesh(new T.PlaneGeometry(1.4, 0.35), new T.MeshBasicMaterial({ map: signTex })); sign.position.set(-3.05, 1.25, 0.0); sign.rotation.set(-0.5, 0, 0); stat.add(sign);
      [[-3.0, -2.4], [-3.0, 2.4]].forEach(([x, z]) => { const l = M.lamp(false); l.position.set(x + 0.4, 0.2, z); stat.add(l); });

      // --- ağaçlar, evler, tarla ---
      const free = (x, z, r) => {
        // hatlardan uzak mı?
        for (const k of ['A', 'M1', 'M2', 'M3', 'SD', 'D']) { if (S[k].nearest(x, z).d < r + 0.9) return false; }
        if (z > RIVER_N - 0.6 && z < RIVER_S + 0.5) return false; // nehir
        if (x > -3.7 && x < -2.0 && z > -3.3 && z < 3.3) return false; // istasyon
        return true;
      };
      const houses = [[-5.6, 3.2, 0xf2d7b6, 0xc0573c], [-6.2, -1.2, 0xe9e3d3, 0x8e4a3a], [-4.9, -4.2, 0xf5e6c4, 0xb5482f], [4.8, -3.6, 0xe7d1b0, 0x9a4b34], [-6.0, 7.0, 0xdfe7ea, 0x5c6f7d]];
      houses.forEach(([x, z, w, r], i) => { const h = M.house(1.1 + (i % 2) * 0.3, 0.9, 0.7, w, r, rnd); h.position.set(x, 0, z); h.rotation.y = (i % 3 - 1) * 0.3; stat.add(h); });
      // tarla (sağ taraf)
      const field = new T.Group();
      field.add(mesh(new T.BoxGeometry(3.6, 0.06, 4.4), RA.mat(0xc9a95a, { roughness: 1 }), 0, 0.03, 0));
      for (let i = 0; i < 9; i++) field.add(mesh(rb(3.4, 0.1, 0.18, 0.04), RA.mat(i % 2 ? 0xb9933e : 0xd8bb6a, { roughness: 1 }), 0, 0.08, -2 + i * 0.5));
      field.position.set(5.2, 0, 1.2); field.rotation.y = 0.08; stat.add(field);
      const fence = M.fence(4.4); fence.rotation.y = Math.PI / 2; fence.position.set(3.2, 0, 1.2); stat.add(fence);
      let placed = 0;
      for (let i = 0; i < 400 && placed < 70; i++) {
        const x = -9 + rnd() * 18, z = -17 + rnd() * 28;
        if (!free(x, z, 0.3)) continue;
        if (x > 3.2 && x < 7.2 && z > -1.2 && z < 3.6) continue; // tarla
        if (houses.some((h) => Math.hypot(h[0] - x, h[1] - z) < 1.1)) continue;
        const hh = this.hillH(x, z);
        if (hh > 0.05 && rnd() < 0.45) continue;
        if (this.inCut(x, z)) continue;
        const t = M.tree(rnd, hh > 0.4 ? 'cone' : null, 0.75 + rnd() * 0.5);
        t.position.set(x, hh - 0.04, z); stat.add(t); placed++;
      }
      for (let i = 0; i < 26; i++) { const x = -10 + rnd() * 20, z = (rnd() < 0.5 ? RIVER_S + 0.45 : RIVER_N - 0.45) + (rnd() - 0.5) * 0.3; if (!free(x, z, 0.1) && Math.abs(x) < 1.5) continue; const b = M.bush(rnd, 0.8 + rnd() * 0.6); b.position.set(x, 0, z); stat.add(b); }
      sc.add(RA.mergeStatic(stat));
    }

    buildDynamic() {
      const sc = this.scene;
      const S = this.segs;
      // makas dilleri
      const bladeGeo = RA.geo('blade', () => { const g = new T.BoxGeometry(0.06, 0.08, BLADE); g.translate(0, 0.21, BLADE / 2); return g; });
      const bladeMat = RA.mat(0xd8dde3, { roughness: 0.25, metalness: 0.7 });
      const P = {}, Tn = {};
      // dil 1: ana hattın sol rayı
      this.blade1 = new T.Mesh(bladeGeo, bladeMat); this.blade1.position.set(-0.3, 0, 5.0 - BLADE); this.blade1.castShadow = true;
      // dil 2: yan hattın sağ rayı
      S.SD.at(BLADE, P); S.SD.tan(BLADE, Tn);
      const heel2 = { x: P.x - Tn.z * 0.3, z: P.z + Tn.x * 0.3 };
      this.blade2 = new T.Mesh(bladeGeo, bladeMat); this.blade2.position.set(heel2.x, 0, heel2.z); this.blade2.castShadow = true;
      this.blade2Base = Math.atan2(0.3 - 0.14 - heel2.x, 5.0 - heel2.z);
      sc.add(this.blade1, this.blade2);
      // çekme demiri
      this.tieBar = mesh(rb(0.9, 0.04, 0.06, 0.01), RA.mat(0x3a3f47), 0, 0.2, 4.85); sc.add(this.tieBar);
      // makas kolu ve yön levhası
      const stand = new T.Group(); stand.position.set(-1.05, 0, 5.45);
      stand.add(mesh(rb(0.34, 0.26, 0.3, 0.04), RA.mat(0x3a3f47), 0, 0.13, 0));
      this.lever = new T.Group(); this.lever.position.set(-0.1, 0.27, 0);
      this.lever.add(mesh(rb(0.05, 0.42, 0.05, 0.015), RA.mat(0x24272c), 0, 0.2, 0));
      this.lever.add(mesh(RA.geo('knob', () => new T.SphereGeometry(0.06, 10, 8)), RA.mat(0xe3342f), 0, 0.42, 0));
      stand.add(this.lever);
      stand.add(mesh(cyl(0.03, 0.75), RA.mat(0x50555c), -0.08, 0.6, 0));
      const mkSign = (curve) => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); g.fillStyle = '#ffffff'; g.beginPath(); g.arc(64, 64, 60, 0, 7); g.fill(); g.fillStyle = curve ? '#ffb400' : '#1aa463'; g.beginPath(); g.arc(64, 64, 52, 0, 7); g.fill(); g.strokeStyle = '#142027'; g.fillStyle = '#142027'; g.lineWidth = 14; g.lineCap = 'round'; g.beginPath(); if (curve) { g.moveTo(80, 104); g.quadraticCurveTo(82, 60, 48, 44); } else { g.moveTo(64, 106); g.lineTo(64, 44); } g.stroke(); g.beginPath(); if (curve) { g.moveTo(30, 34); g.lineTo(62, 26); g.lineTo(52, 58); } else { g.moveTo(40, 52); g.lineTo(64, 22); g.lineTo(88, 52); } g.fill(); const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; return t; };
      this.signTex = { main: mkSign(false), siding: mkSign(true) };
      this.routeSign = new T.Mesh(new T.CircleGeometry(0.3, 24), new T.MeshBasicMaterial({ map: this.signTex.main, side: T.DoubleSide }));
      this.routeSign.position.set(-0.08, 1.05, 0); this.routeSign.rotation.x = -0.55; stand.add(this.routeSign);
      sc.add(stand);
      this.switchWorld = new T.Vector3(0, 0.2, 4.1);
      // seçilen rayın ışık çizgisi
      const grad = (() => { const c = document.createElement('canvas'); c.width = 8; c.height = 128; const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 128, 0, 0); gr.addColorStop(0, '#fff'); gr.addColorStop(0.55, '#aaa'); gr.addColorStop(1, '#000'); g.fillStyle = gr; g.fillRect(0, 0, 8, 128); const t = new T.CanvasTexture(c); return t; })();
      const glowMat = () => new T.MeshBasicMaterial({ color: 0xffb21e, map: grad, transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending });
      const mainPath = RA.Path.concat([S.M1, S.M2]);
      const GL = 5.4;
      this.glowMain = new T.Mesh(RA.ribbon(mainPath, 0.6, 0.27, { s0: 0, s1: GL, step: 0.1, vScale: 1 / GL }), glowMat());
      this.glowSiding = new T.Mesh(RA.ribbon(S.SD, 0.6, 0.27, { s0: 0, s1: GL, step: 0.1, vScale: 1 / GL }), glowMat());
      this.glowMain.renderOrder = this.glowSiding.renderOrder = 3;
      sc.add(this.glowMain, this.glowSiding);
      // sinyaller
      this.sigHome = M.signal(); this.sigHome.position.set(-0.85, 0, 7.6); sc.add(this.sigHome);
      this.sigSiding = M.signal(); this.sigSiding.position.set(-2.36, 0.22, -2.05); sc.add(this.sigSiding);
      this.sigPortal = M.signal(); this.sigPortal.scale.setScalar(1.35);
      const pp = this.portalPos; this.sigPortal.position.set(pp.x + 1.25, 0, pp.z + 1.0); sc.add(this.sigPortal);
      // kıvılcım havuzu
      for (let i = 0; i < 40; i++) { const s = RA.glowSprite(0xffa040, 0.16, 0); s.visible = false; sc.add(s); this.sparks.push({ s, v: new T.Vector3(), life: 0 }); }
    }

    /* ================= TARİFE (günlük sıra) ================= */
    makeSchedule(seed) {
      const rnd = RA.rng(seed);
      const ev = [];
      const W = (tS, extra) => ev.push(Object.assign({ dir: 'W', tS }, extra || {}));
      const E = (tE, extra) => ev.push(Object.assign({ dir: 'E', tE }, extra || {}));
      // 0-10 sn: tek kural — karşı tren gelirken yan hat
      W(3.05, { cars: 2, tut: true, s0: 4.4 });
      E(1.5, { cars: 4, waiting: true });
      W(10.6, { cars: 3 });                              // köprü boş: ana hat zaman kazandırır
      const phrases = {
        meet: (P) => { W(P); E(P - 1.7); return 6.2; },
        pair: (P) => { W(P); W(P + 2.7); E(P - 1.7); return 8.4; },
        eonly: (P) => { E(P); E(P + 2.9); W(P + 4.6); return 8.0; },
        beat: (P) => { W(P); E(P + 0.3); return 5.6; },
        follow: (P) => { W(P); W(P + 2.9); return 6.0; },
        free: (P) => { W(P); return 4.2; },
      };
      const order = RA.shuffle(['meet', 'pair', 'eonly', 'beat', 'follow', 'meet', 'free', 'pair'], rnd);
      let P = 15.2;
      for (let i = 0; i < order.length && P < 46; i++) {
        const k = 1 - Math.min(0.24, (P - 15) / 120);   // giderek sıklaşır
        P += phrases[order[i]](P) * k;
      }
      // araç türleri ve uzunlukları da günlük sıra ile
      ev.forEach((e) => {
        if (e.cars == null) e.cars = e.dir === 'W' ? 2 + Math.floor(rnd() * 2) : 3 + Math.floor(rnd() * 2);
        e.seed = Math.floor(rnd() * 1e9);
        if (e.dir === 'W') e.tSpawn = e.s0 != null ? -1 : e.tS - this.sS / V_MAIN;
        else e.tSpawn = e.tE - this.sEStop / V_MAIN - 0.15;
      });
      ev.sort((a, b) => a.tSpawn - b.tSpawn);
      return ev;
    }

    /* ================= TUR ================= */
    reset(seed) {
      this.trains.forEach((t) => t.units.forEach((u) => this.scene.remove(u.g)));
      this.trains = [];
      this.sparks.forEach((p) => { p.life = 0; p.s.visible = false; });
      this.switchState = 'main'; this.bladeT = 0; this.glowT = 0;
      this.emergency = null; this.t = 0; this.nextId = 1;
      this.firstTap = false; this.lockFlash = 0;
      this.schedule = this.makeSchedule(seed);
      this.queue = this.schedule.slice();
      this.setupLabels();
      // önceden yerleştirilen trenler (tur başı)
      this.spawnDue(0, true);
      this.updateVisuals(0);
    }
    setupLabels() {
      const L = this.app.labels;
      this.ring = document.createElement('div'); this.ring.className = 'tap-ring pulse';
      this.ring.innerHTML = '<span class="tap-lbl">Makas</span>';
      L.appendChild(this.ring);
      this.fullTag = document.createElement('div'); this.fullTag.className = 'tag'; this.fullTag.textContent = 'Yan hat dolu'; this.fullTag.hidden = true;
      L.appendChild(this.fullTag);
    }

    makeTrain(e) {
      const rnd = RA.rng(e.seed || 1);
      const units = M.train(e.dir === 'W' ? 'passenger' : 'freight', rnd, e.cars);
      let off = 0;
      units.forEach((u, i) => { u.off = off + u.len / 2; off += u.len + (i < units.length - 1 ? GAP : 0); u.g.traverse((o) => { if (o.isMesh) o.castShadow = true; }); this.scene.add(u.g); });
      const tr = {
        id: this.nextId++, dir: e.dir, units, len: off, v: V_MAIN, s: 0,
        route: e.dir === 'W' ? this.routes.WM : this.routes.E, decided: e.dir !== 'W',
        siding: false, departed: false, granted: false, tE: e.tE, scored: false, honked: false, tut: !!e.tut, wheelA: 0,
      };
      return tr;
    }
    spawnDue(t, initial) {
      while (this.queue.length && this.queue[0].tSpawn <= t) {
        const e = this.queue[0];
        // giriş noktası dolu mu? (aynı yönden önceki tren)
        const blocked = this.trains.some((o) => o.dir === e.dir && o.s - o.len < 1.2);
        if (blocked && !initial) break;
        this.queue.shift();
        const tr = this.makeTrain(e);
        if (initial) {
          if (e.dir === 'W') { tr.s = e.s0 != null ? e.s0 : Math.max(0, (t - e.tSpawn) * V_MAIN); if (e.tut) tr.v = TUT_V; }
          else if (e.waiting) { tr.s = this.sEStop; tr.v = 0; }
          else tr.s = Math.max(0, (t - e.tSpawn) * V_MAIN);
        }
        this.trains.push(tr);
      }
    }

    sidingOccupied() {
      return this.trains.some((o) => o.dir === 'W' && o.siding && this.tailRouteS(o) < this.routes.WS.sOf('M3', 0) + 0.4);
    }
    tailRouteS(tr) { return tr.s - tr.len; }
    switchLocked() {
      const a = this.sS - 0.12, b = this.sS + BLADE + 0.1;
      return this.trains.some((o) => o.dir === 'W' && o.s >= a && o.s - o.len <= b);
    }
    // batıdan gelen trenlerin tek hatta (K..tünel) yol tutması
    westReserves() {
      for (const o of this.trains) {
        if (o.dir !== 'W') continue;
        const tailC = this.chainOf(o.route, o.s - o.len);
        if (tailC != null && tailC > this.chainPortal + 0.3) continue;
        if (!o.decided) { if (this.switchState === 'main' && this.sS - o.s < LOOK && this.sS - o.s > -0.01) return true; continue; }
        if (!o.siding) return true;
        if (o.departed) return true;
      }
      return false;
    }
    // doğu treninin tek hat üzerindeki işgal aralığı (zincir koordinatında)
    eastInterval(o) {
      if (!o.granted) return null;
      const h = o.s, tl = o.s - o.len;
      if (h >= this.sEK) {
        const tailPast = tl - this.sEK;
        if (tailPast > 1.0) return null;
        return { lo: this.chainK, hi: this.chainK + Math.max(0, -tailPast) };
      }
      const lo = Math.min(this.chainOf(o.route, h), this.chainPortal);
      const hi = tl <= this.sEPortal ? this.chainPortal : this.chainOf(o.route, tl);
      return { lo, hi: Math.min(hi, this.chainPortal) };
    }

    tap(x, y) {
      const p = RA.project(this.switchWorld, this.camera, this.app.w, this.app.h);
      const r = Math.max(70, this.app.w * 0.24);
      if (Math.hypot(x - p.x, y - p.y) > r) { RA.audio.play('tap'); return false; }
      this.toggleSwitch();
      return true;
    }
    key(k) { if (k === ' ' || k === 'Enter' || k === 'm' || k === 'M') { this.toggleSwitch(); return true; } return false; }
    toggleSwitch() {
      if (this.emergency) return;
      if (this.switchLocked()) {
        RA.audio.play('locked'); RA.vibrate([20, 40, 20]);
        this.ring.classList.remove('deny'); void this.ring.offsetWidth; this.ring.classList.add('deny');
        const p = RA.project(new T.Vector3(0, 1.1, 4.2), this.camera, this.app.w, this.app.h);
        const b = document.createElement('div'); b.className = 'lock-badge';
        b.innerHTML = '<svg viewBox="0 0 16 16"><path d="M4 7V5a4 4 0 1 1 8 0v2h1v8H3V7zm2 0h4V5a2 2 0 1 0-4 0z"/></svg>Kilitli · son vagon geçsin';
        b.style.left = p.x + 'px'; b.style.top = p.y + 'px';
        this.app.labels.appendChild(b); setTimeout(() => b.remove(), 1150);
        this.lockFlash = 0.6;
        return;
      }
      this.switchState = this.switchState === 'main' ? 'siding' : 'main';
      RA.audio.play('switch'); RA.vibrate(12);
      this.glowT = 1;
      this.routeSign.material.map = this.signTex[this.switchState]; this.routeSign.material.needsUpdate = true;
      if (!this.firstTap) { this.firstTap = true; }
    }

    /* ================= SİMÜLASYON ================= */
    update(dt, t, ending) {
      this.t = t;
      if (!ending) this.spawnDue(t, false);
      const trains = this.trains;
      // 1) rota kararı (lokomotif makasa vardığında)
      for (const o of trains) {
        if (o.dir === 'W' && !o.decided && o.s >= this.sS) {
          o.decided = true;
          if (this.switchState === 'siding') { o.route = this.routes.WS; o.siding = true; }
          else o.route = this.routes.WM;
        }
      }
      // 2) yan hattan çıkış izni
      const sdTail = this.routes.WS.sOf('SD', 0);
      for (const o of trains) {
        if (o.dir !== 'W' || !o.siding || o.departed) continue;
        const stopS = sdTail + this.sdStop;
        if (stopS - o.s > 2.6) continue;
        let ok = true;
        for (const e of trains) {
          if (e.dir !== 'E') continue;
          const iv = this.eastInterval(e);
          if (iv && iv.hi >= this.chainJ - 0.6) { ok = false; break; }
        }
        if (ok) for (const w of trains) {
          if (w === o || w.dir !== 'W' || !w.decided || w.siding) continue;
          const hc = this.chainOf(w.route, w.s), tc = this.chainOf(w.route, w.s - w.len);
          if (hc == null) continue;
          if ((hc > this.chainJ - 4.5 && hc < this.chainJ + 0.6) || (tc != null && tc < this.chainJ + 0.6 && hc > this.chainJ - 0.6)) { ok = false; break; }
        }
        if (ok && !this.emergency) o.departed = true;
      }
      // 3) doğu treni tünel sinyali
      if (!this.emergency) {
        const westBusy = this.westReserves();
        for (const o of trains) {
          if (o.dir !== 'E' || o.granted) continue;
          if (t >= o.tE - 0.6 && !westBusy) o.granted = true;
          break; // sırayla
        }
      }
      // 4) hız ve hareket
      for (const o of trains) {
        let limit = Infinity, vmax = V_MAIN;
        if (o.dir === 'W') {
          if (o.tut && !o.decided) vmax = TUT_V;
          if (!o.decided && this.switchState === 'siding' && this.sidingOccupied()) limit = Math.min(limit, this.sS - 0.7);
          if (o.siding) {
            const sdStart = this.routes.WS.sOf('SD', 0), sdEnd = this.routes.WS.sOf('M3', 0);
            if (!o.departed) limit = Math.min(limit, sdStart + this.sdStop);
            if (o.s > sdStart + 0.6 && o.s - o.len < sdEnd) vmax = V_SIDING;
          }
        } else if (!o.granted) limit = Math.min(limit, this.sEStop);
        limit = Math.min(limit, this.leaderLimit(o));
        let vt = Math.min(vmax, Math.sqrt(2 * DEC * Math.max(0, limit - o.s - 0.02)));
        if (o.dir === 'W' && !o.siding && o.s > this.sS - 0.6 && o.s < this.sS + 1) vt = Math.min(vt, V_MAIN);
        let dec = BRAKE_MAX;
        if (this.emergency) { if (o === this.emergency.a || o === this.emergency.b) { vt = 0; dec = EDEC; } else { vt = 0; dec = 3; } }
        if (o.v < vt) o.v = Math.min(vt, o.v + (o.dir === 'E' ? ACC_E : ACC) * dt); else o.v = Math.max(vt, o.v - dec * dt);
        o.s += o.v * dt;
        o.wheelA += (o.v * dt) / 0.11;
      }
      // 5) karşılaşma kontrolü (acil fren)
      if (!this.emergency) this.checkConflicts();
      // 6) puan, korna, temizlik
      for (let i = trains.length - 1; i >= 0; i--) {
        const o = trains[i];
        const tl = o.s - o.len;
        const L = o.route.locate(tl);
        if (!o.scored && !this.emergency) {
          if (o.dir === 'W' && L.id === 'M3' && L.c > BRIDGE_B) { o.scored = true; this.app.addScore(1, this.bridgePoint(BRIDGE_B + 0.3)); if (o.tut) this.app.hintDone(); }
          if (o.dir === 'E' && (L.id !== 'M3' || L.c < BRIDGE_A)) { o.scored = true; this.app.addScore(1, this.bridgePoint(BRIDGE_A - 0.3)); }
        }
        if (o.dir === 'E' && o.granted && !o.honked) {
          const hc = this.chainOf(o.route, o.s);
          if (hc != null && hc < this.chainJ - 1.5 && trains.some((w) => w.dir === 'W' && w.siding && !w.departed)) {
            o.honked = true; RA.audio.play('horn');
            const P = o.route.path.at(o.s);
            this.app.popText('düt düüt', new T.Vector3(P.x + 0.6, 1.2, P.z), 'pop-info');
          }
        }
        // tünel içinde/çıkışta kaybol
        if ((o.dir === 'W' && L.id === 'M3' && L.c > this.sPortalM3 + 1.6) || (o.dir === 'E' && tl > o.route.length + 0.5)) {
          o.units.forEach((u) => this.scene.remove(u.g)); trains.splice(i, 1);
        }
      }
      this.updateSparks(dt);
    }
    bridgePoint(c) { const p = this.segs.M3.at(c); return new T.Vector3(p.x + 0.9, 0.9, p.z); }

    leaderLimit(o) {
      let lim = Infinity;
      for (const q of this.trains) {
        if (q === o || q.dir !== o.dir) continue;
        // q'nun kapladığı noktalar: kuyruk + bölüm başlangıçları
        const tl = q.s - q.len;
        const pts = [q.route.locate(tl)];
        for (const p of q.route.parts) if (p.off > tl && p.off < q.s) pts.push(q.route.locate(p.off + 0.001));
        const rt = o.decided ? o.route : (this.switchState === 'siding' ? this.routes.WS : this.routes.WM);
        for (const L of pts) {
          const s2 = rt.sOf(L.id, L.c);
          if (s2 == null) continue;
          if (s2 > o.s - 0.05) lim = Math.min(lim, s2 - 0.45);
        }
      }
      return lim;
    }

    checkConflicts() {
      for (const w of this.trains) {
        if (w.dir !== 'W' || !w.decided) continue;
        const wc = this.chainOf(w.route, w.s);
        if (wc == null || wc > this.chainPortal) continue;
        for (const e of this.trains) {
          if (e.dir !== 'E') continue;
          const iv = this.eastInterval(e);
          if (!iv || iv.hi < wc - 0.3) continue;
          const gap = iv.lo - wc;
          const trig = (w.v * w.v + e.v * e.v) / (2 * EDEC) + 0.75;
          if (gap < trig) { this.triggerEmergency(w, e); return; }
        }
      }
    }
    triggerEmergency(a, b) {
      this.emergency = { a, b, t: 0 };
      RA.audio.play('brake'); RA.audio.play('horn'); RA.vibrate([60, 40, 120]);
      const pa = a.route.path.at(a.s), pb = b.route.path.at(b.s);
      this.app.popText('ACİL FREN!', new T.Vector3((pa.x + pb.x) / 2, 1.4, (pa.z + pb.z) / 2), 'pop-warn');
      this.app.fail('Acil fren!', 'İki tren tek hatta karşı karşıya kaldı.', 1.9);
    }
    updateSparks(dt) {
      if (this.emergency) {
        for (const tr of [this.emergency.a, this.emergency.b]) {
          if (tr.v < 0.15) continue;
          for (let k = 0; k < 2; k++) {
            const sp = this.sparks.find((p) => p.life <= 0); if (!sp) break;
            const P = tr.route.path.at(tr.s - 0.3);
            sp.s.position.set(P.x + (Math.random() - 0.5) * 0.6, 0.3, P.z + (Math.random() - 0.5) * 0.3);
            sp.v.set((Math.random() - 0.5) * 2.4, 1.2 + Math.random() * 1.6, (Math.random() - 0.5) * 2.4);
            sp.life = 0.35 + Math.random() * 0.25; sp.s.visible = true;
          }
        }
      }
      for (const p of this.sparks) {
        if (p.life <= 0) continue;
        p.life -= dt; p.v.y -= 6 * dt; p.s.position.addScaledVector(p.v, dt);
        p.s.material.opacity = Math.max(0, p.life * 2.5);
        if (p.life <= 0) p.s.visible = false;
      }
    }

    /* ================= GÖRSEL GÜNCELLEME ================= */
    frame(dt) {
      this.updateVisuals(dt);
      // etiketler
      const w = this.app.w, h = this.app.h;
      const p = RA.project(this.switchWorld, this.camera, w, h);
      const size = Math.round(Math.max(84, w * 0.26));
      this.ring.style.width = this.ring.style.height = size + 'px';
      this.ring.style.margin = (-size / 2) + 'px 0 0 ' + (-size / 2) + 'px';
      this.ring.style.left = p.x + 'px'; this.ring.style.top = p.y + 'px';
      const pulse = !this.firstTap || this.dangerCue();
      this.ring.classList.toggle('pulse', pulse);
      this.ring.querySelector('.tap-lbl').hidden = !pulse;
      // yan hat dolu etiketi
      const held = this.trains.find((o) => o.dir === 'W' && !o.decided && o.v < 0.3 && this.sS - o.s < 1.6 && this.switchState === 'siding' && this.sidingOccupied());
      this.fullTag.hidden = !held;
      if (held) { const q = RA.project(new T.Vector3(-0.85, 1.6, 7.6), this.camera, w, h); this.fullTag.style.left = q.x + 'px'; this.fullTag.style.top = q.y + 'px'; }
    }
    dangerCue() {
      if (this.t > 12 || this.emergency) return false;
      const eComing = this.trains.some((e) => e.dir === 'E' && e.granted && this.eastInterval(e));
      const wNear = this.trains.some((o) => o.dir === 'W' && !o.decided && this.sS - o.s < 9);
      return eComing && wNear && this.switchState === 'main';
    }
    updateVisuals(dt) {
      if (this.waterTex) this.waterTex.offset.x = (this.waterTex.offset.x + dt * 0.05) % 1;
      // makas dili animasyonu
      const target = this.switchState === 'siding' ? 1 : 0;
      this.bladeT = dt > 0 ? RA.damp(this.bladeT, target, 22, dt) : target;
      const ang = 0.11 * this.bladeT;
      this.blade1.rotation.y = ang;
      this.blade2.rotation.y = this.blade2Base + ang;
      this.tieBar.position.x = 0.15 * this.bladeT;
      this.lever.rotation.z = RA.lerp(0.6, -0.6, this.bladeT);
      // ışık çizgisi
      this.glowT = Math.max(0, this.glowT - dt * 1.1);
      const base = 0.22, flash = this.glowT > 0 ? Math.sin(Math.min(1, this.glowT) * Math.PI) * 0.85 + 0.15 * this.glowT : 0;
      const lockRed = this.lockFlash > 0;
      this.lockFlash = Math.max(0, this.lockFlash - dt);
      const on = this.switchState === 'main' ? this.glowMain : this.glowSiding;
      const off = this.switchState === 'main' ? this.glowSiding : this.glowMain;
      on.material.opacity = Math.min(1, base + flash + (lockRed ? 0.5 * Math.abs(Math.sin(this.lockFlash * 20)) : 0));
      on.material.color.setHex(lockRed ? 0xff5040 : 0xffe08a);
      off.material.opacity = 0;
      // sinyaller
      const homeRed = this.switchState === 'siding' && this.sidingOccupied();
      this.sigHome.userData.set(homeRed ? 'red' : 'green');
      const sdEnd = this.routes.WS.sOf('M3', 0);
      const sidingTrain = this.trains.find((o) => o.dir === 'W' && o.siding && o.s - o.len < sdEnd);
      this.sigSiding.userData.set(sidingTrain && sidingTrain.departed ? 'green' : 'red');
      const eNext = this.trains.find((o) => o.dir === 'E' && !this.eastPast(o));
      this.sigPortal.userData.set(eNext && eNext.granted ? 'green' : 'red');
      // tünelde bekleyen/yaklaşan trenin farları
      let glow = 0;
      for (const o of this.trains) {
        if (o.dir !== 'E' || o.s > this.sEPortal + 0.2) continue;
        glow = Math.max(glow, RA.clamp(1 - (this.sEPortal - o.s) / 5.5, 0.25, 1));
      }
      const flick = 0.92 + 0.08 * Math.sin(performance.now() / 90);
      this.portalGlow.material.opacity = glow * 0.95 * flick;
      this.portalPool.material.opacity = glow * 0.55;
      // tren birimlerini yerleştir
      const F = {}, R = {};
      for (const o of this.trains) {
        for (const u of o.units) {
          const c = o.s - u.off, half = u.len / 2 - 0.26;
          o.route.path.at(c + half, F); o.route.path.at(c - half, R);
          u.g.position.set((F.x + R.x) / 2, 0, (F.z + R.z) / 2);
          u.g.rotation.y = -Math.atan2(F.z - R.z, F.x - R.x);
          for (const wh of u.g.userData.wheels) wh.rotation.y = -o.wheelA;
          // tünel içindekileri gizle
          let hidden = false;
          if (o.dir === 'W') { const L = o.route.locate(c); hidden = L.id === 'M3' && L.c > this.sPortalM3 + 0.55; }
          else hidden = c < this.sEPortal - 0.55;
          u.g.visible = !hidden;
        }
      }
    }
    eastPast(o) { return o.s - o.len > this.sEPortal + 0.5; }

    resize(w, h) {
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      const tilt = T.MathUtils.degToRad(57);
      RA.fitCamera(this.camera, {
        dir: new T.Vector3(0.12, Math.sin(tilt), Math.cos(tilt)),
        target: new T.Vector3(0, 0, -2.0),
        points: [[-4.7, 0, 9.5], [4.7, 0, 9.5], [0, 0, 10.0], [-3.4, 0, -12.6], [3.2, 1.6, -13.4], [-3.6, 0.6, 0], [3.9, 0, 0]],
        margin: { top: this.app.topInset() / h, bottom: 0.012, left: 0.0, right: 0.0 },
      });

    }

    scoreSentence(score, secs, fail) {
      if (fail) return score > 0 ? secs + ' saniyede ' + score + ' treni geçirmiştin.' : 'Henüz hiç tren geçirememiştin.';
      return score > 0 ? secs + ' saniyede ' + score + ' treni geçirdin.' : secs + ' saniyede hiç tren geçiremedin.';
    }
    leave() { }
  }

  const rb = RA.rbox, mesh = RA.mesh;
  const cyl = (r, h) => RA.geo('cylr' + r + h, () => new T.CylinderGeometry(r, r, h, 12));
  RA.RailMode = RailMode;
})();
