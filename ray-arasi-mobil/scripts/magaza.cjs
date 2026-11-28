// Mağaza görsellerini üretir: başlıklı ekran görüntüleri (App Store 6,9" ve Google Play telefon),
// Play öne çıkan görseli (1024×500) ve Play yüksek çözünürlüklü simgesi (512×512).
// Kullanım: npm run paketle && node scripts/magaza.cjs [tr|en]   (Playwright ve Chromium gerekir; dil verilmezse ikisi)
'use strict';
const fs = require('fs'), path = require('path');
const KOK = path.join(__dirname, '..'), CIK = path.join(KOK, 'magaza', 'gorseller');
const src = fs.readFileSync(path.join(KOK, 'oyun', 'oyun.js'), 'utf8');
const html = JSON.parse(src.slice(src.indexOf('export default ') + 15, src.lastIndexOf(';')));
const fontCss = fs.readFileSync(path.join(KOK, 'oyun', 'fontlar', 'fontlar.css'), 'utf8').replace(/url\(([\w.-]+\.woff2)\)/g, (_, f) => 'url(data:font/woff2;base64,' + fs.readFileSync(path.join(KOK, 'oyun', 'fontlar', f)).toString('base64') + ')');
const ADRES = 'https://oyun.rayarasi.local/';
// oyunun adı ve öne çıkan görseldeki slogan
const AD = { tr: 'Trafik Ustası', en: 'Traffic Maestro' };
const SLOGAN = { tr: 'Yol, ray ve pist çiz;<br>trafiği köprüyle çöz.', en: 'Draw roads, rails and runways;<br>beat traffic with bridges.' };
// her dil için klasörler: Türkçe ios/ android/, İngilizce ios-en/ android-en/
const DILLER = process.argv[2] ? [process.argv[2]] : ['tr', 'en'];
const klasor = (ad, dil) => (dil === 'tr' ? ad : ad + '-' + dil);
// sahneler: başlık (dile göre) + oyunda kurulacak durum
const BASLIK = {
  '1-bolumler': { tr: ['Üç dünya, 120 bölüm', 'Karayolu, demiryolu ve havalimanı'], en: ['Three worlds, 120 levels', 'Roads, railways and airports'] },
  '2-ciz': { tr: ['Yolu parmağınla çiz', 'Evleri iş yerlerine bağla, trafiği akıt'], en: ['Draw roads with your finger', 'Connect homes to workplaces, keep traffic flowing'] },
  '3-kesisim': { tr: ['Kesişimde sen seç', 'Kavşak mı, köprü mü, alt geçit mi?'], en: ['You decide at every crossing', 'Junction, bridge or underpass?'] },
  '4-demiryolu': { tr: ['Uzun trenler, makaslar', 'Hatları köprü ve tünellerle ayır'], en: ['Long trains, busy switches', 'Split the lines with bridges and tunnels'] },
  '5-havalimani': { tr: ['Uçakları kapıya yanaştır', 'Pist geçişleri ve taksi köprüleri'], en: ['Taxi planes to their gates', 'Runway crossings and taxiway bridges'] },
  '6-yildiz': { tr: ['Yıldız topla, bölge aç', 'Her bölgenin sonunda bir yıldız kapısı'], en: ['Collect stars, unlock regions', 'A star gate at the end of every region'] },
};
const SAHNE = [
  ['1-bolumler', '', '', () => { [[1, 3], [21, 3], [2, 3], [22, 2], [3, 3], [4, 3], [5, 2], [6, 3], [23, 1]].forEach(([i, s]) => RA.LV.progress.set(i, s)); RA.store.set('lv.set', 'road'); RA.app.menu.set = 'road'; RA.app.showMenu(); RA.app.menu.t = 2.4; }, 0],
  ['2-ciz', '', '', () => { RA.app.openLevel(10); }, 16],
  ['3-kesisim', '', '', 'pick', 0],
  ['4-demiryolu', '', '', () => { RA.app.openLevel(120); }, 18],
  ['5-havalimani', '', '', () => { RA.app.openLevel(204); }, 26],
  ['6-yildiz', '', '', 'win', 0],
];
const HEDEF = {
  ios: { vw: 440, vh: 816, band: 140, dpr: 3 }, // 1320 × 2868 (iPhone 6,9")
  android: { vw: 360, vh: 580, band: 60, dpr: 3 }, // 1080 × 1920
};
const cerceve = (b64, t, alt, H) => `<html><head><style>${fontCss}
  body{margin:0;width:${H.vw}px;height:${H.vh + H.band}px;overflow:hidden;font-family:Overpass,sans-serif;background:linear-gradient(#4fb8f3,#87c3e1)}
  .b{height:${H.band}px;display:flex;flex-direction:column;justify-content:center;align-items:center;color:#fff;text-align:center;padding:0 14px;box-sizing:border-box}
  h1{margin:0;font-weight:900;font-size:${H.band > 100 ? 34 : 22}px;letter-spacing:.2px;text-shadow:0 2px 0 rgba(20,60,100,.35)}
  p{margin:${H.band > 100 ? 8 : 2}px 0 0;font-weight:700;font-size:${H.band > 100 ? 18 : 13}px;opacity:.95}
  img{display:block;width:${H.vw}px;height:${H.vh}px}</style></head>
  <body><div class="b"><h1>${t}</h1><p>${alt}</p></div><img src="data:image/png;base64,${b64}">
  <script>for (const el of document.querySelectorAll('h1, p')) { el.style.whiteSpace = 'nowrap'; let f = parseFloat(getComputedStyle(el).fontSize); while (el.scrollWidth > el.parentElement.clientWidth - 24 && f > 9) { f -= 0.5; el.style.fontSize = f + 'px'; } }</script></body></html>`;
