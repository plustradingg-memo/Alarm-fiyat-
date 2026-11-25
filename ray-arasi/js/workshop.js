/* RAY ARASI — Atölye modu: kendi yolunu, rayını, havalimanını kur; yapay zekâ yönetsin */
(function () {
  'use strict';
  const RA = window.RA;
  const WS = RA.WS;
  const T = THREE;
  const $ = (id) => document.getElementById(id);
  const TITLES = { road: 'Karayolu', rail: 'Demiryolu', air: 'Havalimanı' };
  const DEF_TOOL = { road: 'road', rail: 'rail', air: 'taxi' };
  const TOOL_COL = { road: 0x5b6270, rail: 0x9a6b43, taxi: 0xf2c230, runway: 0x2c2f36, erase: 0xe5372d };

  class Workshop {
    constructor(app) {
      this.app = app;
      this.scene = new T.Scene();
      this.scene.background = new T.Color(0x2b3a42);
      this.camera = new T.PerspectiveCamera(32, 0.5, 0.5, 220);
      RA.makeLights(this.scene, { sky: 0xe6f0ff, ground: 0x7a6a4a, hemi: 0.75, sun: 0xffe2b8, sunI: 2.0, sunPos: [-14, 26, 12], sunTarget: [0, 0, 0], shadowSize: 18, fill: 0xbfd4ff, fillI: 0.25 });
      this.builder = new WS.Builder(this.scene);
      this.sim = new WS.Sim(this);
      this.tool = 'look'; this.style = 'grade'; this.domain = 'road';
      this.paused = false; this.undoStack = [];
      // çizim önizlemesi
      this.prev = new T.InstancedMesh(new T.BoxGeometry(WS.S * 0.92, 0.06, WS.S * 0.92), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45, depthWrite: false }), 64);
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
      $('ws-sample').addEventListener('click', () => { $('ws-pop').hidden = true; this.pushUndo(); this.grid = WS.template(this.domain); this.commit('Örnek düzen yüklendi.'); });
      $('ws-clear').addEventListener('click', () => { $('ws-pop').hidden = true; this.pushUndo(); this.grid = new WS.Grid(); this.commit('Tahta temizlendi. Geri almak için ↶'); });
      document.addEventListener('pointerdown', (e) => { if (!$('ws-pop').hidden && !e.target.closest('#ws-pop') && !e.target.closest('#ws-menu')) $('ws-pop').hidden = true; });
    }
    setTool(t) {
      this.tool = t;
      document.querySelectorAll('#ws [data-tool]').forEach((b) => { const on = b.dataset.tool === t; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
      $('ws-styles').classList.toggle('dim', !(t === 'road' || t === 'rail' || t === 'taxi'));
      if (this.builder.gridLines) this.builder.gridLines.visible = t !== 'look';
      const tips = {
        look: this.sim.ai ? 'İzle: yapay zekâ ışıkları, makasları ve kuleyi yönetiyor.' : 'Elle yönet: kavşağa, makasa ya da bekleyen uçağa dokun.',
        road: 'Yol: parmağını kareler üzerinde sürükle. Kenardan dışarı çizersen araçlar oradan girer.',
        rail: 'Ray: sürükleyerek hat döşe. Hatta değen yeni hat makas olur.',
        taxi: 'Taksi yolu: pisti kapılara bağla. Çıkmaz uçlar uçak park yeridir.',
        runway: 'Pist: en az üç karelik düz bir çizgi çiz.',
        erase: 'Sil: üzerinden geçtiğin kareler temizlenir.',
      };
      this.toast(tips[t]);
    }
    setStyle(s) {
      this.style = s;
      document.querySelectorAll('#ws [data-style]').forEach((b) => { const on = b.dataset.style === s; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
      this.toast({ grade: 'Kavşak: kesiştiği yere aynı seviyede bağlanır, ışıklar otomatik.', bridge: 'Köprü: kesiştiği yolun ya da rayın üstünden geçer.', tunnel: 'Alt geçit: kesiştiği yerin altından batıp çıkar.' }[s]);
    }
    setAI(on) {
      this.sim.ai = on;
      const b = $('ws-ai'); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.querySelector('span.lbl').textContent = on ? 'YZ' : 'Elle';
      b.setAttribute('aria-label', on ? 'Yapay zekâ açık' : 'Yapay zekâ kapalı, elle yönetim');
      this.toast(on ? 'Yapay zekâ yönetiyor: ışıklar trafiğe göre kendiliğinden değişir, boşken sarı yanıp söner.' : 'Yapay zekâ kapalı: İzle aracıyla kavşaklara, makaslara ve uçaklara dokunarak sen yönet.');
      RA.store.set('ws.ai', on);
    }
    setPaused(p) {
      this.paused = p;
      $('ws-play').classList.toggle('paused', p);
      $('ws-play').setAttribute('aria-label', p ? 'Trafiği başlat' : 'Trafiği durdur');
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
      $('ws-title').textContent = TITLES[domain];
      const saved = RA.store.get('ws.' + domain, null);
      try { this.grid = saved ? WS.Grid.load(saved) : WS.template(domain); } catch (e) { this.grid = WS.template(domain); }
      this.undoStack = []; $('ws-undo').disabled = true;
      this.sim.clearAll();
      this.sim.stats = { cars: 0, waitSum: 0, waitN: 0, trains: 0, land: 0, takeoff: 0 };
      this.sim.ai = RA.store.get('ws.ai', true) !== false; this.setAI(this.sim.ai);
      this.setDensity(RA.store.get('ws.density', 3));
      this.setPaused(false);
      this.rebuild();
      this.setTool('look');
      this.setStyle('grade');
      // ilk açılışta kısa yönlendirme
      this.toast(this.sim.ai ? 'Aşağıdan bir araç seç ve kareler üzerinde sürükleyerek çiz. Yapay zekâ ışıkları yönetiyor.' : '');
      this.lastStats = 0;
    }
    rebuild() {
      this.net = new WS.Net(this.grid);
      const dyn = this.builder.build(this.net);
      this.sim.setNet(this.net, dyn);
      if (this.builder.gridLines) this.builder.gridLines.visible = this.tool !== 'look';
    }
    save() { RA.store.set('ws.' + this.domain, this.grid.serialize()); }
    pushUndo() { this.undoStack.push(JSON.stringify(this.grid.serialize())); if (this.undoStack.length > 30) this.undoStack.shift(); $('ws-undo').disabled = false; }
    undo() {
      const s = this.undoStack.pop();
      if (!s) return;
      this.grid = WS.Grid.load(JSON.parse(s));
      this.commit('Geri alındı.');
      $('ws-undo').disabled = !this.undoStack.length;
    }
    commit(msg) { this.save(); this.rebuild(); if (msg) this.toast(msg); RA.audio.play('switch'); }

    /* ---------- girdi ---------- */
    cellAt(x, y) {
      const p = RA.screenToGround(x, y, this.camera, this.app.w, this.app.h, 0);
      if (!p) return null;
      return { i: Math.round((p.x - this.net.ox) / WS.S), j: Math.round((p.z - this.net.oz) / WS.S), x: p.x, z: p.z };
    }
    bindInput() {
      const st = this.app.stage;
      const local = (e) => { const r = st.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
      st.addEventListener('pointerdown', (e) => {
        if (this.app.state !== 'workshop' || e.target.closest('button, .ws-bar, .ws-top, #ws-pop')) return;
        RA.audio.unlock();
        e.preventDefault();
        const p = local(e);
        const c = this.cellAt(p.x, p.y);
        this.drag = { id: e.pointerId, x0: p.x, y0: p.y, cells: c ? [c] : [], moved: false };
        try { st.setPointerCapture(e.pointerId); } catch (err) { /* yok */ }
        this.updatePreview();
      }, { passive: false });
      st.addEventListener('pointermove', (e) => {
        if (!this.drag || e.pointerId !== this.drag.id) return;
        const p = local(e);
        if (Math.hypot(p.x - this.drag.x0, p.y - this.drag.y0) > 8) this.drag.moved = true;
        const c = this.cellAt(p.x, p.y);
        if (!c) return;
        const last = this.drag.cells[this.drag.cells.length - 1];
        if (!last || last.i !== c.i || last.j !== c.j) { this.drag.cells.push(c); this.updatePreview(); }
      });
      const end = (e) => {
        if (!this.drag || e.pointerId !== this.drag.id) return;
        const d = this.drag; this.drag = null;
        const p = local(e);
        if (this.tool === 'look' || !d.moved) { this.prev.count = 0; if (!d.moved) this.tapAt(p.x, p.y); return; }
        this.applyStroke(d.cells);
      };
      st.addEventListener('pointerup', end);
      st.addEventListener('pointercancel', (e) => { if (this.drag && e.pointerId === this.drag.id) { this.drag = null; this.prev.count = 0; } });
      window.addEventListener('keydown', (e) => {
        if (this.app.state !== 'workshop') return;
        if ((e.key === 'z' || e.key === 'Z') && (e.ctrlKey || e.metaKey)) { this.undo(); e.preventDefault(); }
        if (e.key === 'Escape') this.app.showMenu();
      });
    }
    updatePreview() {
      const d = this.drag;
      if (!d || this.tool === 'look') { this.prev.count = 0; return; }
      const seq = WS.strokeCells(d.cells.map((c) => ({ i: c.i, j: c.j })));
      const o = new T.Object3D();
      let n = 0;
      for (const c of seq) {
        if (!this.grid.inside(c.i, c.j) || n >= 64) continue;
        o.position.set(this.net.cx(c.i), 0.12, this.net.cz(c.j)); o.updateMatrix();
        this.prev.setMatrixAt(n++, o.matrix);
      }
      this.prev.count = n; this.prev.instanceMatrix.needsUpdate = true;
      this.prev.material.color.setHex(TOOL_COL[this.tool] || 0xffffff);
      this.prev.material.opacity = this.tool === 'erase' ? 0.5 : 0.42;
    }
    applyStroke(cells) {
      const seq = WS.strokeCells(cells.map((c) => ({ i: c.i, j: c.j })));
      this.prev.count = 0;
      if (this.tool === 'erase') {
        const before = JSON.stringify(this.grid.serialize());
        if (WS.eraseStroke(this.grid, seq)) { this.undoStack.push(before); $('ws-undo').disabled = false; this.commit(); }
        return;
      }
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
        if (sim.ai) { this.toast(best.code + ': kule (yapay zekâ) sıraya aldı.'); return; }
        const r = sim.tapPlane(best);
        if (r === 'ok') { RA.audio.play('select'); this.toast(best.code + ' için izin verildi.'); }
        else if (r === 'busy') { RA.audio.play('denied'); this.toast('Pist dolu: uçak bekliyor.', true); }
        return;
      }
      const c = this.cellAt(x, y);
      if (!c || !this.grid.inside(c.i, c.j)) return;
      const cell = this.grid.cell(c.i, c.j);
      const J = sim.jc.get(c.i + ',' + c.j + ',0');
      if (J) {
        if (sim.ai) { this.toast('Bu kavşağın ışıklarını yapay zekâ yönetiyor. Elle yönetmek için YZ\'yi kapat.'); return; }
        sim.tapJunction(J); RA.audio.play('light'); return;
      }
      const k = cell.pieces.findIndex((p) => p.type === 'rail' && WS.portCount(p.m) >= 3);
      if (k >= 0) {
        if (sim.ai) { this.toast('Makasları yapay zekâ boş hatta göre ayarlıyor. Elle için YZ\'yi kapat.'); return; }
        sim.tapSwitch(c.i, c.j, k); RA.audio.play('switch'); this.toast('Makas çevrildi.'); return;
      }
      if (this.tool === 'look' && !cell.pieces.length) this.toast('Çizmek için aşağıdan Yol, Ray, Taksi yolu ya da Pist seç.');
    }

    /* ---------- döngü ---------- */
    update(dt) { if (!this.paused) this.sim.update(dt); }
    frame(dt) {
      this.sim.visuals();
      const now = performance.now();
      if (now - this.lastStats > 500) {
        this.lastStats = now;
        const s = this.sim.stats, net = this.net, parts = [];
        if (net.list.some((x) => x.fam === 'road')) parts.push(s.cars + ' araç geçti' + (s.waitN ? ' · bekleme ' + (s.waitSum / s.waitN).toFixed(1).replace('.', ',') + ' sn' : ''));
        if (net.list.some((x) => x.fam === 'rail')) parts.push(this.sim.trains.length + ' tren · ' + s.trains + ' sefer');
        if (net.runways.length) parts.push(s.land + ' iniş · ' + s.takeoff + ' kalkış');
        $('ws-stats').textContent = parts.length ? parts.join(' · ') : 'Boş tahta: çizmeye başla';
      }
    }
    resize(w, h) {
      this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
      const top = $('ws').querySelector('.ws-top'), bar = $('ws').querySelector('.ws-bar');
      const tb = top && top.offsetHeight ? top.getBoundingClientRect().bottom - this.app.stage.getBoundingClientRect().top + 6 : 70;
      const bb = bar && bar.offsetHeight ? this.app.stage.getBoundingClientRect().bottom - bar.getBoundingClientRect().top + 6 : 150;
      const hw = (WS.COLS * WS.S) / 2 + 0.6, hd = (WS.ROWS * WS.S) / 2 + 0.6;
      const tilt = T.MathUtils.degToRad(w / h > 0.75 ? 52 : 66);
      this.camera.fov = 28; this.camera.updateProjectionMatrix();
      RA.fitCamera(this.camera, {
        dir: new T.Vector3(0, Math.sin(tilt), Math.cos(tilt)), target: new T.Vector3(0, 0, 0),
        points: [[-hw, 0, -hd], [hw, 0, -hd], [-hw, 0, hd], [hw, 0, hd], [0, 0.8, -hd]],
        margin: { top: tb / h, bottom: bb / h, left: 0.0, right: 0.0 },
      });
    }
  }
  RA.Workshop = Workshop;
})();
