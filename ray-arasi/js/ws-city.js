/* RAY ARASI — Şehir: talepler (mahalle, okul, AVM, istasyon…), büyüyen trafik, memnuniyet ve sıkışan kavşaklar */
(function () {
  'use strict';
  const RA = window.RA;
  const WS = RA.WS;
  const T = THREE;
  const M = RA.M;
  const { DV } = WS;
  const rb = RA.rbox, mesh = RA.mesh;

  // Talep türleri. need: bağlanması gereken hat ailesi (o karede çıkmaz uç olmalı). role: yolculuk mantığı
  // (evden işe, okula, alışverişe; oradan eve). res: sakin, jobs: iş/hizmet yeri (yer büyüdükçe dolar).
  // cap: içerideki araç yeri, start: bağlanınca içerideki araç, w: trafiğe katkı, unlock: talep edilebildiği aşama.
  const TYPES = {
    mahalle: { name: 'Mahalle', need: 'road', role: 'home', cap: 8, w: 3.6, emit: 1.5, start: 4, res: 1000, jobs: 0, unlock: 0, col: '#e0662a', why: 'Yeni aileler geliyor', ask: 'Mahalle yol istiyor' },
    okul: { name: 'Okul', need: 'road', role: 'service', cap: 6, w: 1.5, emit: 0.9, start: 0, res: 0, jobs: 120, unlock: 0, col: '#d99a00', why: 'Çocuklar çoğaldı', ask: 'Okul yol istiyor' },
    fabrika: { name: 'Fabrika', need: 'road', role: 'work', cap: 8, w: 1.8, emit: 1.0, start: 0, res: 0, jobs: 700, unlock: 0, col: '#5f6b78', why: 'İş arayan çok', ask: 'Fabrika yol istiyor' },
    avm: { name: 'AVM', need: 'road', role: 'shop', cap: 10, w: 2.0, emit: 1.1, start: 0, res: 0, jobs: 400, unlock: 1, col: '#7a4fc2', why: 'Halk alışveriş yeri istiyor', ask: 'AVM yol istiyor' },
    ofis: { name: 'Ofis', need: 'road', role: 'work', cap: 8, w: 1.8, emit: 1.0, start: 0, res: 0, jobs: 650, unlock: 2, col: '#2f6fd6', why: 'İş arayan çok', ask: 'Ofis binası yol istiyor' },
    hastane: { name: 'Hastane', need: 'road', role: 'service', cap: 6, w: 1.4, emit: 0.9, start: 0, res: 0, jobs: 250, unlock: 2, col: '#d8432f', why: 'Nüfus büyüdü', ask: 'Hastane yol istiyor' },
    stadyum: { name: 'Stadyum', need: 'road', role: 'event', cap: 12, w: 2.4, emit: 1.2, start: 0, res: 0, jobs: 100, unlock: 3, col: '#1f9d61', why: 'Şehrin bir takımı olsun', ask: 'Stadyum yol istiyor' },
    istasyon: { name: 'İstasyon', need: 'rail', role: 'station', trains: 1, res: 0, jobs: 100, unlock: 0, col: '#d9861a', why: 'Banliyö yolcuları çoğaldı', ask: 'İstasyon ray istiyor' },
    kapi: { name: 'Kapı', need: 'taxi', role: 'gate', planes: 1, res: 0, jobs: 150, unlock: 0, col: '#4d7cff', why: 'Uçuşlar doldu', ask: 'Yeni yolcu kapısı taksi yolu istiyor' },
  };
  const HOW = { road: 'Yolu bu kareye kadar çiz; yol binada bitsin. Yanında yol varsa Otopark aracıyla bu kareye dokunmak da yeter.', rail: 'Hattan bu kareye bir ray kolu çek; ray burada bitsin.', taxi: 'Taksi yolunu bu kareye uzat; burada bitsin.' };
  // Şehrin aşamaları (nüfusa göre)
  const LEVELS = [{ name: 'Köy', min: 0 }, { name: 'Kasaba', min: 1500 }, { name: 'İlçe', min: 4000 }, { name: 'Şehir', min: 8000 }, { name: 'Büyükşehir', min: 14000 }];
  // Kim nereye gider: yolculuğun başladığı yerin türüne göre varış ağırlıkları (exit = şehir dışı)
  const ROLE_W = {
    home: { work: 1.0, shop: 0.7, service: 0.6, event: 0.5, park: 0.35, home: 0.12, station: 0, gate: 0, exit: 0.3 },
    work: { home: 1.5, shop: 0.3, service: 0.15, event: 0.15, park: 0.2, work: 0.1, exit: 0.35 },
    shop: { home: 1.5, shop: 0.1, work: 0.2, service: 0.15, event: 0.15, park: 0.2, exit: 0.35 },
    service: { home: 1.5, shop: 0.3, work: 0.2, service: 0.05, event: 0.1, park: 0.2, exit: 0.3 },
    event: { home: 1.5, shop: 0.4, work: 0.1, service: 0.05, park: 0.3, exit: 0.4 },
    park: { home: 0.7, work: 0.5, shop: 0.5, service: 0.3, event: 0.3, park: 0.2, exit: 0.5 },
    edge: { work: 1.0, shop: 0.8, event: 0.5, service: 0.3, park: 0.5, home: 0.4, exit: 0.7 },
  };
  const BASE_RES = 300, BASE_JOBS = 200;
  const MAX_PLACES = 24, MAX_WAITING = 2;
  const GROW_MOOD = 45, SPAWN_MOOD = 50; // memnuniyet bunların altındaysa nüfus artmaz / yeni talep gelmez
  // tabela yazısı: o anki dilde ve o dilin büyük harf kuralıyla (tr: i → İ)
  const upName = (s) => RA.t(s).toLocaleUpperCase(RA.dil === 'en' ? 'en-US' : 'tr-TR');
  const num = (n) => n.toLocaleString(RA.dil === 'en' ? 'en-US' : 'tr-TR');

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
    const key = type + '|' + RA.dil;
    if (texCache[key]) return texCache[key];
    const t = TYPES[type];
    const c = document.createElement('canvas'); c.width = 256; c.height = 96; const g = c.getContext('2d');
    g.fillStyle = '#ffffff'; roundRect(g, 0, 0, 256, 96, 18); g.fill();
    g.fillStyle = t.col; roundRect(g, 7, 7, 242, 82, 13); g.fill();
    g.fillStyle = '#ffffff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const txt = upName(t.name); let fs = 50; g.font = '900 ' + fs + 'px Overpass, Arial, sans-serif';
    while (g.measureText(txt).width > 220 && fs > 24) { fs -= 2; g.font = '900 ' + fs + 'px Overpass, Arial, sans-serif'; }
    g.fillText(txt, 128, 54);
    const tx = new T.CanvasTexture(c); tx.encoding = T.sRGBEncoding; texCache[key] = tx; return tx;
  }
  WS.placeSignTex = signTex;
  // Bekleyen talep işareti: ünlemli ad levhası ve aşağı bakan uç
  function pinTex(type, urgent) {
    const key = 'pin' + type + (urgent ? 1 : 0) + '|' + RA.dil;
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
    const txt = upName(t.name); let fs = 46; g.font = '900 ' + fs + 'px Overpass, Arial, sans-serif';
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
      this.places = []; this.t = 0; this.nextT = 5; this.mood = 85; this.ema = 0; this.uid = 1; this.lvl = 0;
      this.jams = []; this.jt = 0; this.saveT = 0; this.jamHintT = 0; this.gateHintT = 0; this.focusN = 0;
      this.rnd = RA.rng(City.seed != null ? City.seed : (Date.now() % 100000) + 17); // testler sabit tohum verebilir
      this.clearVisuals();
    }
    load(data) {
      this.reset();
      if (!data || !data.places) return;
      this.t = data.t || 0; this.nextT = data.nextT != null ? data.nextT : 5;
      this.mood = data.mood != null ? data.mood : 85; this.ema = data.ema || 0;
      this.places = data.places.filter((p) => TYPES[p.type]).map((p) => ({ id: this.uid++, i: p.i, j: p.j, type: p.type, age: p.age || 0, cAge: p.cAge || 0, conn: !!p.conn, face: p.face || 'S', grow: p.grow != null ? p.grow : p.conn ? Math.min(1, (p.cAge || 0) / 90) : 0 }));
      // eski kurallarla kaydedilmiş şehir: bağlı yerler kalır, rastgele açılmış bekleyen talepler silinir, memnuniyet yeniden hesaplanır
      if (!data.v || data.v < 2) { this.places = this.places.filter((p) => p.conn); this.mood = 85; this.ema = 0; this.nextT = 8; }
      this.lvl = this.levelOf(this.residents());
    }
    serialize() {
      return { v: 2, t: Math.round(this.t), nextT: Math.round(this.nextT * 10) / 10, mood: Math.round(this.mood), ema: Math.round(this.ema * 100) / 100, places: this.places.map((p) => ({ i: p.i, j: p.j, type: p.type, age: Math.round(p.age), cAge: Math.round(p.cAge), conn: p.conn, face: p.face, grow: Math.round(p.grow * 1000) / 1000 })) };
    }
    type(p) { return TYPES[p.type]; }
    placeAt(i, j) { return this.places.find((p) => p.i === i && p.j === j) || null; }
    map() { const m = new Map(); for (const p of this.places) m.set(p.i + ',' + p.j, p); return m; }
    waiting() { return this.places.filter((p) => !p.conn); }
    connected(kind) { return this.places.filter((p) => p.conn && (!kind || TYPES[p.type].need === kind)).length; }
    counts() { const n = {}; for (const k in TYPES) n[k] = 0; for (const p of this.places) n[p.type]++; return n; }
    // sakinler ve iş/hizmet yerleri: bağlanan yer büyüdükçe dolar
    residents() { let n = BASE_RES; for (const p of this.places) if (p.conn) n += (TYPES[p.type].res || 0) * p.grow; return n; }
    jobs() { let n = BASE_JOBS; for (const p of this.places) if (p.conn) n += (TYPES[p.type].jobs || 0) * p.grow; return n; }
    population() { return Math.round(this.residents() / 10) * 10; }
    levelOf(n) { let l = 0; LEVELS.forEach((L, k) => { if (n >= L.min) l = k; }); return l; }
    level() { return this.lvl; }
    levelInfo() { return { cur: LEVELS[this.lvl], next: LEVELS[this.lvl + 1] || null, idx: this.lvl }; }
    // trafiğe katkı (yer büyüdükçe artar)
    weight(p) { return (TYPES[p.type].w || 0) * (0.3 + 0.7 * p.grow); }

    /* ---------- ızgara ile eşitleme: bağlandı mı? ---------- */
    sync(grid) {
      const events = [];
      this.places = this.places.filter((p) => {
        const c = grid.cell(p.i, p.j); if (!c) return false;
        const need = TYPES[p.type].need;
        const q = c.pieces[0];
        const dead = c.pieces.length === 1 && q.type === need && WS.portCount(q.m) === 1 && q.lv === 0;
        if (dead) { if (!p.conn) { p.conn = true; p.cAge = 0; p.grow = Math.max(p.grow, 0.15); events.push(p); } p.face = WS.ports(q.m)[0]; return true; }
        if (c.pieces.length) return false; // kareye başka bir şey yapıldı: talep kalkar
        p.conn = false;
        return true;
      });
      return events;
    }

    /* ---------- yeni talep: şehrin ihtiyacından doğar ---------- */
    hasFamily(fam) { let n = 0; this.ws.grid.each((c) => { if (c.pieces.some((q) => q.type === fam)) n++; }); return n > 0; }
    needs() {
      const R = this.residents(), J = this.jobs(), n = this.counts(), lvl = this.lvl, dom = this.ws.domain;
      const ok = (t) => TYPES[t].unlock <= lvl && (TYPES[t].need === 'road' || this.hasFamily(TYPES[t].need));
      const out = [];
      const add = (t, s, why) => { if (ok(t) && s > 0) out.push({ type: t, s: s * (0.85 + this.rnd() * 0.3), why: why || TYPES[t].why }); };
      // konut: hiç yoksa, iş yerleri boş kalıyorsa ya da şehir büyüyorsa
      add('mahalle', n.mahalle === 0 ? 10 : 0.8 + Math.max(0, (J - R * 0.75) / 300), n.mahalle === 0 ? 'İlk sakinler geliyor' : J > R * 0.75 ? 'İş var ama çalışacak kimse yok' : 'Yeni aileler geliyor');
      // iş: işsizler çoğaldıysa
      const jobless = Math.max(0, R * 0.75 - J) / 300;
      add('fabrika', jobless / (1 + n.fabrika * 0.6));
      add('avm', jobless * 0.9 / (1 + n.avm * 0.8) + (n.avm === 0 ? 1 : 0));
      add('ofis', jobless / (1 + n.ofis * 0.6));
      // hizmetler: nüfus eşiklerinde
      add('okul', R > 900 + n.okul * 2400 ? 3 : 0);
      add('hastane', R > 3500 + n.hastane * 5500 ? 3 : 0);
      add('stadyum', n.stadyum === 0 ? 2.5 : 0);
      if (dom === 'rail') add('istasyon', R > 1000 + n.istasyon * 2000 ? 3.5 : 0);
      if (dom === 'air') add('kapi', R > 1000 + n.kapi * 2000 ? 3.5 : 0);
      return out.sort((a, b) => b.s - a.s);
    }
    // Yer seçimi: yol kenarında (en çok bir kare içeride), tahtanın içinde, türüne uygun bölgede
    pickCell(type) {
      const t = TYPES[type], need = t.need, role = t.role;
      const g = this.ws.grid, W = g.cols, H = g.rows;
      const cell = (i, j) => g.cell(i, j);
      const isRamp = (i, j) => ['N', 'E', 'S', 'W'].some((d) => { const c = cell(i + DV[d].x, j + DV[d].z); return c && c.pieces.some((q) => q.lv !== 0); });
      // kol eklenebilecek parça: o aileden, zemin seviyesinde, 2-3 kollu (4 kollu kavşak ve çıkmaz uç olmaz), rampa değil
      const src = (i, j) => { const c = cell(i, j); if (!c || c.pieces.length !== 1) return false; const q = c.pieces[0]; const n = WS.portCount(q.m); return q.type === need && q.lv === 0 && n >= 2 && n <= 3 && !isRamp(i, j); };
      const dist = new Int16Array(W * H).fill(-1), face = new Array(W * H).fill(null);
      const q = [];
      g.each((c, i, j) => { if (src(i, j)) { dist[j * W + i] = 0; q.push([i, j]); } });
      const taken = this.map();
      while (q.length) {
        const [i, j] = q.shift(); const d0 = dist[j * W + i];
        if (d0 >= 2) continue;
        for (const d of ['N', 'E', 'S', 'W']) {
          const ni = i + DV[d].x, nj = j + DV[d].z;
          if (!g.inside(ni, nj) || dist[nj * W + ni] >= 0) continue;
          const c = cell(ni, nj); if (c.pieces.length || taken.has(ni + ',' + nj)) continue;
          dist[nj * W + ni] = d0 + 1; face[nj * W + ni] = WS.OPP[d]; q.push([ni, nj]);
        }
      }
      const around = (i, j, r, fn) => { let n = 0; for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) { const c = cell(i + a, j + b); if (c && fn(c, i + a, j + b)) n++; } return n; };
      const near = (i, j, r, types) => this.places.filter((p) => Math.abs(p.i - i) <= r && Math.abs(p.j - j) <= r && (!types || types.includes(p.type))).length;
      const cand = [];
      g.each((c, i, j) => {
        const d = dist[j * W + i];
        if (d < 1) return;
        if (i < 1 || j < 1 || i > W - 2 || j > H - 2) return; // tahtanın kenarına bina konmaz
        if (near(i, j, 1)) return; // başka bir yerin dibine konmaz
        // konut ve iş yerleri rayın, pistin, taksi yolunun dibine kurulmaz
        if (need === 'road' && around(i, j, 1, (cc) => cc.pieces.some((x) => x.type === 'rail' || x.type === 'runway' || x.type === 'taxi'))) return;
        const M = near(i, j, 3, ['mahalle']), F = near(i, j, 3, ['fabrika']), Wk = near(i, j, 3, ['ofis', 'avm', 'fabrika']);
        const Jn = around(i, j, 2, (cc) => cc.pieces.some((x) => x.type === 'road' && WS.portCount(x.m) >= 3));
        const edge = Math.min(i, j, W - 1 - i, H - 1 - j);
        let zone = 1;
        if (type === 'mahalle') zone = 1 + 0.4 * M - 0.8 * F + (Jn === 0 ? 0.4 : 0);
        else if (type === 'fabrika') zone = 1 + (edge <= 1 ? 0.9 : 0) - 0.6 * M;
        else if (role === 'service') zone = 1 + 0.5 * M;
        else if (role === 'shop' || role === 'work') zone = 1 + 0.35 * Jn + 0.2 * Wk;
        else if (role === 'event') zone = 1 + (edge <= 2 ? 0.6 : 0);
        else zone = 1 + 0.3 * M;
        cand.push({ i, j, d, face: face[j * W + i], s: (d === 1 ? 2.5 : 1) * Math.max(0.1, zone) * (0.6 + this.rnd() * 0.8) });
      });
      if (!cand.length) return null;
      cand.sort((a, b) => b.s - a.s);
      return cand[0];
    }
    trySpawn() {
      for (const nd of this.needs()) {
        const c = this.pickCell(nd.type);
        if (!c) continue;
        const p = { id: this.uid++, i: c.i, j: c.j, type: nd.type, age: 0, cAge: 0, conn: false, face: c.face || 'S', grow: 0 };
        this.places.push(p);
        this.ws.rebuild(); this.ws.save();
        this.ws.onDemand(p, nd.why);
        return true;
      }
      return false;
    }

    /* ---------- adım ---------- */
    update(dt) {
      this.t += dt;
      const happy = this.mood >= GROW_MOOD;
      for (const p of this.places) {
        p.age += dt;
        if (p.conn) { p.cAge += dt; if (happy) p.grow = Math.min(1, p.grow + dt / 90); } // trafik sıkışıkken nüfus artmaz
      }
      const L = this.levelOf(this.residents());
      if (L > this.lvl) { this.lvl = L; this.ws.onLevel(LEVELS[L], L, Object.keys(TYPES).filter((k) => TYPES[k].unlock === L && (TYPES[k].need === 'road')).map((k) => TYPES[k].name)); }
      // yeni talep: bekleyen az, memnuniyet yeterliyse
      const waiting = this.waiting().length;
      this.nextT -= dt;
      if (this.nextT <= 0) {
        if (waiting >= MAX_WAITING || this.places.length >= MAX_PLACES) this.nextT = 6;
        else if (this.mood < SPAWN_MOOD) {
          this.nextT = 6;
          if (!this.gateHintT) { this.gateHintT = 60; this.ws.toast(RA.t('Şehir büyümek istiyor ama trafik sıkışık (memnuniyet %{n}). Kırmızı halkalı yerleri rahatlatınca nüfus artar ve yeni talepler gelir.', { n: Math.round(this.mood) })); }
        } else if (this.trySpawn()) this.nextT = 22 + this.rnd() * 12 + waiting * 8;
        else this.nextT = 8;
      }
      this.jt -= dt; if (this.jt <= 0) { this.jt = 0.5; this.measureJams(); }
      const parts = (this.parts = this.moodParts());
      this.mood += (parts.total - this.mood) * Math.min(1, dt * 0.12);
      this.jamHintT = Math.max(0, this.jamHintT - dt); this.gateHintT = Math.max(0, this.gateHintT - dt);
      this.saveT += dt; if (this.saveT > 10) { this.saveT = 0; this.ws.saveCity(); }
    }
    // memnuniyet: araçların yolda durarak geçirdiği süre, sıkışan kavşaklar, kımıldayamayan araçlar, uzun bekleyen talepler
    moodParts() {
      const traffic = Math.min(45, Math.max(0, this.ema - 3) * 3);
      const jam = Math.min(24, this.jams.length * 6);
      let st = 0; for (const c of this.ws.sim.cars) if (!c.fade && c.still > 20) st++;
      const stuck = Math.min(15, st * 1.5);
      let demand = 0; for (const p of this.places) if (!p.conn) demand += RA.clamp((p.age - 60) / 8, 0, 6);
      demand = Math.min(15, demand);
      return { traffic, jam, stuck, demand, total: RA.clamp(96 - traffic - jam - stuck - demand, 0, 100) };
    }
    moodText() {
      const p = this.parts || this.moodParts(), m = Math.round(this.mood), bits = [];
      if (p.traffic >= 2) bits.push(RA.t('araçlar yolda ortalama {sn} sn duruyor (−{p})', { sn: Math.round(this.ema), p: Math.round(p.traffic) }));
      if (p.jam > 0) bits.push(RA.t('{n} sıkışık kavşak (−{p})', { n: this.jams.length, p: Math.round(p.jam) }));
      if (p.stuck >= 2) bits.push(RA.t('kımıldayamayan araçlar (−{p})', { p: Math.round(p.stuck) }));
      if (p.demand >= 2) bits.push(RA.t('uzun bekleyen talep (−{p})', { p: Math.round(p.demand) }));
      return RA.t('Memnuniyet %{n}', { n: m }) + (bits.length ? ': ' + bits.join(', ') + '.' : RA.t(': trafik akıyor, herkes memnun.')) + (m < SPAWN_MOOD ? RA.t(' %{n} altında şehir büyümez.', { n: SPAWN_MOOD }) : '');
    }
    levelText() {
      const { cur, next } = this.levelInfo(), n = num(this.population());
      if (!next) return RA.t('{ad}: {n} kişi. En büyük aşamadasın!', { ad: RA.t(cur.name), n });
      return RA.t('{ad}: {n} kişi. {sonraki} olmak için {m} kişi gerekir. Mahalleleri bağla, iş ve okul taleplerini karşıla; trafik sıkışırsa nüfus artmaz.', { ad: RA.t(cur.name), n, sonraki: RA.t(next.name), m: num(next.min) });
    }
    onTrip(c) { this.ema += ((c.stopT || 0) - this.ema) * 0.08; }
    onGiveUp(c) { this.ema += (40 - this.ema) * 0.06; this.giveUps = (this.giveUps || 0) + 1; }

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
        this.ws.toast(RA.t('Trafik sıkıştı! Kavşağı köprü ya da alt geçitle ayır, ya da trafiği dağıtacak yeni bir yol aç.'));
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
  City.LEVELS = LEVELS;
  City.ROLE_W = ROLE_W;
  WS.City = City;
})();