(async () => {
  const { chromium } = require('playwright');
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const dil of DILLER) for (const [ad, H] of Object.entries(HEDEF)) {
    fs.mkdirSync(path.join(CIK, klasor(ad, dil)), { recursive: true });
    const ctx = await b.newContext({ viewport: { width: H.vw, height: H.vh }, deviceScaleFactor: H.dpr, hasTouch: true, isMobile: true });
    await ctx.addInitScript((d) => { try { localStorage.setItem('rayarasi.dil', JSON.stringify(d)); } catch (e) {} }, dil);
    const p = await ctx.newPage();
    await p.route('**/*', (r) => (r.request().url() === ADRES ? r.fulfill({ body: html, contentType: 'text/html; charset=utf-8' }) : r.abort()));
    await p.goto(ADRES); await p.waitForFunction(() => window.RA && RA.app); await p.waitForTimeout(800);
    const cp = await (await b.newContext({ viewport: { width: H.vw, height: H.vh + H.band }, deviceScaleFactor: H.dpr })).newPage();
    for (const [dosya, , , kur, sn] of SAHNE) {
      const [t, alt] = BASLIK[dosya][dil];
      if (kur === 'pick') {
        await p.evaluate(() => { RA.app.openLevel(3); RA.app.manual = true; const g = RA.app.lv; g.hideCard(); for (const [, raw] of g.level.solution) g.addStroke(raw.map(([x, z]) => ({ x, z }))); document.getElementById('lv-toast').hidden = true; });
        await p.waitForTimeout(1200); await p.evaluate(() => { const g = RA.app.lv, v = g.view; v.anims.forEach((a) => a.step(a, 10)); v.anims = []; const c = g.net.crossings.find((q) => q.type === 'pending'); if (c) g.openPick(c); });
        await p.waitForTimeout(500);
      } else if (kur === 'win') {
        await p.evaluate(() => { RA.app.openLevel(10); RA.app.manual = true; const g = RA.app.lv; g.hideCard(); g.playSolution(); g.togglePlay(); for (let t = 0; t < 300 && !g.ended; t += 0.5) RA.app.advance(0.5); });
        await p.waitForTimeout(1400);
      } else {
        await p.evaluate(kur);
        if (sn) {
          await p.evaluate(() => { RA.app.manual = true; const g = RA.app.lv; g.hideCard(); g.playSolution(); });
          await p.waitForTimeout(1200);
          await p.evaluate((sn) => { const g = RA.app.lv; g.togglePlay(); RA.app.advance(sn); document.getElementById('lv-toast').hidden = true; const v = g.view; v.anims.forEach((a) => a.step(a, 10)); v.anims = []; }, sn);
        }
        await p.waitForTimeout(900);
      }
      const b64 = (await p.screenshot()).toString('base64');
      await cp.setContent(cerceve(b64, t, alt, H)); await cp.waitForTimeout(300);
      await cp.screenshot({ path: path.join(CIK, klasor(ad, dil), dosya + '.jpg'), type: 'jpeg', quality: 90 });
      console.log('✓', klasor(ad, dil), dosya);
    }
    await ctx.close();
  }
  // Play öne çıkan görseli ve 512 simge
  const g = await (await b.newContext({ viewport: { width: 1024, height: 500 }, deviceScaleFactor: 1 })).newPage();
  const simge = fs.readFileSync(path.join(KOK, 'assets', 'icon.png')).toString('base64');
  for (const dil of DILLER) {
  await g.setContent(`<html><head><style>${fontCss}body{margin:0;width:1024px;height:500px;overflow:hidden;font-family:Overpass,sans-serif;background:linear-gradient(160deg,#4fb8f3,#bfe9ff 60%,#93dc6e 60%,#55ad42);display:flex;align-items:center;gap:56px;padding:0 70px;box-sizing:border-box}
    img{width:300px;height:300px;border-radius:66px;box-shadow:0 18px 40px rgba(20,60,100,.35)}h1{margin:0;font-size:78px;font-weight:900;color:#fff;white-space:nowrap;text-shadow:0 5px 0 rgba(20,60,100,.35)}p{margin:10px 0 0;font-size:30px;font-weight:800;color:#17304f}</style></head>
    <body><img src="data:image/png;base64,${simge}"><div id="y"><h1>${AD[dil]}</h1><p>${SLOGAN[dil]}</p></div>
    <script>const h = document.querySelector('h1'); let f = 78; while (h.getBoundingClientRect().right > 1024 - 56 && f > 40) { f -= 1; h.style.fontSize = f + 'px'; }</script></body></html>`);
  await g.waitForTimeout(300);
  await g.screenshot({ path: path.join(CIK, dil === 'tr' ? 'play-one-cikan-gorsel.png' : 'play-one-cikan-gorsel-' + dil + '.png') });
  }
  const s = await (await b.newContext({ viewport: { width: 512, height: 512 }, deviceScaleFactor: 1 })).newPage();
  await s.setContent(`<body style="margin:0"><img src="data:image/png;base64,${simge}" style="width:512px;height:512px;display:block"></body>`);
  await s.screenshot({ path: path.join(CIK, 'play-simge-512.png') });
  console.log('✓ öne çıkan görsel ve 512 simge');
  await b.close();
})();
