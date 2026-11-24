/*
 * RAY ARASI — uçtan uca kontrol (isteğe bağlı)
 * Çalıştırma:  npm i -D playwright  &&  npx playwright install chromium  &&  node test/kontrol.cjs
 * Gerçek dokunuşlarla menüyü, üç modu, tur sonunu, Tekrar Oyna / Mod Seç düğmelerini, rekor kaydını,
 * sekme değişince duraklamayı ve üç özel durumu sınar. Ekran görüntülerini test/cikti/ klasörüne yazar.
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(__dirname, 'cikti');
fs.mkdirSync(OUT, { recursive: true });
let fails = 0;
const ok = (cond, msg) => { console.log((cond ? '  ✓ ' : '  ✗ ') + msg); if (!cond) fails++; };

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/WebGL|GPU|swiftshader/i.test(m.text())) errors.push(m.text()); });
  await page.goto('file://' + path.join(ROOT, 'index.html'));
  await page.waitForFunction(() => window.RA && RA.app);
  await page.evaluate(() => localStorage.clear());
  const shot = (n) => page.screenshot({ path: path.join(OUT, n + '.png') });
  const state = () => page.evaluate(() => ({ state: RA.app.state, mode: RA.app.mode && RA.app.mode.id, t: RA.app.round && RA.app.round.t, score: RA.app.round && RA.app.round.score }));
  const tapWorld = async (v) => {
    const p = await page.evaluate(([x, y, z]) => { const m = RA.app.mode; const q = RA.project(new THREE.Vector3(x, y, z), m.camera, RA.app.w, RA.app.h); const r = RA.app.stage.getBoundingClientRect(); return { x: q.x + r.left, y: q.y + r.top }; }, v);
    await page.touchscreen.tap(p.x, p.y);
  };
  // akıllı oyuncu politikaları (yalnızca turu bitirmek için)
  const playSmart = (id) => page.evaluate((id) => {
    const m = RA.app.mode, AX = { N: 'NS', S: 'NS', W: 'EW', E: 'EW' }; let lastT = -9;
    for (let i = 0; i < 46 * 60 && RA.app.state === 'play'; i++) {
      if (id === 'rail') {
        const near = m.trains.filter((o) => o.dir === 'W' && !o.decided && m.sS - o.s < 7);
        if (near.length) { const want = m.trains.some((e) => e.dir === 'E' && e.granted && m.eastInterval(e)) ? 'siding' : 'main'; if (want !== m.switchState && !m.switchLocked()) m.toggleSwitch(); }
      } else if (id === 'road') {
        if (i % 10 === 0 && !m.pending && RA.app.round.t - lastT > 2.2) {
          let red = 0, grn = 0, urg = false;
          for (const v of m.vehicles) { const d = v.L.sStop - v.s; if (d < -0.1 || d > 9) continue; if (AX[v.lane] === m.green) grn++; else { red += v.v < 1 ? 1.3 : 0.6; if (v.s - v.P.L < v.L.sWarn + 2.5) urg = true; } }
          if (red > 0 && (grn === 0 || red >= grn + 2.5 || urg)) { m.toggle(); lastT = RA.app.round.t; }
        }
      } else if (!m.runway && i % 6 === 0) {
        let best = null, bv = 1e9; for (const q of m.planes) { if (q.state !== 'hold' && q.state !== 'arrive') continue; const v = q.state === 'arrive' ? q.laps + 0.5 : q.laps - q.prog; if (v < bv) { bv = v; best = q; } }
        if (best) m.select(best);
      }
      RA.app.step(1 / 60);
    }
    RA.app.updateTimer();
  }, id);
  const playIdle = () => page.evaluate(() => { for (let i = 0; i < 46 * 60 && RA.app.state === 'play'; i++) RA.app.step(1 / 60); });
  const resultText = () => page.evaluate(() => ({ visible: !document.getElementById('result').hidden, title: document.getElementById('res-title').textContent, sentence: document.getElementById('res-sentence').textContent, rec: document.getElementById('res-record').textContent, score: +document.getElementById('res-score').textContent }));

  console.log('ANA EKRAN');
  ok(await page.locator('#menu').isVisible(), 'mod seçimi görünür');
  ok((await page.locator('#menu .card').count()) === 3, 'üç büyük sahne kartı var');
  await page.waitForTimeout(600); await shot('00-menu');

  const names = { rail: 'Demiryolu', road: 'Karayolu', air: 'Hava Trafiği' };
  const best = {};
  for (const id of ['rail', 'road', 'air']) {
    console.log('\n' + names[id].toUpperCase());
    await page.locator('#menu .card[data-mode="' + id + '"]').tap();
    await page.waitForTimeout(150);
    let s = await state();
    ok(s.state === 'play' && s.mode === id, 'karta dokununca mod başladı');
    ok(await page.locator('#hint').isVisible(), 'kontrol tek cümleyle gösterildi: "' + (await page.locator('#hint-text').textContent()) + '"');
    await page.evaluate(() => { RA.app.manual = true; });
    // sekme değişince süre durur
    await page.evaluate(() => RA.app.advance(1.0));
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
    const t1 = (await state()).t;
    await page.evaluate(() => { RA.app.manual = false; });
    await page.waitForTimeout(700);
    s = await state();
    ok(s.state === 'paused' && Math.abs(s.t - t1) < 1e-6, 'sekme gizlenince oyun durdu, süre ilerlemedi');
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { value: false, configurable: true }); });
    await page.locator('#btn-resume').tap();
    s = await state();
    ok(s.state === 'play', '"Devam Et" ile sürdü');
    await page.evaluate(() => { RA.app.manual = true; });
    // akıllı oyunla tur sonu
    await page.evaluate(() => { RA.app.start(RA.app.mode.id); RA.app.manual = true; });
    await playSmart(id);
    await page.waitForTimeout(200);
    let r = await resultText();
    ok(r.visible, 'tur sonu ekranı açıldı');
    ok(/saniyede/.test(r.sentence), 'sonuç cümlesi: "' + r.sentence + '"');
    best[id] = r.score;
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('rayarasi.records') || '{}'));
    ok(stored[id] === r.score && r.score > 0, 'rekor kaydedildi (' + id + ' = ' + stored[id] + ')');
    await shot('1-' + id + '-sonuc');
    // Tekrar Oyna
    await page.locator('#btn-again').tap();
    s = await state();
    ok(s.state === 'play' && s.mode === id && s.t < 0.2 && s.score === 0, '"Tekrar Oyna" turu baştan başlattı');
    // dokunmadan bekle: başarısızlık (veya süre) sonu
    await page.evaluate(() => { RA.app.manual = true; });
    await playIdle();
    await page.waitForTimeout(150);
    r = await resultText();
    ok(r.visible, 'hiç dokunmayınca tur bitti: ' + r.title + ' — "' + r.sentence + '"');
    ok(/Rekor/.test(r.rec), 'önceki rekor korunuyor: ' + r.rec);
    await shot('2-' + id + '-basarisiz');
    // Mod Seç
    await page.locator('#btn-modes').tap();
    s = await state();
    ok(s.state === 'menu' && (await page.locator('#menu').isVisible()), '"Mod Seç" ana ekrana döndü');
    const shown = await page.locator('[data-rec="' + id + '"]').textContent();
    ok(+shown === best[id], 'kartta rekor görünüyor: ' + shown);
  }
  const allRec = await page.evaluate(() => JSON.parse(localStorage.getItem('rayarasi.records')));
  ok(Object.keys(allRec).length === 3, 'her modun rekoru ayrı tutuluyor: ' + JSON.stringify(allRec));

  // ---- ÖZEL DURUM 1: son vagon hâlâ makastayken dokunmak
  console.log('\nÖZEL DURUM 1 — son vagon makastayken makasa dokunmak');
  await page.evaluate(() => { RA.app.start('rail'); RA.app.manual = true; RA.app.advance(1.2); RA.app.mode.toggleSwitch(); });
  for (let i = 0; i < 120; i++) { const st = await page.evaluate(() => { RA.app.advance(0.05); const m = RA.app.mode; const tr = m.trains.find((o) => o.dir === 'W' && o.decided); return tr ? { lock: m.switchLocked(), tail: tr.s - tr.len - m.sS } : null; }); if (st && st.lock && st.tail > -0.6 && st.tail < 0.6) break; }
  const before1 = await page.evaluate(() => RA.app.mode.switchState);
  await tapWorld([0, 0.2, 4.1]);
  await page.waitForTimeout(120);
  const after1 = await page.evaluate(() => ({ sw: RA.app.mode.switchState, badge: document.querySelector('#labels .lock-badge') && document.querySelector('#labels .lock-badge').textContent, ring: document.querySelector('#labels .tap-ring').className }));
  ok(after1.sw === before1, 'makas kilitli kaldı (' + after1.sw + ')');
  ok(!!after1.badge, 'oyuncuya karşılık: "' + after1.badge + '" + kırmızı halka (' + after1.ring + ')');
  await shot('3-ozel1-makas-kilitli');
  await page.evaluate(() => { for (let i = 0; i < 240 && RA.app.mode.switchLocked(); i++) RA.app.advance(1 / 60); RA.app.advance(0.05); });
  await tapWorld([0, 0.2, 4.1]);
  ok((await page.evaluate(() => RA.app.mode.switchState)) !== before1, 'son vagon geçince aynı dokunuş makası çevirdi');

  // ---- ÖZEL DURUM 2: otobüs kavşağın ortasındayken ışığı değiştirmek
  console.log('\nÖZEL DURUM 2 — otobüs kavşağın ortasındayken ışığı değiştirmek');
  await page.evaluate(() => {
    RA.app.start('road'); RA.app.manual = true; const m = RA.app.mode;
    m.vehicles.forEach((v) => m.scene.remove(v.g)); m.vehicles = []; m.queue = m.queue.filter((e) => e.t > 6);
    m.green = 'NS';
    const L = m.lanes.N; m.bus = m.addVehicle('N', 'bus', 0, L.sBoxIn + 1.3, 2.6);
    m.addVehicle('W', 'car', 1, m.lanes.W.sStop - 0.05, 0);
    m.addVehicle('W', 'taxi', 0, m.lanes.W.sStop - 2.0, 0);
    RA.app.advance(0.05);
  });
  await tapWorld([0, 1.55, 0]);
  await page.evaluate(() => RA.app.advance(0.25));
  const mid = await page.evaluate(() => { const m = RA.app.mode; return { pending: m.pending, green: m.green, chip: !document.querySelector('#labels .clear-chip').hidden, busInBox: m.inConflict(m.bus) }; });
  ok(mid.pending === 'EW' && mid.green === null && mid.busInBox, 'dokunuş hemen işlendi: kuzey-güney sarıya döndü, doğu-batı otobüs çıkana kadar bekliyor');
  ok(mid.chip, 'ekranda "Kavşak boşalıyor" uyarısı ve kutuda turuncu çerçeve');
  await page.evaluate(() => RA.app.advance(0.15));
  await shot('4-ozel2-otobus-kavsakta');
  let opened = null;
  for (let i = 0; i < 200; i++) { const st = await page.evaluate(() => { RA.app.advance(1 / 60); const m = RA.app.mode; return { g: m.green, rear: m.bus.s - m.bus.P.L - m.bus.L.sBoxOut }; }); if (st.g === 'EW') { opened = st; break; } }
  ok(opened && opened.rear > 0.15 && opened.rear < 0.3, 'otobüsün arka tamponu kavşaktan çıkar çıkmaz doğu-batı yeşil oldu');
  await page.evaluate(() => RA.app.advance(0.6));
  await shot('5-ozel2-dogu-bati-yesil');

  // ---- ÖZEL DURUM 3: ilk uçak teker koyarken ikinci uçağı seçmek
  console.log('\nÖZEL DURUM 3 — ilk uçak teker koyarken ikinci uçağı seçmek');
  await page.evaluate(() => { RA.app.start('air'); RA.app.manual = true; const m = RA.app.mode; m.select(m.slots[0]); });
  for (let i = 0; i < 400; i++) { const d = await page.evaluate(() => { RA.app.advance(1 / 60); const p = RA.app.mode.runway; return p ? p.sTD - p.s : -1; }); if (d <= 0.05) break; }
  const p2 = await page.evaluate(() => { const m = RA.app.mode; const p = m.planes.find((q) => q.state === 'hold'); return { x: p.x, y: p.alt + 0.33, z: p.z, code: p.code }; });
  await tapWorld([p2.x, p2.y, p2.z]);
  await page.evaluate(() => RA.app.advance(0.12));
  const deny = await page.evaluate((code) => { const m = RA.app.mode; const p = m.planes.find((q) => q.code === code); return { state: p.state, flash: m.flash, rw: m.runway && m.runway.touched, pop: [...document.querySelectorAll('#labels .pop')].map((e) => e.textContent).join(' | ') }; }, p2.code);
  ok(deny.rw === true, 'ilk uçak teker koydu');
  ok(deny.state === 'hold', 'ikinci uçak (' + p2.code + ') bekleme dönüşüne devam ediyor');
  ok(deny.flash > 0, 'pist ışıkları kırmızı yanıp sönüyor; mesaj: ' + deny.pop);
  await shot('6-ozel3-pist-dolu');
  for (let i = 0; i < 300; i++) { const fr = await page.evaluate(() => { RA.app.advance(1 / 30); return !RA.app.mode.runway; }); if (fr) break; }
  await tapWorld([...(await page.evaluate((code) => { const p = RA.app.mode.planes.find((q) => q.code === code); return [p.x, p.alt + 0.33, p.z]; }, p2.code))]);
  ok(await page.evaluate((code) => RA.app.mode.planes.find((q) => q.code === code).state === 'app', p2.code), 'pist boşalınca aynı uçağa dokunmak iniş izni verdi');

  console.log('\nKonsol hataları: ' + (errors.length ? errors.join('\n') : 'yok'));
  if (errors.length) fails++;
  console.log(fails ? '\nSONUÇ: ' + fails + ' kontrol başarısız' : '\nSONUÇ: tüm kontroller geçti');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
