/* RAY ARASI — uygulama kabuğu: oluşturucu, ekranlar, tur akışı, girdi, duraklatma */
(function () {
  'use strict';
  const RA = window.RA;
  const T = THREE;
  const ROUND = 45;
  const STEP = 1 / 60;
  const $ = (id) => document.getElementById(id);

  class App {
    constructor() {
      this.stage = $('stage');
      this.canvas = $('gl');
      this.labels = $('labels');
      this.state = 'menu';
      this.modes = {};
      this.mode = null;
      this.round = null;
      this.acc = 0;
      this.last = performance.now();
      this.debug = /[?&]debug/.test(location.search);
      this.manual = false; // testler için: gerçek zamanlı simülasyonu durdur

      this.renderer = new T.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
      this.renderer.setPixelRatio(RA.quality.dpr);
      this.renderer.outputEncoding = T.sRGBEncoding;
      this.renderer.toneMapping = T.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.0;
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = T.PCFSoftShadowMap;

      this.menu = new RA.Menu(this);
      this.bindUI();
      this.resize();
      window.addEventListener('resize', () => this.resize());
      window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 200));
      document.addEventListener('visibilitychange', () => { if (document.hidden) this.pause(true); });
      window.addEventListener('pagehide', () => this.pause(true));
      this.showMenu();
      requestAnimationFrame((t) => this.loop(t));
    }

    /* ---------- arayüz bağlantıları ---------- */
    bindUI() {
      const stage = this.stage;
      const onDown = (e) => {
        RA.audio.unlock();
        if (this.state !== 'play' || !this.round || this.round.ending) return;
        if (e.target.closest && e.target.closest('button')) return;
        const r = stage.getBoundingClientRect();
        const x = e.clientX - r.left, y = e.clientY - r.top;
        e.preventDefault();
        this.mode.tap(x, y);
      };
      stage.addEventListener('pointerdown', onDown, { passive: false });
      stage.addEventListener('contextmenu', (e) => e.preventDefault());
      document.addEventListener('pointerdown', () => RA.audio.unlock(), { capture: true });
      window.addEventListener('keydown', (e) => {
        if (e.repeat) return;
        RA.audio.unlock();
        if (this.state === 'play' && this.round && !this.round.ending) {
          if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') { this.pause(); e.preventDefault(); return; }
          if (this.mode.key && this.mode.key(e.key)) e.preventDefault();
        } else if (this.state === 'paused' && (e.key === 'Escape' || e.key === ' ' || e.key === 'Enter')) { this.resume(); e.preventDefault(); }
        else if (this.state === 'result' && (e.key === 'Enter' || e.key === ' ')) { this.start(this.mode.id); e.preventDefault(); }
      });
      $('btn-pause').addEventListener('click', () => this.pause());
      $('btn-resume').addEventListener('click', () => this.resume());
      $('btn-pause-menu').addEventListener('click', () => this.showMenu());
      $('btn-again').addEventListener('click', () => this.start(this.mode.id));
      $('btn-modes').addEventListener('click', () => this.showMenu());
      const snd = () => {
        const on = !RA.audio.enabled; RA.audio.setEnabled(on); RA.audio.unlock();
        document.querySelectorAll('.btn-sound').forEach((b) => { b.classList.toggle('off', !on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); b.setAttribute('aria-label', on ? 'Sesi kapat' : 'Sesi aç'); });
        if (on) RA.audio.play('tap');
      };
      document.querySelectorAll('.btn-sound').forEach((b) => {
        b.addEventListener('click', snd);
        b.classList.toggle('off', !RA.audio.enabled);
        b.setAttribute('aria-pressed', RA.audio.enabled ? 'true' : 'false');
      });
    }

    resize() {
      const app = $('app');
      const vh = app.clientHeight || window.innerHeight;
      const vw = app.clientWidth || window.innerWidth;
      // dikey oyun alanı: telefonda tam ekran, geniş ekranda ortada dikey sütun
      const w = Math.min(vw, Math.round(vh * 0.62));
      this.stage.style.width = w + 'px';
      this.stage.style.height = vh + 'px';
      this.w = w; this.h = vh;
      this.renderer.setSize(w, vh, false);
      this.canvas.style.width = w + 'px'; this.canvas.style.height = vh + 'px';
      if (this.mode) this.mode.resize(w, vh);
      this.menu.resize(w, vh);
    }

    // üst gösterge + ipucu bandının kapladığı yükseklik (sahne bunun altına sığdırılır)
    topInset() {
      const hint = $('hint');
      if (!$('hud').hidden && !hint.hidden) {
        const sr = this.stage.getBoundingClientRect(), r = hint.getBoundingClientRect();
        if (r.height > 0) return Math.round(r.bottom - sr.top + 14 + 6);
      }
      return Math.round(Math.max(130, this.h * 0.16));
    }

    getMode(id) {
      if (!this.modes[id]) {
        const C = { rail: RA.RailMode, road: RA.RoadMode, air: RA.AirMode }[id];
        this.modes[id] = new C(this);
      }
      return this.modes[id];
    }

    /* ---------- ekranlar ---------- */
    showScreen(name) {
      ['menu', 'hud', 'result', 'pause'].forEach((s) => { $(s).hidden = s !== name && !(name === 'pause' && s === 'hud') && !(name === 'result' && s === 'hud'); });
    }
    showMenu() {
      this.state = 'menu';
      this.round = null;
      this.clearLabels();
      this.showScreen('menu');
      this.menu.refresh();
      this.stage.dataset.mode = '';
    }
    clearLabels() { this.labels.innerHTML = ''; }

    start(id) {
      RA.audio.unlock();
      const mode = this.getMode(id);
      if (this.mode && this.mode !== mode && this.mode.leave) this.mode.leave();
      this.mode = mode;
      this.clearLabels();
      this.stage.dataset.mode = id;
      const seed = RA.dailySeed(id);
      this.round = { t: 0, score: 0, ending: null, over: false, best: RA.records.get(id), hintUntil: 6.5, hintHidden: false };
      $('hud-mode').textContent = mode.title;
      $('hud-best').textContent = this.round.best;
      $('hud-score').textContent = '0';
      $('hint-text').textContent = mode.hint;
      const hint = $('hint'); hint.classList.remove('gone'); hint.hidden = false;
      this.showScreen('hud');
      mode.resize(this.w, this.h);
      mode.reset(seed);
      this.updateTimer();
      this.state = 'play';
      this.acc = 0; this.last = performance.now();
    }

    pause(auto) {
      if (this.state !== 'play') return;
      this.state = 'paused';
      $('pause-title').textContent = auto ? 'Oyun durdu' : 'Duraklatıldı';
      $('pause-sub').textContent = auto ? 'Başka bir sekmeye geçtiğin için süre durdu.' : 'Süre durdu. Hazır olunca devam et.';
      this.showScreen('pause');
    }
    resume() {
      if (this.state !== 'paused') return;
      this.state = 'play';
      this.showScreen('hud');
      this.acc = 0; this.last = performance.now();
    }

    /* ---------- tur olayları (modlar çağırır) ---------- */
    addScore(n, worldPos) {
      if (!this.round || this.round.over) return;
      this.round.score += n || 1;
      $('hud-score').textContent = this.round.score;
      const sc = $('hud-scorebox'); sc.classList.remove('bump'); void sc.offsetWidth; sc.classList.add('bump');
      RA.audio.play('point');
      if (worldPos) this.popText('+' + (n || 1), worldPos, 'pop-score');
    }
    popText(text, worldPos, cls) {
      const p = RA.project(worldPos, this.mode.camera, this.w, this.h);
      const el = document.createElement('div');
      el.className = 'pop ' + (cls || '');
      el.textContent = text;
      el.style.left = p.x + 'px'; el.style.top = p.y + 'px';
      this.labels.appendChild(el);
      setTimeout(() => el.remove(), 1300);
    }
    hintDone() { if (this.round && this.round.hintUntil > this.round.t + 1.4) this.round.hintUntil = this.round.t + 1.4; }
    fail(title, message, delay) {
      if (!this.round || this.round.ending) return;
      this.round.ending = { title, message, delay: delay == null ? 1.4 : delay, fail: true };
    }

    finish() {
      const r = this.round; if (!r || r.over) return;
      r.over = true;
      const mode = this.mode;
      const rec = RA.records.submit(mode.id, r.score);
      const fail = r.ending && r.ending.fail;
      const secs = Math.min(ROUND, Math.max(1, Math.round(r.t)));
      $('res-title').textContent = fail ? r.ending.title : 'Süre doldu';
      let sentence;
      if (fail) sentence = r.ending.message + ' ' + mode.scoreSentence(r.score, secs, true);
      else sentence = mode.scoreSentence(r.score, ROUND, false);
      $('res-sentence').textContent = sentence;
      $('res-score').textContent = r.score;
      $('res-unit').textContent = mode.unitLabel;
      const recEl = $('res-record');
      if (rec.isNew && r.score > 0) { recEl.textContent = rec.prev > 0 ? 'Yeni rekor! Önceki: ' + rec.prev : 'İlk rekorun kaydedildi!'; recEl.classList.add('new'); }
      else { recEl.textContent = 'Rekor: ' + rec.best; recEl.classList.remove('new'); }
      $('res-day').textContent = 'Bugünün trafik akışı (' + RA.todayLabel() + '). Yarın sıra değişir.';
      $('result').dataset.fail = fail ? '1' : '0';
      this.state = 'result';
      this.showScreen('result');
      RA.audio.play(rec.isNew && r.score > 0 ? 'record' : 'end');
      setTimeout(() => { const b = $('btn-again'); if (b && this.state === 'result') b.focus({ preventScroll: true }); }, 50);
    }

    updateTimer() {
      const r = this.round; if (!r) return;
      const left = Math.max(0, ROUND - r.t);
      const secs = Math.ceil(left - 1e-6);
      const el = $('hud-time');
      if (el.textContent !== String(secs)) el.textContent = secs;
      $('hud-bar').style.transform = 'scaleX(' + (left / ROUND).toFixed(4) + ')';
      $('hud-timebox').classList.toggle('low', left <= 5.5 && left > 0);
    }

    /* ---------- simülasyon ---------- */
    step(dt) {
      const r = this.round;
      if (!r || r.over) return;
      if (r.ending) {
        this.mode.update(dt, r.t, true);
        r.ending.delay -= dt;
        if (r.ending.delay <= 0) this.finish();
        return;
      }
      r.t += dt;
      this.mode.update(dt, r.t, false);
      if (!r.hintHidden && r.t >= r.hintUntil) { r.hintHidden = true; $('hint').classList.add('gone'); }
      if (r.t >= ROUND && !r.ending) { r.ending = { title: 'Süre doldu', message: '', delay: 0.01, fail: false }; }
    }
    // testler için zamanı ileri sar
    advance(seconds) {
      const n = Math.round(seconds / STEP);
      for (let i = 0; i < n; i++) { if (this.state === 'play') this.step(STEP); }
      if (this.mode && this.mode.frame) this.mode.frame(0);
      this.updateTimer();
    }

    loop(now) {
      requestAnimationFrame((t) => this.loop(t));
      let dt = (now - this.last) / 1000; this.last = now;
      if (dt > 0.1) dt = 0.1;
      if (this.state === 'menu') { this.menu.render(dt); return; }
      if (!this.mode) return;
      if (this.state === 'play' && !this.manual) {
        this.acc += dt;
        let n = 0;
        while (this.acc >= STEP && n < 8) { this.step(STEP); this.acc -= STEP; n++; }
        if (n >= 8) this.acc = 0;
        this.updateTimer();
      }
      this.mode.frame(this.state === 'play' ? dt : 0);
      this.renderer.setScissorTest(false);
      this.renderer.setViewport(0, 0, this.w, this.h);
      this.renderer.render(this.mode.scene, this.mode.camera);
    }
  }

  RA.App = App;
  function boot() {
    if (RA.app) return;
    try {
      RA.app = new App();
    } catch (e) {
      const f = document.getElementById('fatal');
      if (f) { f.hidden = false; f.querySelector('.res-sentence').textContent = 'Bu tarayıcı WebGL çalıştıramadı. Güncel bir Chrome, Safari, Firefox veya Edge ile tekrar dene.'; }
      console.error(e);
    }
  }
  if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', boot); else boot();
})();
