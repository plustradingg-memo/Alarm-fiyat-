/* RAY ARASI — Şehir: talepler (mahalle, okul, AVM, istasyon…), büyüyen trafik, memnuniyet ve sıkışan kavşaklar */
(function () {
  'use strict';
  const RA = window.RA;
  const WS = RA.WS;
  const T = THREE;
  const M = RA.M;
  const { DV } = WS;
  const rb = RA.rbox, mesh = RA.mesh;

  // Talep türleri. need: bağlanması gereken hat ailesi (o karede çıkmaz uç olmalı).
  // w: trafiğe katkı, pull: araç çekme, emit: araç gönderme, cap: içerideki araç yeri, start: bağlanınca içerideki araç
  const TYPES = {
    mahalle: { name: 'Mahalle', need: 'road', cap: 8, w: 5, pull: 0.8, emit: 1.6, start: 5, pop: 1500, col: '#e0662a', ask: 'Yeni mahalle yol istiyor' },
    okul: { name: 'Okul', need: 'road', cap: 6, w: 3.5, pull: 1.3, emit: 0.9, start: 1, pop: 250, col: '#d99a00', ask: 'Okul yol istiyor' },
    avm: { name: 'AVM', need: 'road', cap: 10, w: 4.5, pull: 1.7, emit: 1.1, start: 2, pop: 300, col: '#7a4fc2', ask: 'AVM yol istiyor' },
    ofis: { name: 'Ofis', need: 'road', cap: 8, w: 4, pull: 1.4, emit: 1.0, start: 1, pop: 400, col: '#2f6fd6', ask: 'Ofis binası yol istiyor' },
    hastane: { name: 'Hastane', need: 'road', cap: 6, w: 3, pull: 1.1, emit: 0.9, start: 1, pop: 200, col: '#d8432f', ask: 'Hastane yol istiyor' },
    fabrika: { name: 'Fabrika', need: 'road', cap: 8, w: 4, pull: 1.2, emit: 1.0, start: 2, pop: 350, col: '#5f6b78', ask: 'Fabrika yol istiyor' },
    stadyum: { name: 'Stadyum', need: 'road', cap: 12, w: 6, pull: 1.9, emit: 1.2, start: 0, pop: 0, col: '#1f9d61', ask: 'Stadyum yol istiyor' },
    istasyon: { name: 'İstasyon', need: 'rail', trains: 1, pop: 500, col: '#d9861a', ask: 'Yeni istasyon ray istiyor' },
    kapi: { name: 'Kapı', need: 'taxi', planes: 1, pop: 500, col: '#4d7cff', ask: 'Yeni yolcu kapısı taksi yolu istiyor' },
  };
  const HOW = { road: 'Yolu bu kareye kadar çiz; yol binada bitsin.', rail: 'Hattan bu kareye bir ray kolu çek; ray burada bitsin.', taxi: 'Taksi yolunu bu kareye uzat; burada bitsin.' };
  // Hangi sırayla talep gelir (kart türüne göre)
  const ORDER = {
    road: ['mahalle', 'okul', 'mahalle', 'avm', 'ofis', 'mahalle', 'hastane', 'fabrika', 'mahalle', 'stadyum', 'avm', 'ofis', 'mahalle', 'okul'],
    rail: ['istasyon', 'mahalle', 'okul', 'istasyon', 'avm', 'mahalle', 'istasyon', 'fabrika', 'ofis', 'mahalle', 'istasyon', 'hastane'],
    air: ['kapi', 'mahalle', 'avm', 'kapi', 'ofis', 'mahalle', 'kapi', 'okul', 'hastane', 'kapi', 'fabrika', 'mahalle'],
  };
  const MAX_PLACES = 16, MAX_WAITING = 3;
  const upTR = (s) => s.toLocaleUpperCase('tr-TR');

  /* ---------- yer modelleri (yerel +z yola bakar, taban yaklaşık x∈[-0.95,0.95], z∈[-0.55,0.45]) ---------- */
  function placeModel(type, seed) {
    const g = new T.Group();
    const rnd = RA.rng(seed || 7);
    const mat = RA.mat;
    if (type === 'mahalle') {
      const walls = [0xf2d7b6, 0xe9e3d3, 0xf5e6c4, 0xdfe7ea, 0xf1c9b5], roofs = [0xc0573c, 0x8e4a3a, 0xb5482f, 0x5c6f7d];
      for (const x of [-0.64, 0, 0.64]) { const h = M.house(0.52, 0.5, 0.34 + rnd() * 0.1, RA.pick(walls, rnd), RA.pick(roofs, rnd), rnd); h.position.set(x, 0, -0.08 + (rnd() - 0.5) * 0.1); g.add(h); }
    } else if (type === 'okul') {
      const b = M.block(1.55, 0.72, 0.9, 0xf2d49b, rnd); b.position.set(-0.12, 0, -0.08); g.add(b);
      g.add(mesh(rb(1.6, 0.08, 0.76, 0.02), mat(0xc0573c), -0.12, 0.92, -0.08));
      g.add(mesh(RA.geo('flagpole', () => new T.CylinderGeometry(0.018, 0.018, 1.25, 6)), mat(0xd0d4d8), 0.82, 0.62, 0.28));
      const fl = mesh(RA.geo('flag', () => new T.BoxGeometry(0.3, 0.19, 0.01)), mat(0xe30a17), 0.97, 1.13, 0.28, false); g.add(fl);
    } else if (type === 'avm') {
      const b = M.block(1.85, 0.8, 0.72, 0xe9edf0, rnd, { awning: 0xd8432f }); b.position.set(0, 0, -0.12); g.add(b);
      g.add(mesh(rb(1.7, 0.2, 0.02, 0.005), RA.glow(0x8fd3ff, 0.55), 0, 0.56, 0.29, false));
      g.add(mesh(rb(0.9, 0.2, 0.05, 0.02), mat(0x7a4fc2), 0, 0.84, 0.25));
    } else if (type === 'ofis') {
      const b = M.block(0.9, 0.72, 2.1, 0x8fb3c9, rnd); b.position.set(-0.4, 0, -0.1); g.add(b);
      const a = M.block(0.8, 0.6, 0.62, 0xd5dde3, rnd); a.position.set(0.5, 0, -0.05); g.add(a);
    } else if (type === 'hastane') {
      const b = M.block(1.5, 0.74, 1.15, 0xf6f7f8, rnd); b.position.set(-0.15, 0, -0.1); g.add(b);
      const red = mat(0xe02b23);
      g.add(mesh(rb(0.34, 0.1, 0.03, 0.01), red, -0.15, 0.95, 0.29, false)); g.add(mesh(rb(0.1, 0.34, 0.03, 0.01), red, -0.15, 0.95, 0.29, false));
      g.add(mesh(rb(0.36, 0.03, 0.1, 0.01), red, -0.15, 1.2, -0.1, false)); g.add(mesh(rb(0.1, 0.03, 0.36, 0.01), red, -0.15, 1.2, -0.1, false));
    } else if (type === 'fabrika') {
      g.add(mesh(rb(1.6, 0.5, 0.82, 0.03), mat(0xb7a58c), -0.1, 0.25, -0.12));
      const saw = RA.geo('saw', () => { const sh = new T.Shape(); sh.moveTo(0, 0); sh.lineTo(0.52, 0); sh.lineTo(0, 0.26); sh.lineTo(0, 0); const e = new T.ExtrudeGeometry(sh, { depth: 0.8, bevelEnabled: false }); e.translate(0, 0, -0.4); return e; });
      for (let a = 0; a < 3; a++) g.add(mesh(saw, mat(0x8a96a3), -0.86 + a * 0.52, 0.5, -0.12));
      g.add(mesh(RA.geo('chim', () => new T.CylinderGeometry(0.08, 0.1, 1.5, 10)), mat(0xe9e3d3), 0.78, 0.75, -0.3));
      for (const y of [1.15, 1.4]) g.add(mesh(RA.geo('chimb', () => new T.CylinderGeometry(0.087, 0.087, 0.1, 10)), mat(0xd8432f), 0.78, y, -0.3, false));
    } else if (type === 'stadyum') {
      const bowl = mesh(RA.geo('bowl', () => new T.CylinderGeometry(1, 0.82, 0.42, 28, 1, true)), mat(0xdfe3e6, { side: T.DoubleSide }), 0, 0.21, -0.12);
      bowl.scale.set(0.95, 1, 0.5); g.add(bowl);
      const pitch = mesh(RA.geo('pitch', () => new T.CircleGeometry(0.82, 28)), mat(0x3fae4f), 0, 0.03, -0.12, false); pitch.rotation.x = -Math.PI / 2; pitch.scale.set(0.95, 0.5, 1); g.add(pitch);
      g.add(mesh(rb(0.02, 0.01, 0.6, 0.004), mat(0xffffff), 0, 0.045, -0.12, false));
      for (const x of [-0.78, 0.78]) g.add(mesh(RA.geo('mast', () => new T.CylinderGeometry(0.02, 0.02, 0.9, 6)), mat(0x9aa1aa), x, 0.45, -0.12));
    } else if (type === 'istasyon') {
      const h = M.house(1.0, 0.42, 0.4, 0xf1dfc0, 0xb5482f, rnd); g.add(h);
    } else if (type === 'kapi') {
      g.add(mesh(rb(1.5, 0.42, 0.3, 0.03), mat(0xdfe5ea), 0, 0.21, 0));
      g.add(mesh(rb(1.4, 0.16, 0.02, 0.005), RA.glow(0x8fd3ff, 0.5), 0, 0.27, 0.16, false));
    }
    return g;
  }
  WS.placeModel = placeModel;

  // Ad levhası dokusu (bina tabelası)
  const texCache = {};
  function signTex(type) {
    if (texCache[type]) return texCache[type];
    const t = TYPES[type];
    const c = document.createElement('canvas'); c.width = 256; c.height = 96; const g = c.getContext('2d');
    g.fillStyle = '#ffffff'; roundRect(g, 0, 0, 256, 96, 18); g.fill();
    g.fillStyle = t.col; roundRect(g, 7, 7, 242, 82, 13); g.fill();
    g.fillStyle = '#ffffff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const txt = upTR(t.name); let fs = 50; g.font = '900 ' + fs + 'px Overpass, Arial, sans-serif';
    while (g.measureText(txt).width > 220 && fs > 24) { fs -= 2; g.font = '900 ' + fs + 'px Overpass, Arial, sans-serif'; }
    g.fillText(txt, 128, 54);
    const tx = new T.CanvasTexture(c); tx.encoding = T.sRGBEncoding; texCache[type] = tx; return tx;
  }
  WS.placeSignTex = signTex;
  // Bekleyen talep işareti: ünlemli ad levhası ve aşağı bakan uç
  function pinTex(type, urgent) {
    const key = 'pin' + type + (urgent ? 1 : 0);
    if (texCache[key]) return texCache[key];
    const t = TYPES[type];
    const c = document.createElement('canvas'); c.width = 320; c.height = 150; const g = c.getContext('2d');
    const col = urgent ? '#e5372d' : '#ff8a1f';
    g.fillStyle = 'rgba(0,0,0,0.25)'; roundRect(g, 6, 10, 308, 96, 26); g.fill();
    g.fillStyle = '#ffffff'; roundRect(g, 2, 2, 308, 96, 26); g.fill();
    g.fillStyle = col; roundRect(g, 9, 9, 294, 82, 20); g.fill();
    g.beginPath(); g.moveTo(132, 96); g.lineTo(156, 140); g.lineTo(180, 96); g.closePath(); g.fillStyle = '#ffffff'; g.fill();
    g.beginPath(); g.moveTo(140, 90); g.lineTo(156, 122); g.lineTo(172, 90); g.closePath(); g.fillStyle = col; g.fill();
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(54, 50, 28, 0, Math.PI * 2); g.fill();
    g.fillStyle = col; g.font = '900 44px Overpass, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('!', 54, 54);
    g.fillStyle = '#ffffff'; g.textAlign = 'left';
    const txt = upTR(t.name); let fs = 46; g.font = '900 ' + fs + 'px Overpass, Arial, sans-serif';
    while (g.measureText(txt).width > 205 && fs > 22) { fs -= 2; g.font = '900 ' + fs + 'px Overpass, Arial, sans-serif'; }
    g.fillText(txt, 94, 56);
    const tx = new T.CanvasTexture(c); tx.encoding = T.sRGBEncoding; texCache[key] = tx; return tx;
  }
  function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

  /* ================= Şehir ================= */
  class City {
    constructor(ws) {
      this.ws = ws;
      this.g = new T.Group(); ws.scene.add(this.g);
      this.ghostMat = new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false });
      this.ringMat = new T.MeshBasicMaterial({ color: 0xff8a1f, transparent: true, opacity: 0.9, depthWrite: false });
      this.jamMat = new T.MeshBasicMaterial({ color: 0xff2a1f, transparent: true, opacity: 0.6, depthWrite: false });
      this.jamRings = [];
      this.reset();
    }
    reset() {
      this.places = []; this.t = 0; this.seq = 0; this.nextT = 6; this.mood = 80; this.ema = 0; this.uid = 1;
      this.jams = []; this.jt = 0; this.saveT = 0; this.jamHintT = 0; this.focusN = 0;
      this.rnd = RA.rng(City.seed != null ? City.seed : (Date.now() % 100000) + 17); // testler sabit tohum verebilir
      this.clearVisuals();
    }
    load(data) {
      this.reset();
      if (!data || !data.places) return;
      this.t = data.t || 0; this.seq = data.seq || 0; this.nextT = data.nextT != null ? data.nextT : 6;
      this.mood = data.mood != null ? data.mood : 80; this.ema = data.ema || 0;
      this.places = data.places.filter((p) => TYPES[p.type]).map((p) => ({ id: this.uid++, i: p.i, j: p.j, type: p.type, age: p.age || 0, cAge: p.cAge || 0, conn: !!p.conn, face: p.face || 'S' }));
    }
    serialize() {
      return { v: 1, t: Math.round(this.t), seq: this.seq, nextT: Math.round(this.nextT * 10) / 10, mood: Math.round(this.mood), ema: Math.round(this.ema * 100) / 100, places: this.places.map((p) => ({ i: p.i, j: p.j, type: p.type, age: Math.round(p.age), cAge: Math.round(p.cAge), conn: p.conn, face: p.face })) };
    }
    type(p) { return TYPES[p.type]; }
    placeAt(i, j) { return this.places.find((p) => p.i === i && p.j === j) || null; }
    map() { const m = new Map(); for (const p of this.places) m.set(p.i + ',' + p.j, p); return m; }
    waiting() { return this.places.filter((p) => !p.conn); }
    connected(kind) { return this.places.filter((p) => p.conn && (!kind || TYPES[p.type].need === kind)).length; }
    population() {
      let n = 1200;
      for (const p of this.places) if (p.conn) n += TYPES[p.type].pop * (0.45 + 0.55 * Math.min(1, p.cAge / 90));
      return Math.round(n / 10) * 10;
    }
    // trafiğe katkı (bağlanalı ne kadar olduysa o kadar büyür)
    weight(p) { const t = TYPES[p.type]; return (t.w || 0) * (0.55 + 0.45 * Math.min(1, p.cAge / 75)); }

    /* ---------- ızgara ile eşitleme: bağlandı mı? ---------- */
    sync(grid) {
      const events = [];
      this.places = this.places.filter((p) => {
        const c = grid.cell(p.i, p.j); if (!c) return false;
        const need = TYPES[p.type].need;
        const q = c.pieces[0];
        const dead = c.pieces.length === 1 && q.type === need && WS.portCount(q.m) === 1 && q.lv === 0;
        if (dead) { if (!p.conn) { p.conn = true; p.cAge = 0; events.push(p); } p.face = WS.ports(q.m)[0]; return true; }
        if (c.pieces.length) return false; // kareye başka bir şey yapıldı: talep kalkar
        p.conn = false;
        return true;
      });
      return events;
    }

    /* ---------- yeni talep ---------- */
    hasFamily(fam) { let n = 0; this.ws.grid.each((c) => { if (c.pieces.some((q) => q.type === fam)) n++; }); return n > 0; }
    pickCell(need, want) {
      const g = this.ws.grid, W = g.cols, H = g.rows;
      // ailenin parçalarından boş karelere doğru yayılan uzaklık
      const dist = new Int16Array(W * H).fill(-1), face = new Array(W * H).fill(null);
      const q = [];
      g.each((c, i, j) => { if (c.pieces.some((p) => p.type === need)) { dist[j * W + i] = 0; q.push([i, j]); } });
      const taken = this.map();
      while (q.length) {
        const [i, j] = q.shift(); const d0 = dist[j * W + i];
        if (d0 >= 3) continue;
        for (const d of ['N', 'E', 'S', 'W']) {
          const ni = i + DV[d].x, nj = j + DV[d].z;
          if (!g.inside(ni, nj) || dist[nj * W + ni] >= 0) continue;
          const c = g.cell(ni, nj); if (c.pieces.length || taken.has(ni + ',' + nj)) continue;
          dist[nj * W + ni] = d0 + 1; face[nj * W + ni] = WS.OPP[d]; q.push([ni, nj]);
        }
      }
      const near = (i, j) => this.places.some((p) => Math.abs(p.i - i) <= 1 && Math.abs(p.j - j) <= 1);
      const cand = [];
      g.each((c, i, j) => {
        const d = dist[j * W + i];
        if (d < 1 || near(i, j) || j === 0) return; // en üst sıradaki işaret üst şeridin altında kalırdı
        // kenardaki kareler biraz daha az tercih edilir
        const edge = i === 0 || j === 0 || i === W - 1 || j === H - 1;
        cand.push({ i, j, d, face: face[j * W + i], s: (d === want ? 3 : d === want + 1 || d === want - 1 ? 1.2 : 0.4) * (edge ? 0.5 : 1) * (0.5 + this.rnd()) });
      });
      if (!cand.length) return null;
      cand.sort((a, b) => b.s - a.s);
      return cand[0];
    }
    trySpawn() {
      const order = ORDER[this.ws.domain] || ORDER.road;
      let type = order[this.seq % order.length];
      if (TYPES[type].need !== 'road' && !this.hasFamily(TYPES[type].need)) type = 'mahalle';
      const need = TYPES[type].need;
      if (!this.hasFamily(need)) return false;
      const want = this.seq < 2 ? 1 : RA.pick([1, 2, 2, 3], this.rnd);
      const c = this.pickCell(need, need === 'road' ? want : Math.min(2, want));
      if (!c) return false;
      const p = { id: this.uid++, i: c.i, j: c.j, type, age: 0, cAge: 0, conn: false, face: c.face || 'S' };
      this.places.push(p); this.seq++;
      this.ws.rebuild(); this.ws.save();
      this.ws.onDemand(p);
      return true;
    }

    /* ---------- adım ---------- */
    update(dt) {
      this.t += dt;
      for (const p of this.places) { p.age += dt; if (p.conn) p.cAge += dt; }
      const waiting = this.waiting().length;
      this.nextT -= dt;
      if (this.nextT <= 0) {
        if (waiting < MAX_WAITING && this.places.length < MAX_PLACES && this.trySpawn()) this.nextT = 26 + this.rnd() * 14 + waiting * 10;
        else this.nextT = 8;
      }
      this.jt -= dt; if (this.jt <= 0) { this.jt = 0.5; this.measureJams(); }
      // memnuniyet: araçların durarak geçirdiği süre, sıkışan kavşaklar, uzun süre bekleyen talepler
      const waitPen = Math.min(40, Math.max(0, this.ema - 2.5) * 3.2);
      const jamPen = Math.min(30, this.jams.length * 9);
      let stuck = 0; for (const c of this.ws.sim.cars) if (!c.fade && c.still > 20) stuck++;
      const stuckPen = Math.min(25, stuck * 2.5);
      let demPen = 0; for (const p of this.places) if (!p.conn) demPen += RA.clamp((p.age - 40) / 5, 0, 12);
      const bonus = Math.min(12, this.connected() * 1.5);
      const target = RA.clamp(92 + bonus - waitPen - jamPen - stuckPen - Math.min(40, demPen), 0, 100);
      this.mood += (target - this.mood) * Math.min(1, dt * 0.15);
      this.jamHintT = Math.max(0, this.jamHintT - dt);
      this.saveT += dt; if (this.saveT > 10) { this.saveT = 0; this.ws.saveCity(); }
    }
    onTrip(c) { this.ema += ((c.stopT || 0) - this.ema) * 0.08; }
    onGiveUp(c) { this.ema += (60 - this.ema) * 0.08; this.mood = Math.max(0, this.mood - 3); this.giveUps = (this.giveUps || 0) + 1; }

    // Kavşak/geçit önünde duran araçları say: 5+ araç ya da 15 sn'den uzun bekleme = sıkışma
    measureJams() {
      const sim = this.ws.sim, net = this.ws.net; if (!net) return;
      const q = new Map();
      const keyOf = (m) => {
        if (!m || m.exit || m.i == null) return null;
        const jk = m.i + ',' + m.j + ',' + m.k;
        if (sim.jc.has(jk) || net.yieldAt.has(jk)) return jk;
        if (sim.xc.has('c' + m.i + ',' + m.j)) return m.i + ',' + m.j + ',x';
        return null;
      };
      for (const c of sim.cars) {
        if (c.fade || c.v > 0.2) continue;
        let key = null, m = null;
        for (let n = 0; n < Math.min(4, c.plan.length) && !key; n++) { m = c.plan[n]; key = keyOf(m); }
        if (!key) continue;
        const e = q.get(key) || { n: 0, w: 0, i: m.i, j: m.j }; e.n++; e.w = Math.max(e.w, c.still || 0); q.set(key, e);
      }
      this.jams = [...q.values()].filter((e) => e.n >= 5 || e.w > 15).sort((a, b) => b.n - a.n);
      if (this.jams.length && !this.jamHintT && this.ws.tool === 'look') {
        this.jamHintT = 75;
        this.ws.toast('Trafik sıkıştı! Kavşağı köprü ya da alt geçitle ayır, ya da trafiği dağıtacak yeni bir yol aç.');
      }
    }

    /* ---------- görseller ---------- */
    clearVisuals() { while (this.g.children.length) this.g.remove(this.g.children[0]); this.pins = []; this.jamRings = []; }
    rebuildVisuals(net) {
      this.clearVisuals();
      for (const p of this.places) {
        if (p.conn) continue;
        const x = net.cx(p.i), z = net.cz(p.j), d = p.face || 'S';
        const grp = new T.Group(); grp.position.set(x, 0, z);
        // zemin çerçevesi
        const ring = new T.Mesh(RA.geo('dring', () => new T.RingGeometry(1.08, 1.24, 4, 1, Math.PI / 4)), this.ringMat);
        ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05; ring.renderOrder = 4; grp.add(ring);
        // yarı saydam bina taslağı
        const gh = placeModel(p.type, p.i * 31 + p.j * 7);
        gh.traverse((o) => { if (o.isMesh) { o.material = this.ghostMat; o.castShadow = false; o.receiveShadow = false; } });
        gh.position.set(-DV[d].x * 0.4, 0, -DV[d].z * 0.4); gh.rotation.y = Math.atan2(DV[d].x, DV[d].z);
        grp.add(gh);
        // talep işareti
        const sp = new T.Sprite(new T.SpriteMaterial({ map: pinTex(p.type, false), depthTest: false, transparent: true }));
        sp.center.set(0.5, 0); sp.renderOrder = 20; sp.position.y = 1.5; grp.add(sp);
        this.g.add(grp);
        this.pins.push({ p, sp, grp, urgent: false });
      }
      // bağlı istasyon/kapı levhaları
      for (const p of this.places) {
        if (!p.conn || TYPES[p.type].need === 'road') continue;
        const sp = new T.Sprite(new T.SpriteMaterial({ map: signTex(p.type), transparent: true }));
        sp.center.set(0.5, 0); sp.scale.set(1.3, 0.49, 1); sp.position.set(net.cx(p.i), 1.0, net.cz(p.j)); this.g.add(sp);
      }
      for (let n = 0; n < 8; n++) {
        const r = new T.Mesh(RA.geo('jring', () => new T.RingGeometry(1.0, 1.28, 36)), this.jamMat);
        r.rotation.x = -Math.PI / 2; r.position.y = 0.09; r.visible = false; r.renderOrder = 4; this.g.add(r); this.jamRings.push(r);
      }
    }
    visuals(now, viewD) {
      const s = RA.clamp(viewD / 50, 0.8, 2.3);
      for (const pin of this.pins) {
        const urgent = pin.p.age > 45;
        if (urgent !== pin.urgent) { pin.urgent = urgent; pin.sp.material.map = pinTex(pin.p.type, urgent); pin.sp.material.needsUpdate = true; }
        pin.sp.scale.set(2.3 * s, 2.3 * s * (150 / 320), 1);
        pin.sp.position.y = 1.45 + Math.sin(now * 3 + pin.p.id) * 0.12;
      }
      this.ringMat.opacity = 0.6 + Math.sin(now * 4) * 0.3;
      const net = this.ws.net;
      this.jamRings.forEach((r, n) => {
        const e = this.jams[n];
        r.visible = !!e;
        if (e) { r.position.x = net.cx(e.i); r.position.z = net.cz(e.j); }
      });
      this.jamMat.opacity = 0.35 + (Math.sin(now * 5) * 0.5 + 0.5) * 0.45;
    }
  }
  City.TYPES = TYPES;
  City.HOW = HOW;
  WS.City = City;
})();
