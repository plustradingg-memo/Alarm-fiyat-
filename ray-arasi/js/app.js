/* RAY ARASI — uygulama kabuğu: oluşturucu, ana ekran ve Atölye döngüsü */
(function () {
  'use strict';
  const RA = window.RA;
  const T = THREE;
  const STEP = 1 / 60;
  const $ = (id) => document.getElementById(id);

  class App {
    constructor() {
      this.stage = $('stage');
      this.canvas = $('gl');
      this.state = 'menu';
      this.acc = 0;
      this.last = performance.now();
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
      this.showMenu();
      requestAnimationFrame((t) => this.loop(t));
    }

    bindUI() {
      this.stage.addEventListener('contextmenu', (e) => e.preventDefault());
      document.addEventListener('pointerdown', () => RA.audio.unlock(), { capture: true });
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
      // dikey alan: telefonda tam ekran, geniş ekranda ortada dikey sütun
      const w = Math.min(vw, Math.round(vh * 0.62));
      this.stage.style.width = w + 'px';
      this.stage.style.height = vh + 'px';
      this.w = w; this.h = vh;
      this.renderer.setSize(w, vh, false);
      this.canvas.style.width = w + 'px'; this.canvas.style.height = vh + 'px';
      if (this.ws) this.ws.resize(w, vh);
      if (this.lv) this.lv.resize(w, vh);
      this.menu.resize(w, vh);
    }

    showScreen(name) { ['menu', 'ws', 'lv'].forEach((s) => { $(s).hidden = s !== name; }); }
    showMenu() {
      this.state = 'menu';
      this.showScreen('menu');
      this.stage.dataset.mode = '';
      if (this.menu) this.menu.refresh();
    }
    openLevel(id) {
      RA.audio.unlock();
      if (!this.lv) this.lv = new RA.LV.Game(this);
      this.state = 'level';
      this.stage.dataset.mode = 'lv';
      this.showScreen('lv');
      this.lv.resize(this.w, this.h);
      this.lv.open(id);
      this.lv.resize(this.w, this.h);
      this.acc = 0; this.last = performance.now();
    }
    openWorkshop(domain) {
      RA.audio.unlock();
      if (!this.ws) this.ws = new RA.Workshop(this);
      this.state = 'workshop';
      this.stage.dataset.mode = 'ws';
      this.showScreen('ws');
      this.ws.resize(this.w, this.h);
      this.ws.open(domain);
      this.ws.resize(this.w, this.h);
      this.acc = 0; this.last = performance.now();
    }

    // testler için zamanı ileri sar
    advance(seconds) {
      const scr = this.state === 'workshop' ? this.ws : this.state === 'level' ? this.lv : null;
      if (!scr) return;
      const n = Math.round(seconds / STEP);
      for (let i = 0; i < n; i++) scr.update(STEP);
      scr.frame(0);
    }

    loop(now) {
      requestAnimationFrame((t) => this.loop(t));
      let dt = (now - this.last) / 1000; this.last = now;
      if (dt > 0.1) dt = 0.1;
      if (this.state === 'menu') { this.menu.render(dt); return; }
      const scr = this.state === 'workshop' ? this.ws : this.state === 'level' ? this.lv : null;
      if (scr) {
        if (!this.manual) { this.acc += dt; let n = 0; while (this.acc >= STEP && n < 6) { scr.update(STEP); this.acc -= STEP; n++; } if (n >= 6) this.acc = 0; }
        scr.frame(dt);
        this.renderer.setScissorTest(false);
        this.renderer.setViewport(0, 0, this.w, this.h);
        this.renderer.render(scr.scene, scr.camera);
      }
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
