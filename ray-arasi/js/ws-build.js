/* RAY ARASI — Atölye: ızgaradan 3B maket (statik sahne + ışık/sinyal/bariyer nesneleri) */
(function () {
  'use strict';
  const RA = window.RA;
  const WS = RA.WS;
  const T = THREE;
  const M = RA.M;
  const { DV, OPP, BIT, FAMILY } = WS;
  const S = WS.S;
  const GH = 1.5;          // zemin kalınlığı (alt geçitler için)
  const TW = 1.72;         // yarma genişliği
  const W = { road: 1.5, rail: 1.0, taxi: 1.25, runway: 1.8 };
  const GAUGE = 0.215;     // ray açıklığının yarısı (ölçekli trenler)
  const rb = RA.rbox, mesh = RA.mesh;

  // değişken yükseklikli süpürme: prof(s) -> [[yanal, y], ...]
  function ext(path, s0, s1, step, prof) {
    const n = Math.max(2, Math.ceil((s1 - s0) / step) + 1);
    const pos = [], idx = [];
    const P = {}, Tn = {};
    const samples = [];
    for (let a = 0; a < n; a++) { const s = s0 + ((s1 - s0) * a) / (n - 1); path.at(s, P); path.tan(s, Tn); samples.push({ x: P.x, z: P.z, rx: -Tn.z, rz: Tn.x, pr: prof(s) }); }
    const segs = samples[0].pr.length - 1;
    const g = new T.BufferGeometry();
    let base = 0;
    for (let k = 0; k < segs; k++) {
      for (const sm of samples) {
        const a = sm.pr[k], b = sm.pr[k + 1];
        pos.push(sm.x + sm.rx * a[0], a[1], sm.z + sm.rz * a[0], sm.x + sm.rx * b[0], b[1], sm.z + sm.rz * b[0]);
      }
      for (let a = 1; a < n; a++) { const q = base + (a - 1) * 2; idx.push(q, q + 1, q + 2, q + 1, q + 3, q + 2); }
      base += n * 2;
    }
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new T.Float32BufferAttribute(new Float32Array((pos.length / 3) * 2), 2));
    g.setIndex(idx); g.computeVertexNormals();
    return g;
  }
  WS.ext = ext;

  let MAT = null;
  function mats() {
    if (MAT) return MAT;
    MAT = {
      grass: new T.MeshStandardMaterial({ map: RA.tex.clone(RA.tex.grass(), 1, 1), roughness: 0.95 }),
      pave: new T.MeshStandardMaterial({ map: RA.tex.clone(RA.tex.sidewalk(), 3, 3), roughness: 0.9 }),
      apron: RA.mat(0xc9c6bd, { roughness: 0.9 }),
      soil: RA.mat(0x8f7a5e, { roughness: 1 }),
      wall: RA.mat(0xb9ad98, { roughness: 0.95 }),
      asphalt: new T.MeshStandardMaterial({ map: RA.tex.clone(RA.tex.asphalt(), 1, 1), roughness: 0.95 }),
      runway: RA.mat(0x34373e, { roughness: 0.9 }),
      concrete: RA.mat(0xb8b5ac, { roughness: 0.85 }),
      deck: RA.mat(0xa9a59b, { roughness: 0.8 }),
      gravel: new T.MeshStandardMaterial({ map: RA.tex.clone(RA.tex.gravel(), 1, 1), roughness: 1 }),
      steel: RA.mat(0x9aa1aa, { roughness: 0.35, metalness: 0.6 }),
      sleeper: RA.mat(0x6b4e3a, { roughness: 0.9 }),
      white: RA.mat(0xf2f2ec, { roughness: 0.6 }),
      yellow: RA.mat(0xf2c230, { roughness: 0.6 }),
      rail: RA.mat(0x3d4249, { roughness: 0.5 }),
      wood: RA.mat(0x9a6b43, { roughness: 0.8 }),
      table: RA.mat(0x3a4a52, { roughness: 1 }),
      platform: RA.mat(0xcfc6b5, { roughness: 0.9 }),
      blueL: RA.glow(0x4a7dff, 1.6), whiteL: RA.glow(0xfff4d6, 1.6), greenL: RA.glow(0x44ff88, 1.6),
    };
    return MAT;
  }

  class Builder {
    constructor(scene) {
      this.scene = scene;
      this.root = null;
      this.dyn = null;
    }
    dispose() {
      if (this.root) {
        this.scene.remove(this.root);
        this.root.traverse((o) => { if (o.isMesh && o.geometry && !o.geometry.userData.cached) o.geometry.dispose(); });
        this.root = null;
      }
    }
    centerPath(net, i, j, a, b) {
      const C = { x: net.cx(i), z: net.cz(j) };
      const e = (d) => ({ x: C.x + DV[d].x * S / 2, z: C.z + DV[d].z * S / 2 });
      if (b === 'C') return new RA.Path([e(a), C]);
      if (b === OPP[a]) return new RA.Path([e(a), e(b)]);
      const K = { x: C.x + (DV[a].x + DV[b].x) * S / 2, z: C.z + (DV[a].z + DV[b].z) * S / 2 };
      const A = e(a), B = e(b), r = S / 2;
      const a0 = Math.atan2(A.z - K.z, A.x - K.x), a1 = Math.atan2(B.z - K.z, B.x - K.x), da = RA.wrapAngle(a1 - a0);
      const pts = []; for (let t = 0; t <= 16; t++) { const q = a0 + (da * t) / 16; pts.push({ x: K.x + Math.cos(q) * r, z: K.z + Math.sin(q) * r }); }
      return new RA.Path(pts);
    }

    // Otopark binası: çok katlı, çatıda park etmiş arabalar (doluluk), giriş bariyeri, P levhası ve doluluk lambası
    buildLot(root, stat, dyn, net, i, j, k, d, m) {
      const x = net.cx(i), z = net.cz(j);
      const g = new T.Group();
      g.position.set(x - DV[d].x * 0.4, 0, z - DV[d].z * 0.4);
      g.rotation.y = Math.atan2(DV[d].x, DV[d].z); // yerel +z yola bakar
      const deck = RA.mat(0xd6d1c6, { roughness: 0.85 }), band = RA.mat(0x2f6fd6, { roughness: 0.6 }), pil = RA.mat(0xb3ada1);
      for (const y of [0.52, 0.9, 1.28]) { g.add(mesh(rb(1.86, 0.07, 1.12, 0.02), deck, 0, y, 0)); g.add(mesh(rb(1.88, 0.06, 0.04, 0.01), band, 0, y + 0.01, 0.58, false)); }
      for (const px of [-0.86, 0, 0.86]) for (const pz of [-0.5, 0.5]) g.add(mesh(rb(0.08, 1.28, 0.08, 0.01), pil, px, 0.64, pz));
      g.add(mesh(rb(1.6, 0.012, 0.95, 0.01), RA.mat(0x3a3d44), 0, 0.02, 0, false));
      stat.add(g);
      // dinamik parçalar (aynı yerel çerçevede)
      const dg = new T.Group(); dg.position.copy(g.position); dg.rotation.copy(g.rotation);
      // çatıdaki park yerleri: doluluk kadar araba görünür
      const carG = RA.geo('lotcar', () => { const b = new T.BoxGeometry(0.42, 0.16, 0.24); b.translate(0, 0.08, 0); return b; });
      const inst = new T.InstancedMesh(carG, new T.MeshStandardMaterial({ roughness: 0.4 }), 6);
      const o = new T.Object3D(); const rr = RA.rng(i * 37 + j * 101);
      const cols = [0xd8432f, 0x2f6fd6, 0xeeeeee, 0x2f9e5a, 0xf08a24, 0xf7c21b, 0x8a96a3];
      for (let n = 0; n < 6; n++) { o.position.set(-0.56 + (n % 3) * 0.56, 1.32, n < 3 ? -0.24 : 0.24); o.rotation.y = Math.PI / 2; o.updateMatrix(); inst.setMatrixAt(n, o.matrix); inst.setColorAt(n, new T.Color(cols[Math.floor(rr() * cols.length)])); }
      inst.count = 0; inst.castShadow = true; dg.add(inst);
      // giriş bariyeri (iki şeridi birden kapatır)
      const post = mesh(rb(0.08, 0.3, 0.08, 0.02), RA.mat(0xf2f2ec), 0.9, 0.15, 0.78); dg.add(post);
      const arm = new T.Group(); arm.position.set(0.9, 0.28, 0.78);
      const armM = new T.Mesh(RA.geo('lotarm', () => { const b = new T.BoxGeometry(1.72, 0.045, 0.04); b.translate(-0.86, 0, 0); return b; }), RA.mat(0xf2f2ec)); arm.add(armM);
      for (const ox of [-0.3, -0.75, -1.2, -1.6]) arm.add(mesh(RA.geo('lotst', () => new T.BoxGeometry(0.14, 0.05, 0.045)), RA.mat(0xd23b2f), ox, 0, 0, false));
      dg.add(arm);
      // P levhası ve doluluk lambası
      const sp = new T.Group(); sp.position.set(-0.95, 0, 0.7);
      sp.add(mesh(RA.geo('lotpole', () => new T.CylinderGeometry(0.025, 0.025, 0.9, 6)), m.rail, 0, 0.45, 0));
      const pm = new T.Mesh(new T.PlaneGeometry(0.42, 0.42), new T.MeshBasicMaterial({ map: lotSignTex(), side: T.DoubleSide })); pm.position.set(0, 0.98, 0); pm.rotation.x = -0.6; sp.add(pm);
      const lm = new T.MeshStandardMaterial({ color: 0x111111, emissive: 0x2bff6a, emissiveIntensity: 2.2 });
      const lamp = new T.Mesh(RA.geo('lamp', () => new T.SphereGeometry(0.055, 12, 8)), lm); lamp.position.set(0, 1.24, 0); sp.add(lamp);
      dg.add(sp);
      root.add(dg);
      dyn.lots.push({ key: i + ',' + j, i, j, k, port: d, arm, lm, inst });
    }

    build(net) {
      this.dispose();
      const m = mats();
      const g = net.g;
      const root = new T.Group();
      const stat = new T.Group();
      const dyn = { junctions: [], crossings: [], railSignals: [], stopbars: [], buffers: [], lots: [] };
      const sleepers = [], edgeLights = [], blueLights = [];
      const rnd = RA.rng(97);
      const hEdge = (i, j, k, d) => net.edgeH(i, j, k, d);

      // --- masa ve maket tahtası çerçevesi ---
      const BW = g.cols * S, BD = g.rows * S;
      const table = mesh(new T.BoxGeometry(BW + 40, 0.4, BD + 40), m.table, 0, -GH - 0.5, 0); table.castShadow = false; root.add(table);
      for (const [x, z, w, d] of [[0, -BD / 2 - 0.3, BW + 1.2, 0.6], [0, BD / 2 + 0.3, BW + 1.2, 0.6], [-BW / 2 - 0.3, 0, 0.6, BD], [BW / 2 + 0.3, 0, 0.6, BD]]) stat.add(mesh(rb(w, GH + 0.3, d, 0.08), m.wood, x, -GH / 2 + 0.05, z));

      // --- hücre bilgisi: yarma (alt geçit) ---
      const cellInfo = (i, j) => {
        const c = g.cell(i, j);
        let trench = null, use = null;
        c.pieces.forEach((p, k) => {
          const fam = FAMILY[p.type];
          use = use || fam;
          const ps = WS.ports(p.m);
          const neg = p.lv < 0 || ps.some((d) => hEdge(i, j, k, d) < 0);
          if (neg && WS.axisOf(p.m)) trench = { k, ax: WS.axisOf(p.m) };
        });
        return { c, trench, use };
      };

      // --- zemin karoları ---
      g.each((c, i, j) => {
        const x = net.cx(i), z = net.cz(j);
        const inf = cellInfo(i, j);
        const gate = inf.use === 'air' && c.pieces.some((q) => q.type === 'taxi' && WS.portCount(q.m) === 1);
        const top = inf.use === 'road' ? m.pave : gate ? m.apron : m.grass;
        if (!inf.trench) { const t = mesh(new T.BoxGeometry(S, GH, S), top, x, -GH / 2, z); t.castShadow = false; stat.add(t); }
        else {
          const sw = (S - TW) / 2;
          for (const sgn of [-1, 1]) {
            const geo = inf.trench.ax === 'NS' ? new T.BoxGeometry(sw, GH, S) : new T.BoxGeometry(S, GH, sw);
            const ox = inf.trench.ax === 'NS' ? sgn * (TW / 2 + sw / 2) : 0, oz = inf.trench.ax === 'NS' ? 0 : sgn * (TW / 2 + sw / 2);
            const side = new T.Mesh(geo, [m.wall, m.wall, top, m.wall, m.wall, m.wall]); side.position.set(x + ox, -GH / 2, z + oz); side.receiveShadow = true; root.add(side);
          }
        }
        // boş karelere süs
        if (!c.pieces.length) {
          const r = RA.rng(i * 131 + j * 977 + 7)();
          const r2 = RA.rng(i * 71 + j * 53 + 3);
          if (r < 0.5) { const n = 1 + Math.floor(r2() * 3); for (let a = 0; a < n; a++) { const t = M.tree(r2, r2() < 0.6 ? 'round' : 'cone', 0.6 + r2() * 0.3); t.position.set(x + (r2() - 0.5) * 1.3, 0, z + (r2() - 0.5) * 1.3); stat.add(t); } }
          else if (r < 0.66) { const h = M.house(1.0, 0.85, 0.62, RA.pick([0xf2d7b6, 0xe9e3d3, 0xf5e6c4, 0xdfe7ea], r2), RA.pick([0xc0573c, 0x8e4a3a, 0xb5482f, 0x5c6f7d], r2), r2); h.position.set(x, 0, z); h.rotation.y = Math.floor(r2() * 4) * Math.PI / 2; stat.add(h); }
          else if (r < 0.78) { for (let a = 0; a < 3; a++) { const b = M.bush(r2, 0.7); b.position.set(x + (r2() - 0.5) * 1.4, 0, z + (r2() - 0.5) * 1.4); stat.add(b); } }
        }
      });

      // --- parçalar ---
      g.each((c, i, j) => {
        const x = net.cx(i), z = net.cz(j);
        const inf = cellInfo(i, j);
        c.pieces.forEach((p, k) => {
          const fam = FAMILY[p.type];
          const ps = WS.ports(p.m);
          const w = W[p.type];
          const yOf = (a, b) => { const h0 = a === 'C' ? 0 : hEdge(i, j, k, a), h1 = b === 'C' ? 0 : hEdge(i, j, k, b); return (s, L) => (h0 === h1 ? h0 : h0 + (h1 - h0) * RA.smooth(s / L)); };
          // bu parçanın çizim yolları
          const paths = [];
          if (p.type === 'runway') { const ax = p.ax || 'NS'; const [d0, d1] = ax === 'NS' ? ['N', 'S'] : ['W', 'E']; paths.push([d0, d1]); }
          else if (ps.length === 1) paths.push([ps[0], 'C']);
          else if (ps.length === 2) paths.push([ps[0], ps[1]]);
          else if (fam === 'rail') { for (let a = 0; a < ps.length; a++) for (let b = a + 1; b < ps.length; b++) paths.push([ps[a], ps[b]]); }
          else ps.forEach((d) => paths.push([d, 'C']));
          const elev = p.lv !== 0 || ps.some((d) => hEdge(i, j, k, d) !== 0);
          for (const [a, b] of paths) {
            const path = this.centerPath(net, i, j, a, b);
            const L = path.length, yf = yOf(a, b);
            const yy = (s) => yf(s, L);
            // köprü tabliyesi / dolgu / yarma tabanı
            if (p.lv > 0) {
              stat.add(new T.Mesh(ext(path, 0, L, 0.25, (s) => { const y = yy(s); return [[-w / 2 - 0.12, y - 0.28], [-w / 2 - 0.12, y + 0.01], [w / 2 + 0.12, y + 0.01], [w / 2 + 0.12, y - 0.28]]; }), m.deck));
              for (const sgn of [-1, 1]) {
                stat.add(new T.Mesh(ext(path, 0, L, 0.25, (s) => { const y = yy(s); return [[sgn * (w / 2 + 0.06) - 0.03, y], [sgn * (w / 2 + 0.06) - 0.03, y + 0.2], [sgn * (w / 2 + 0.06) + 0.03, y + 0.2], [sgn * (w / 2 + 0.06) + 0.03, y]]; }), m.white));
                for (const s of [0.12, L - 0.12]) { const P = path.at(s), Tn = path.tan(s); const pil = mesh(rb(0.22, H_UPv() - 0.25, 0.22, 0.03), m.deck, P.x - Tn.z * sgn * (w / 2), (H_UPv() - 0.25) / 2, P.z + Tn.x * sgn * (w / 2)); stat.add(pil); }
              }
            } else if (elev && p.lv === 0 && Math.max(hEdge(i, j, k, a === 'C' ? b : a), b === 'C' ? 0 : hEdge(i, j, k, b)) > 0) {
              stat.add(new T.Mesh(ext(path, 0, L, 0.2, (s) => { const y = yy(s); return [[-w / 2 - 0.1, 0], [-w / 2 - 0.1, y], [w / 2 + 0.1, y], [w / 2 + 0.1, 0]]; }), m.wall));
              for (const sgn of [-1, 1]) stat.add(new T.Mesh(ext(path, 0, L, 0.2, (s) => { const y = yy(s); const hh = RA.clamp(y * 0.3, 0, 0.2); return [[sgn * (w / 2 + 0.06) - 0.03, y], [sgn * (w / 2 + 0.06) - 0.03, y + hh], [sgn * (w / 2 + 0.06) + 0.03, y + hh], [sgn * (w / 2 + 0.06) + 0.03, y]]; }), m.white));
            }
            if (inf.trench && inf.trench.k === k) {
              stat.add(new T.Mesh(ext(path, 0, L, 0.2, (s) => { const y = yy(s); return [[-TW / 2, -GH + 0.02], [-TW / 2, y - 0.01], [TW / 2, y - 0.01], [TW / 2, -GH + 0.02]]; }), m.concrete));
            }
            // alt geçidin üstünden geçen parça: ince tabliye + korkuluk
            if (inf.trench && inf.trench.k !== k && p.lv === 0) {
              stat.add(new T.Mesh(ext(path, 0, L, 0.25, () => [[-w / 2 - 0.12, -0.26], [-w / 2 - 0.12, -0.0], [w / 2 + 0.12, -0.0], [w / 2 + 0.12, -0.26]]), m.deck));
              for (const sgn of [-1, 1]) stat.add(new T.Mesh(ext(path, S / 2 - TW / 2 - 0.05, S / 2 + TW / 2 + 0.05, 0.2, () => [[sgn * (w / 2 + 0.1) - 0.03, 0], [sgn * (w / 2 + 0.1) - 0.03, 0.18], [sgn * (w / 2 + 0.1) + 0.03, 0.18], [sgn * (w / 2 + 0.1) + 0.03, 0]]), m.white));
            }
            // yüzeyler
            if (fam === 'road') {
              stat.add(new T.Mesh(ext(path, 0, L, 0.15, (s) => { const y = yy(s) + 0.025; return [[-w / 2, y], [w / 2, y]]; }), m.asphalt));
              if (ps.length <= 2) for (let s = 0.25; s < L - 0.15; s += 0.5) { const P = path.at(s), Tn = path.tan(s); const d = mesh(RA.geo('wsdash', () => new T.BoxGeometry(0.26, 0.01, 0.05)), m.white, P.x, yy(s) + 0.035, P.z, false); d.rotation.y = -Math.atan2(Tn.z, Tn.x); stat.add(d); }
            } else if (fam === 'rail') {
              const onDeck = p.lv > 0 || (inf.trench && inf.trench.k !== k);
              if (!onDeck) stat.add(new T.Mesh(ext(path, 0, L, 0.2, (s) => { const y = yy(s); return [[-0.5, y], [-0.36, y + 0.1], [0.36, y + 0.1], [0.5, y]]; }), m.gravel));
              for (let s = 0.16; s < L; s += 0.3) { const P = path.at(s), Tn = path.tan(s); sleepers.push([P.x, yy(s) + 0.11, P.z, Math.atan2(Tn.z, Tn.x)]); }
              for (const sgn of [-1, 1]) stat.add(new T.Mesh(ext(path, 0, L, 0.12, (s) => { const y = yy(s) + 0.13; const o = sgn * GAUGE; return [[o - 0.025, y], [o - 0.025, y + 0.06], [o + 0.025, y + 0.06], [o + 0.025, y]]; }), m.steel));
            } else if (p.type === 'taxi') {
              stat.add(new T.Mesh(ext(path, 0, L, 0.15, (s) => { const y = yy(s) + 0.02; return [[-w / 2, y], [w / 2, y]]; }), m.concrete));
              stat.add(new T.Mesh(ext(path, 0, L, 0.15, (s) => { const y = yy(s) + 0.028; return [[-0.03, y], [0.03, y]]; }), m.yellow));
              if (ps.length === 2) for (let s = 0.35; s < L; s += 0.7) { const P = path.at(s), Tn = path.tan(s); for (const sgn of [-1, 1]) blueLights.push([P.x - Tn.z * sgn * 0.66, yy(s) + 0.06, P.z + Tn.x * sgn * 0.66]); }
            } else if (p.type === 'runway') {
              stat.add(new T.Mesh(ext(path, 0, L, 0.2, (s) => { const y = yy(s) + 0.022; return [[-w / 2, y], [w / 2, y]]; }), m.runway));
              for (let s = 0.3; s < L; s += 0.66) { const P = path.at(s), Tn = path.tan(s); const d = mesh(RA.geo('rwdash', () => new T.BoxGeometry(0.34, 0.01, 0.06)), m.white, P.x, 0.03, P.z, false); d.rotation.y = -Math.atan2(Tn.z, Tn.x); stat.add(d); for (const sgn of [-1, 1]) edgeLights.push([P.x - Tn.z * sgn * 0.88, 0.07, P.z + Tn.x * sgn * 0.88]); }
            }
          }
          // kavşak/çıkmaz ortası
          const yC = p.lv > 0 ? WS.H_UP : p.lv < 0 ? WS.H_DN : 0;
          if (fam === 'road' && ps.length === 1 && p.lv === 0) {
            this.buildLot(root, stat, dyn, net, i, j, k, ps[0], m);
          } else if ((fam === 'road' || p.type === 'taxi') && ps.length !== 2) {
            const pad = ps.length === 1 ? new T.BoxGeometry(1.75, 0.02, 1.75) : new T.BoxGeometry(w, 0.02, w);
            stat.add(mesh(pad, fam === 'road' ? m.asphalt : m.concrete, x, yC + 0.027, z, false));
            if (ps.length === 1 && p.type === 'taxi') { const bar = mesh(new T.BoxGeometry(0.9, 0.012, 0.07), m.yellow, x - DV[ps[0]].x * 0.55, 0.034, z - DV[ps[0]].z * 0.55, false); if (DV[ps[0]].x) bar.rotation.y = Math.PI / 2; stat.add(bar); }
          }
          if (fam === 'road' && ps.length >= 3) {
            // yaya geçidi ve dur çizgisi
            for (const d of ps) {
              const t = DV[d]; const rI = { x: -(-t.z), z: -t.x }; // gelen aracın sağı
              for (let a = 0; a < 5; a++) { const off = -0.6 + a * 0.3; const zz = mesh(RA.geo('zeb', () => new T.BoxGeometry(0.26, 0.011, 0.12)), m.white, x + t.x * 0.8 + (t.z !== 0 ? off : 0), 0.04, z + t.z * 0.8 + (t.x !== 0 ? off : 0), false); if (t.z !== 0) zz.rotation.y = Math.PI / 2; stat.add(zz); }
            }
          }
          if (fam === 'rail' && ps.length === 1) {
            const d = ps[0]; const bp = { x: x - DV[d].x * 0.82, z: z - DV[d].z * 0.82 };
            const buf = new T.Group(); buf.position.set(bp.x, 0, bp.z); buf.rotation.y = d === 'N' || d === 'S' ? 0 : Math.PI / 2;
            buf.add(mesh(rb(0.62, 0.22, 0.12, 0.03), RA.mat(0xd23b2f), 0, 0.3, 0)); buf.add(mesh(rb(0.08, 0.3, 0.08, 0.02), m.rail, -0.2, 0.15, 0)); buf.add(mesh(rb(0.08, 0.3, 0.08, 0.02), m.rail, 0.2, 0.15, 0));
            stat.add(buf);
            // küçük peron
            const side = { x: -DV[d].z, z: DV[d].x };
            const pl = mesh(rb(Math.abs(side.x) > 0 ? 0.45 : 1.4, 0.2, Math.abs(side.z) > 0 ? 0.45 : 1.4, 0.03), m.platform, x + side.x * 0.62, 0.1, z + side.z * 0.62); stat.add(pl);
            const roof = mesh(rb(Math.abs(side.x) > 0 ? 0.42 : 1.0, 0.05, Math.abs(side.z) > 0 ? 0.42 : 1.0, 0.02), RA.mat(0xb5482f), x + side.x * 0.7, 0.62, z + side.z * 0.7); stat.add(roof);
            stat.add(mesh(rb(0.05, 0.42, 0.05, 0.01), m.rail, x + side.x * 0.75, 0.41, z + side.z * 0.75));
          }
          if (p.type === 'runway') {
            // eşik çizgileri (şerit uçlarında)
            const ax = p.ax || 'NS'; const [d0, d1] = ax === 'NS' ? ['N', 'S'] : ['W', 'E'];
            for (const d of [d0, d1]) {
              if (p.m & BIT[d]) continue;
              for (let a = 0; a < 5; a++) { const off = -0.6 + a * 0.3; const th = mesh(RA.geo('thr', () => new T.BoxGeometry(0.1, 0.011, 0.5)), m.white, x + DV[d].x * 0.55 + (ax === 'NS' ? off : 0), 0.034, z + DV[d].z * 0.55 + (ax === 'EW' ? off : 0), false); if (ax === 'EW') th.rotation.y = Math.PI / 2; stat.add(th); }
              for (let a = 0; a < 5; a++) { const off = -0.72 + a * 0.36; const gl = mesh(RA.geo('thrl', () => new T.BoxGeometry(0.07, 0.05, 0.07)), m.greenL, x + DV[d].x * 0.95 + (ax === 'NS' ? off : 0), 0.07, z + DV[d].z * 0.95 + (ax === 'EW' ? off : 0), false); stat.add(gl); }
            }
            // yan bağlantılar (taksi yolu ağzı) ve dur ışıkları
            for (const d of ps) {
              if (WS.AXIS[d] === ax) continue;
              const P0 = { x: x + DV[d].x * 0.9, z: z + DV[d].z * 0.9 };
              const stub = mesh(new T.BoxGeometry(DV[d].x ? 0.2 : W.taxi, 0.02, DV[d].z ? 0.2 : W.taxi), m.concrete, P0.x, 0.024, P0.z, false); stat.add(stub);
              const bar = new T.Group(); bar.position.set(x + DV[d].x * 0.97, 0.06, z + DV[d].z * 0.97);
              const red = new T.MeshStandardMaterial({ color: 0x220808, emissive: 0xff2a1f, emissiveIntensity: 2.2 });
              for (const o of [-0.42, -0.14, 0.14, 0.42]) { const l = new T.Mesh(RA.geo('sbl', () => new T.BoxGeometry(0.08, 0.06, 0.08)), red); l.position.set(DV[d].z ? o : 0, 0, DV[d].x ? o : 0); bar.add(l); }
              root.add(bar);
              dyn.stopbars.push({ i, j, k, d, mat: red, rw: net.rwOfCell.get(i + ',' + j) });
            }
          }
        });
        // ışıksız (yol ver) kavşak: otopark kolunda kesik çizgi ve üçgen levha
        const yj = net.yieldAt.get(i + ',' + j + ',0');
        if (yj) {
          const d = yj.minor, t = DV[d], rI = { x: t.z, z: -t.x };
          for (let a = 0; a < 4; a++) { const off = 0.05 + a * 0.17; const dsh = mesh(RA.geo('ywd', () => new T.BoxGeometry(0.1, 0.012, 0.1)), m.white, x + t.x * 0.86 + rI.x * off, 0.04, z + t.z * 0.86 + rI.z * off, false); stat.add(dsh); }
          const sg = new T.Group(); sg.position.set(x + t.x * 0.9 + rI.x * 0.92, 0, z + t.z * 0.9 + rI.z * 0.92);
          sg.add(mesh(RA.geo('ysp', () => new T.CylinderGeometry(0.025, 0.025, 0.55, 6)), m.rail, 0, 0.27, 0));
          const tri = new T.Shape(); tri.moveTo(-0.17, 0.15); tri.lineTo(0.17, 0.15); tri.lineTo(0, -0.14); tri.lineTo(-0.17, 0.15);
          const tg = mesh(RA.geo('ytri', () => new T.ExtrudeGeometry(tri, { depth: 0.03, bevelEnabled: false })), RA.mat(0xd23b2f), 0, 0.66, 0);
          tg.rotation.y = Math.atan2(t.x, t.z); sg.add(tg); stat.add(sg);
        }
        // kavşak ışıkları
        const jn = net.juncAt.get(i + ',' + j + ',0');
        if (jn) {
          const head = M.trafficLightLite(); head.scale.setScalar(0.42); head.position.set(x + 0.9, 1.0, z + 0.9);
          root.add(head);
          const pole = mesh(RA.geo('jpole', () => new T.CylinderGeometry(0.03, 0.035, 1.0, 8)), m.rail, x + 0.9, 0.5, z + 0.9); root.add(pole);
          const bars = {};
          const axM = { NS: new T.MeshBasicMaterial({ color: 0xff3020, transparent: true, opacity: 0.85, depthWrite: false }), EW: new T.MeshBasicMaterial({ color: 0xff3020, transparent: true, opacity: 0.85, depthWrite: false }) };
          const bg = new T.Group();
          for (const d of jn.ports) {
            const t = DV[d]; const rI = { x: t.z, z: -t.x }; // içeri giren aracın sağı = right(-t)
            const mt = axM[WS.AXIS[d]];
            const b = new T.Mesh(RA.geo('jbar', () => { const q = new T.PlaneGeometry(0.62, 0.12); q.rotateX(-Math.PI / 2); return q; }), mt);
            b.position.set(x + t.x * 0.94 + rI.x * WS.LANE, 0.045, z + t.z * 0.94 + rI.z * WS.LANE);
            if (t.z !== 0) b.rotation.y = 0; else b.rotation.y = Math.PI / 2;
            bg.add(b); bars[d] = mt;
          }
          const merged = RA.mergeStatic(bg); merged.children.forEach((q) => { q.castShadow = false; q.receiveShadow = false; q.renderOrder = 2; }); root.add(merged);
          dyn.junctions.push({ key: jn.key, i, j, k: 0, ports: jn.ports, head, bars, pos: new T.Vector3(x, 1.0, z) });
        }
        // hemzemin geçitler
        const cx = net.crossAt.get(i + ',' + j);
        if (cx && (cx.kind === 'level' || cx.kind === 'taxiRoad')) {
          const road = c.pieces.find((q) => q.type === 'road' && q.lv === 0);
          const rax = WS.axisOf(road.m);
          const gates = [];
          for (const d of WS.ports(road.m)) {
            const t = DV[d]; const rI = { x: t.z, z: -t.x };
            const post = new T.Group(); post.position.set(x + t.x * 0.95 + rI.x * 0.86, 0, z + t.z * 0.95 + rI.z * 0.86);
            post.add(mesh(rb(0.07, 0.62, 0.07, 0.02), RA.mat(0xf2f2ec), 0, 0.31, 0));
            const lm = new T.MeshStandardMaterial({ color: 0x220808, emissive: 0xff2a1f, emissiveIntensity: 0.1 });
            const lamp = new T.Mesh(RA.geo('xl', () => new T.SphereGeometry(0.055, 10, 8)), lm); lamp.position.set(0, 0.55, 0); post.add(lamp);
            const halo = RA.glowSprite(0xff3b2f, 0.55, 0); halo.position.set(0, 0.58, 0); post.add(halo);
            const x1 = mesh(rb(0.3, 0.04, 0.02, 0.01), m.white, 0, 0.72, 0, false); x1.rotation.z = 0.7; post.add(x1);
            const x2 = mesh(rb(0.3, 0.04, 0.02, 0.01), m.white, 0, 0.72, 0, false); x2.rotation.z = -0.7; post.add(x2);
            post.rotation.y = Math.atan2(-t.x, -t.z);
            let arm = null;
            if (cx.kind === 'level') {
              arm = new T.Group(); arm.position.set(0, 0.36, 0);
              const armM = new T.Mesh(RA.geo('barm', () => { const b = new T.BoxGeometry(0.9, 0.05, 0.04); b.translate(0.45, 0, 0); return b; }), RA.mat(0xf2f2ec)); arm.add(armM);
              for (const o of [0.2, 0.5, 0.8]) { const st = mesh(RA.geo('bst', () => new T.BoxGeometry(0.12, 0.055, 0.045)), RA.mat(0xd23b2f), o, 0, 0, false); arm.add(st); }
              post.add(arm);
            }
            root.add(post);
            gates.push({ post, arm, lm, halo, d });
          }
          dyn.crossings.push({ key: cx.key, kind: cx.kind, i, j, gates, rax });
        }
      });
      // ray sinyalleri
      for (const sg of net.railSignals) {
        const t = DV[sg.d]; const rI = { x: t.z, z: -t.x };
        const s = M.signalLite(); s.scale.setScalar(0.5);
        const p = net.piece(sg.i, sg.j, sg.k);
        const y = p.lv > 0 ? WS.H_UP : 0;
        s.position.set(net.cx(sg.i) + t.x * 0.92 + rI.x * 0.48, y, net.cz(sg.j) + t.z * 0.92 + rI.z * 0.48);
        s.rotation.y = Math.atan2(t.x, t.z);
        root.add(s);
        dyn.railSignals.push(Object.assign({ obj: s, state: '' }, sg));
      }
      // örneklenmiş traversler ve ışıklar
      if (sleepers.length) {
        const im = new T.InstancedMesh(RA.geo('wssl', () => new T.BoxGeometry(0.11, 0.04, 0.62)), m.sleeper, sleepers.length);
        const o = new T.Object3D();
        sleepers.forEach((sp, a) => { o.position.set(sp[0], sp[1], sp[2]); o.rotation.set(0, -sp[3], 0); o.updateMatrix(); im.setMatrixAt(a, o.matrix); });
        im.receiveShadow = true; root.add(im);
      }
      const inst = (list, mat, size) => { if (!list.length) return; const im = new T.InstancedMesh(RA.geo('wsl' + size, () => new T.BoxGeometry(size, size * 0.7, size)), mat, list.length); const o = new T.Object3D(); list.forEach((q, a) => { o.position.set(q[0], q[1], q[2]); o.updateMatrix(); im.setMatrixAt(a, o.matrix); }); root.add(im); };
      inst(edgeLights, m.whiteL, 0.07); inst(blueLights, m.blueL, 0.06);
      // kılavuz ızgara çizgileri
      const gl = [];
      for (let a = 0; a <= g.cols; a++) { const xx = net.ox - S / 2 + a * S; gl.push(xx, 0.06, net.oz - S / 2, xx, 0.06, net.oz - S / 2 + g.rows * S); }
      for (let b = 0; b <= g.rows; b++) { const zz = net.oz - S / 2 + b * S; gl.push(net.ox - S / 2, 0.06, zz, net.ox - S / 2 + g.cols * S, 0.06, zz); }
      const gg = new T.BufferGeometry(); gg.setAttribute('position', new T.Float32BufferAttribute(gl, 3));
      this.gridLines = new T.LineSegments(gg, new T.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.22, depthWrite: false }));
      this.gridLines.renderOrder = 5; root.add(this.gridLines);

      root.add(RA.mergeStatic(stat));
      this.scene.add(root);
      this.root = root; this.dyn = dyn;
      return dyn;
    }
  }
  function H_UPv() { return WS.H_UP; }
  let _lotTex = null;
  function lotSignTex() {
    if (_lotTex) return _lotTex;
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#1f5fc8'; g.fillRect(8, 8, 112, 112);
    g.fillStyle = '#ffffff'; g.font = '900 96px Overpass, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('P', 64, 70);
    _lotTex = new T.CanvasTexture(c); _lotTex.encoding = T.sRGBEncoding; return _lotTex;
  }
  WS.Builder = Builder;
  WS.GH = GH;
})();
