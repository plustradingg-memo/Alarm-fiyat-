/* RAY ARASI — oyuncak maket modelleri. Tüm araçlarda yerel +x = ileri, +y = yukarı. */
(function () {
  'use strict';
  const RA = window.RA;
  const T = THREE;
  const M = (RA.M = {});
  const rb = RA.rbox, mat = RA.mat, mesh = RA.mesh;

  const DARK = mat(0x2d3036, { roughness: 0.8 });
  const STEEL = mat(0x8a9099, { roughness: 0.45, metalness: 0.35 });
  const GLASS = mat(0x22303d, { roughness: 0.15, metalness: 0.2 });
  const WHITE = mat(0xf4f1ea);
  const RUBBER = mat(0x1f2124, { roughness: 0.9 });

  const cyl = (r, h, seg) => RA.geo('cyl' + r + '_' + h + '_' + (seg || 12), () => new T.CylinderGeometry(r, r, h, seg || 12));

  function wheel(r, w, m) {
    const wm = new T.Mesh(cyl(r, w, 14), m || RUBBER);
    wm.rotation.x = Math.PI / 2; wm.castShadow = true;
    return wm;
  }

  /* ================= DEMİRYOLU ================= */
  // Ray üstü y=0.25; tekerlek yarıçapı 0.11 -> tekerlek merkezi y=0.36. Hat açıklığı 0.6 (raylar z=±0.3).
  const RAIL_TOP = (M.RAIL_TOP = 0.25);
  function bogie(g, x, wheels) {
    const fr = mesh(rb(0.42, 0.1, 0.5, 0.02), DARK, x, RAIL_TOP + 0.13, 0);
    g.add(fr);
    for (const dx of [-0.13, 0.13]) for (const z of [-0.3, 0.3]) {
      const w = wheel(0.11, 0.05, STEEL); w.position.set(x + dx, RAIL_TOP + 0.11, z); g.add(w); wheels.push(w);
    }
  }
  function trainBase(len) {
    const g = new T.Group(); g.userData.wheels = []; g.userData.len = len;
    bogie(g, len / 2 - 0.26, g.userData.wheels);
    bogie(g, -len / 2 + 0.26, g.userData.wheels);
    g.add(mesh(rb(len - 0.04, 0.08, 0.56, 0.02), DARK, 0, RAIL_TOP + 0.24, 0));
    // tampon ve koşum
    for (const sx of [1, -1]) g.add(mesh(rb(0.06, 0.06, 0.4, 0.01), DARK, sx * (len / 2 - 0.01), RAIL_TOP + 0.22, 0, false));
    return g;
  }

  M.loco = function (color, stripe, len) {
    len = len || 1.2;
    const g = trainBase(len);
    const body = mat(color), str = mat(stripe || 0xf6e7b8);
    const y0 = RAIL_TOP + 0.28;
    // uzun kaput (arka) + kabin (ön)
    g.add(mesh(rb(len * 0.58, 0.34, 0.5, 0.07), body, -len * 0.16, y0 + 0.17, 0));
    g.add(mesh(rb(len * 0.34, 0.5, 0.6, 0.08), body, len * 0.3, y0 + 0.25, 0));
    g.add(mesh(rb(len * 0.36, 0.06, 0.64, 0.03), mat(0x3a3f47), len * 0.3, y0 + 0.52, 0)); // çatı
    g.add(mesh(rb(len * 0.6, 0.05, 0.52, 0.02), str, -len * 0.16, y0 + 0.22, 0, false)); // şerit
    g.add(mesh(rb(len * 0.35, 0.06, 0.62, 0.02), str, len * 0.3, y0 + 0.1, 0, false));
    // camlar
    g.add(mesh(rb(0.03, 0.16, 0.46, 0.01), GLASS, len * 0.47 + 0.005, y0 + 0.36, 0, false));
    for (const z of [-0.305, 0.305]) g.add(mesh(rb(len * 0.2, 0.15, 0.02, 0.005), GLASS, len * 0.3, y0 + 0.36, z, false));
    // far
    const head = new T.Mesh(rb(0.03, 0.08, 0.16, 0.01), RA.glow(0xfff1c2, 2.2));
    head.position.set(len / 2 + 0.005, y0 + 0.16, 0); g.add(head);
    g.userData.headlightPos = new T.Vector3(len / 2 + 0.05, y0 + 0.16, 0);
    // korna / egzoz
    g.add(mesh(cyl(0.035, 0.08, 8), DARK, -len * 0.02, y0 + 0.38, 0.1));
    return g;
  };
  M.coach = function (color, len) {
    len = len || 1.0;
    const g = trainBase(len);
    const y0 = RAIL_TOP + 0.28;
    g.add(mesh(rb(len - 0.06, 0.44, 0.58, 0.07), mat(color), 0, y0 + 0.22, 0));
    g.add(mesh(rb(len - 0.1, 0.12, 0.6, 0.03), GLASS, 0, y0 + 0.3, 0, false));
    g.add(mesh(rb(len - 0.04, 0.07, 0.56, 0.035), mat(0xd9dde2), 0, y0 + 0.47, 0));
    g.add(mesh(rb(len - 0.08, 0.04, 0.6, 0.01), mat(0xf6e7b8), 0, y0 + 0.13, 0, false));
    return g;
  };
  M.boxcar = function (color, len) {
    len = len || 1.0;
    const g = trainBase(len);
    const y0 = RAIL_TOP + 0.28;
    g.add(mesh(rb(len - 0.06, 0.46, 0.58, 0.04), mat(color, { roughness: 0.8 }), 0, y0 + 0.23, 0));
    g.add(mesh(rb(0.3, 0.36, 0.6, 0.01), mat(new T.Color(color).multiplyScalar(0.8).getHex()), 0, y0 + 0.22, 0, false));
    g.add(mesh(rb(len - 0.04, 0.04, 0.6, 0.02), mat(0x5b5f66), 0, y0 + 0.47, 0));
    return g;
  };
  M.tank = function (color, len) {
    len = len || 1.0;
    const g = trainBase(len);
    const y0 = RAIL_TOP + 0.28;
    const t = mesh(cyl(0.25, len - 0.12, 16), mat(color, { roughness: 0.35, metalness: 0.25 }), 0, y0 + 0.24, 0);
    t.rotation.z = Math.PI / 2; g.add(t);
    for (const sx of [1, -1]) { const c = mesh(RA.geo('tankcap', () => new T.SphereGeometry(0.25, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2)), mat(color, { roughness: 0.35, metalness: 0.25 }), sx * (len / 2 - 0.06), y0 + 0.24, 0); c.rotation.z = -sx * Math.PI / 2; c.scale.y = 0.35; g.add(c); }
    g.add(mesh(cyl(0.07, 0.08, 10), DARK, 0, y0 + 0.5, 0));
    return g;
  };
  M.hopper = function (color, len) {
    len = len || 1.0;
    const g = trainBase(len);
    const y0 = RAIL_TOP + 0.28;
    g.add(mesh(rb(len - 0.06, 0.34, 0.58, 0.03), mat(color, { roughness: 0.85 }), 0, y0 + 0.17, 0));
    const coal = mesh(RA.geo('coal', () => { const s = new T.SphereGeometry(0.5, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2); s.scale(1, 0.28, 0.55); return s; }), mat(0x2b2a2c, { roughness: 1 }), 0, y0 + 0.32, 0);
    coal.scale.x = (len - 0.1) / 1.0; g.add(coal);
    return g;
  };

  // Tren: lokomotif + vagonlar; her birim ayrı grup (virajda ayrı ayrı yönlenir)
  M.train = function (kind, rnd, nCars) {
    const units = [];
    if (kind === 'passenger') {
      const pal = RA.pick([[0x1f5fc8, 0xf6e7b8, 0x2463c4], [0x1f5fc8, 0xffffff, 0x2a6ad0], [0x14857c, 0xf6e7b8, 0x1b9488]], rnd);
      units.push({ g: M.loco(pal[0], pal[1], 1.2), len: 1.2 });
      for (let i = 0; i < nCars; i++) units.push({ g: M.coach(pal[2], 1.0), len: 1.0 });
    } else {
      units.push({ g: M.loco(0xd23b2f, 0xffd166, 1.25), len: 1.25 });
      const kinds = [
        () => M.boxcar(RA.pick([0x9c3b2a, 0xb3492f, 0x7e3a2b], rnd)),
        () => M.tank(RA.pick([0xb9bec6, 0x2f3338, 0xd9d4c8], rnd)),
        () => M.hopper(RA.pick([0x6b4a3a, 0x5a5048], rnd)),
        () => M.boxcar(RA.pick([0x2f5d8c, 0x3d6b4f], rnd)),
      ];
      for (let i = 0; i < nCars; i++) units.push({ g: RA.pick(kinds, rnd)(), len: 1.0 });
    }
    return units;
  };

  M.sleeperGeo = () => RA.geo('sleeper', () => new T.BoxGeometry(0.16, 0.05, 0.86));

  M.signal = function (heads) {
    // heads: lamba sayısı (2: kırmızı/yeşil)
    const g = new T.Group();
    g.add(mesh(cyl(0.035, 0.9, 8), mat(0x50555c), 0, 0.45, 0));
    g.add(mesh(rb(0.2, 0.06, 0.2, 0.02), DARK, 0, 0.03, 0));
    const box = mesh(rb(0.16, 0.36, 0.12, 0.04), mat(0x24272c), 0, 0.98, 0); g.add(box);
    const lamps = {};
    const red = new T.MeshStandardMaterial({ color: 0x220808, emissive: 0xff2a1f, emissiveIntensity: 0.08 });
    const green = new T.MeshStandardMaterial({ color: 0x082208, emissive: 0x2bff6a, emissiveIntensity: 0.08 });
    const sph = RA.geo('lamp', () => new T.SphereGeometry(0.055, 12, 8));
    const r = new T.Mesh(sph, red); r.position.set(0.0, 1.06, 0.07); g.add(r);
    const gr = new T.Mesh(sph, green); gr.position.set(0.0, 0.9, 0.07); g.add(gr);
    lamps.red = red; lamps.green = green;
    const halo = RA.glowSprite(0xff3b2f, 0.55, 0); halo.position.set(0, 1.06, 0.12); g.add(halo);
    const haloG = RA.glowSprite(0x3bff7a, 0.55, 0); haloG.position.set(0, 0.9, 0.12); g.add(haloG);
    g.userData.set = function (state) {
      const isRed = state === 'red';
      red.emissiveIntensity = isRed ? 2.4 : 0.08; green.emissiveIntensity = isRed ? 0.08 : 2.4;
      halo.material.opacity = isRed ? 0.85 : 0; haloG.material.opacity = isRed ? 0 : 0.85;
    };
    g.userData.set('red');
    return g;
  };

  /* ================= ÇEVRE ================= */
  const LEAF = [0x5f9e3f, 0x4f8f39, 0x6fae47, 0x3f7f35, 0x7cb24c];
  M.tree = function (rnd, kind, scale) {
    const g = new T.Group();
    const s = scale || 1;
    kind = kind || (rnd() < 0.65 ? 'round' : 'cone');
    if (kind === 'round') {
      g.add(mesh(cyl(0.07 * s, 0.5 * s, 6), mat(0x7a5638), 0, 0.25 * s, 0));
      const c = mesh(RA.geo('ico1', () => new T.IcosahedronGeometry(0.42, 1)), mat(RA.pick(LEAF, rnd), { flatShading: true }), 0, 0.72 * s, 0);
      c.scale.setScalar(s * (0.85 + rnd() * 0.35)); g.add(c);
      if (rnd() < 0.5) { const c2 = mesh(RA.geo('ico1', () => new T.IcosahedronGeometry(0.42, 1)), mat(RA.pick(LEAF, rnd), { flatShading: true }), 0.18 * s, 0.98 * s, 0.05); c2.scale.setScalar(s * 0.55); g.add(c2); }
    } else if (kind === 'cone') {
      g.add(mesh(cyl(0.06 * s, 0.3 * s, 6), mat(0x6e4d33), 0, 0.15 * s, 0));
      const c = mesh(RA.geo('cone1', () => new T.ConeGeometry(0.36, 1.0, 7)), mat(RA.pick([0x3f7a3a, 0x2f6b3a, 0x497f3f], rnd), { flatShading: true }), 0, 0.75 * s, 0);
      c.scale.setScalar(s * (0.85 + rnd() * 0.3)); g.add(c);
    } else if (kind === 'palm') {
      const trunk = mesh(cyl(0.05 * s, 1.1 * s, 6), mat(0x8a6a48), 0, 0.55 * s, 0); trunk.rotation.z = 0.12; g.add(trunk);
      const top = new T.Group(); top.position.set(0.07 * s, 1.1 * s, 0); g.add(top);
      for (let i = 0; i < 6; i++) {
        const leaf = mesh(rb(0.62 * s, 0.03, 0.16 * s, 0.01), mat(RA.pick([0x2f6b45, 0x37784d, 0x2a5f40], rnd)), 0.28 * s, -0.08 * s, 0);
        const piv = new T.Group(); piv.rotation.y = (i / 6) * Math.PI * 2 + rnd() * 0.4; piv.rotation.z = -0.35; piv.add(leaf); top.add(piv);
      }
    }
    return g;
  };
  M.bush = function (rnd, s) {
    const c = mesh(RA.geo('ico0', () => new T.IcosahedronGeometry(0.25, 1)), mat(RA.pick(LEAF, rnd), { flatShading: true }), 0, 0.15 * (s || 1), 0);
    c.scale.set((s || 1) * 1.2, (s || 1) * 0.8, (s || 1)); return c;
  };
  M.house = function (w, d, h, wall, roof, rnd, opts) {
    opts = opts || {};
    const g = new T.Group();
    g.add(mesh(rb(w, h, d, 0.04), mat(wall), 0, h / 2, 0));
    // üçgen çatı
    const sh = new T.Shape(); sh.moveTo(-w / 2 - 0.08, 0); sh.lineTo(w / 2 + 0.08, 0); sh.lineTo(0, w * 0.42); sh.lineTo(-w / 2 - 0.08, 0);
    const rg = new T.ExtrudeGeometry(sh, { depth: d + 0.16, bevelEnabled: false }); rg.translate(0, 0, -(d + 0.16) / 2);
    g.add(mesh(rg, mat(roof), 0, h, 0));
    const win = opts.lit ? RA.glow(0xffc96b, 1.1) : mat(0x3a4a5a, { roughness: 0.3 });
    const nx = Math.max(1, Math.floor(w / 0.42));
    for (let i = 0; i < nx; i++) {
      const x = -w / 2 + (w / nx) * (i + 0.5);
      for (const z of [d / 2 + 0.005, -d / 2 - 0.005]) g.add(mesh(rb(0.16, 0.18, 0.02, 0.005), win, x, h * 0.55, z, false));
    }
    if (opts.door !== false) g.add(mesh(rb(0.16, 0.28, 0.02, 0.005), mat(0x6a4a34), 0, 0.14, d / 2 + 0.01, false));
    return g;
  };
  M.block = function (w, d, h, wall, rnd, opts) {
    // düz çatılı apartman/dükkân bloğu
    opts = opts || {};
    const g = new T.Group();
    g.add(mesh(rb(w, h, d, 0.05), mat(wall), 0, h / 2, 0));
    g.add(mesh(rb(w + 0.06, 0.06, d + 0.06, 0.02), mat(new T.Color(wall).multiplyScalar(0.82).getHex()), 0, h + 0.03, 0));
    const win = opts.lit ? RA.glow(0xffd27a, 1.0) : mat(0x34495e, { roughness: 0.25, metalness: 0.1 });
    const winOff = mat(0x34495e, { roughness: 0.25, metalness: 0.1 });
    const floors = Math.max(1, Math.floor((h - 0.3) / 0.42));
    const nx = Math.max(1, Math.floor(w / 0.4)), nz = Math.max(1, Math.floor(d / 0.4));
    for (let f = 0; f < floors; f++) {
      const y = 0.45 + f * 0.42;
      for (let i = 0; i < nx; i++) {
        const x = -w / 2 + (w / nx) * (i + 0.5);
        const m1 = opts.lit && rnd() < 0.55 ? win : winOff;
        g.add(mesh(rb(0.18, 0.2, 0.02, 0.005), m1, x, y, d / 2 + 0.005, false));
        g.add(mesh(rb(0.18, 0.2, 0.02, 0.005), opts.lit && rnd() < 0.5 ? win : winOff, x, y, -d / 2 - 0.005, false));
      }
      for (let i = 0; i < nz; i++) {
        const z = -d / 2 + (d / nz) * (i + 0.5);
        g.add(mesh(rb(0.02, 0.2, 0.18, 0.005), opts.lit && rnd() < 0.5 ? win : winOff, w / 2 + 0.005, y, z, false));
        g.add(mesh(rb(0.02, 0.2, 0.18, 0.005), opts.lit && rnd() < 0.5 ? win : winOff, -w / 2 - 0.005, y, z, false));
      }
    }
    if (opts.awning) g.add(mesh(rb(w * 0.8, 0.04, 0.26, 0.01), mat(opts.awning), 0, 0.38, d / 2 + 0.13));
    return g;
  };
  M.fence = function (len) {
    const g = new T.Group();
    const n = Math.max(2, Math.round(len / 0.35));
    for (let i = 0; i <= n; i++) g.add(mesh(rb(0.04, 0.22, 0.04, 0.01), WHITE, -len / 2 + (len * i) / n, 0.11, 0));
    g.add(mesh(rb(len, 0.03, 0.025, 0.01), WHITE, 0, 0.16, 0));
    g.add(mesh(rb(len, 0.03, 0.025, 0.01), WHITE, 0, 0.08, 0));
    return g;
  };
  M.lamp = function (lit) {
    const g = new T.Group();
    g.add(mesh(cyl(0.025, 0.95, 6), mat(0x3d4249), 0, 0.475, 0));
    g.add(mesh(rb(0.14, 0.05, 0.1, 0.02), mat(0x3d4249), 0.05, 0.96, 0));
    const bulb = new T.Mesh(rb(0.08, 0.02, 0.06, 0.01), lit ? RA.glow(0xffe2a8, 2.2) : mat(0xfff6dc)); bulb.position.set(0.07, 0.93, 0); g.add(bulb);
    return g;
  };

  M.station = function () {
    const g = new T.Group();
    // peron
    g.add(mesh(rb(5.6, 0.22, 1.0, 0.04), mat(0xc9c1b2), 0, 0.11, 0));
    g.add(mesh(rb(5.6, 0.03, 0.08, 0.01), mat(0xf2c94c), 0, 0.235, 0.42, false));
    // bina
    const b = M.house(1.9, 1.05, 0.85, 0xf1dfc0, 0xb5482f, null, { door: true });
    b.position.set(-0.4, 0.22, -0.95); g.add(b);
    // saçak
    for (const x of [-2.2, -1.0, 0.2, 1.4]) g.add(mesh(cyl(0.025, 0.6, 6), mat(0x5a4636), x, 0.52, 0.15));
    g.add(mesh(rb(4.2, 0.05, 0.7, 0.02), mat(0x8f3b27), -0.4, 0.84, 0.05));
    // bank ve tabela
    g.add(mesh(rb(0.5, 0.06, 0.16, 0.02), mat(0x7a5638), 1.9, 0.33, 0.0));
    const sign = mesh(rb(1.0, 0.24, 0.04, 0.02), mat(0x1f3b63), -0.4, 1.1, -0.38);
    g.add(sign);
    return g;
  };

  /* ================= KARAYOLU ================= */
  // Araç: uzunluk L, ön çıkıntı ovF, arka çıkıntı ovR; tekerlekler ayrı (ön tekerlekler direksiyonlu)
  function vehicleBase(L, W, ovF, ovR, wr) {
    const g = new T.Group();
    g.userData = { L, W, ovF, ovR, wheels: [], steer: [], wb: L - ovF - ovR };
    const xf = L / 2 - ovF, xr = -L / 2 + ovR;
    for (const [x, front] of [[xf, true], [xr, false]]) for (const z of [-W / 2 + 0.06, W / 2 - 0.06]) {
      const piv = new T.Group(); piv.position.set(x, wr, z);
      const w = wheel(wr, 0.1); piv.add(w); g.add(piv);
      g.userData.wheels.push(w); if (front) g.userData.steer.push(piv);
    }
    return g;
  }
  function addLights(g, L, W, y, h) {
    const head = RA.glow(0xfff6d8, 1.6);
    for (const z of [-W / 2 + 0.12, W / 2 - 0.12]) g.add(mesh(rb(0.03, h, 0.12, 0.01), head, L / 2 + 0.005, y, z, false));
    const brake = new T.MeshStandardMaterial({ color: 0x3a0a0a, emissive: 0xff2414, emissiveIntensity: 0.35, roughness: 0.4 });
    for (const z of [-W / 2 + 0.11, W / 2 - 0.11]) g.add(mesh(rb(0.03, h, 0.13, 0.01), brake, -L / 2 - 0.005, y, z, false));
    const halo = RA.glowSprite(0xff2a1a, 0.6, 0); halo.position.set(-L / 2 - 0.08, y, 0); halo.scale.set(W * 1.2, 0.35, 1); g.add(halo);
    g.userData.brake = brake; g.userData.brakeHalo = halo;
  }
  M.car = function (color) {
    const L = 1.45, W = 0.68;
    const g = vehicleBase(L, W, 0.3, 0.3, 0.13);
    g.add(mesh(rb(L, 0.27, W, 0.09), mat(color, { roughness: 0.35, metalness: 0.1 }), 0, 0.27, 0));
    g.add(mesh(rb(0.8, 0.25, W - 0.08, 0.08), mat(color, { roughness: 0.35, metalness: 0.1 }), -0.08, 0.5, 0));
    g.add(mesh(rb(0.72, 0.17, W - 0.04, 0.05), GLASS, -0.08, 0.5, 0, false));
    g.add(mesh(rb(0.62, 0.05, W - 0.14, 0.03), mat(color, { roughness: 0.35 }), -0.1, 0.63, 0));
    addLights(g, L, W, 0.3, 0.07);
    return g;
  };
  M.taxi = function () {
    const g = M.car(0xf7c21b);
    g.add(mesh(rb(0.26, 0.09, 0.2, 0.02), RA.glow(0xfff2a0, 0.9), -0.1, 0.71, 0, false));
    g.add(mesh(rb(1.2, 0.05, 0.69, 0.01), mat(0x222222), 0.02, 0.32, 0, false));
    return g;
  };
  M.bus = function (color) {
    const L = 3.3, W = 0.8;
    const g = vehicleBase(L, W, 0.62, 0.78, 0.16);
    const body = mat(color || 0x2a7fb8, { roughness: 0.45 });
    g.add(mesh(rb(L, 0.72, W, 0.1), body, 0, 0.55, 0));
    g.add(mesh(rb(L - 0.18, 0.24, W + 0.01, 0.04), GLASS, -0.05, 0.68, 0, false));
    g.add(mesh(rb(0.04, 0.34, W - 0.12, 0.02), GLASS, L / 2 + 0.005, 0.66, 0, false));
    g.add(mesh(rb(L - 0.1, 0.08, W - 0.04, 0.04), mat(0xf2f2f2), 0, 0.94, 0));
    g.add(mesh(rb(0.6, 0.1, W - 0.3, 0.03), mat(0xd8dcdf), -0.5, 1.0, 0));
    g.add(mesh(rb(0.03, 0.08, 0.42, 0.01), RA.glow(0xffb000, 1.2), L / 2 + 0.01, 0.88, 0, false));
    g.add(mesh(rb(L - 0.2, 0.05, W + 0.01, 0.01), mat(0xf2f2f2), 0, 0.42, 0, false));
    addLights(g, L, W, 0.3, 0.1);
    return g;
  };

  // Merkez trafik ışığı: dört yüzlü fener; her yüzde 3 lamba + üstte yöne bakan büyük ok lambaları (yukarıdan okunur)
  M.trafficLight = function () {
    const g = new T.Group();
    const lamps = { NS: [], EW: [] };
    const housing = mat(0x23272d, { roughness: 0.5 });
    g.add(mesh(rb(0.62, 0.5, 0.62, 0.1), housing, 0, 0, 0));
    g.add(mesh(rb(0.7, 0.05, 0.7, 0.03), mat(0xf2c230), 0, 0.27, 0));
    const sph = RA.geo('tlamp', () => new T.SphereGeometry(0.07, 14, 10));
    const faces = [
      { axis: 'NS', dx: 0, dz: -1 }, { axis: 'NS', dx: 0, dz: 1 },
      { axis: 'EW', dx: -1, dz: 0 }, { axis: 'EW', dx: 1, dz: 0 },
    ];
    const cols = { red: 0xff2a1f, yellow: 0xffb000, green: 0x22e06a };
    // üst yüz: her yöne bakan üçgen ok lamba
    const tri = new T.Shape(); tri.moveTo(-0.13, 0); tri.lineTo(0.13, 0); tri.lineTo(0, 0.17); tri.lineTo(-0.13, 0);
    const triG = RA.geo('tltri', () => { const e = new T.ExtrudeGeometry(tri, { depth: 0.04, bevelEnabled: false }); e.rotateX(-Math.PI / 2); return e; });
    faces.forEach((f) => {
      const set = {};
      ['red', 'yellow', 'green'].forEach((c, i) => {
        const m = new T.MeshStandardMaterial({ color: 0x111111, emissive: cols[c], emissiveIntensity: 0.06, roughness: 0.3 });
        const s = new T.Mesh(sph, m);
        const y = 0.13 - i * 0.13;
        s.position.set(f.dx * 0.31, y, f.dz * 0.31); g.add(s);
        set[c] = m;
      });
      const tm = new T.MeshStandardMaterial({ color: 0x111111, emissive: 0x22e06a, emissiveIntensity: 0.1, roughness: 0.3 });
      const t = new T.Mesh(triG, tm);
      t.position.set(f.dx * 0.16, 0.3, f.dz * 0.16);
      t.rotation.y = Math.atan2(f.dx, f.dz);
      g.add(t);
      set.top = tm;
      const halo = RA.glowSprite(0x22e06a, 0.9, 0); halo.position.set(f.dx * 0.3, 0.36, f.dz * 0.3); g.add(halo);
      set.halo = halo;
      lamps[f.axis].push(set);
    });
    g.userData.lamps = lamps;
    g.userData.setAxis = function (axis, state) {
      const col = state === 'green' ? 0x22e06a : state === 'yellow' ? 0xffb000 : 0xff2a1f;
      const off = state !== 'green' && state !== 'yellow' && state !== 'red';
      lamps[axis].forEach((set) => {
        set.red.emissiveIntensity = state === 'red' ? 2.8 : 0.06;
        set.yellow.emissiveIntensity = state === 'yellow' ? 2.8 : 0.06;
        set.green.emissiveIntensity = state === 'green' ? 2.8 : 0.06;
        set.top.emissive.setHex(col); set.top.emissiveIntensity = off ? 0.08 : 2.4;
        set.halo.material.color.setHex(col); set.halo.material.opacity = off ? 0 : state === 'green' ? 0.9 : 0.55;
      });
    };
    return g;
  };

  // Atölye için hafif ışık başı: yukarıdan okunan dört üçgen lamba
  M.trafficLightLite = function () {
    const g = new T.Group();
    g.add(mesh(rb(0.62, 0.42, 0.62, 0.1), mat(0x23272d, { roughness: 0.5 }), 0, 0, 0));
    const tri = new T.Shape(); tri.moveTo(-0.15, 0); tri.lineTo(0.15, 0); tri.lineTo(0, 0.2); tri.lineTo(-0.15, 0);
    const triG = RA.geo('tltri2', () => { const e = new T.ExtrudeGeometry(tri, { depth: 0.05, bevelEnabled: false }); e.rotateX(-Math.PI / 2); return e; });
    const lamps = { NS: [new T.MeshStandardMaterial({ color: 0x111111, emissive: 0xff2a1f, emissiveIntensity: 2.4, roughness: 0.3 })], EW: [new T.MeshStandardMaterial({ color: 0x111111, emissive: 0xff2a1f, emissiveIntensity: 2.4, roughness: 0.3 })] };
    [['NS', 0, -1], ['NS', 0, 1], ['EW', -1, 0], ['EW', 1, 0]].forEach(([ax, dx, dz]) => {
      const t = new T.Mesh(triG, lamps[ax][0]); t.position.set(dx * 0.14, 0.23, dz * 0.14); t.rotation.y = Math.atan2(dx, dz); g.add(t);
    });
    RA.compact(g);
    const halo = RA.glowSprite(0xffffff, 1.0, 0.55); halo.position.set(0, 0.32, 0); g.add(halo);
    g.userData.setAxis = function (axis, state) {
      const col = state === 'green' ? 0x22e06a : state === 'yellow' ? 0xffb000 : 0xff2a1f;
      const off = state !== 'green' && state !== 'yellow' && state !== 'red';
      lamps[axis].forEach((m) => { m.emissive.setHex(col); m.emissiveIntensity = off ? 0.08 : 2.4; });
      if (axis === 'NS') g.userData.ns = state; else g.userData.ew = state;
      const any = g.userData.ns === 'green' || g.userData.ew === 'green' ? 0x22e06a : g.userData.ns === 'yellow' || g.userData.ew === 'yellow' ? 0xffb000 : 0xff3a2a;
      halo.material.color.setHex(any); halo.material.opacity = off && (g.userData.ns !== 'yellow' && g.userData.ew !== 'yellow') ? 0.08 : 0.5;
    };
    return g;
  };
  // Atölye için hafif ray sinyali: direk + tek renk değiştiren lamba
  M.signalLite = function () {
    const g = new T.Group();
    g.add(mesh(cyl(0.035, 0.9, 8), mat(0x50555c), 0, 0.45, 0));
    g.add(mesh(rb(0.16, 0.22, 0.12, 0.04), mat(0x24272c), 0, 0.95, 0));
    RA.compact(g);
    const lm = new T.MeshStandardMaterial({ color: 0x111111, emissive: 0xff2a1f, emissiveIntensity: 2.4 });
    const l = new T.Mesh(RA.geo('lamp', () => new T.SphereGeometry(0.055, 12, 8)), lm); l.position.set(0, 0.97, 0.07); g.add(l);
    const halo = RA.glowSprite(0xff3b2f, 0.55, 0.8); halo.position.set(0, 0.97, 0.12); g.add(halo);
    g.userData.set = function (s) { const c = s === 'red' ? 0xff2a1f : 0x2bff6a; lm.emissive.setHex(c); halo.material.color.setHex(c); };
    return g;
  };

  /* ================= HAVA ================= */
  M.plane = function (livery) {
    const g = new T.Group();
    g.rotation.order = 'YZX';
    const body = new T.Group(); g.add(body);
    const white = mat(0xf6f6f2, { roughness: 0.35 });
    const tailM = mat(livery, { roughness: 0.4 });
    const fus = mesh(RA.geo('fus', () => new T.CylinderGeometry(0.15, 0.15, 1.3, 16)), white, 0, 0, 0); fus.rotation.z = Math.PI / 2; body.add(fus);
    const nose = mesh(RA.geo('nose', () => { const s = new T.SphereGeometry(0.15, 16, 10); s.scale(1.9, 1, 1); return s; }), white, 0.63, -0.005, 0); body.add(nose);
    const tail = mesh(RA.geo('tailc', () => new T.ConeGeometry(0.15, 0.55, 16)), white, -0.9, 0.04, 0); tail.rotation.z = Math.PI / 2; tail.scale.set(1, 1, 0.85); body.add(tail);
    // kokpit camı ve pencere şeridi
    body.add(mesh(rb(0.12, 0.05, 0.2, 0.02), GLASS, 0.82, 0.07, 0, false));
    body.add(mesh(rb(1.15, 0.035, 0.305, 0.015), mat(0x2d3a4a), -0.02, 0.05, 0, false));
    body.add(mesh(rb(1.3, 0.04, 0.31, 0.02), tailM, -0.05, -0.07, 0, false));
    // kanatlar (ok açılı)
    const wingShape = new T.Shape();
    wingShape.moveTo(0.18, 0); wingShape.lineTo(-0.12, 0.92); wingShape.lineTo(-0.3, 0.92); wingShape.lineTo(-0.28, 0); wingShape.lineTo(0.18, 0);
    const wg = RA.geo('wing', () => { const e = new T.ExtrudeGeometry(wingShape, { depth: 0.04, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 1 }); e.rotateX(Math.PI / 2); return e; });
    for (const sz of [1, -1]) {
      const w = mesh(wg, white, 0.05, -0.06, 0); w.scale.z = sz; body.add(w);
      const eng = mesh(RA.geo('eng', () => new T.CylinderGeometry(0.065, 0.075, 0.28, 12)), tailM, 0.12, -0.14, sz * 0.38); eng.rotation.z = Math.PI / 2; body.add(eng);
      const tip = new T.Mesh(RA.geo('tip', () => new T.SphereGeometry(0.035, 8, 6)), RA.glow(sz > 0 ? 0x33ff66 : 0xff3333, 2.5));
      tip.position.set(-0.2, -0.04, sz * 0.93); body.add(tip);
    }
    // kuyruk
    const finShape = new T.Shape(); finShape.moveTo(0, 0); finShape.lineTo(-0.32, 0.42); finShape.lineTo(-0.44, 0.42); finShape.lineTo(-0.36, 0); finShape.lineTo(0, 0);
    const fin = mesh(RA.geo('fin', () => new T.ExtrudeGeometry(finShape, { depth: 0.03, bevelEnabled: false })), tailM, -0.8, 0.08, -0.015); body.add(fin);
    const stabShape = new T.Shape(); stabShape.moveTo(0, 0); stabShape.lineTo(-0.16, 0.36); stabShape.lineTo(-0.26, 0.36); stabShape.lineTo(-0.24, 0); stabShape.lineTo(0, 0);
    const sg = RA.geo('stab', () => { const e = new T.ExtrudeGeometry(stabShape, { depth: 0.025, bevelEnabled: false }); e.rotateX(Math.PI / 2); return e; });
    for (const sz of [1, -1]) { const s = mesh(sg, white, -0.86, 0.03, 0); s.scale.z = sz; body.add(s); }
    // iniş takımı
    const gear = new T.Group();
    for (const [x, z] of [[0.55, 0], [-0.05, 0.12], [-0.05, -0.12]]) {
      gear.add(mesh(cyl(0.012, 0.16, 6), DARK, x, -0.2, z));
      const w = wheel(0.04, 0.04); w.position.set(x, -0.28, z); gear.add(w);
    }
    gear.visible = false; body.add(gear);
    // ışıklar
    const strobe = RA.glowSprite(0xffffff, 0.5, 0); strobe.position.set(-1.0, 0.25, 0); body.add(strobe);
    const landing = RA.glowSprite(0xfff3c8, 0.9, 0); landing.position.set(0.95, -0.05, 0); body.add(landing);
    const beacon = RA.glowSprite(0xff4a3a, 0.4, 0.8); beacon.position.set(0, 0.2, 0); body.add(beacon);
    g.userData = { body, gear, strobe, landing, beacon };
    body.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
    return g;
  };
})();
