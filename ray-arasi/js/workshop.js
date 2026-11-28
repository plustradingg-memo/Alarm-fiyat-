/* RAY ARASI — Atölye modu: kendi yolunu, rayını, havalimanını kur; yapay zekâ yönetsin */
(function () {
  'use strict';
  const RA = window.RA;
  const WS = RA.WS;
  const T = THREE;
  const $ = (id) => document.getElementById(id);
  const TITLES = { road: 'Karayolu', rail: 'Demiryolu', air: 'Havalimanı' };
  const DEF_TOOL = { road: 'road', rail: 'rail', air: 'taxi' };
  const TOOL_COL = { road: 0x5b6270, rail: 0x9a6b43, taxi: 0xf2c230, runway: 0x2c2f36, erase: 0xe5372d, lot: 0x1f5fc8 };
  const num = (n) => n.toLocaleString(RA.dil === 'en' ? 'en-US' : 'tr-TR');

  class Workshop {
    constructor(app) {
      this.app = app;
      this.scene = new T.Scene();
      this.scene.background = new T.Color(0x2b3a42);
      this.camera = new T.PerspectiveCamera(28, 0.5, 0.5, 420);
      this.view = null; this.ptrs = new Map(); this.gesture = null;
      this.lights = RA.makeLights(this.scene, { sky: 0xe6f0ff, ground: 0x7a6a4a, hemi: 0.75, sun: 0xffe2b8, sunI: 2.0, sunPos: [-14, 26, 12], sunTarget: [0, 0, 0], shadowSize: 18, fill: 0xbfd4ff, fillI: 0.25 });
      this.builder = new WS.Builder(this.scene);
      this.sim = new WS.Sim(this);
      this.city = new WS.City(this);
      this.tool = 'look'; this.style = 'grade'; this.domain = 'road';
      this.paused = false; this.undoStack = [];
      // çizim önizlemesi
      this.prev = new T.InstancedMesh(new T.BoxGeometry(WS.S * 0.92, 0.06, WS.S * 0.92), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45, depthWrite: false }), 200);
      this.prev.count = 0; this.prev.renderOrder = 6; this.prev.frustumCulled = false; this.scene.add(this.prev);
      this.bindUI();
      this.bindInput();
    }

    /* ---------- arayüz ---------- */
    bindUI() {
      document.querySelectorAll('#ws [data-tool]').forEach((b) => b.addEventListener('click', () => this.setTool(b.dataset.tool)));
      document.querySelectorAll('#ws [data-style]').forEach((b) => b.addEventListener('click', () => this.setStyle(b.dataset.style)));
      $('ws-back').addEventListener('click', () => this.app.showMenu());
      $('ws-ai').addEventListener('click', () => this.setAI(!this.sim.ai));
      $('ws-play').addEventListener('click', () => this.setPaused(!this.paused));
      $('ws-undo').addEventListener('click', () => this.undo());
      $('ws-less').addEventListener('click', () => this.setDensity(this.sim.density - 1));
      $('ws-more').addEventListener('click', () => this.setDensity(this.sim.density + 1));
      $('ws-menu').addEventListener('click', (e) => { e.stopPropagation(); $('ws-pop').hidden = !$('ws-pop').hidden; });
      $('ws-new').addEventListener('click', () => { $('ws-pop').hidden = true; this.pushUndo(); this.grid = WS.start(this.domain); this.city.reset(); this.sim.clearAll(); this.commit(RA.t('Yeni şehir: 4 düz yol. Talepler birazdan gelir. Eski çizim ↶ ile geri gelir.')); });
      $('ws-sample').addEventListener('click', () => { $('ws-pop').hidden = true; this.pushUndo(); this.grid = WS.template(this.domain); this.commit(RA.t('Örnek düzen yüklendi.')); });
      $('ws-clear').addEventListener('click', () => { $('ws-pop').hidden = true; this.pushUndo(); this.grid = new WS.Grid(); this.city.reset(); this.commit(RA.t('Tahta temizlendi. Geri almak için ↶')); });
      $('ws-dem').addEventListener('click', () => this.focusNext());
      $('ws-mood').addEventListener('click', () => this.toast(this.city.moodText()));
      $('ws-popn').addEventListener('click', () => this.toast(this.city.levelText()));
      const mid = () => ({ x: this.app.w / 2, y: this.app.h * 0.45 });
      $('ws-zin').addEventListener('click', () => { const m = mid(); this.zoomAt(m.x, m.y, 0.66); });
      $('ws-zout').addEventListener('click', () => { const m = mid(); this.zoomAt(m.x, m.y, 1.5); });
      $('ws-zfit').addEventListener('click', () => this.fitView());
      document.addEventListener('pointerdown', (e) => { if (!$('ws-pop').hidden && !e.target.closest('#ws-pop') && !e.target.closest('#ws-menu')) $('ws-pop').hidden = true; });
    }
    setTool(t) {
      this.tool = t;
      document.querySelectorAll('#ws [data-tool]').forEach((b) => { const on = b.dataset.tool === t; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
      $('ws-styles').classList.toggle('dim', !(t === 'road' || t === 'rail' || t === 'taxi'));
      if (this.builder.gridLines) this.builder.gridLines.visible = t !== 'look';
      const tips = {
        look: this.sim.ai ? 'İzle: tek parmakla kaydır, iki parmakla yakınlaştır. Işıkları, makasları ve kuleyi yapay zekâ yönetiyor.' : 'Elle yönet: kavşağa, makasa ya da bekleyen uçağa dokun. Tek parmakla kaydır.',
        road: 'Yol: sürükleyerek çiz. Çıkmaz uç otopark olur; kenardan dışarı çizersen şehir dışına bağlanır.',
        lot: 'Otopark: yolun yanındaki boş kareye dokun. Araçlar oraya park eder, sonra başka araçlar çıkar.',
        rail: 'Ray: sürükleyerek hat döşe. Hatta değen yeni hat makas olur.',
        taxi: 'Taksi yolu: pisti kapılara bağla. Çıkmaz uçlar uçak park yeridir.',
        runway: 'Pist: en az üç karelik düz bir çizgi çiz.',
        erase: 'Sil: üzerinden geçtiğin kareler temizlenir.',
      };
      this.toast(RA.t(tips[t]));
    }
    setStyle(s) {
      this.style = s;
      document.querySelectorAll('#ws [data-style]').forEach((b) => { const on = b.dataset.style === s; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
      this.toast(RA.t({ grade: 'Kavşak: kesiştiği yere aynı seviyede bağlanır, ışıklar otomatik.', bridge: 'Köprü: kesiştiği yolun ya da rayın üstünden geçer.', tunnel: 'Alt geçit: kesiştiği yerin altından batıp çıkar.' }[s]));
    }
    setAI(on) {
      this.sim.ai = on;
      const b = $('ws-ai'); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.querySelector('span.lbl').textContent = RA.t(on ? 'YZ' : 'Elle');
      b.setAttribute('aria-label', RA.t(on ? 'Yapay zekâ açık' : 'Yapay zekâ kapalı, elle yönetim'));
      this.toast(RA.t(on ? 'Yapay zekâ yönetiyor: ışıklar trafiğe göre kendiliğinden değişir, boşken sarı yanıp söner.' : 'Yapay zekâ kapalı: İzle aracıyla kavşaklara, makaslara ve uçaklara dokunarak sen yönet.'));
      RA.store.set('ws.ai', on);
    }
    setPaused(p) {
      this.paused = p;
      $('ws-play').classList.toggle('paused', p);
      $('ws-play').setAttribute('aria-label', RA.t(p ? 'Trafiği başlat' : 'Trafiği durdur'));
    }
    setDensity(d) {
      this.sim.density = RA.clamp(d, 1, 5);
      document.querySelectorAll('#ws-dens i').forEach((el, n) => el.classList.toggle('on', n < this.sim.density));
      RA.store.set('ws.density', this.sim.density);
    }
    toast(msg, err) {
      const el = $('ws-toast');
      if (!msg) return;
      el.textContent = msg; el.hidden = false; el.classList.toggle('err', !!err);
      el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
      clearTimeout(this.toastT); this.toastT = setTimeout(() => { el.hidden = true; }, err ? 3200 : 2800);
    }

    /* ---------- aç / kaydet ---------- */
    open(domain) {
      this.domain = domain;
      $('ws-title').textContent = RA.t(TITLES[domain]);
      const saved = RA.store.get('ws.' + domain, null);
      // eski sürüm kaydı (başka boyut ya da biçim): şehir 4 düz yolla baştan başlar; eski çizim ↶ ile geri getirilebilir
      const stale = !!(saved && (saved.v !== WS.SAVE_V || saved.cols !== WS.COLS || saved.rows !== WS.ROWS));
      let oldGrid = null;
      try { if (saved) oldGrid = WS.Grid.load(saved); } catch (e) { oldGrid = null; }
      const fresh = !oldGrid || stale;
      this.grid = fresh ? WS.start(domain) : oldGrid;
      this.city.load(fresh ? null : RA.store.get('ws.city.' + domain, null));
      this.undoStack = []; $('ws-undo').disabled = true;
      if (stale && oldGrid && !oldGrid.isEmpty()) { this.undoStack.push(JSON.stringify(oldGrid.serialize())); $('ws-undo').disabled = false; }
      this.sim.clearAll();
      this.sim.stats = { cars: 0, waitSum: 0, waitN: 0, trains: 0, land: 0, takeoff: 0 };
      this.sim.ai = RA.store.get('ws.ai', true) !== false; this.setAI(this.sim.ai);
      this.setDensity(RA.store.get('ws.density', 3));
      this.setPaused(false);
      this.rebuild();
      if (fresh) this.save();
      this.userView = false; if (this.fit) this.fitView();
      this.setTool('look');
      this.setStyle('grade');
      // ilk açılışta kısa yönlendirme
      if (stale && this.undoStack.length) this.toast(RA.t('Şehir 4 düz yolla baştan başladı. Eski çizimin ↶ ile geri gelir.'));
      else if (fresh) this.toast(RA.t('Köyünün 4 düz yolu var. Talepleri karşıladıkça köy kasabaya, sonra şehre büyür. Trafik sıkışırsa büyüme durur.'));
      else this.toast(RA.t('Yakınlaştırmak için iki parmağını aç ya da sağdaki + düğmesine dokun. İzle aracıyla tek parmakla kaydır, diğer araçlarla sürükleyerek çiz.'));
      this.lastStats = 0;
    }
    rebuild() {
      // talepler: hangisi bağlandı? Bağlananlar kendi binasıyla, bekleyenler işaretle çizilir
      const ev = this.city.sync(this.grid);
      this.builder.places = this.city.map();
      this.builder.reserved = new Set(this.city.waiting().map((p) => p.i + ',' + p.j));
      this.net = new WS.Net(this.grid);
      const dyn = this.builder.build(this.net);
      this.sim.setNet(this.net, dyn);
      this.city.rebuildVisuals(this.net);
      if (this.builder.gridLines) this.builder.gridLines.visible = this.tool !== 'look';
      if (ev.length) this.onConnect(ev);
    }
    save() { RA.store.set('ws.' + this.domain, this.grid.serialize()); this.saveCity(); }
    saveCity() { RA.store.set('ws.city.' + this.domain, this.city.serialize()); }

    /* ---------- talepler ---------- */
    onDemand(p, why) {
      const t = WS.City.TYPES[p.type];
      this.toast(why ? RA.t('{why}: {ask}. Üstteki talep düğmesi seni oraya götürür.', { why: RA.t(why), ask: RA.t(t.ask) }) : RA.t('Yeni talep: {ask}. Üstteki talep düğmesi seni oraya götürür.', { ask: RA.t(t.ask) }));
      RA.audio.play('point');
      const b = $('ws-dem'); b.classList.remove('ping'); void b.offsetWidth; b.classList.add('ping');
    }
    onLevel(L, idx, unlocked) {
      this.toast(RA.t('Tebrikler, artık bir {ad} oldun ({n} kişi)!', { ad: RA.t(L.name), n: num(L.min) }) + (unlocked.length ? RA.t(' Yeni talepler: {liste}.', { liste: unlocked.map((s) => RA.t(s)).join(', ') }) : ''));
      RA.audio.play('record');
      const b = $('ws-popn'); b.classList.remove('ping'); void b.offsetWidth; b.classList.add('ping');
      this.saveCity();
    }
    onConnect(list) {
      const p = list[list.length - 1], t = WS.City.TYPES[p.type];
      const msg = RA.t({ road: '{ad} bağlandı! Araçlar gelip gitmeye başladı.', rail: 'İstasyon bağlandı! Daha çok tren sefer yapacak.', taxi: 'Yeni kapı açıldı! Daha çok uçak gelecek.' }[t.need], { ad: RA.t(t.name) });
      this.pendingMsg = msg; // çizim mesajının yerine geçsin
      RA.audio.play('clear');
      this.saveCity();
    }
    // Talep düğmesi: sıradaki bekleyen talebe (yoksa sıkışan kavşağa) yakınlaş
    focusNext() {
      const w = this.city.waiting();
      const items = w.map((p) => ({ i: p.i, j: p.j, msg: RA.t(WS.City.TYPES[p.type].ask) + '. ' + RA.t(WS.City.HOW[WS.City.TYPES[p.type].need]) }));
      for (const e of this.city.jams) items.push({ i: e.i, j: e.j, msg: RA.t('Burası sıkışık ({n} araç bekliyor). Köprü, alt geçit ya da yeni bir yol dene.', { n: e.n }) });
      if (!items.length) { this.toast(RA.t('Şu an bekleyen talep yok. Yeni talepler kendiliğinden gelir.')); return; }
      const it = items[this.city.focusN++ % items.length];
      this.view.t.set(this.net.cx(it.i), 0, this.net.cz(it.j) + 1.5);
      this.view.d = this.fit.d * 0.34; this.clampView(); this.applyCam(); this.userView = true;
      this.toast(it.msg);
      RA.audio.play('tap');
    }
    pushUndo() { this.undoStack.push(JSON.stringify(this.grid.serialize())); if (this.undoStack.length > 30) this.undoStack.shift(); $('ws-undo').disabled = false; }
    undo() {
      const s = this.undoStack.pop();
      if (!s) return;
      this.grid = WS.Grid.load(JSON.parse(s));
      this.commit(RA.t('Geri alındı.'));
      $('ws-undo').disabled = !this.undoStack.length;
    }
    commit(msg) { this.pendingMsg = null; this.save(); this.rebuild(); const m = this.pendingMsg || msg; this.pendingMsg = null; if (m) this.toast(m); RA.audio.play('switch'); }

    /* ---------- girdi ---------- */
    cellAt(x, y) {
      const p = RA.screenToGround(x, y, this.camera, this.app.w, this.app.h, 0);
      if (!p) return null;
      return { i: Math.round((p.x - this.net.ox) / WS.S), j: Math.round((p.z - this.net.oz) / WS.S), x: p.x, z: p.z };
    }
    bindInput() {
      const st = this.app.stage;
      const local = (e) => { const r = st.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
      const two = () => { const [a, b] = [...this.ptrs.values()]; return { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, m: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } }; };
      st.addEventListener('pointerdown', (e) => {
        if (this.app.state !== 'workshop' || e.target.closest('button, .ws-bar, .ws-top, .ws-city, #ws-pop, .ws-zoom')) return;
        RA.audio.unlock();
        e.preventDefault();
        const p = local(e);
        this.ptrs.set(e.pointerId, p);
        try { st.setPointerCapture(e.pointerId); } catch (err) { /* yok */ }
        if (this.ptrs.size === 1) {
          const pan = this.tool === 'look' || e.button === 1 || e.button === 2;
          this.gesture = { kind: pan ? 'pan' : 'draw', id: e.pointerId, x0: p.x, y0: p.y, last: p, moved: false };
          if (!pan) { const c = this.cellAt(p.x, p.y); this.drag = { id: e.pointerId, x0: p.x, y0: p.y, cells: c ? [c] : [], moved: false }; this.updatePreview(); }
        } else if (this.ptrs.size === 2) {
          // ikinci parmak: çizimi bırak, yakınlaştır/kaydır
          this.drag = null; this.prev.count = 0;
          const t = two(); this.gesture = { kind: 'pinch', d0: t.d, mid: t.m };
        }
      }, { passive: false });
      st.addEventListener('pointermove', (e) => {
        if (!this.ptrs.has(e.pointerId)) return;
        const p = local(e);
        this.ptrs.set(e.pointerId, p);
        const g = this.gesture; if (!g) return;
        if (g.kind === 'pinch' && this.ptrs.size >= 2) {
          const t = two();
          this.zoomAt(t.m.x, t.m.y, g.d0 / t.d); this.panBy(g.mid, t.m);
          g.d0 = t.d; g.mid = t.m;
        } else if (g.kind === 'pan' && e.pointerId === g.id) {
          if (Math.hypot(p.x - g.x0, p.y - g.y0) > 7) g.moved = true;
          if (g.moved) { this.panBy(g.last, p); g.last = p; }
        } else if (g.kind === 'draw' && this.drag && e.pointerId === this.drag.id) {
          if (Math.hypot(p.x - this.drag.x0, p.y - this.drag.y0) > 8) this.drag.moved = true;
          const c = this.cellAt(p.x, p.y);
          if (!c) return;
          const last = this.drag.cells[this.drag.cells.length - 1];
          if (!last || last.i !== c.i || last.j !== c.j) { this.drag.cells.push(c); this.updatePreview(); }
        }
      });
      const end = (e) => {
        if (!this.ptrs.has(e.pointerId)) return;
        this.ptrs.delete(e.pointerId);
        const g = this.gesture;
        const p = local(e);
        if (g && g.kind === 'draw' && this.drag && e.pointerId === this.drag.id) {
          const d = this.drag; this.drag = null;
          if (this.tool === 'lot' && e.type !== 'pointercancel') { this.prev.count = 0; this.placeLots(d.cells); }
          else if (!d.moved) { this.prev.count = 0; this.tapAt(p.x, p.y); }
          else if (e.type === 'pointercancel') this.prev.count = 0;
          else this.applyStroke(d.cells);
        } else if (g && g.kind === 'pan' && e.pointerId === g.id && !g.moved && e.type !== 'pointercancel') this.tapAt(p.x, p.y);
        if (!this.ptrs.size) this.gesture = null;
        else if (g && g.kind === 'pinch') this.gesture = { kind: 'none' };
      };
      st.addEventListener('pointerup', end);
      st.addEventListener('pointercancel', end);
      st.addEventListener('wheel', (e) => {
        if (this.app.state !== 'workshop') return;
        e.preventDefault();
        const p = local(e);
        this.zoomAt(p.x, p.y, Math.exp(RA.clamp(e.deltaY, -120, 120) * 0.0022));
      }, { passive: false });
      window.addEventListener('keydown', (e) => {
        if (this.app.state !== 'workshop') return;
        if ((e.key === 'z' || e.key === 'Z') && (e.ctrlKey || e.metaKey)) { this.undo(); e.preventDefault(); return; }
        if (e.key === 'Escape') { this.app.showMenu(); return; }
        const c = { x: this.app.w / 2, y: this.app.h * 0.45 }, k = 60;
        const pan = { ArrowLeft: [-k, 0], ArrowRight: [k, 0], ArrowUp: [0, -k], ArrowDown: [0, k] }[e.key];
        if (pan) { this.panBy({ x: c.x + pan[0], y: c.y + pan[1] }, c); e.preventDefault(); }
        if (e.key === '+' || e.key === '=') this.zoomAt(c.x, c.y, 0.75);
        if (e.key === '-' || e.key === '_') this.zoomAt(c.x, c.y, 1.33);
        if (e.key === '0') this.fitView();
      });
    }

    /* ---------- görünüm: yakınlaştır / kaydır ---------- */
    applyCam() {
      const v = this.view;
      this.camera.position.copy(v.t).addScaledVector(this.dir, v.d);
      this.camera.lookAt(v.t);
      this.camera.updateMatrixWorld(true);
      // gölge, görünen bölgeyi izler (büyük tahtada keskin kalsın)
      const sun = this.lights.sun, half = RA.clamp(v.d * 0.42, 9, 40);
      sun.target.position.set(v.t.x, 0, v.t.z); sun.position.set(v.t.x - 14, 26, v.t.z + 12);
      const sc = sun.shadow.camera; sc.left = -half; sc.right = half; sc.top = half; sc.bottom = -half; sc.far = 140; sc.updateProjectionMatrix();
      sun.target.updateMatrixWorld();
    }
    clampView() {
      const v = this.view, f = this.fit;
      v.d = RA.clamp(v.d, f.d * 0.2, f.d * 1.04);
      const k = RA.clamp((f.d * 1.04 - v.d) / (f.d * 0.84), 0, 1);
      const hw = (WS.COLS * WS.S) / 2, hd = (WS.ROWS * WS.S) / 2;
      v.t.x = RA.clamp(v.t.x, f.t.x - hw * k, f.t.x + hw * k);
      v.t.z = RA.clamp(v.t.z, f.t.z - hd * k, f.t.z + hd * k);
    }
    zoomAt(sx, sy, factor) {
      if (!this.view) return;
      const P = RA.screenToGround(sx, sy, this.camera, this.app.w, this.app.h, 0);
      this.view.d *= factor; this.clampView(); this.applyCam();
      const Q = RA.screenToGround(sx, sy, this.camera, this.app.w, this.app.h, 0);
      if (P && Q) { this.view.t.x += P.x - Q.x; this.view.t.z += P.z - Q.z; this.clampView(); this.applyCam(); }
      this.userView = true;
    }
    panBy(a, b) {
      if (!this.view) return;
      const P = RA.screenToGround(a.x, a.y, this.camera, this.app.w, this.app.h, 0);
      const Q = RA.screenToGround(b.x, b.y, this.camera, this.app.w, this.app.h, 0);
      if (!P || !Q) return;
      this.view.t.x += P.x - Q.x; this.view.t.z += P.z - Q.z;
      this.clampView(); this.applyCam();
      this.userView = true;
    }
    fitView() { this.view = { t: this.fit.t.clone(), d: this.fit.d }; this.applyCam(); this.userView = false; }
    updatePreview() {
      const d = this.drag;
      if (!d || this.tool === 'look') { this.prev.count = 0; return; }
      const seq = WS.strokeCells(d.cells.map((c) => ({ i: c.i, j: c.j })));
      const o = new T.Object3D();
      let n = 0;
      for (const c of seq) {
        if (!this.grid.inside(c.i, c.j) || n >= 200) continue;
        o.position.set(this.net.cx(c.i), 0.12, this.net.cz(c.j)); o.updateMatrix();
        this.prev.setMatrixAt(n++, o.matrix);
      }
      this.prev.count = n; this.prev.instanceMatrix.needsUpdate = true;
      this.prev.material.color.setHex(TOOL_COL[this.tool] || 0xffffff);
      this.prev.material.opacity = this.tool === 'erase' ? 0.5 : 0.42;
    }
    // Otopark: dokunulan boş kareyi yanındaki yola bağla (çıkmaz uç = otopark)
    placeLots(cells) {
      const before = JSON.stringify(this.grid.serialize());
      const seen = new Set(); let n = 0, tried = 0;
      for (const c of cells) {
        const key = c.i + ',' + c.j; if (seen.has(key)) continue; seen.add(key);
        const cell = this.grid.cell(c.i, c.j);
        if (!cell || cell.pieces.length) continue;
        const pl = this.city.placeAt(c.i, c.j);
        if (pl && WS.City.TYPES[pl.type].need !== 'road') { this.toast(RA.t(WS.City.TYPES[pl.type].need === 'rail' ? '{ad} için ray gerekir.' : '{ad} için taksi yolu gerekir.', { ad: RA.t(WS.City.TYPES[pl.type].name) }), true); return; }
        tried++;
        for (const d of ['S', 'N', 'E', 'W']) {
          const nb = this.grid.cell(c.i + WS.DV[d].x, c.j + WS.DV[d].z);
          if (!nb || !nb.pieces.some((q) => q.type === 'road' && q.lv === 0)) continue;
          const r = WS.applyStroke(this.grid, [{ i: c.i, j: c.j }, { i: c.i + WS.DV[d].x, j: c.j + WS.DV[d].z }], 'road', 'grade');
          if (r.ok) { n++; break; }
        }
      }
      if (n) { this.undoStack.push(before); if (this.undoStack.length > 30) this.undoStack.shift(); $('ws-undo').disabled = false; this.commit(n > 1 ? RA.t('{n} otopark eklendi.', { n }) : RA.t('Otopark eklendi: araçlar buraya park edecek, sonra buradan çıkacak.')); }
      else if (tried) { this.toast(RA.t('Otoparkı bir yolun yanındaki boş kareye koy.'), true); RA.audio.play('denied'); }
    }
    applyStroke(cells) {
      let seq = WS.strokeCells(cells.map((c) => ({ i: c.i, j: c.j })));
      this.prev.count = 0;
      if (this.tool === 'erase') {
        const before = JSON.stringify(this.grid.serialize());
        if (WS.eraseStroke(this.grid, seq)) { this.undoStack.push(before); $('ws-undo').disabled = false; this.commit(); }
        return;
      }
      // talep kareleri: hat talebin karesinde biter (çıkmaz uç = bina girişi); başka tür hat oraya giremez
      let cut = seq;
      for (let k = 0; k < seq.length; k++) {
        const pl = this.city.placeAt(seq[k].i, seq[k].j); if (!pl) continue;
        const t = WS.City.TYPES[pl.type];
        if (pl.conn) { this.toast(RA.t('{ad} zaten bağlı; tek girişi var. Yolu yanından geçir.', { ad: RA.t(t.name) }), true); RA.audio.play('denied'); return; }
        if (t.need !== this.tool) { this.toast(RA.t('Bu kare {ad} için ayrıldı: {nasil}', { ad: RA.t(t.name), nasil: RA.t(WS.City.HOW[t.need]) }), true); RA.audio.play('denied'); return; }
        if (k > 0) { cut = seq.slice(0, k + 1); break; }
      }
      seq = cut;
      const before = JSON.stringify(this.grid.serialize());
      const r = WS.applyStroke(this.grid, seq, this.tool, this.style);
      if (!r.ok) { if (r.msg) { this.toast(r.msg, true); RA.audio.play('denied'); RA.vibrate([20, 40, 20]); } return; }
      this.undoStack.push(before); if (this.undoStack.length > 30) this.undoStack.shift(); $('ws-undo').disabled = false;
      this.commit(r.info);
    }
    tapAt(x, y) {
      const sim = this.sim, w = this.app.w, h = this.app.h;
      // uçak
      let best = null, bd = 46;
      for (const p of sim.planes) {
        const q = RA.project(new T.Vector3(p.x, (p.gy || 0) + p.alt + 0.25, p.z), this.camera, w, h);
        const d = Math.hypot(q.x - x, q.y - y); if (d < bd) { bd = d; best = p; }
      }
      if (best) {
        if (sim.ai) { this.toast(RA.t('{kod}: kule (yapay zekâ) sıraya aldı.', { kod: best.code })); return; }
        const r = sim.tapPlane(best);
        if (r === 'ok') { RA.audio.play('select'); this.toast(RA.t('{kod} için izin verildi.', { kod: best.code })); }
        else if (r === 'busy') { RA.audio.play('denied'); this.toast(RA.t('Pist dolu: uçak bekliyor.'), true); }
        return;
      }
      const c = this.cellAt(x, y);
      if (!c || !this.grid.inside(c.i, c.j)) return;
      const cell = this.grid.cell(c.i, c.j);
      const J = sim.jc.get(c.i + ',' + c.j + ',0');
      if (J) {
        if (sim.ai) { this.toast(RA.t('Bu kavşağın ışıklarını yapay zekâ yönetiyor. Elle yönetmek için YZ\'yi kapat.')); return; }
        sim.tapJunction(J); RA.audio.play('light'); return;
      }
      const k = cell.pieces.findIndex((p) => p.type === 'rail' && WS.portCount(p.m) >= 3);
      if (k >= 0) {
        if (sim.ai) { this.toast(RA.t('Makasları yapay zekâ boş hatta göre ayarlıyor. Elle için YZ\'yi kapat.')); return; }
        sim.tapSwitch(c.i, c.j, k); RA.audio.play('switch'); this.toast(RA.t('Makas çevrildi.')); return;
      }
      if (this.tool === 'look' && !cell.pieces.length) this.toast(RA.t('Çizmek için aşağıdan Yol, Ray, Taksi yolu ya da Pist seç.'));
    }

    /* ---------- döngü ---------- */
    update(dt) { if (!this.paused) { this.sim.update(dt); this.city.update(dt); } }
    frame(dt) {
      this.sim.visuals();
      this.city.visuals(performance.now() / 1000, this.view ? this.view.d : 60);
      const now = performance.now();
      if (now - this.lastStats > 500) {
        this.lastStats = now;
        const s = this.sim.stats, net = this.net, parts = [];
        if (net.list.some((x) => x.fam === 'road')) {
          const sources = this.sim.lots.size + net.entries.filter((e) => e.fam === 'road').length;
          const wait = s.waitN ? (s.waitSum / s.waitN).toFixed(1) : '';
          parts.push(sources ? RA.t('{a} yolculuk · {b} araç', { a: s.cars, b: this.sim.cars.length }) + (s.waitN ? RA.t(' · bekleme {sn} sn', { sn: RA.dil === 'en' ? wait : wait.replace('.', ',') }) : '') : RA.t('Araçlar için otopark ya da şehir dışı çıkışı ekle'));
        }
        if (net.list.some((x) => x.fam === 'rail')) parts.push(RA.t('{a} tren · {b} sefer', { a: this.sim.trains.length, b: s.trains }));
        if (net.runways.length) parts.push(RA.t('{a} iniş · {b} kalkış', { a: s.land, b: s.takeoff }));
        $('ws-stats').textContent = parts.length ? parts.join(' · ') : RA.t('Boş tahta: çizmeye başla');
        this.cityUI();
      }
    }
    // Şehir şeridi: memnuniyet, nüfus, bekleyen talep / sıkışma
    cityUI() {
      const c = this.city, mood = Math.round(c.mood);
      const el = $('ws-mood');
      el.querySelector('b').textContent = RA.t('%{n}', { n: mood });
      el.querySelector('.meter i').style.width = mood + '%';
      el.dataset.lv = mood >= 70 ? 'ok' : mood >= 45 ? 'mid' : 'bad';
      const li = c.levelInfo(), pop = c.population();
      const pb = $('ws-popn');
      pb.querySelector('.lv b').textContent = RA.t(li.cur.name);
      pb.querySelector('.lv > span:not(.meter)').textContent = num(pop);
      pb.querySelector('.meter i').style.width = (li.next ? RA.clamp((pop - li.cur.min) / (li.next.min - li.cur.min), 0, 1) * 100 : 100) + '%';
      pb.title = li.next ? RA.t('{ad} için {n} kişi', { ad: RA.t(li.next.name), n: num(li.next.min) }) : RA.t('En büyük aşama');
      const n = c.waiting().length, jam = c.jams.length;
      const b = $('ws-dem');
      b.dataset.st = n ? 'dem' : jam ? 'jam' : 'none';
      b.querySelector('b').textContent = n ? String(n) : jam ? String(jam) : '0';
      b.querySelector('span').textContent = n ? RA.t('{n:talep:talep}', { n }) : jam ? RA.t('{n:sıkışık:sıkışık}', { n: jam }) : RA.t('talep');
    }
    resize(w, h) {
      this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
      const top = $('ws-city') && $('ws-city').offsetHeight ? $('ws-city') : $('ws').querySelector('.ws-top'), bar = $('ws').querySelector('.ws-bar');
      const tb = top && top.offsetHeight ? top.getBoundingClientRect().bottom - this.app.stage.getBoundingClientRect().top + 6 : 70;
      const zm = $('ws').querySelector('.ws-zoom');
      const lowTop = zm && zm.offsetHeight ? zm.getBoundingClientRect().top : bar && bar.offsetHeight ? bar.getBoundingClientRect().top : 0;
      const bb = lowTop ? this.app.stage.getBoundingClientRect().bottom - lowTop + 6 : 190;
      const hw = (WS.COLS * WS.S) / 2 + 0.6, hd = (WS.ROWS * WS.S) / 2 + 0.6;
      const tilt = T.MathUtils.degToRad(w / h > 0.75 ? 55 : 64);
      this.dir = new T.Vector3(0, Math.sin(tilt), Math.cos(tilt));
      const r = RA.fitCamera(this.camera, {
        dir: this.dir, target: new T.Vector3(0, 0, 0),
        points: [[-hw, 0, -hd], [hw, 0, -hd], [-hw, 0, hd], [hw, 0, hd], [0, 0.8, -hd]],
        margin: { top: tb / h, bottom: bb / h, left: 0.0, right: 0.0 },
      });
      this.fit = { t: r.target.clone(), d: r.dist };
      if (!this.view || !this.userView) this.fitView();
      else { this.clampView(); this.applyCam(); }
    }
  }
  RA.Workshop = Workshop;
})();
