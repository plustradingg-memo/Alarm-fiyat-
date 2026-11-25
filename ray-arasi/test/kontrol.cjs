/*
 * RAY ARASI — uçtan uca kontrol (isteğe bağlı)
 * Çalıştırma:  npm i -D playwright  &&  npx playwright install chromium  &&  node test/kontrol.cjs
 * Gerçek dokunuş ve sürüklemelerle ana ekranı, 4 düz yolla başlayan şehri, çizim kurallarını, talepleri (mahalle,
 * okul…), otoparkları ve araç yolculuklarını, sıkışma ve memnuniyeti, yakınlaştırma/kaydırmayı, yapay zekâ ve elle
 * yönetimi, kaydı ve simülasyonu sınar. Ekran görüntülerini test/cikti/ klasörüne yazar.
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
  await page.evaluate(() => { localStorage.clear(); RA.WS.City.seed = 7; });
  const shot = (n) => page.screenshot({ path: path.join(OUT, n + '.png') });
  const state = () => page.evaluate(() => RA.app.state);
  const cellXY = (i, j) => page.evaluate(([i, j]) => { const ws = RA.app.ws; const q = RA.project(new THREE.Vector3(ws.net.cx(i), 0, ws.net.cz(j)), ws.camera, RA.app.w, RA.app.h); const r = RA.app.stage.getBoundingClientRect(); return { x: q.x + r.left, y: q.y + r.top }; }, [i, j]);
  const drag = async (cells) => { const pts = []; for (const [i, j] of cells) pts.push(await cellXY(i, j)); await page.mouse.move(pts[0].x, pts[0].y); await page.mouse.down(); for (let k = 1; k < pts.length; k++) await page.mouse.move(pts[k].x, pts[k].y, { steps: 14 }); await page.mouse.up(); await page.waitForTimeout(60); };
  const pieces = (i, j) => page.evaluate(([i, j]) => RA.app.ws.grid.cell(i, j).pieces.map((q) => ({ t: q.type, n: RA.WS.portCount(q.m), lv: q.lv })), [i, j]);
  const toastTxt = () => page.evaluate(() => { const t = document.getElementById('ws-toast'); return { txt: t.textContent, err: t.classList.contains('err'), vis: !t.hidden }; });
  const uiTick = () => page.waitForTimeout(650); // üst şerit yarım saniyede bir güncellenir

  console.log('ANA EKRAN');
  ok(await page.locator('#menu').isVisible(), 'ana ekran görünür');
  ok((await page.locator('#menu .card').count()) === 3, 'üç atölye kartı var: Demiryolu, Karayolu, Havalimanı');
  ok((await page.locator('#hud, #result, .seg').count()) === 0, '45 saniyelik görev modu yok (gösterge, sonuç ekranı, seçici yok)');
  await page.waitForTimeout(600); await shot('00-ana-ekran');

  console.log('\nKARAYOLU — ŞEHİR 4 DÜZ YOLLA BAŞLAR');
  await page.locator('.card[data-mode="road"]').tap();
  ok((await state()) === 'workshop', 'karta dokununca atölye açıldı');
  await page.evaluate(() => { RA.app.manual = true; });
  const start = await page.evaluate(() => { const ws = RA.app.ws; let n = 0, other = 0; ws.grid.each((c) => c.pieces.forEach((q) => (q.type === 'road' ? n++ : other++))); return { size: [ws.grid.cols, ws.grid.rows], n, other, jc: ws.sim.jc.size, lots: ws.sim.lots.size, places: ws.city.places.length }; });
  ok(start.size[0] === 12 && start.size[1] === 20, 'tahta 12 × 20 kare');
  ok(start.n === 2 * 20 + 2 * 12 - 4 && start.other === 0, 'başlangıçta yalnızca 4 düz yol var (' + start.n + ' yol karesi)');
  ok(start.jc === 4 && start.lots === 0 && start.places === 0, 'dört ışıklı kavşak; otopark ve bina yok');
  const corners = await page.evaluate(() => { const ws = RA.app.ws, n = ws.net; const pts = [[0, 0], [11, 0], [0, 19], [11, 19]].map(([i, j]) => RA.project(new THREE.Vector3(n.cx(i), 0, n.cz(j)), ws.camera, RA.app.w, RA.app.h)); return pts.every((q) => q.x > 0 && q.x < RA.app.w && q.y > 90 && q.y < RA.app.h - 120); });
  ok(corners, 'açılışta tahtanın tamamı ekranda (üst şeridin altında)');
  ok(/4 düz yol/.test((await toastTxt()).txt), 'açılış notu: "' + (await toastTxt()).txt + '"');
  await page.waitForTimeout(200); await shot('01-karayolu-baslangic');

  console.log('\nÇİZİM KURALLARI');
  await page.locator('#ws [data-tool="road"]').tap();
  await drag([[-1, 10], [12, 10]]);
  ok([await pieces(3, 10), await pieces(8, 10)].every((pc) => pc.length === 1 && pc[0].n === 4), 'parmakla çizilen yol iki caddeyi kesince iki dört kollu kavşak oluştu');
  ok(await page.evaluate(() => ['3,10,0', '8,10,0'].every((k) => RA.app.ws.sim.jc.has(k))), 'yeni kavşaklara ışık ve yapay zekâ denetleyicisi eklendi');
  await page.locator('#ws [data-style="bridge"]').tap();
  await drag([[5, 10], [5, 16]]);
  let pc = await pieces(5, 13);
  ok(pc.some((q) => q.lv === 1) && pc.some((q) => q.lv === 0), 'Köprü: yeni yol sokağın üstünden geçti');
  await page.locator('#ws [data-style="tunnel"]').tap();
  await drag([[6, 17], [12, 17]]);
  ok((await pieces(8, 17)).some((q) => q.lv === -1), 'Alt geçit (battı çıktı): yeni yol caddenin altından geçti');
  await page.locator('#ws [data-style="grade"]').tap();
  await page.locator('#ws [data-tool="runway"]').tap();
  await drag([[0, 4], [0, 8]]);
  const tt = await toastTxt();
  ok(tt.err && tt.vis, 'geçersiz çizim reddedildi ve nedeni yazıldı: "' + tt.txt + '"');
  await page.locator('#ws [data-tool="erase"]').tap();
  await drag([[11, 10], [11, 11]]);
  ok((await pieces(11, 10)).length === 0, 'Sil aracı kareleri temizledi');
  await page.locator('#ws-undo').tap();
  ok((await pieces(11, 10)).length === 1, 'Geri al son değişikliği geri getirdi');

  console.log('\nOTOPARK');
  const lots0 = await page.evaluate(() => RA.app.ws.sim.lots.size);
  ok(lots0 === 2, 'tahta içinde biten iki yol ucu otopark oldu');
  await page.locator('#ws [data-tool="lot"]').tap();
  const l45 = await cellXY(4, 4); await page.mouse.click(l45.x, l45.y); await page.waitForTimeout(60);
  pc = await pieces(4, 4);
  ok(pc.length === 1 && pc[0].n === 1 && (await page.evaluate(() => RA.app.ws.sim.lots.size)) === lots0 + 1, 'Otopark aracı: caddenin yanındaki boş kareye dokununca otopark eklendi');
  ok(await page.evaluate(() => RA.app.ws.net.yieldAt.has('3,4,0')), 'otopark girişi caddeye ışıksız, yol veren bir kavşakla bağlandı');
  await page.locator('#ws [data-tool="look"]').tap();

  console.log('\nTALEPLER');
  const dem = await page.evaluate(() => { RA.app.advance(9); const c = RA.app.ws.city; return c.places.map((p) => ({ type: p.type, i: p.i, j: p.j, conn: p.conn })); });
  ok(dem.length >= 1 && !dem[0].conn, 'birkaç saniye sonra ilk talep geldi: ' + dem.map((d) => d.type + ' (' + d.i + ',' + d.j + ')').join(', '));
  ok(/Yeni talep/.test((await toastTxt()).txt), 'talep notu: "' + (await toastTxt()).txt + '"');
  await uiTick();
  ok((await page.locator('#ws-dem').getAttribute('data-st')) === 'dem' && /1/.test(await page.locator('#ws-dem').textContent()), 'üstteki talep düğmesi turuncu ve sayıyı gösteriyor');
  ok(await page.evaluate(() => RA.app.ws.city.pins.length === RA.app.ws.city.waiting().length && RA.app.ws.builder.reserved.size >= 1), 'talep karesinde işaret ve yarı saydam bina taslağı var, kare süslerden boşaltıldı');
  await page.waitForTimeout(150); await shot('02-talep-isareti');
  const d0 = await page.evaluate(() => RA.app.ws.view.d);
  await page.locator('#ws-dem').tap(); await page.waitForTimeout(120);
  const d1 = await page.evaluate(() => RA.app.ws.view.d);
  ok(d1 < d0 * 0.5 && /istiyor/.test((await toastTxt()).txt), 'talep düğmesi kamerayı talebe götürdü ve ne yapılacağını yazdı: "' + (await toastTxt()).txt + '"');
  await page.waitForTimeout(150); await shot('03-talebe-yakinlasma');
  await page.locator('#ws-zfit').tap();
  // talebe giden yolu parmakla çiz (boş kareler boyunca en kısa yol)
  const pth = await page.evaluate(() => {
    const ws = RA.app.ws, WS = RA.WS, g = ws.grid, pl = ws.city.waiting()[0];
    const key = (i, j) => i + ',' + j; const prev = new Map([[key(pl.i, pl.j), null]]); const q = [[pl.i, pl.j]];
    while (q.length) {
      const [i, j] = q.shift();
      for (const d of ['N', 'E', 'S', 'W']) {
        const ni = i + WS.DV[d].x, nj = j + WS.DV[d].z; if (!g.inside(ni, nj) || prev.has(key(ni, nj))) continue;
        const c = g.cell(ni, nj);
        const ramp = ['N', 'E', 'S', 'W'].some((e) => { const n2 = g.cell(ni + WS.DV[e].x, nj + WS.DV[e].z); return n2 && n2.pieces.some((x) => x.lv !== 0); });
        if (!ramp && c.pieces.some((x) => x.type === 'road' && x.lv === 0 && WS.portCount(x.m) === 2)) { const out = [[ni, nj]]; let cur = [i, j]; while (cur) { out.push(cur); cur = prev.get(key(cur[0], cur[1])); } return { type: pl.type, cells: out }; }
        if (c.pieces.length || ws.city.placeAt(ni, nj)) continue;
        prev.set(key(ni, nj), [i, j]); q.push([ni, nj]);
      }
    }
    return null;
  });
  await page.locator('#ws [data-tool="road"]').tap();
  await drag(pth.cells);
  const conn = await page.evaluate(() => { const ws = RA.app.ws; const p = ws.city.places[0]; const L = ws.sim.lots.get(p.i + ',' + p.j); return { conn: p.conn, cap: L && L.cap, place: L && L.place && L.place.type }; });
  ok(conn.conn && conn.place === pth.type && conn.cap >= 6, pth.type + ' yolla bağlandı; kendi binası ve ' + conn.cap + ' araçlık yeri oldu');
  ok(/bağlandı/.test((await toastTxt()).txt), 'bağlanma notu: "' + (await toastTxt()).txt + '"');
  await page.locator('#ws [data-tool="look"]').tap();
  await page.waitForTimeout(150); await shot('04-talep-baglandi');

  console.log('\nYOLCULUKLAR, SIKIŞMA VE MEMNUNİYET');
  const trips = await page.evaluate(() => {
    const ws = RA.app.ws, sim = ws.sim; const into = new Set(), out = new Set(); let uturn = 0, noDest = 0, maxStill = 0, maxCars = 0;
    const t0 = sim.carTarget();
    for (let k = 0; k < 240; k++) {
      RA.app.advance(0.5);
      for (const c of sim.cars) {
        if (c.fade) continue; // tahtadan çıkıp ya da otoparka girip kaybolmakta olan araç
        if (c.mv.kind === 'uturn') uturn++;
        if (!c.dest) noDest++;
        if (c.mv.kind === 'park') into.add(c.id);
        if (c.mv.kind === 'unpark') out.add(c.id);
        maxStill = Math.max(maxStill, c.still);
      }
      maxCars = Math.max(maxCars, sim.cars.length);
    }
    return { into: into.size, out: out.size, uturn, noDest, maxStill, done: sim.stats.cars, giveUp: sim.stats.giveUp || 0, t0, t1: sim.carTarget(), maxCars, places: ws.city.places.length };
  });
  ok(trips.noDest === 0 && trips.uturn === 0, 'her aracın bir varış yeri var; amaçsız dönüş ve U dönüşü yok');
  ok(trips.into >= 10 && trips.out >= 10, 'araçlar otoparklara/binalara girip kayboldu (' + trips.into + '), sonra oradan başka araçlar çıktı (' + trips.out + ')');
  ok(trips.places >= 3, '2 dakikada yeni talepler geldi (' + trips.places + ' yer)');
  ok(trips.t1 > trips.t0, 'şehir büyüdükçe trafik artıyor (araç hedefi ' + trips.t0 + ' → ' + trips.t1 + ')');
  ok(trips.maxStill <= 46 && trips.giveUp <= 2, 'kalıcı kilitlenme yok (en uzun duruş ' + Math.round(trips.maxStill) + ' sn, ' + trips.giveUp + ' araç vazgeçti); ' + trips.done + ' yolculuk tamamlandı');
  // sıkışma halkası: kavşak önünde 5+ araç durunca kırmızı halka
  const jam = await page.evaluate(() => { const ws = RA.app.ws, city = ws.city; city.jams = [{ n: 6, w: 20, i: 3, j: 6 }]; city.visuals(1, ws.view.d); return city.jamRings[0].visible; });
  ok(jam, 'sıkışan kavşakta kırmızı halka görünür');
  await uiTick();
  const moodTxt = await page.locator('#ws-mood b').textContent();
  ok(/^%\d+$/.test(moodTxt), 'üst şeritte memnuniyet (' + moodTxt + ') ve nüfus (' + (await page.locator('#ws-popn b').textContent()) + ') görünüyor');
  await shot('05-sehir-buyudu');

  console.log('\nYAKINLAŞTIRMA VE KAYDIRMA');
  await page.locator('#ws-zfit').tap();
  const v0 = await page.evaluate(() => ({ d: RA.app.ws.view.d, x: RA.app.ws.view.t.x, z: RA.app.ws.view.t.z }));
  await page.locator('#ws-zin').tap(); await page.locator('#ws-zin').tap();
  const v1 = await page.evaluate(() => ({ d: RA.app.ws.view.d }));
  ok(v1.d < v0.d * 0.6, '+ düğmesi yakınlaştırdı (uzaklık ' + v0.d.toFixed(0) + ' → ' + v1.d.toFixed(0) + ')');
  const a = { x: 200, y: 420 };
  await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(a.x - 120, a.y + 160, { steps: 10 }); await page.mouse.up();
  const v2 = await page.evaluate(() => ({ x: RA.app.ws.view.t.x, z: RA.app.ws.view.t.z }));
  ok(Math.hypot(v2.x - v0.x, v2.z - v0.z) > 2, 'İzle aracında tek parmakla sürükleyince harita kaydı');
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
  await page.locator('#ws-ai').tap();
  const before2 = await page.evaluate(() => { const J = RA.app.ws.sim.jc.get('3,6,0'); return J.green + '/' + J.pending; });
  const c36 = await cellXY(3, 6); await page.mouse.click(c36.x, c36.y);
  const after2 = await page.evaluate(() => { const J = RA.app.ws.sim.jc.get('3,6,0'); return J.green + '/' + J.pending; });
  ok(before2 !== after2, 'yapay zekâ kapalıyken kavşağa dokununca ışık elle değişti (' + before2 + ' → ' + after2 + ')');
  await page.locator('#ws-ai').tap();
  ok(await page.evaluate(() => RA.app.ws.sim.ai), 'yapay zekâ yeniden açıldı');

  console.log('\nKAYIT');
  const saved = await page.evaluate(() => JSON.stringify([RA.app.ws.grid.serialize(), RA.app.ws.city.places.map((p) => [p.type, p.i, p.j, p.conn])]));
  await page.reload(); await page.waitForFunction(() => window.RA && RA.app);
  await page.locator('.card[data-mode="road"]').tap();
  ok((await page.evaluate(() => JSON.stringify([RA.app.ws.grid.serialize(), RA.app.ws.city.places.map((p) => [p.type, p.i, p.j, p.conn])]))) === saved, 'çizim ve talepler kaydedildi: sayfa yenilenince aynı şehir geldi');
  await page.locator('#ws-menu').tap(); await page.locator('#ws-new').tap();
  const fresh = await page.evaluate(() => { const ws = RA.app.ws; let n = 0; ws.grid.each((c) => (n += c.pieces.length)); return { n, places: ws.city.places.length, undo: !document.getElementById('ws-undo').disabled }; });
  ok(fresh.n === start.n && fresh.places === 0 && fresh.undo, '⋯ › Yeni şehir: 4 düz yola döndü, talepler sıfırlandı, eski şehir ↶ ile geri alınabilir');
  // önceki sürümün kaydı: şehir 4 düz yolla başlar, eski çizim geri alınabilir
  await page.evaluate(() => { RA.app.showMenu(); const g = RA.WS.template('road').serialize(); g.v = 1; RA.store.set('ws.road', g); });
  await page.locator('.card[data-mode="road"]').tap();
  const mig = await page.evaluate(() => { const ws = RA.app.ws; let n = 0; ws.grid.each((c) => (n += c.pieces.length)); return { n, undo: !document.getElementById('ws-undo').disabled, toast: document.getElementById('ws-toast').textContent }; });
  ok(mig.n === start.n && mig.undo && /baştan başladı/.test(mig.toast), 'önceki sürümün kaydı varsa şehir 4 düz yolla başlar, eski çizim ↶ ile gelir');

  console.log('\nDEMİRYOLU VE HAVALİMANI');
  await page.evaluate(() => RA.app.showMenu());
  await page.locator('.card[data-mode="rail"]').tap();
  const rail = await page.evaluate(() => { RA.app.manual = true; let closed = false; for (let k = 0; k < 200; k++) { RA.app.advance(0.5); for (const X of RA.app.ws.sim.xc.values()) if (X.state === 'closed') closed = true; } const s = RA.app.ws.sim; let rails = 0; RA.app.ws.grid.each((c) => c.pieces.forEach((q) => q.type === 'rail' && rails++)); return { trains: s.trains.length, trips: s.stats.trains, closed, rails, places: RA.app.ws.city.places.map((p) => p.type) }; });
  ok(rail.rails >= 40 && rail.trains > 0 && rail.trips > 0, 'demiryolu iki düz hatla başlar; trenler sefer yaptı (' + rail.trains + ' tren, ' + rail.trips + ' sefer)');
  ok(rail.closed, 'hemzemin geçitte bariyerler tren gelince otomatik indi, ışıklar yanıp söndü');
  ok(rail.places.includes('istasyon'), 'demiryolunda istasyon talebi geldi (' + rail.places.join(', ') + ')');
  await page.waitForTimeout(150); await shot('06-demiryolu');
  await page.evaluate(() => RA.app.showMenu());
  await page.locator('.card[data-mode="air"]').tap();
  const air = await page.evaluate(() => { RA.app.manual = true; for (let k = 0; k < 100; k++) RA.app.advance(1); return Object.assign({ places: RA.app.ws.city.places.map((p) => p.type) }, RA.app.ws.sim.stats); });
  ok(air.land >= 2 && air.takeoff >= 1, 'havalimanı tek pist ve bir kapıyla başlar; kule iniş ve kalkışları sıraladı (' + air.land + ' iniş, ' + air.takeoff + ' kalkış)');
  ok(air.places.includes('kapi'), 'havalimanında yeni kapı talebi geldi (' + air.places.join(', ') + ')');
  await page.waitForTimeout(150); await shot('07-havalimani');
  // örnek düzen hâlâ menüde
  await page.locator('#ws-menu').tap(); await page.locator('#ws-sample').tap();
  ok(await page.evaluate(() => RA.app.ws.net.runways.length === 2), '⋯ › Örnek düzen: iki pistli hazır havalimanı yüklendi');
  await page.locator('#ws-back').tap();
  ok((await state()) === 'menu', 'geri düğmesi ana ekrana döndü');

  console.log('\nKonsol hataları: ' + (errors.length ? errors.join('\n') : 'yok'));
  if (errors.length) fails++;
  console.log(fails ? '\nSONUÇ: ' + fails + ' kontrol başarısız' : '\nSONUÇ: tüm kontroller geçti');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
