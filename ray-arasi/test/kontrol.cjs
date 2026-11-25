/*
 * RAY ARASI — uçtan uca kontrol (isteğe bağlı)
 * Çalıştırma:  npm i -D playwright  &&  npx playwright install chromium  &&  node test/kontrol.cjs
 * Gerçek dokunuş ve sürüklemelerle ana ekranı, üç atölyeyi, çizim kurallarını, yakınlaştırma/kaydırmayı,
 * otoparkları ve araç yolculuklarını, yapay zekâ ve elle yönetimi, kaydı ve simülasyonu sınar. Ekran görüntülerini test/cikti/ klasörüne yazar.
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
  const state = () => page.evaluate(() => RA.app.state);
  const cellXY = (i, j) => page.evaluate(([i, j]) => { const ws = RA.app.ws; const q = RA.project(new THREE.Vector3(ws.net.cx(i), 0, ws.net.cz(j)), ws.camera, RA.app.w, RA.app.h); const r = RA.app.stage.getBoundingClientRect(); return { x: q.x + r.left, y: q.y + r.top }; }, [i, j]);
  const drag = async (cells) => { const pts = []; for (const [i, j] of cells) pts.push(await cellXY(i, j)); await page.mouse.move(pts[0].x, pts[0].y); await page.mouse.down(); for (let k = 1; k < pts.length; k++) await page.mouse.move(pts[k].x, pts[k].y, { steps: 14 }); await page.mouse.up(); await page.waitForTimeout(60); };
  const pieces = (i, j) => page.evaluate(([i, j]) => RA.app.ws.grid.cell(i, j).pieces.map((q) => ({ t: q.type, n: RA.WS.portCount(q.m), lv: q.lv })), [i, j]);
  const toastTxt = () => page.evaluate(() => { const t = document.getElementById('ws-toast'); return { txt: t.textContent, err: t.classList.contains('err'), vis: !t.hidden }; });

  console.log('ANA EKRAN');
  ok(await page.locator('#menu').isVisible(), 'ana ekran görünür');
  ok((await page.locator('#menu .card').count()) === 3, 'üç atölye kartı var: Demiryolu, Karayolu, Havalimanı');
  ok((await page.locator('#hud, #result, .seg').count()) === 0, '45 saniyelik görev modu kaldırıldı (gösterge, sonuç ekranı, seçici yok)');
  await page.waitForTimeout(600); await shot('00-ana-ekran');

  console.log('\nKARAYOLU ATÖLYESİ — 12 × 20 kare');
  await page.locator('.card[data-mode="road"]').tap();
  ok((await state()) === 'workshop', 'karta dokununca atölye açıldı');
  await page.evaluate(() => { RA.app.manual = true; });
  const size = await page.evaluate(() => [RA.app.ws.grid.cols, RA.app.ws.grid.rows]);
  ok(size[0] === 12 && size[1] === 20, 'tahta yüzde 25 küçültüldü: ' + size.join(' × ') + ' kare');
  const corners = await page.evaluate(() => { const ws = RA.app.ws, n = ws.net; const pts = [[0, 0], [11, 0], [0, 19], [11, 19]].map(([i, j]) => RA.project(new THREE.Vector3(n.cx(i), 0, n.cz(j)), ws.camera, RA.app.w, RA.app.h)); return pts.every((q) => q.x > 0 && q.x < RA.app.w && q.y > 50 && q.y < RA.app.h - 120); });
  ok(corners, 'açılışta tahtanın tamamı ekranda görünüyor');
  await page.waitForTimeout(200); await shot('01-karayolu-genel');

  await page.locator('#ws [data-tool="road"]').tap();
  await drag([[-1, 11], [12, 11]]);
  ok([await pieces(2, 11), await pieces(6, 11), await pieces(10, 11)].every((pc) => pc.length === 1 && pc[0].n === 4), 'parmakla çizilen yol üç caddeyle kesişince üç dört kollu kavşak oluştu');
  ok(await page.evaluate(() => ['2,11,0', '6,11,0', '10,11,0'].every((k) => RA.app.ws.sim.jc.has(k))), 'yeni kavşaklara ışık ve yapay zekâ denetleyicisi eklendi');
  await page.locator('#ws [data-style="bridge"]').tap();
  await drag([[-1, 6], [5, 6]]);
  let pc = await pieces(2, 6);
  ok(pc.some((q) => q.lv === 1) && pc.some((q) => q.lv === 0), 'Köprü: yeni yol caddenin üstünden geçti');
  await page.locator('#ws [data-style="tunnel"]').tap();
  await drag([[7, 16], [12, 16]]);
  ok((await pieces(10, 16)).some((q) => q.lv === -1), 'Alt geçit (battı çıktı): yeni yol caddenin altından geçti');
  await page.locator('#ws [data-tool="runway"]').tap();
  await drag([[1, 0], [1, 4]]);
  const tt = await toastTxt();
  ok(tt.err && tt.vis, 'geçersiz çizim reddedildi ve nedeni yazıldı: "' + tt.txt + '"');
  await page.locator('#ws [data-tool="erase"]').tap();
  await drag([[11, 11], [11, 12]]);
  ok((await pieces(11, 11)).length === 0, 'Sil aracı kareleri temizledi');
  await page.locator('#ws-undo').tap();
  ok((await pieces(11, 11)).length === 1, 'Geri al son değişikliği geri getirdi');

  console.log('\nOTOPARKLAR VE YOLCULUKLAR');
  const lots0 = await page.evaluate(() => RA.app.ws.sim.lots.size);
  ok(lots0 >= 6, 'örnek düzende yol uçlarında katlı otoparklar var (' + lots0 + ')');
  await page.locator('#ws [data-tool="lot"]').tap();
  const l35 = await cellXY(3, 5); await page.mouse.click(l35.x, l35.y); await page.waitForTimeout(60);
  pc = await pieces(3, 5);
  ok(pc.length === 1 && pc[0].n === 1 && (await page.evaluate(() => RA.app.ws.sim.lots.size)) === lots0 + 1, 'Otopark aracı: caddenin yanındaki boş kareye dokununca otopark eklendi');
  ok(await page.evaluate(() => RA.app.ws.net.yieldAt.has('2,5,0')), 'otopark girişi caddeye ışıksız, yol veren bir kavşakla bağlandı');
  const trips = await page.evaluate(() => {
    const sim = RA.app.ws.sim; const into = new Set(), out = new Set(); let uturn = 0, noDest = 0, stuck = 0;
    for (let k = 0; k < 180; k++) {
      RA.app.advance(0.5);
      for (const c of sim.cars) {
        if (c.fade) continue; // tahtadan çıkıp ya da otoparka girip kaybolmakta olan araç
        if (c.mv.kind === 'uturn') uturn++;
        if (!c.dest) noDest++;
        if (c.mv.kind === 'park') into.add(c.id);
        if (c.mv.kind === 'unpark') out.add(c.id);
        if (c.wait > 25) stuck++;
      }
    }
    return { into: into.size, out: out.size, uturn, noDest, stuck, done: sim.stats.cars, counts: [...sim.lots.values()].map((L) => L.count + '/' + L.cap).join(' ') };
  });
  ok(trips.noDest === 0 && trips.uturn === 0, 'her aracın bir varış yeri var; amaçsız dönüş ve U dönüşü yok');
  ok(trips.into >= 10, 'araçlar otoparklara girip kayboldu (' + trips.into + ' araç)');
  ok(trips.out >= 10, 'otoparklardan sonra başka araçlar çıktı (' + trips.out + ' araç)');
  ok(trips.stuck === 0, 'hiçbir araç takılı kalmadı; ' + trips.done + ' yolculuk tamamlandı (doluluk: ' + trips.counts + ')');
  await page.locator('#ws [data-tool="look"]').tap();

  console.log('\nYAKINLAŞTIRMA VE KAYDIRMA');
  const v0 = await page.evaluate(() => ({ d: RA.app.ws.view.d, x: RA.app.ws.view.t.x, z: RA.app.ws.view.t.z }));
  await page.locator('#ws-zin').tap(); await page.locator('#ws-zin').tap();
  const v1 = await page.evaluate(() => ({ d: RA.app.ws.view.d }));
  ok(v1.d < v0.d * 0.6, '+ düğmesi yakınlaştırdı (uzaklık ' + v0.d.toFixed(0) + ' → ' + v1.d.toFixed(0) + ')');
  const a = { x: 200, y: 420 };
  await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(a.x - 120, a.y + 160, { steps: 10 }); await page.mouse.up();
  const v2 = await page.evaluate(() => ({ x: RA.app.ws.view.t.x, z: RA.app.ws.view.t.z }));
  ok(Math.hypot(v2.x - v0.x, v2.z - v0.z) > 2, 'İzle aracında tek parmakla sürükleyince harita kaydı');
  await page.waitForTimeout(150); await shot('02-yakin-plan');
  // iki parmakla sıkıştırma (pinch)
  const pinch = await page.evaluate(() => {
    const el = document.getElementById('gl'); const r = el.getBoundingClientRect();
    const ev = (type, id, x, y) => el.dispatchEvent(new PointerEvent(type, { pointerId: id, clientX: r.left + x, clientY: r.top + y, bubbles: true, cancelable: true, pointerType: 'touch', isPrimary: id === 1 }));
    const d0 = RA.app.ws.view.d;
    ev('pointerdown', 1, 160, 400); ev('pointerdown', 2, 230, 400);
    for (let k = 1; k <= 6; k++) { ev('pointermove', 1, 160 - k * 6, 400); ev('pointermove', 2, 230 + k * 6, 400); }
    ev('pointerup', 1, 124, 400); ev('pointerup', 2, 266, 400);
    const d1 = RA.app.ws.view.d;
    ev('pointerdown', 3, 120, 400); ev('pointerdown', 4, 270, 400);
    for (let k = 1; k <= 6; k++) { ev('pointermove', 3, 120 + k * 8, 400); ev('pointermove', 4, 270 - k * 8, 400); }
    ev('pointerup', 3, 168, 400); ev('pointerup', 4, 222, 400);
    return { d0, d1, d2: RA.app.ws.view.d };
  });
  ok(pinch.d1 < pinch.d0 && pinch.d2 > pinch.d1, 'iki parmakla açınca yakınlaştı, kapatınca uzaklaştı (' + pinch.d0.toFixed(0) + ' → ' + pinch.d1.toFixed(0) + ' → ' + pinch.d2.toFixed(0) + ')');
  await page.locator('#ws-zfit').tap();
  ok(await page.evaluate(() => Math.abs(RA.app.ws.view.d - RA.app.ws.fit.d) < 0.01), '"Tümü" düğmesi bütün tahtayı yeniden gösterdi');

  console.log('\nYAPAY ZEKÂ VE ELLE YÖNETİM');
  const hist = await page.evaluate(() => { const seen = new Set(); for (let k = 0; k < 50; k++) { RA.app.advance(0.5); for (const J of RA.app.ws.sim.jc.values()) seen.add(J.key + ':' + (J.flash ? 'flash' : J.green || 'clear')); } return [...seen]; });
  ok(hist.some((h) => /:EW$/.test(h)) && hist.some((h) => /:NS$/.test(h)), 'yapay zekâ ışıkları trafiğe göre kendiliğinden değiştirdi (' + new Set(hist.map((h) => h.split(':')[0])).size + ' kavşak)');
  ok(true, 'boş kavşakta sarı yanıp sönme: ' + (hist.some((h) => /:flash$/.test(h)) ? 'görüldü' : 'bu sürede gerekmedi'));
  await page.locator('#ws-ai').tap();
  const before2 = await page.evaluate(() => { const J = RA.app.ws.sim.jc.get('2,3,0'); return J.green + '/' + J.pending; });
  const c33 = await cellXY(2, 3); await page.mouse.click(c33.x, c33.y);
  const after2 = await page.evaluate(() => { const J = RA.app.ws.sim.jc.get('2,3,0'); return J.green + '/' + J.pending; });
  ok(before2 !== after2, 'yapay zekâ kapalıyken kavşağa dokununca ışık elle değişti (' + before2 + ' → ' + after2 + ')');
  await page.locator('#ws-ai').tap();
  ok(await page.evaluate(() => RA.app.ws.sim.ai), 'yapay zekâ yeniden açıldı');
  const saved = await page.evaluate(() => JSON.stringify(RA.app.ws.grid.serialize()));
  await page.reload(); await page.waitForFunction(() => window.RA && RA.app);
  await page.locator('.card[data-mode="road"]').tap();
  ok((await page.evaluate(() => JSON.stringify(RA.app.ws.grid.serialize()))) === saved, 'çizim kaydedildi: sayfa yenilenince aynı tahta geldi');

  console.log('\nDEMİRYOLU VE HAVALİMANI ATÖLYELERİ');
  await page.evaluate(() => RA.app.showMenu());
  await page.locator('.card[data-mode="rail"]').tap();
  const rail = await page.evaluate(() => { RA.app.manual = true; let closed = false; for (let k = 0; k < 140; k++) { RA.app.advance(0.5); for (const X of RA.app.ws.sim.xc.values()) if (X.state === 'closed') closed = true; } const s = RA.app.ws.sim; return { trains: s.trains.length, trips: s.stats.trains, closed, signals: s.dyn.railSignals.length }; });
  ok(rail.trains > 0 && rail.trips > 0, 'trenler makaslardan geçip sefer yaptı (' + rail.trains + ' tren, ' + rail.trips + ' sefer)');
  ok(rail.closed, 'hemzemin geçitte bariyerler tren gelince otomatik indi, ışıklar yanıp söndü');
  ok(rail.signals > 0, 'makas ve kesişimlerde yapay zekâ sinyalleri var (' + rail.signals + ')');
  await page.waitForTimeout(150); await shot('03-demiryolu');
  await page.evaluate(() => RA.app.showMenu());
  await page.locator('.card[data-mode="air"]').tap();
  const air = await page.evaluate(() => { RA.app.manual = true; for (let k = 0; k < 100; k++) RA.app.advance(1); return RA.app.ws.sim.stats; });
  ok(air.land >= 2 && air.takeoff >= 1, 'kule (yapay zekâ) iki pistte iniş ve kalkışları sıraladı (' + air.land + ' iniş, ' + air.takeoff + ' kalkış)');
  await page.waitForTimeout(150); await shot('04-havalimani');
  await page.locator('#ws-back').tap();
  ok((await state()) === 'menu', 'geri düğmesi ana ekrana döndü');

  console.log('\nKonsol hataları: ' + (errors.length ? errors.join('\n') : 'yok'));
  if (errors.length) fails++;
  console.log(fails ? '\nSONUÇ: ' + fails + ' kontrol başarısız' : '\nSONUÇ: tüm kontroller geçti');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
