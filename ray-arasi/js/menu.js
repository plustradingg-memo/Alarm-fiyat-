/* RAY ARASI — ana ekran: üç canlı maket sahnesi; her kart kendi atölyesini açar */
(function () {
  'use strict';
  const RA = window.RA;
  const T = THREE;
  const M = RA.M;
  const rb = RA.rbox, mesh = RA.mesh;

  /* ---------- 1) Makastan geçen tren ---------- */
  function railScene() {
    const scene = new T.Scene(); scene.background = new T.Color(0x9cc28f);
    RA.makeLights(scene, { sky: 0xe6f0ff, ground: 0x8a7a5a, hemi: 0.8, sun: 0xffdcaa, sunI: 2.2, sunPos: [-6, 10, 6], shadowSize: 8 });
    const g = new T.Mesh(new T.PlaneGeometry(40, 30), new T.MeshStandardMaterial({ map: RA.tex.clone(RA.tex.grass(), 8, 6), roughness: 1 }));
    g.rotation.x = -Math.PI / 2; g.receiveShadow = true; scene.add(g);
    const main = new RA.PathBuilder(-9, 0.6, 0).line(18).build();
    const sd = new RA.PathBuilder(-2.2, 0.6, 0).to(1.6, -1.0, 0, 1).line(8).build();
    const gravel = new T.MeshStandardMaterial({ map: RA.tex.gravel(), roughness: 1 });
    const steel = RA.mat(0x9aa1aa, { roughness: 0.35, metalness: 0.6 });
    const stat = new T.Group();
    const prof = [[-0.66, 0], [-0.46, 0.13], [0.46, 0.13], [0.66, 0]];
    [main, sd].forEach((p, i) => {
      stat.add(new T.Mesh(RA.extrude(p, prof, { step: 0.25 }), gravel));
      stat.add(new T.Mesh(RA.barAlong(p, -0.3, 0.06, 0.08, 0.17, { s0: i ? 1.4 : 0 }), steel));
      stat.add(new T.Mesh(RA.barAlong(p, 0.3, 0.06, 0.08, 0.17, { s0: 0 }), steel));
      for (let s = 0.2; s < p.length; s += 0.42) { const P = p.at(s), Tn = p.tan(s); const sl = mesh(M.sleeperGeo(), RA.mat(0x6b4e3a), P.x, 0.155, P.z); sl.rotation.y = -Math.atan2(Tn.z, Tn.x); stat.add(sl); }
    });
    const rnd = RA.rng(3);
    for (let i = 0; i < 16; i++) { const x = -9 + rnd() * 18, z = rnd() < 0.5 ? -3 - rnd() * 3 : 2.2 + rnd() * 2.5; const t = M.tree(rnd, null, 0.8 + rnd() * 0.4); t.position.set(x, 0, z); stat.add(t); }
    const h = M.house(1.3, 1.0, 0.8, 0xf1dfc0, 0xb5482f, rnd); h.position.set(3.5, 0, 2.6); stat.add(h);
    scene.add(RA.mergeStatic(stat));
    const blade = mesh(RA.geo('mblade', () => { const b = new T.BoxGeometry(1.4, 0.08, 0.06); b.translate(0.7, 0.21, 0); return b; }), RA.mat(0xd8dde3, { metalness: 0.7, roughness: 0.25 }), -2.2, 0, 0.3);
    scene.add(blade);
    const grad = (() => { const c = document.createElement('canvas'); c.width = 8; c.height = 128; const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 128, 0, 0); gr.addColorStop(0, '#fff'); gr.addColorStop(0.55, '#aaa'); gr.addColorStop(1, '#000'); g.fillStyle = gr; g.fillRect(0, 0, 8, 128); return new T.CanvasTexture(c); })();
    const gm = () => new T.MeshBasicMaterial({ color: 0xffb21e, map: grad, transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending });
    const glowM = new T.Mesh(RA.ribbon(main, 0.6, 0.27, { s0: 6.8, s1: 11.5, vScale: 1 / 4.7 }), gm());
    const glowS = new T.Mesh(RA.ribbon(sd, 0.6, 0.27, { s0: 0, s1: 4.7, vScale: 1 / 4.7 }), gm());
    glowM.geometry.translate(0, 0, 0);
    scene.add(glowM, glowS);
    const units = M.train('passenger', RA.rng(9), 2);
    let off = 0; units.forEach((u, i) => { u.off = off + u.len / 2; off += u.len + 0.12; scene.add(u.g); });
    const cam = new T.PerspectiveCamera(34, 2, 0.5, 100); cam.position.set(0.2, 7.0, 6.4); cam.lookAt(0.0, 0, -0.4);
    const routeA = RA.Path.concat([main.slice(0, 6.8), sd]);
    let wa = 0;
    return {
      scene, camera: cam, frame(t) {
        const cyc = t % 7; const useSd = Math.floor(t / 7) % 2 === 0;
        const route = useSd ? routeA : main;
        const s = 3.0 + cyc * 2.1;
        const sw = cyc > 0.8 ? (useSd ? 1 : 0) : (useSd ? 0 : 1);
        blade.rotation.y = RA.lerp(blade.rotation.y, sw ? 0.14 : 0, 0.25);
        const fl = cyc > 0.8 && cyc < 1.8 ? Math.sin((cyc - 0.8) * Math.PI) : 0;
        (useSd ? glowS : glowM).material.opacity = 0.3 + fl * 0.7; (useSd ? glowM : glowS).material.opacity = 0;
        wa += 0.2;
        const F = {}, R = {};
        units.forEach((u) => { const c = s - u.off, hh = u.len / 2 - 0.26; route.at(c + hh, F); route.at(c - hh, R); u.g.position.set((F.x + R.x) / 2, 0, (F.z + R.z) / 2); u.g.rotation.y = -Math.atan2(F.z - R.z, F.x - R.x); u.g.userData.wheels.forEach((w) => (w.rotation.y = -wa)); });
      },
    };
  }

  /* ---------- 2) Işıkta bekleyen taksi ---------- */
  function roadScene() {
    const scene = new T.Scene(); scene.background = new T.Color(0xb9c8cf);
    RA.makeLights(scene, { sky: 0xf2f6ff, ground: 0x9a9080, hemi: 0.85, sun: 0xfff1d6, sunI: 2.0, sunPos: [6, 10, 5], shadowSize: 8 });
    const stat = new T.Group();
    const asphalt = new T.MeshStandardMaterial({ map: RA.tex.clone(RA.tex.asphalt(), 6, 2), roughness: 0.95 });
    const side = new T.MeshStandardMaterial({ map: RA.tex.clone(RA.tex.sidewalk(), 12, 3), roughness: 0.9 });
    stat.add(mesh(new T.BoxGeometry(40, 0.1, 30), side, 0, -0.05, 0));
    stat.add(mesh(new T.BoxGeometry(40, 0.1, 2.4), asphalt, 0, 0.0, 0));
    stat.add(mesh(new T.BoxGeometry(2.4, 0.1, 30), asphalt, 3.2, 0.0, 0));
    const white = RA.mat(0xf4f4f0);
    for (let x = -12; x < 1.6; x += 0.9) stat.add(mesh(new T.BoxGeometry(0.5, 0.02, 0.06), white, x, 0.06, 0));
    stat.add(mesh(new T.BoxGeometry(0.1, 0.02, 1.1), white, 1.7, 0.06, 0.55));
    for (let i = 0; i < 6; i++) stat.add(mesh(new T.BoxGeometry(0.42, 0.02, 0.16), white, 2.6 - 0.05, 0.06, -1.0 + i * 0.4).rotateY(Math.PI / 2));
    const rnd = RA.rng(5);
    for (let i = 0; i < 7; i++) { const t = M.tree(rnd, 'round', 0.75); t.position.set(-10 + i * 1.8, 0, -1.9); stat.add(t); }
    const b1 = M.block(3.0, 1.6, 1.4, 0xe9c9a5, rnd, { awning: 0xc0392b }); b1.position.set(-2.6, 0, -3.6); stat.add(b1);
    const b2 = M.block(2.4, 1.6, 1.8, 0xb9d3dc, rnd); b2.position.set(-6.4, 0, -3.6); stat.add(b2);
    scene.add(RA.mergeStatic(stat));
    const pole = new T.Group(); pole.position.set(1.95, 0, 1.45);
    pole.add(mesh(new T.CylinderGeometry(0.04, 0.04, 1.3, 8), RA.mat(0x3d4249), 0, 0.65, 0));
    const head = M.trafficLight(); head.scale.setScalar(0.7); head.position.set(0, 1.45, 0); pole.add(head);
    scene.add(pole);
    const taxi = M.taxi(); scene.add(taxi);
    const car = M.car(0x2f6fd6); scene.add(car);
    const cam = new T.PerspectiveCamera(34, 2, 0.5, 100); cam.position.set(-1.4, 6.0, 6.2); cam.lookAt(0.4, 0, 0.2);
    let wa = 0;
    return {
      scene, camera: cam, frame(t) {
        const cyc = t % 7;
        const green = cyc > 3.2;
        head.userData.setAxis('EW', green ? 'green' : 'red'); head.userData.setAxis('NS', green ? 'red' : 'green');
        const xs = green ? 1.2 + Math.pow(cyc - 3.2, 2) * 1.4 : 1.2 - Math.max(0, 1.2 - cyc) * 4;
        taxi.position.set(xs - 0.75, 0, 0.55);
        const brake = !green || cyc < 3.5;
        taxi.userData.brake.emissiveIntensity = brake ? 2.6 : 0.35; taxi.userData.brakeHalo.material.opacity = brake ? 0.7 : 0;
        const cz = !green ? -6 + cyc * 4.2 : 9;
        car.position.set(3.75, 0, cz); car.rotation.y = -Math.PI / 2;
        car.userData.brake.emissiveIntensity = 0.35;
        wa += 0.15; taxi.userData.wheels.forEach((w) => (w.rotation.y = green ? -wa * 2 : 0));
      },
    };
  }

  /* ---------- 3) Piste inen uçak ---------- */
  function airScene() {
    const scene = new T.Scene(); scene.background = new T.Color(0x22335a);
    RA.makeLights(scene, { sky: 0x7f98d8, ground: 0x2b2d45, hemi: 0.7, sun: 0xff9a6a, sunI: 1.1, sunPos: [-8, 6, 4], shadowSize: 10 });
    const stat = new T.Group();
    const sea = new T.Mesh(new T.PlaneGeometry(60, 40), new T.MeshStandardMaterial({ map: RA.tex.clone(RA.tex.seaDusk(), 8, 6), roughness: 0.25, metalness: 0.2 }));
    sea.rotation.x = -Math.PI / 2; sea.position.y = -0.05; stat.add(sea);
    stat.add(mesh(new T.BoxGeometry(40, 0.2, 5.5), RA.mat(0x3d5a4a, { roughness: 1 }), 0, 0, 0.6));
    stat.add(mesh(new T.BoxGeometry(30, 0.04, 1.3), RA.mat(0x2f3238, { roughness: 0.9 }), 0, 0.12, 0.6));
    const white = RA.mat(0xe8e8e8);
    for (let x = -12; x < 14; x += 1.0) stat.add(mesh(new T.BoxGeometry(0.5, 0.02, 0.05), white, x, 0.15, 0.6));
    scene.add(RA.mergeStatic(stat));
    for (let x = -12; x <= 14; x += 0.9) for (const z of [-0.08, 1.28]) { const s = RA.glowSprite(0xfff1c8, 0.32, 0.9); s.position.set(x, 0.2, z); scene.add(s); }
    for (const z of [-0.08, 0.3, 0.9, 1.28]) { const s = RA.glowSprite(0x44ff88, 0.38, 1); s.position.set(-5.2, 0.2, z); scene.add(s); }
    const plane = M.plane(0x2f6fd6); scene.add(plane);
    plane.userData.gear.visible = true;
    const shadow = RA.blobShadow(2.0, 1.8, 0.5); scene.add(shadow);
    const refl = M.plane(0x2f6fd6); refl.scale.y = -1; scene.add(refl);
    const cam = new T.PerspectiveCamera(34, 2, 0.5, 120); cam.position.set(-1.0, 6.2, 7.6); cam.lookAt(0.4, 0.4, 0.2);
    return {
      scene, camera: cam, frame(t) {
        const cyc = t % 6.5;
        const x = 6.2 - cyc * 2.2;
        const alt = Math.max(0, 2.4 - cyc * 0.72) + 0.16;
        const touched = alt <= 0.17;
        plane.position.set(x, alt, 0.6); plane.rotation.set(0, Math.PI, touched ? 0 : 0.06);
        plane.userData.landing.material.opacity = 0.9;
        plane.userData.strobe.material.opacity = (t * 1.6) % 1 < 0.12 ? 1 : 0;
        const k = alt * 0.55;
        shadow.position.set(x + k, 0.13, 0.6 + k * 0.4); shadow.material.opacity = RA.clamp(0.6 - alt * 0.12, 0.2, 0.6); shadow.scale.setScalar(1 + alt * 0.15);
        refl.position.set(x, -alt - 0.1, 0.6); refl.rotation.copy(plane.rotation); refl.visible = x < -14;
      },
    };
  }

  class Menu {
    constructor(app) {
      this.app = app;
      this.t = 0;
      this.scenes = { rail: railScene(), road: roadScene(), air: airScene() };
      this.views = Array.from(document.querySelectorAll('#menu [data-scene]'));
      document.querySelectorAll('#menu .free-btn').forEach((b) => b.addEventListener('click', () => app.openWorkshop(b.dataset.mode)));
      this.grid = document.getElementById('lv-grid');
      // sekmeler: karayolu / demiryolu / havalimanı bölümleri
      this.set = RA.store.get('lv.set', 'road') || 'road';
      this.tabs = Array.from(document.querySelectorAll('#menu .lv-tabs [data-set]'));
      this.tabs.forEach((b) => b.addEventListener('click', () => { this.set = b.dataset.set; RA.store.set('lv.set', this.set); RA.audio.play('tap'); this.refresh(); }));
      this.grid.addEventListener('click', (e) => {
        const b = e.target.closest('[data-lv]'); if (!b) return;
        if (b.classList.contains('locked')) { b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake'); RA.audio.play('denied'); return; }
        app.openLevel(+b.dataset.lv);
      });
      this.bg = new T.Color(0x1a242b);
      this.refresh();
    }
    // bölüm kartları: numara, ad, yıldızlar, kilit
    refresh() {
      const LV = RA.LV; if (!LV || !this.grid) return;
      const set = LV.SETS.find((q) => q.mode === this.set) || LV.SETS[0];
      const INFO = { road: ['Karayolu bölümleri', 'Evleri iş yerlerine bağla, trafiği tıkatma'], rail: ['Demiryolu bölümleri', 'İstasyonları garlara bağla, trenleri bekletme'], air: ['Havalimanı bölümleri', 'Uçakları kapıya yanaştır, kalkışa yetiştir'] }[set.mode];
      document.getElementById('menu-set-t').textContent = INFO[0]; document.getElementById('menu-set-d').textContent = INFO[1];
      this.views.forEach((el) => { if (el.closest('.menu-banner')) el.dataset.scene = set.mode; });
      this.tabs.forEach((b) => b.setAttribute('aria-selected', b.dataset.set === set.mode));
      this.grid.dataset.set = set.mode;
      this.grid.innerHTML = set.levels.map((L) => {
        const st = LV.progress.stars(L.id), open = LV.progress.unlocked(L.id);
        return '<button type="button" role="listitem" class="lv-btn' + (open ? '' : ' locked') + (st ? ' done' : '') + '" data-lv="' + L.id + '" aria-label="' + set.name + ' ' + L.n + ': ' + L.name + (open ? ', ' + st + ' yıldız' : ', kilitli') + '">' +
          '<span class="n">' + L.n + '</span><span class="t">' + L.name + '</span><span class="s">' + (open ? [1, 2, 3].map((k) => '<i class="' + (k <= st ? 'on' : '') + '">★</i>').join('') : '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>') + '</span></button>';
      }).join('');
    }
    resize() { }
    render(dt) {
      this.t += dt;
      const r = this.app.renderer;
      const sr = this.app.stage.getBoundingClientRect();
      r.setScissorTest(false);
      r.setViewport(0, 0, this.app.w, this.app.h);
      r.setClearColor(this.bg, 1); r.clear();
      r.setScissorTest(true);
      this.views.forEach((el) => {
        const v = el.getBoundingClientRect();
        const x = v.left - sr.left, y = v.top - sr.top, w = v.width, h = v.height;
        if (w < 4 || h < 4) return;
        const ms = this.scenes[el.dataset.scene];
        ms.frame(this.t);
        ms.camera.aspect = w / h; ms.camera.updateProjectionMatrix();
        const yb = this.app.h - (y + h);
        r.setViewport(x, yb, w, h); r.setScissor(x, yb, w, h);
        r.render(ms.scene, ms.camera);
      });
      r.setScissorTest(false);
    }
  }
  RA.Menu = Menu;
})();
