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
  // bekleyen talepleri boş kareler boyunca en kısa hatla bağlayan yardımcı (demiryolu/havalimanı bölümü için)
  const CONNECT = `window.__connect = () => { const ws = RA.app.ws, WS = RA.WS, g = ws.grid;
    for (const pl of ws.city.waiting()) { const need = WS.City.TYPES[pl.type].need; const key = (i, j) => i + ',' + j; const prev = new Map([[key(pl.i, pl.j), null]]); const q = [[pl.i, pl.j]]; let done = false;
      while (q.length && !done) { const [i, j] = q.shift(); for (const d of ['N', 'E', 'S', 'W']) { const ni = i + WS.DV[d].x, nj = j + WS.DV[d].z; if (!g.inside(ni, nj) || prev.has(key(ni, nj))) continue; const c = g.cell(ni, nj);
        if (c.pieces.some((x) => x.type === need && x.lv === 0)) { const cells = [{ i: ni, j: nj }]; let cur = [i, j]; while (cur) { cells.push({ i: cur[0], j: cur[1] }); cur = prev.get(key(cur[0], cur[1])); } ws.setTool(need); ws.style = 'grade'; ws.applyStroke(cells); ws.setTool('look'); if (pl.conn) { done = true; break; } continue; }
        if (c.pieces.length || ws.city.placeAt(ni, nj)) continue; prev.set(key(ni, nj), [i, j]); q.push([ni, nj]); } } } };`;

  console.log('ANA EKRAN');
  ok(await page.locator('#menu').isVisible(), 'ana ekran görünür');
  ok((await page.locator('#lv-grid .lv-btn').count()) === 10, 'ana ekranda 10 bölüm var');
  ok(!(await page.locator('.lv-btn[data-lv="1"]').getAttribute('class')).includes('locked') && (await page.locator('.lv-btn[data-lv="2"]').getAttribute('class')).includes('locked'), 'ilk bölüm açık, sonrakiler kilitli');
  ok((await page.locator('#menu .free-btn').count()) === 3, 'serbest atölye düğmeleri duruyor: Karayolu, Demiryolu, Havalimanı');
  await page.waitForTimeout(600); await shot('00-ana-ekran');
  await page.locator('.lv-btn[data-lv="2"]').tap();
  ok((await state()) === 'menu', 'kilitli bölüme dokununca açılmıyor');

  console.log('\nBÖLÜM 1 — SERBEST ÇİZİM');
  const W = (x, z, y) => page.evaluate(([x, z, y]) => { const g = RA.app.lv; const q = RA.project(new THREE.Vector3(x, y || 0, z), g.camera, RA.app.w, RA.app.h); const r = RA.app.stage.getBoundingClientRect(); return { x: q.x + r.left, y: q.y + r.top }; }, [x, z, y]);
  const draw = async (pts) => { const sc = []; for (const [x, z] of pts) sc.push(await W(x, z)); await page.mouse.move(sc[0].x, sc[0].y); await page.mouse.down(); for (let k = 1; k < sc.length; k++) await page.mouse.move(sc[k].x, sc[k].y, { steps: 12 }); await page.mouse.up(); await page.waitForTimeout(80); };
  const lvToast = () => page.evaluate(() => { const t = document.getElementById('lv-toast'); return { txt: t.textContent, err: t.classList.contains('err') }; });
  await page.locator('.lv-btn[data-lv="1"]').tap();
  ok((await state()) === 'level' && (await page.locator('#lv-card').isVisible()), 'bölüm 1 açıldı; hedefi anlatan kart görünüyor');
  ok(/8 araç ulaştır/.test(await page.locator('#lv-card').textContent()), 'kartta hedef yazıyor: 8 araç ulaştır');
  await page.locator('#lv-card [data-act="start"]').tap();
  await page.evaluate(() => { RA.app.manual = true; });
  const b1 = await page.evaluate(() => RA.app.lv.level.blds.map((b) => [b.ex, b.ez]));
  // ev girişinin biraz yanından başla, eğri çiz, fabrika girişinin yanında bırak (uçlar yapışmalı)
  await draw([[b1[0][0] + 0.7, b1[0][1] - 0.4], [-4, 2], [1, -2], [4, -5], [b1[1][0] - 0.6, b1[1][1] + 0.5]]);
  const c1 = await page.evaluate(() => { const g = RA.app.lv; return { n: g.strokes.length, conn: g.net.bNodes.map((n) => n.deg), len: g.net.usage.len, pts: g.strokes[0] && g.strokes[0].pts.length }; });
  ok(c1.n === 1 && c1.conn.every((d) => d === 1), 'parmakla çizilen eğri yol evin ve fabrikanın girişine yapıştı (' + Math.round(c1.len) + ' m, ' + c1.pts + ' noktalı yumuşak eğri)');
  ok(/bağlandı/.test((await lvToast()).txt), 'not: "' + (await lvToast()).txt + '"');
  await page.waitForTimeout(150); await shot('10-bolum1-cizim');
  await page.locator('#lv-play').tap();
  ok(await page.evaluate(() => RA.app.lv.running), '▶ Başlat ile trafik başladı');
  const sp = [];
  for (let k = 0; k < 4; k++) { await page.locator('#lv-speed').tap(); sp.push(await page.locator('#lv-speed').textContent()); }
  ok(sp.join(',') === '2×,4×,8×,1×', 'hız düğmesi döngüsü: 1× → ' + sp.join(' → '));
  const t8 = await page.evaluate(() => { const g = RA.app.lv; g.setSpeed(8); const t0 = g.sim.t; RA.app.advance(1); const d = g.sim.t - t0; g.setSpeed(1); return d; });
  ok(Math.abs(t8 - 8) < 0.1, '8× hızda 1 saniyede trafik 8 saniye ilerledi (' + t8.toFixed(2) + ' sn)');
  const same = await page.evaluate(() => {
    const run = (v) => { RA.app.openLevel(10); RA.app.manual = true; const g = RA.app.lv; g.hideCard(); g.playSolution(); g.togglePlay(); g.setSpeed(v); for (let k = 0; k < 400 && !g.ended; k++) RA.app.advance(1 / v); return { ended: g.ended, t: g.sim.t.toFixed(2), del: g.sim.stats.delivered, peak: g.sim.stats.peak }; };
    const a = run(1), b = run(8); return { a, b };
  });
  ok(JSON.stringify(same.a) === JSON.stringify(same.b) && same.a.ended === 'win', '8× hızda sonuç 1×\'tekiyle birebir aynı (Bölüm 10: ' + same.b.del + ' araç, ' + same.b.t + ' sn, ' + same.b.ended + ')');
  await page.evaluate(() => { RA.app.openLevel(1); RA.app.manual = true; const g = RA.app.lv; g.hideCard(); const b = g.level.blds; g.addStroke([{ x: b[0].ex, z: b[0].ez }, { x: -4, z: 2 }, { x: 1, z: -2 }, { x: 4, z: -5 }, { x: b[1].ex, z: b[1].ez }], 'junction', true); g.togglePlay(); });
  const w1 = await page.evaluate(() => { const g = RA.app.lv; let t = 0; for (; t < 120 && !g.ended; t += 0.5) RA.app.advance(0.5); return { ended: g.ended, t, del: g.sim.stats.delivered }; });
  ok(w1.ended === 'win', 'turuncu araçlar fabrikaya ulaştı, bölüm kazanıldı (' + w1.del + ' araç, ' + w1.t + ' sn)');
  await page.waitForTimeout(800);
  ok(/Harika/.test(await page.locator('#lv-card').textContent()) && (await page.locator('#lv-card .lv-stars i.on').count()) >= 1, 'kazanma kartı ve yıldızlar (' + (await page.locator('#lv-card .lv-stars i.on').count()) + ' yıldız)');
  await shot('11-bolum1-kazandi');
  await page.locator('#lv-card [data-act="menu"]').tap();
  ok(!(await page.locator('.lv-btn[data-lv="2"]').getAttribute('class')).includes('locked'), 'bölüm 2 açıldı, yıldızlar ana ekranda görünüyor');

  console.log('\nBÖLÜM 3 — KESİŞİM: KAVŞAK, KÖPRÜ, ALT GEÇİT');
  await page.evaluate(() => { RA.LV.progress.set(2, 1); RA.app.showMenu(); });
  await page.locator('.lv-btn[data-lv="3"]').tap();
  await page.locator('#lv-card [data-act="start"]').tap();
  await page.evaluate(() => { RA.app.manual = true; });
  const b3 = await page.evaluate(() => RA.app.lv.level.blds.map((b) => [b.ex, b.ez]));
  await draw([b3[0], [0, 0], b3[2]]);
  await draw([b3[1], [0, 0.2], b3[3]]);
  let x3 = await page.evaluate(() => RA.app.lv.net.crossings.map((c) => ({ type: c.type, x: c.x, z: c.z })));
  ok(x3.length === 1 && x3[0].type === 'pending' && !(await page.evaluate(() => RA.app.lv.net.nodes.some((n) => n.kind === 'j'))), 'iki yol kesişince kendiliğinden kavşak olmadı: kesişim belirsiz (turuncu ? işareti)');
  ok(/\? işaretine dokun/.test((await lvToast()).txt), 'not: "' + (await lvToast()).txt + '"');
  await page.locator('#lv-play').tap(); await page.waitForTimeout(60);
  ok(!(await page.evaluate(() => RA.app.lv.started)) && /Önce kesişimleri belirle/.test((await lvToast()).txt) && (await page.locator('#lv-pick').isVisible()), 'belirsiz kesişim varken trafik başlamadı; seçim kutusu açıldı');
  await page.waitForTimeout(150); await shot('12-bolum3-secim');
  await page.locator('#lv-pick [data-pick="junction"]').tap(); await page.waitForTimeout(60);
  ok((await page.evaluate(() => RA.app.lv.net.crossings[0].type === 'junction' && RA.app.lv.net.nodes.some((n) => n.kind === 'j' && n.deg === 4))) && !(await page.locator('#lv-pick').isVisible()), 'seçim kutusundan Kavşak: ışıklı dört kollu kavşak oldu');
  await page.waitForTimeout(150); await shot('12-bolum3-kavsak');
  const mk = await W(x3[0].x, x3[0].z, 2.0);
  await page.mouse.click(mk.x, mk.y); await page.waitForTimeout(80);
  ok(await page.locator('#lv-pick').isVisible() && (await page.locator('#lv-pick [data-pick="tunnel"]').isDisabled()), 'işarete dokununca seçim kutusu açıldı; hakkı olmayan Alt geçit kapalı');
  await page.locator('#lv-pick [data-pick="bridge"]').tap(); await page.waitForTimeout(60);
  x3 = await page.evaluate(() => ({ type: RA.app.lv.net.crossings[0].type, br: RA.app.lv.net.usage.bridges, nb: document.getElementById('lv-nb').textContent, up: RA.app.lv.net.edges.some((e) => e.y((e.s0 + e.s1) / 2) > 1) }));
  ok(x3.type === 'bridge' && x3.br === 1 && x3.nb === '0' && x3.up, 'Köprü seçildi: bir yol öbürünün üstünden geçiyor, köprü hakkı 0 kaldı');
  await page.waitForTimeout(150); await shot('13-bolum3-kopru');
  await page.mouse.click(mk.x, mk.y); await page.waitForTimeout(80);
  await page.locator('#lv-pick [data-pick="junction"]').tap(); await page.waitForTimeout(60);
  ok((await page.evaluate(() => RA.app.lv.net.crossings[0].type)) === 'junction', 'yeniden dokunup Kavşak seçince kavşağa döndü');
  // Köprü düğmesi: köprü yapılabilecek yerler parlar, oyuncu istediğine dokunur (kavşak olan kesişim de olur)
  await page.locator('#lv-tok-b').tap(); await page.waitForTimeout(80);
  const bm = await page.evaluate(() => { const g = RA.app.lv; return { tool: g.tool, spots: (g.spotList || []).filter((q) => q.act === 'set').length, on: document.getElementById('lv-tok-b').classList.contains('on'), marks: g.view.marks.every((m) => !m.sp.visible) }; });
  ok(bm.tool === 'bridge' && bm.spots === 1 && bm.on && bm.marks && /1 yer parlıyor/.test((await lvToast()).txt), '"Köprü"ye basınca köprü yapılabilecek yer parladı (kavşak olan kesişim): "' + (await lvToast()).txt + '"');
  await page.waitForTimeout(150); await shot('13a-kopru-yerleri');
  await page.mouse.click(mk.x, mk.y); await page.waitForTimeout(80);
  const bd = await page.evaluate(() => { const g = RA.app.lv; return { type: g.net.crossings[0].type, br: g.net.usage.bridges, tool: g.tool }; });
  ok(bd.type === 'bridge' && bd.br === 1 && bd.tool === 'road', 'parlayan yere dokununca köprü oldu; hak bitince Yol çiz\'e dönüldü (' + (await lvToast()).txt + ')');
  await page.locator('#lv-tok-b').tap(); await page.waitForTimeout(60);
  ok((await page.evaluate(() => RA.app.lv.tool)) === 'road' && /hakkın bitti/.test((await lvToast()).txt), 'hak bitmişken Köprü\'ye basınca nedeni yazdı: "' + (await lvToast()).txt + '"');
  await page.locator('#lv-tok-t').tap(); await page.waitForTimeout(60);
  ok(/alt geçit hakkın yok/.test((await lvToast()).txt), 'bu bölümde alt geçit yok: "' + (await lvToast()).txt + '"');
  await page.mouse.click(mk.x, mk.y); await page.waitForTimeout(80);
  await page.locator('#lv-pick [data-pick="junction"]').tap(); await page.waitForTimeout(60);
  // asfalt sınırı
  await page.evaluate(() => { RA.app.lv.level.budget = 50; });
  await draw([[-8.6, 7], [-8.6, -5]]);
  await page.evaluate(() => { RA.app.lv.level.budget = 60; });
  ok((await lvToast()).err && /Asfalt yetmiyor/.test((await lvToast()).txt), 'asfalt yetmeyince çizim reddedildi: "' + (await lvToast()).txt + '"');
  // sil ve geri al
  await page.locator('#lv [data-lvtool="erase"]').tap();
  const e3 = await page.evaluate(() => { const g = RA.app.lv; const st = g.net.S.find((q) => Math.hypot(q.pts[0].x - g.level.blds[1].ex, q.pts[0].z - g.level.blds[1].ez) < 0.5); const p = RA.LV.geo.at(st, st.len * 0.25); return [p.x, p.z]; });
  const ep = await W(e3[0], e3[1]); await page.mouse.click(ep.x, ep.y); await page.waitForTimeout(80);
  const d3 = await page.evaluate(() => RA.app.lv.net.bNodes.map((n) => n.deg).join(','));
  ok(/Yol silindi/.test((await lvToast()).txt) && d3.split(',').filter((v) => v === '0').length === 1, 'Sil: dokunulan yol parçası silindi, mavi ev bağlantısız kaldı (' + (await lvToast()).txt + ' · ' + d3 + ')');
  await page.locator('#lv-undo').tap();
  ok((await page.evaluate(() => RA.app.lv.net.bNodes.every((n) => n.deg === 1))), 'Geri al: silinen yol geri geldi');
  await page.locator('#lv [data-lvtool="road"]').tap();
  await page.mouse.click(mk.x, mk.y); await page.waitForTimeout(80); await page.locator('#lv-pick [data-pick="bridge"]').tap(); // yeniden köprü
  await page.locator('#lv-hint').tap();
  ok(await page.evaluate(() => !!RA.app.lv.view.hintG), 'İpucu: çözüm yolu tahtada yeşil gösterildi');
  const w3 = await page.evaluate(() => { const g = RA.app.lv; g.togglePlay(); let t = 0; for (; t < 200 && !g.ended; t += 0.5) RA.app.advance(0.5); return { ended: g.ended, del: g.sim.stats.delivered, peak: g.sim.stats.peak }; });
  ok(w3.ended === 'win', 'köprülü düzenle bölüm 3 kazanıldı (' + w3.del + ' araç, evde en çok ' + w3.peak + ' kişi bekledi)');

  console.log('\nTAŞAN UÇ VE AKAN TRAFİKTE KESİŞİM');
  await page.evaluate(() => { RA.app.openLevel(4); RA.app.manual = true; RA.app.lv.hideCard(); });
  const b4 = await page.evaluate(() => RA.app.lv.level.blds.map((q) => [q.ex, q.ez]));
  await draw([b4[3], [0, -2], [0, 7.5]]); // fabrikadan aşağı ana yol
  await draw([b4[0], [-3, 7.2], [1.5, 5.4]]); // turuncu ev → ana yolu 1,5 m aşıp boşta biter
  const t4 = await page.evaluate(() => { const g = RA.app.lv; const st = g.net.S.find((q) => q.id !== g.net.S[0].id); const e = st.pts[st.pts.length - 1]; return { pend: g.net.pending, conn: g.net.bNodes[0].deg, n: g.strokes.length, endX: e.x }; });
  ok(t4.n === 2 && t4.pend === 0 && t4.conn === 1 && Math.abs(t4.endX) < 0.05, 'ana yolu az farkla aşan uç kesildi: yol tam ana yolun üstünde bitip ona birleşti, kesişim sorusu çıkmadı');
  await page.evaluate(() => { const g = RA.app.lv; g.togglePlay(); RA.app.advance(3); });
  await draw([b4[2], [0, 1.4], [6.1, 1]]); // mavi yol ana yolu keser (trafik akarken)
  const r4 = await page.evaluate(() => ({ running: RA.app.lv.running, pend: RA.app.lv.net.pending, pick: !document.getElementById('lv-pick').hidden, toast: document.getElementById('lv-toast').textContent }));
  ok(!r4.running && r4.pend === 1 && r4.pick && /Trafik durdu/.test(r4.toast), 'trafik akarken çizilen kesişim için trafik durdu ve seçim kutusu açıldı');
  await page.locator('#lv-pick [data-pick="bridge"]').tap(); await page.waitForTimeout(60);
  await page.locator('#lv-play').tap();
  ok(await page.evaluate(() => RA.app.lv.running && RA.app.lv.net.pending === 0 && RA.app.lv.net.usage.bridges === 1), 'köprü seçilince trafik ▶ ile devam etti');

  console.log('\nYOL KALİTESİ');
  await page.evaluate(() => { RA.app.openLevel(2); RA.app.manual = true; RA.app.lv.hideCard(); });
  const b2 = await page.evaluate(() => RA.app.lv.level.blds.map((q) => [q.ex, q.ez]));
  let sd = 11; const rn = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
  const wob = []; for (let t = 0; t <= 1.0001; t += 0.04) wob.push([b2[0][0] + (b2[2][0] - b2[0][0]) * t + (rn() - 0.5) * 0.9, b2[0][1] + (b2[2][1] - b2[0][1]) * t + (rn() - 0.5) * 0.9]);
  wob[0] = b2[0]; wob[wob.length - 1] = b2[2];
  await draw(wob);
  const q1 = await page.evaluate(() => { const st = RA.app.lv.net.S[0]; if (!st) return null; let m = 0; for (let i = 1; i < st.pts.length - 1; i++) { const a = Math.atan2(st.pts[i].z - st.pts[i - 1].z, st.pts[i].x - st.pts[i - 1].x), b = Math.atan2(st.pts[i + 1].z - st.pts[i].z, st.pts[i + 1].x - st.pts[i].x); m = Math.max(m, Math.abs(RA.wrapAngle(b - a))); } const t0 = RA.LV.geo.tan(st, 0.3), t1 = RA.LV.geo.tan(st, st.len - 0.3); return { r: 0.3 / m, exit: -t0.z, enter: -t1.z }; });
  ok(q1 && q1.r > 1.6 && q1.exit > 0.99 && q1.enter > 0.99, 'titrek el çizimi düzgün yola dönüştü: en dar viraj ' + (q1 ? q1.r.toFixed(1) : '?') + ' m yarıçaplı, yol binadan dümdüz çıkıp binaya dümdüz giriyor');
  // dağınık çizimler reddedilmez: oyun yolu kendisi düzeltir (hata kutusu çıkmaz)
  await page.evaluate(() => { const g = RA.app.lv; window.__errs = []; if (!g.__errWrap) { g.__errWrap = true; const ot = g.toast.bind(g); g.toast = (m, e) => { if (e) window.__errs.push(m); ot(m, e); }; } });
  await draw([b2[1], [4, 5], [2, 2], [-2, 1], [-2, -3], [2, -3], [2, 1], [-1, 4], [-5, -4], b2[3]]);
  const lp = await page.evaluate(() => { const g = RA.app.lv, st = g.net.S[g.net.S.length - 1]; let self = false; for (let i = 0; i < st.pts.length - 1; i++) for (let j = i + 2; j < st.pts.length - 1; j++) if (RA.LV.geo.segX(st.pts[i].x, st.pts[i].z, st.pts[i + 1].x, st.pts[i + 1].z, st.pts[j].x, st.pts[j].z, st.pts[j + 1].x, st.pts[j + 1].z)) self = true; return { n: g.strokes.length, self, errs: window.__errs.slice() }; });
  ok(lp.n === 2 && !lp.self && !lp.errs.length, 'kendini kesen ilmekli çizim reddedilmedi: ilmek atılıp yol düzgün kuruldu ("' + (await lvToast()).txt + '")');
  const kissN = await page.evaluate(() => new Promise((res) => setTimeout(() => res(RA.app.lv.view.anims.length), 330)));
  ok(kissN > 0, 'yol binaya / yola kavuşunca öpüşme animasyonu oynadı (' + kissN + ' canlandırma)');
  await shot('11b-ilmek-duzeldi');
  await draw([b2[1], [6, 4], [5.6, 2], [5.2, 4.5], [-6, -9.1]]);
  ok(!(await page.evaluate(() => window.__errs.length)), 'saç tokası gibi keskin viraj hata vermeden düzeltildi: "' + (await lvToast()).txt + '"');
  await draw([[-3.72, 3.44], [0, 0.1], [3.72, -3.24]]); // turuncu yolu 15° ile kesen çizgi
  const sx = await page.evaluate(() => { const g = RA.app.lv, G = RA.LV.geo; let min = 9; for (let i = 0; i < g.net.S.length; i++) for (let j = i + 1; j < g.net.S.length; j++) for (const x of G.intersections(g.net.S[i], g.net.S[j])) { const a = G.tan(g.net.S[i], x.sa), b = G.tan(g.net.S[j], x.sb); min = Math.min(min, Math.abs(a.x * b.z - a.z * b.x)); } return { errs: window.__errs.length, min }; });
  ok(!sx.errs && sx.min > 0.5, 'öbür yolu çok yatık kesen çizim hata vermeden dikleştirildi (en yatık kesişim ' + Math.round(Math.asin(Math.min(1, sx.min)) * 180 / Math.PI) + '°)');
  // karşılıklı bağlanmış iki yol (dört kollu kavşak) da köprü yeri olur: iki yol birleşip öbürünün üstünden geçer
  const mg = await page.evaluate(() => {
    RA.app.openLevel(3); RA.app.manual = true; const g = RA.app.lv; g.hideCard();
    g.tryCommit([{ id: 1, pts: [{ x: -6, z: 0 }, { x: 6, z: 0 }] }, { id: 2, pts: [{ x: 0, z: -7 }, { x: 0, z: 0 }] }, { id: 3, pts: [{ x: 0, z: 0 }, { x: 0, z: 7 }] }], {}, null, null, true); g.nextId = 4;
    const deg = (g.net.nodes.find((q) => q.kind === 'j') || {}).deg;
    g.setTool('bridge');
    const s = (g.spotList || []).find((q) => q.act === 'merge'); if (s) g.useSpot(s);
    return { deg, merge: !!s, n: g.strokes.length, br: g.net.usage.bridges, j: g.net.nodes.filter((q) => q.kind === 'j').length };
  });
  ok(mg.deg === 4 && mg.merge && mg.n === 2 && mg.br === 1 && mg.j === 0, 'yolu kavşaklı çizsen de köprü olur: karşılıklı bağlanan iki yol birleşip ana yolun üstünden geçti');
  // rastgele karman çorman 40 çizim: hiçbirinde kırmızı hata yok
  const fz = await page.evaluate(() => {
    let seed = 7; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    const g = RA.app.lv; let errs = 0, added = 0, slow = 0;
    for (let round = 0; round < 5; round++) {
      RA.app.openLevel(7 + (round % 3)); RA.app.manual = true; g.hideCard(); g.level.budget = 9999; g.level.bridges = 20; g.level.tunnels = 20;
      const B = g.level.blds; window.__errs = [];
      for (let k = 0; k < 8; k++) {
        const pick = () => { const r = rnd(); if (r < 0.55) { const b = B[Math.floor(rnd() * B.length)]; return { x: b.ex + (rnd() - 0.5) * 1.2, z: b.ez + (rnd() - 0.5) * 1.2 }; } if (r < 0.75 && g.net.S.length) { const st = g.net.S[Math.floor(rnd() * g.net.S.length)]; const q = RA.LV.geo.at(st, rnd() * st.len); return { x: q.x + (rnd() - 0.5) * 1.5, z: q.z + (rnd() - 0.5) * 1.5 }; } return { x: (rnd() - 0.5) * 18, z: (rnd() - 0.5) * 30 }; };
        const A = pick(), Z = pick(), wp = [A]; const nw = Math.floor(rnd() * 3);
        for (let i = 1; i <= nw; i++) { const t = i / (nw + 1); wp.push({ x: A.x + (Z.x - A.x) * t + (rnd() - 0.5) * 8, z: A.z + (Z.z - A.z) * t + (rnd() - 0.5) * 8 }); }
        wp.push(Z);
        const raw = []; for (let i = 0; i < wp.length - 1; i++) { const a = wp[i], b = wp[i + 1], n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.35)); for (let j = 0; j < n; j++) raw.push({ x: a.x + (b.x - a.x) * j / n + (rnd() - 0.5) * 0.25, z: a.z + (b.z - a.z) * j / n + (rnd() - 0.5) * 0.25 }); }
        raw.push(Z);
        const t0 = performance.now(); if (g.addStroke(raw)) added++; if (performance.now() - t0 > 1500) slow++;
      }
      errs += window.__errs.length;
    }
    return { errs, added, slow };
  });
  ok(fz.errs === 0 && fz.added >= 25 && fz.slow === 0, '40 rastgele karman çorman çizimin ' + fz.added + ' tanesi yol oldu, hiçbirinde kırmızı hata çıkmadı, hiçbiri 1,5 sn sürmedi');

  console.log('\nKAYBETME');
  await page.evaluate(() => { RA.app.openLevel(2); RA.app.manual = true; const g = RA.app.lv; g.hideCard(); const b = g.level.blds; g.addStroke([{ x: b[0].ex, z: b[0].ez }, { x: b[2].ex, z: b[2].ez }], 'junction', true); });
  const l2 = await page.evaluate(() => { const g = RA.app.lv; g.togglePlay(); let t = 0; for (; t < 120 && !g.ended; t += 0.5) RA.app.advance(0.5); return { ended: g.ended, t }; });
  await page.waitForFunction(() => /Trafik tıkandı/.test(document.getElementById('lv-card').textContent) && !document.getElementById('lv-card').hidden, null, { timeout: 5000 }).catch(() => {});
  ok(l2.ended === 'lose' && /Trafik tıkandı/.test(await page.locator('#lv-card').textContent()) && /yol yok/.test(await page.locator('#lv-card').textContent()), 'mavi evin yolu yokken bekleyenler 8 olunca bölüm kaybedildi ve nedeni yazdı');
  await shot('14-kaybetti');
  await page.locator('#lv-card [data-act="retry"]').tap();
  ok(await page.evaluate(() => RA.app.lv.strokes.length === 1 && !RA.app.lv.started), '"Yollarımla tekrar dene": çizilen yol duruyor, trafik baştan');

  console.log('\nBÜTÜN BÖLÜMLER ÇÖZÜLEBİLİR');
  const all = await page.evaluate(() => RA.LV.LEVELS.map((L) => {
    const run = (naive) => {
      RA.app.openLevel(L.id); RA.app.manual = true; const g = RA.app.lv; g.hideCard();
      let n = 0; for (const [tool, raw] of L.solution) if (g.addStroke(raw.map(([x, z]) => ({ x, z })), naive || tool === 'road' ? 'junction' : tool, true)) n++;
      g.togglePlay(); let t = 0; for (; t < 400 && !g.ended; t += 0.5) RA.app.advance(0.5);
      return { n, ended: g.ended, del: g.sim.stats.delivered, peak: g.sim.stats.peak, len: Math.round(g.net.usage.len) };
    };
    const sol = run(false), naive = [3, 4, 9, 10].includes(L.id) ? run(true) : null;
    return { id: L.id, name: L.name, goal: L.goal, sol, naive };
  }));
  for (const r of all) ok(r.sol.n > 0 && r.sol.ended === 'win', 'Bölüm ' + r.id + ' (' + r.name + '): çözüm yoluyla kazanıldı (' + r.sol.del + '/' + r.goal + ' araç, ' + r.sol.len + ' m asfalt, evde en çok ' + r.sol.peak + ' kişi)');
  for (const r of all) if (r.naive) ok(r.naive.ended === 'lose', 'Bölüm ' + r.id + ': köprüsüz (hepsi kavşak) denemede kaybedildi (' + r.naive.del + '/' + r.goal + ')');
  await page.evaluate(() => RA.app.showMenu());

  console.log('\nKARAYOLU — ŞEHİR 4 DÜZ YOLLA BAŞLAR');
  await page.locator('.free-btn[data-mode="road"]').tap();
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
  ok(dem[0].type === 'mahalle' && /İlk sakinler geliyor/.test((await toastTxt()).txt), 'ilk talep gerekçesiyle geldi: "' + (await toastTxt()).txt + '"');
  const placeOk = await page.evaluate(() => { const ws = RA.app.ws, g = ws.grid, WS = RA.WS; return ws.city.places.every((p) => p.i >= 1 && p.j >= 1 && p.i <= g.cols - 2 && p.j <= g.rows - 2 && [[-1, 0], [1, 0], [0, -1], [0, 1], [-2, 0], [2, 0], [0, -2], [0, 2], [1, 1], [1, -1], [-1, 1], [-1, -1]].some(([a, b]) => { const c = g.cell(p.i + a, p.j + b); return c && c.pieces.some((q) => q.type === 'road'); })); });
  ok(placeOk, 'talep tahtanın kenarında değil, yolun yanında ya da bir kare içeride');
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
  ok(/^%\d+$/.test(moodTxt), 'üst şeritte memnuniyet (' + moodTxt + ') ve aşama (' + (await page.locator('#ws-popn .lv b').textContent()) + ', ' + (await page.locator('#ws-popn .lv > span:not(.meter)').textContent()) + ' kişi) görünüyor');
  await page.locator('#ws-mood').tap();
  ok(/^Memnuniyet %\d+/.test((await toastTxt()).txt), 'memnuniyete dokununca nedeni yazıyor: "' + (await toastTxt()).txt + '"');
  await page.locator('#ws-popn').tap();
  ok(/kişi/.test((await toastTxt()).txt), 'aşamaya dokununca sonraki aşama yazıyor: "' + (await toastTxt()).txt + '"');
  const roles = await page.evaluate(() => { const sim = RA.app.ws.sim; let home = 0, toHome = 0; for (let k = 0; k < 60; k++) { RA.app.advance(0.5); for (const c of sim.cars) if (c.role === 'home' && c.dest && !c.counted) { c.counted = true; home++; const L = c.dest.kind === 'lot' && sim.lots.get(c.dest.key); if (L && L.role === 'home') toHome++; } } return { home, toHome }; });
  ok(roles.home >= 3 && roles.toHome / roles.home < 0.3, 'mahalleden çıkan araçlar başka yerlere (iş, okul, otopark, şehir dışı) gidiyor (' + roles.home + ' araçtan ' + roles.toHome + ' tanesi başka mahalleye)');
  // büyüme kapısı: trafik sıkışıkken (memnuniyet düşük) yeni talep gelmez, nüfus artmaz
  const gate = await page.evaluate(() => { const ws = RA.app.ws, c = ws.city; while (c.waiting().length) c.places.splice(c.places.indexOf(c.waiting()[0]), 1); const n0 = c.places.length, r0 = c.residents(); c.mood = 20; c.nextT = 0; c.gateHintT = 0; c.update(0.1); return { n0, n1: c.places.length, grew: c.residents() > r0 + 0.01, toast: document.getElementById('ws-toast').textContent }; });
  ok(gate.n1 === gate.n0 && !gate.grew && /büyümek istiyor/.test(gate.toast), 'memnuniyet düşükken şehir büyümüyor ve nedenini söylüyor: "' + gate.toast + '"');
  const lvl = await page.evaluate(() => { const c = RA.app.ws.city; const p = c.places.find((q) => q.conn && q.type === 'mahalle'); const was = c.level(); c.places.push({ id: 999, i: 0, j: 0, type: 'mahalle', conn: true, grow: 1, age: 0, cAge: 0, face: 'S' }); c.mood = 90; c.update(0.1); const now = c.level(); c.places.pop(); return { was, now, toast: document.getElementById('ws-toast').textContent }; });
  ok(lvl.now > lvl.was && /Tebrikler/.test(lvl.toast), 'nüfus eşiği geçilince aşama atlanıyor: "' + lvl.toast + '"');
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
  await page.locator('.free-btn[data-mode="road"]').tap();
  ok((await page.evaluate(() => JSON.stringify([RA.app.ws.grid.serialize(), RA.app.ws.city.places.map((p) => [p.type, p.i, p.j, p.conn])]))) === saved, 'çizim ve talepler kaydedildi: sayfa yenilenince aynı şehir geldi');
  await page.locator('#ws-menu').tap(); await page.locator('#ws-new').tap();
  const fresh = await page.evaluate(() => { const ws = RA.app.ws; let n = 0; ws.grid.each((c) => (n += c.pieces.length)); return { n, places: ws.city.places.length, undo: !document.getElementById('ws-undo').disabled }; });
  ok(fresh.n === start.n && fresh.places === 0 && fresh.undo, '⋯ › Yeni şehir: 4 düz yola döndü, talepler sıfırlandı, eski şehir ↶ ile geri alınabilir');
  // önceki sürümün kaydı: şehir 4 düz yolla başlar, eski çizim geri alınabilir
  await page.evaluate(() => { RA.app.showMenu(); const g = RA.WS.template('road').serialize(); g.v = 1; RA.store.set('ws.road', g); });
  await page.locator('.free-btn[data-mode="road"]').tap();
  const mig = await page.evaluate(() => { const ws = RA.app.ws; let n = 0; ws.grid.each((c) => (n += c.pieces.length)); return { n, undo: !document.getElementById('ws-undo').disabled, toast: document.getElementById('ws-toast').textContent }; });
  ok(mig.n === start.n && mig.undo && /baştan başladı/.test(mig.toast), 'önceki sürümün kaydı varsa şehir 4 düz yolla başlar, eski çizim ↶ ile gelir');

  console.log('\nDEMİRYOLU VE HAVALİMANI');
  await page.evaluate(() => RA.app.showMenu());
  await page.locator('.free-btn[data-mode="rail"]').tap();
  await page.evaluate(CONNECT);
  const rail = await page.evaluate(() => { RA.app.manual = true; let closed = false; for (let k = 0; k < 360; k++) { RA.app.advance(0.5); if (k % 8 === 0) window.__connect(); for (const X of RA.app.ws.sim.xc.values()) if (X.state === 'closed') closed = true; } const s = RA.app.ws.sim; let rails = 0; RA.app.ws.grid.each((c) => c.pieces.forEach((q) => q.type === 'rail' && rails++)); return { trains: s.trains.length, trips: s.stats.trains, closed, rails, places: RA.app.ws.city.places.map((p) => p.type) }; });
  ok(rail.rails >= 40 && rail.trains > 0 && rail.trips > 0, 'demiryolu iki düz hatla başlar; trenler sefer yaptı (' + rail.trains + ' tren, ' + rail.trips + ' sefer)');
  ok(rail.closed, 'hemzemin geçitte bariyerler tren gelince otomatik indi, ışıklar yanıp söndü');
  ok(rail.places.includes('istasyon'), 'nüfus artınca demiryolunda istasyon talebi geldi (' + rail.places.join(', ') + ')');
  await page.waitForTimeout(150); await shot('06-demiryolu');
  await page.evaluate(() => RA.app.showMenu());
  await page.locator('.free-btn[data-mode="air"]').tap();
  await page.evaluate(CONNECT);
  const air = await page.evaluate(() => { RA.app.manual = true; for (let k = 0; k < 180; k++) { RA.app.advance(1); if (k % 4 === 0) window.__connect(); } return Object.assign({ places: RA.app.ws.city.places.map((p) => p.type) }, RA.app.ws.sim.stats); });
  ok(air.land >= 2 && air.takeoff >= 1, 'havalimanı tek pist ve bir kapıyla başlar; kule iniş ve kalkışları sıraladı (' + air.land + ' iniş, ' + air.takeoff + ' kalkış)');
  ok(air.places.includes('kapi'), 'nüfus artınca havalimanında yeni kapı talebi geldi (' + air.places.join(', ') + ')');
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
