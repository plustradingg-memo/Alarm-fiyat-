/* RAY ARASI — Bölümler: oyun ekranı (serbest çizim, kesişim türü, silme, geri al, başlat, kazan/kaybet, yıldızlar) */
(function () {
  'use strict';
  const RA = window.RA;
  const LV = RA.LV;
  const T = THREE;
  const $ = (id) => document.getElementById(id);
  const G = LV.geo;
  const CYCLE = { road: ['junction', 'bridge', 'tunnel'], rail: ['level', 'bridge', 'tunnel'] };
  const TNAME = { junction: 'kavşak', level: 'hemzemin geçit', bridge: 'köprü', tunnel: 'alt geçit' };

  LV.progress = {
    get() { return RA.store.get('lv.stars', {}) || {}; },
    stars(id) { return this.get()[id] || 0; },
    unlocked(id) { return id === 1 || this.stars(id - 1) > 0; },
    set(id, n) { const p = this.get(); if ((p[id] || 0) < n) { p[id] = n; RA.store.set('lv.stars', p); } },
  };

  class LvGame {
    constructor(app) {
      this.app = app;
      this.scene = new T.Scene();
      this.scene.background = new T.Color(0x2b3a42);
      this.camera = new T.PerspectiveCamera(28, 0.5, 0.5, 420);
      this.lights = RA.makeLights(this.scene, { sky: 0xe6f0ff, ground: 0x7a6a4a, hemi: 0.78, sun: 0xffe2b8, sunI: 2.0, sunPos: [-12, 26, 10], sunTarget: [0, 0, 0], shadowSize: 20, fill: 0xbfd4ff, fillI: 0.25 });
      this.view = new LV.View(this.scene);
      this.sim = new LV.Sim(this);
      this.tool = 'road'; this.cross = 'junction';
      this.bindUI(); this.bindInput();
    }

    /* ---------- bölüm aç ---------- */
    open(id) {
      const def = LV.LEVELS.find((l) => l.id === id) || LV.LEVELS[0];
      clearTimeout(this.endT); clearTimeout(this.hintT); // önceki bölümden bekleyen kart / ipucu yeni bölüme düşmesin
      this.level = LV.prep(def);
      this.strokes = []; this.choices = {}; this.nextId = 1; this.undoStack = [];
      this.started = false; this.running = false; this.speed = 1; this.ended = null;
      this.net = LV.buildNet(this.level, [], {});
      this.view.buildBase(this.level, this.net);
      this.view.buildRoads(this.level, this.net);
      this.view.hint(null);
      this.sim.setup(this.level, this.net);
      $('lv-title').textContent = 'Bölüm ' + def.id + ' · ' + def.name;
      this.setTool('road'); this.setCross('junction');
      this.updPlay(); this.hud(true);
      this.showCard('intro');
    }
    snapshot() { return { strokes: this.strokes.map((s) => ({ id: s.id, pts: s.pts })), choices: Object.assign({}, this.choices), nextId: this.nextId }; }
    // yeni ağı dene; kurala uyuyorsa uygula
    tryCommit(strokes, choices, okMsg, check) {
      const res = LV.buildNet(this.level, strokes, choices, { check });
      if (!res.ok) { this.toast(res.msg, true); RA.audio.play('denied'); RA.vibrate([20, 40, 20]); if (res.at) this.flash(res.at); return false; }
      this.undoStack.push(this.snapshot()); if (this.undoStack.length > 40) this.undoStack.shift();
      this.strokes = strokes; this.choices = choices; this.net = res;
      this.view.buildRoads(this.level, res);
      this.sim.setNet(res);
      this.hud(true);
      if (okMsg) this.toast(okMsg);
      RA.audio.play('switch');
      return true;
    }
    undo() {
      const s = this.undoStack.pop(); if (!s) return;
      const res = LV.buildNet(this.level, s.strokes, s.choices, {});
      if (!res.ok) return;
      this.strokes = s.strokes; this.choices = s.choices; this.nextId = Math.max(this.nextId, s.nextId); this.net = res;
      this.view.buildRoads(this.level, res); this.sim.setNet(res); this.hud(true);
      this.toast('Geri alındı.');
    }

    /* ---------- çizim ---------- */
    // ham noktalar (zemin) → uçları binaya / yola yapıştır, yumuşat, kesişim türlerini ata, dene
    addStroke(raw, crossTool, quiet) {
      if (!raw || raw.length < 2) return false;
      raw = raw.map((p) => ({ x: RA.clamp(p.x, -LV.C.BX, LV.C.BX), z: RA.clamp(p.z, -LV.C.BZ, LV.C.BZ) }));
      const net = this.net;
      const snapEnd = (p) => {
        // bina girişi: yol binadan dümdüz çıkar
        let best = null, bd = 1.7;
        for (const bn of net.bNodes) { const d = Math.hypot(bn.x - p.x, bn.z - p.z); if (d < bd) { bd = d; best = bn; } }
        if (best) {
          if (best.deg > 0) return { err: 'Bu binanın yolu var; yeni yolu o yola bağla.' };
          const b = best.bld;
          return { pt: { x: b.ex, z: b.ez }, dir: { x: b.ux, z: b.uz }, b };
        }
        // var olan yol: ucu yakınsa uca, değilse üstündeki en yakın noktaya
        let q = null, qd = 1.1;
        for (const st of net.S) {
          for (const end of [0, st.len]) { const e = G.at(st, end); const d = Math.hypot(e.x - p.x, e.z - p.z) - 0.45; if (d < qd) { q = e; qd = d; } }
          const n = G.nearest(st, p.x, p.z); if (n.d < qd) { qd = n.d; q = { x: n.x, z: n.z }; }
        }
        return { pt: q };
      };
      const a = snapEnd(raw[0]), b = snapEnd(raw[raw.length - 1]);
      if (a.err || b.err) { this.toast(a.err || b.err, true); RA.audio.play('denied'); return false; }
      if (a.b && b.b && a.b === b.b) return false;
      const head = a.pt || raw[0], tail = b.pt || raw[raw.length - 1];
      // yapışan ucun yakınındaki ham noktaları at (kıvrım olmasın)
      const mid = raw.slice(1, -1).filter((p) => Math.hypot(p.x - head.x, p.z - head.z) > 0.8 && Math.hypot(p.x - tail.x, p.z - tail.z) > 0.8);
      const pts = LV.smoothStroke([head].concat(mid, [tail]), a.dir || null, b.dir || null);
      if (pts.sharp) { this.toast('Viraj çok keskin: daha geniş bir kavisle çiz.', true); RA.audio.play('denied'); return false; }
      pts[0] = head; pts[pts.length - 1] = tail;
      const st = G.stroke(this.nextId, pts);
      if (st.len < 1.2) return false;
      const choices = Object.assign({}, this.choices);
      for (const o of net.S) for (const x of G.intersections(st, o)) { const k = G.posKey(x.x, x.z); if (!(k in choices)) choices[k] = crossTool || this.cross; }
      for (const r of net.rails) for (const x of G.intersections(st, r)) { const k = G.posKey(x.x, x.z); if (!(k in choices)) choices[k] = (crossTool || this.cross) === 'junction' ? 'level' : crossTool || this.cross; }
      const id = this.nextId;
      const strokes = this.strokes.concat([{ id, pts }]);
      const before = this.net.crossings.length;
      const ok = this.tryCommit(strokes, choices, null, id);
      if (ok) {
        this.nextId++;
        if (!quiet) {
          const nb = this.net.crossings.length - before, conn = [a.b, b.b].filter(Boolean);
          const parts = [];
          if (conn.length) parts.push(conn.map((x) => LV.COLORS[x.color].name.toLowerCase() + ' ' + (x.kind === 'house' ? 'ev' : 'iş yeri')).join(' ve ') + ' bağlandı');
          if (nb > 0) parts.push(nb + ' kesişim (değiştirmek için işarete dokun)');
          const msg = parts.length ? parts.join(' · ') + '.' : 'Yol eklendi.';
          this.toast(msg.charAt(0).toLocaleUpperCase('tr-TR') + msg.slice(1));
        }
      }
      return ok;
    }
    cycleCrossing(c) {
      const order = CYCLE[c.kind];
      const k0 = order.indexOf(c.type);
      for (let k = 1; k < order.length; k++) {
        const t = order[(k0 + k) % order.length];
        const choices = Object.assign({}, this.choices, { [c.key]: t });
        const res = LV.buildNet(this.level, this.strokes, choices, {});
        if (res.ok) { this.tryCommit(this.strokes, choices, 'Kesişim: ' + TNAME[t] + '.'); return; }
        if (k === order.length - 1) { this.toast(res.msg, true); RA.audio.play('denied'); }
      }
    }
    eraseAt(p) {
      let best = null, bd = 1.0;
      for (const e of this.net.edges) {
        const n = G.nearest(e.st, p.x, p.z);
        if (n.s < e.s0 - 0.01 || n.s > e.s1 + 0.01) continue;
        if (n.d < bd) { bd = n.d; best = e; }
      }
      if (!best) { this.toast('Silmek için bir yolun üstüne dokun.'); return; }
      const st = this.strokes.find((s) => s.id === best.st.id);
      const S = G.stroke(st.id, st.pts);
      const parts = [];
      if (best.s0 > 1.2) parts.push(G.slicePts(S, 0, best.s0));
      if (S.len - best.s1 > 1.2) parts.push(G.slicePts(S, best.s1, S.len));
      const strokes = this.strokes.filter((s) => s !== st);
      for (const pts of parts) strokes.push({ id: this.nextId++, pts });
      this.tryCommit(strokes, this.choices, 'Yol silindi.');
    }

    /* ---------- arayüz ---------- */
    bindUI() {
      document.querySelectorAll('#lv [data-lvtool]').forEach((b) => b.addEventListener('click', () => this.setTool(b.dataset.lvtool)));
      document.querySelectorAll('#lv [data-lvcross]').forEach((b) => b.addEventListener('click', () => this.setCross(b.dataset.lvcross)));
      $('lv-back').addEventListener('click', () => this.app.showMenu());
      $('lv-undo').addEventListener('click', () => this.undo());
      $('lv-play').addEventListener('click', () => this.togglePlay());
      $('lv-speed').addEventListener('click', () => { this.speed = this.speed === 1 ? 2 : 1; $('lv-speed').textContent = this.speed + '×'; });
      $('lv-hint').addEventListener('click', () => this.showHint());
      $('lv-card').addEventListener('click', (e) => {
        const b = e.target.closest('[data-act]'); if (!b) return;
        const act = b.dataset.act;
        if (act === 'start') this.hideCard();
        else if (act === 'next') { const nx = LV.LEVELS.find((l) => l.id === this.level.id + 1); if (nx) this.open(nx.id); else this.app.showMenu(); }
        else if (act === 'retry') this.restart(true);
        else if (act === 'reset') this.restart(false);
        else if (act === 'menu') this.app.showMenu();
      });
    }
    setTool(t) {
      this.tool = t;
      document.querySelectorAll('#lv [data-lvtool]').forEach((b) => { const on = b.dataset.lvtool === t; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
      $('lv-cross').classList.toggle('dim', t !== 'road');
    }
    setCross(c) {
      const L = this.level, u = (this.net && this.net.usage) || { bridges: 0, tunnels: 0 };
      if (c === 'bridge' && !L.bridges) { this.toast('Bu bölümde köprü hakkın yok.', true); return; }
      if (c === 'tunnel' && !L.tunnels) { this.toast('Bu bölümde alt geçit hakkın yok.', true); return; }
      this.cross = c;
      document.querySelectorAll('#lv [data-lvcross]').forEach((b) => { const on = b.dataset.lvcross === c; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
      if (this.started || this.strokes.length) this.toast({ junction: 'Kesişimler kavşak olur (ışıklı).', bridge: 'Yeni yol kesiştiği yolun üstünden köprüyle geçer.', tunnel: 'Yeni yol kesiştiği yolun altından geçer.' }[c]);
    }
    togglePlay() {
      if (this.ended) return;
      if (!this.started) {
        if (!this.net.bNodes.some((n) => n.bld.kind === 'house' && n.deg > 0)) { this.toast('Önce evlerden iş yerlerine yol çiz.', true); return; }
        this.started = true; this.running = true; this.view.hint(null);
        this.toast('Trafik başladı! Çizmeye devam edebilirsin; sıkışan yeri köprü ya da yeni yolla rahatlat.');
      } else this.running = !this.running;
      this.updPlay();
    }
    updPlay() {
      const b = $('lv-play');
      b.classList.toggle('run', this.running);
      b.querySelector('span').textContent = !this.started ? 'Başlat' : this.running ? 'Duraklat' : 'Devam';
      $('lv-speed').hidden = !this.started;
    }
    restart(keep) {
      const s = keep ? this.snapshot() : null;
      this.open(this.level.id);
      this.hideCard();
      if (s && s.strokes.length) { const res = LV.buildNet(this.level, s.strokes, s.choices, {}); if (res.ok) { this.strokes = s.strokes; this.choices = s.choices; this.nextId = s.nextId; this.net = res; this.view.buildRoads(this.level, res); this.sim.setNet(res); this.hud(true); } }
      this.toast(keep ? 'Yolların duruyor. Düzelt ve ▶ ile yeniden başlat.' : 'Bölüm baştan başladı.');
    }
    showHint() {
      const paths = this.level.solution.map(([, raw]) => { const b0 = this.level.blds.find((b) => Math.hypot(b.ex - raw[0][0], b.ez - raw[0][1]) < 0.4), b1 = this.level.blds.find((b) => Math.hypot(b.ex - raw[raw.length - 1][0], b.ez - raw[raw.length - 1][1]) < 0.4); return LV.smoothStroke(raw.map(([x, z]) => ({ x, z })), b0 && { x: b0.ux, z: b0.uz }, b1 && { x: b1.ux, z: b1.uz }); });
      this.view.hint(paths);
      this.toast('İpucu: ' + this.level.tip);
      clearTimeout(this.hintT); this.hintT = setTimeout(() => this.view.hint(null), 6000);
    }
    // çözüm yollarını sırayla çiz (testler ve ipucu için)
    playSolution() {
      for (const [tool, raw] of this.level.solution) this.addStroke(raw.map(([x, z]) => ({ x, z })), tool === 'road' ? 'junction' : tool, true);
      return this.strokes.length;
    }
    showCard(kind, extra) {
      const L = this.level, c = $('lv-card');
      const res = (L.budget ? '<li><b>' + L.budget + ' m</b> asfalt</li>' : '') + (L.bridges ? '<li><b>' + L.bridges + '</b> köprü</li>' : '') + (L.tunnels ? '<li><b>' + L.tunnels + '</b> alt geçit</li>' : '');
      let html = '';
      if (kind === 'intro') {
        html = '<p class="lv-kicker">Bölüm ' + L.id + '</p><h2>' + L.name + '</h2><p>' + L.intro + '</p>' +
          '<div class="lv-goalbox"><span>Hedef</span><b>' + L.goal + ' araç ulaştır</b><small>Bir ev ' + LV.Sim.PENDING_CAP + ' kişiyi bekletirse kaybedersin.</small></div>' +
          '<ul class="lv-res">' + res + '</ul><div class="lv-btns"><button data-act="start" class="primary" type="button">Kurmaya başla</button></div>';
      } else if (kind === 'win') {
        const s = extra;
        html = '<p class="lv-kicker">Bölüm ' + L.id + ' tamam</p><h2>Harika!</h2><div class="lv-stars">' + [1, 2, 3].map((k) => '<i class="' + (k <= s.stars ? 'on' : '') + '">★</i>').join('') + '</div>' +
          '<ul class="lv-crit"><li class="ok">' + L.goal + ' araç ulaştı</li><li class="' + (s.c2 ? 'ok' : '') + '">En çok ' + L.star2 + ' m asfalt (' + Math.round(s.len) + ' m)</li><li class="' + (s.c3 ? 'ok' : '') + '">Hiçbir ev 3 kişiden fazla bekletmedi (en çok ' + s.peak + ')</li></ul>' +
          '<div class="lv-btns">' + (LV.LEVELS.some((l) => l.id === L.id + 1) ? '<button data-act="next" class="primary" type="button">Sonraki bölüm</button>' : '<button data-act="menu" class="primary" type="button">Bütün bölümler bitti!</button>') + '<button data-act="retry" type="button">Daha iyisini dene</button><button data-act="menu" type="button">Bölümler</button></div>';
      } else {
        const h = extra;
        html = '<p class="lv-kicker">Bölüm ' + L.id + '</p><h2>Trafik tıkandı</h2><p>' + LV.COLORS[h.b.color].name + ' evdekiler ' + LV.Sim.PENDING_CAP + ' kişi bekledi' + (h.noRoute ? ': gidecekleri iş yerine yol yok.' : '; yollar onları taşıyamadı.') + ' Sıkışan yeri köprü, alt geçit ya da ikinci bir yolla rahatlat.</p>' +
          '<p class="lv-note">' + this.sim.stats.delivered + ' / ' + L.goal + ' araç ulaştı</p>' +
          '<div class="lv-btns"><button data-act="retry" class="primary" type="button">Yollarımla tekrar dene</button><button data-act="reset" type="button">Boş tahtayla başla</button><button data-act="menu" type="button">Bölümler</button></div>';
      }
      c.innerHTML = '<div class="lv-cardbox">' + html + '</div>';
      c.hidden = false; c.dataset.kind = kind;
    }
    hideCard() { $('lv-card').hidden = true; if (!this.started && this.level.id <= 3) this.toast(this.level.tip); }
    onDeliver() { if (this.sim.stats.delivered % 5 === 0) RA.audio.play('tap'); }
    onEnd(kind, h) {
      this.running = false; this.ended = kind; this.updPlay();
      if (kind === 'win') {
        const len = this.net.usage.len, peak = this.sim.stats.peak;
        const c2 = len <= this.level.star2 + 0.01, c3 = peak <= 3;
        const stars = 1 + (c2 ? 1 : 0) + (c3 ? 1 : 0);
        LV.progress.set(this.level.id, stars);
        RA.audio.play('record');
        this.endT = setTimeout(() => this.showCard('win', { stars, c2, c3, len, peak }), 700);
      } else {
        RA.audio.play('end');
        this.endT = setTimeout(() => this.showCard('lose', h), 700);
      }
    }
    hud(force) {
      const L = this.level, u = this.net.usage, st = this.sim.stats || { delivered: 0 };
      $('lv-goaltxt').textContent = st.delivered + ' / ' + L.goal;
      $('lv-goalbar').style.width = Math.min(100, (st.delivered / L.goal) * 100) + '%';
      if (force) {
        $('lv-budgettxt').textContent = Math.round(u.len) + ' / ' + L.budget + ' m';
        const f = u.len / L.budget;
        const bb = $('lv-budgetbar'); bb.style.width = Math.min(100, f * 100) + '%'; bb.dataset.lv = f > 0.9 ? 'bad' : f > 0.7 ? 'mid' : 'ok';
        $('lv-nb').textContent = Math.max(0, (L.bridges || 0) - u.bridges);
        $('lv-nt').textContent = Math.max(0, (L.tunnels || 0) - u.tunnels);
        document.querySelector('#lv [data-lvcross="bridge"]').disabled = !L.bridges;
        document.querySelector('#lv [data-lvcross="tunnel"]').disabled = !L.tunnels;
        $('lv-undo').disabled = !this.undoStack.length;
      }
    }
    toast(msg, err) {
      const el = $('lv-toast'); if (!msg) return;
      el.textContent = msg; el.hidden = false; el.classList.toggle('err', !!err);
      el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
      clearTimeout(this.toastT); this.toastT = setTimeout(() => { el.hidden = true; }, err ? 3200 : 3400);
    }
    flash(p) {
      const m = new T.Mesh(new T.RingGeometry(0.6, 0.95, 28), new T.MeshBasicMaterial({ color: 0xff3b2f, transparent: true, opacity: 0.9, depthWrite: false, depthTest: false }));
      m.rotation.x = -Math.PI / 2; m.position.set(p.x, 0.4, p.z); m.renderOrder = 30; this.scene.add(m);
      let t = 0; const tick = () => { t += 0.05; m.material.opacity = 0.9 * (1 - t); m.scale.setScalar(1 + t); if (t < 1) requestAnimationFrame(tick); else { this.scene.remove(m); m.geometry.dispose(); } }; tick();
    }

    /* ---------- dokunma ---------- */
    ground(x, y) { return RA.screenToGround(x, y, this.camera, this.app.w, this.app.h, 0); }
    markAt(x, y) {
      let best = null, bd = 30;
      for (const mk of this.view.marks || []) {
        const q = RA.project(new T.Vector3(mk.c.x, 2.0, mk.c.z), this.camera, this.app.w, this.app.h);
        const d = Math.hypot(q.x - x, q.y - y); if (d < bd) { bd = d; best = mk.c; }
      }
      return best;
    }
    bindInput() {
      const st = this.app.stage;
      const local = (e) => { const r = st.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
      st.addEventListener('pointerdown', (e) => {
        if (this.app.state !== 'level' || e.target.closest('button, .lv-bar, .lv-top, .lv-card')) return;
        if (!$('lv-card').hidden || this.ended) return;
        RA.audio.unlock(); e.preventDefault();
        const p = local(e);
        try { st.setPointerCapture(e.pointerId); } catch (err) { /* yok */ }
        const g = this.ground(p.x, p.y);
        this.drag = { id: e.pointerId, x0: p.x, y0: p.y, moved: false, raw: g ? [{ x: g.x, z: g.z }] : [] };
      }, { passive: false });
      st.addEventListener('pointermove', (e) => {
        const d = this.drag; if (!d || e.pointerId !== d.id) return;
        const p = local(e);
        if (Math.hypot(p.x - d.x0, p.y - d.y0) > 9) d.moved = true;
        if (!d.moved || this.tool !== 'road') return;
        const g = this.ground(p.x, p.y); if (!g) return;
        const last = d.raw[d.raw.length - 1];
        if (!last || Math.hypot(g.x - last.x, g.z - last.z) > 0.12) d.raw.push({ x: RA.clamp(g.x, -LV.C.BX, LV.C.BX), z: RA.clamp(g.z, -LV.C.BZ, LV.C.BZ) });
        let L = 0; for (let k = 1; k < d.raw.length; k++) L += Math.hypot(d.raw[k].x - d.raw[k - 1].x, d.raw[k].z - d.raw[k - 1].z);
        this.view.preview(d.raw, this.net.usage.len + L * 0.95 <= this.level.budget);
      });
      const end = (e) => {
        const d = this.drag; if (!d || e.pointerId !== d.id) return;
        this.drag = null; this.view.preview(null);
        if (e.type === 'pointercancel') return;
        const p = local(e);
        if (!d.moved) {
          const mk = this.markAt(p.x, p.y);
          if (mk) { this.cycleCrossing(mk); return; }
          const g = this.ground(p.x, p.y);
          if (g && this.tool === 'erase') this.eraseAt(g);
          else if (g && this.tool === 'road') this.toast('Çizmek için parmağını sürükle: bir evin önünden aynı renkteki binanın önüne.');
          return;
        }
        if (this.tool === 'road') this.addStroke(d.raw);
        else if (this.tool === 'erase') { const g = this.ground(p.x, p.y); if (g) this.eraseAt(g); }
      };
      st.addEventListener('pointerup', end);
      st.addEventListener('pointercancel', end);
    }

    /* ---------- döngü ---------- */
    update(dt) { if (this.running) this.sim.update(dt * this.speed); }
    frame(dt) {
      this.view.frame(this.sim, performance.now() / 1000, this.running);
      const now = performance.now();
      if (!this.lastHud || now - this.lastHud > 200) { this.lastHud = now; this.hud(false); }
    }
    resize(w, h) {
      this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
      const top = $('lv').querySelector('.lv-top'), bar = $('lv').querySelector('.lv-bar');
      const sr = this.app.stage.getBoundingClientRect();
      const tb = top && top.offsetHeight ? top.getBoundingClientRect().bottom - sr.top + 6 : 70;
      const bb = bar && bar.offsetHeight ? sr.bottom - bar.getBoundingClientRect().top + 6 : 150;
      const tilt = T.MathUtils.degToRad(w / h > 0.75 ? 52 : 57);
      const dir = new T.Vector3(0, Math.sin(tilt), Math.cos(tilt));
      const r = RA.fitCamera(this.camera, { dir, target: new T.Vector3(0, 0, 0), points: [[-10.4, 0, -16.4], [10.4, 0, -16.4], [-10.4, 0, 16.4], [10.4, 0, 16.4], [0, 2.2, -16]], margin: { top: tb / h, bottom: bb / h, left: 0.0, right: 0.0 } });
      this.camera.position.copy(r.target).addScaledVector(dir, r.dist); this.camera.lookAt(r.target); this.camera.updateMatrixWorld(true);
      const sun = this.lights.sun; sun.target.position.set(0, 0, 0); sun.position.set(-12, 26, 10);
      const sc = sun.shadow.camera; sc.left = -20; sc.right = 20; sc.top = 20; sc.bottom = -20; sc.far = 120; sc.updateProjectionMatrix(); sun.target.updateMatrixWorld();
    }
  }
  LV.Game = LvGame;
})();
