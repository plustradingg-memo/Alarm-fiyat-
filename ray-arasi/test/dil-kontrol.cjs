// RAY ARASI — İngilizce eksik denetimi: oyunu İngilizce açar, ekranda görünen bütün metinleri toplar
// (sayfadaki yazılar, uyarılar, kartlar, 3B sahnedeki tabela yazıları) ve Türkçe kalanları raporlar.
// Kullanım: node test/dil-kontrol.cjs [menu|bolum|atolye|hepsi]   (varsayılan: hepsi)
// Çıkış kodu: Türkçe kalan metin varsa 1.
'use strict';
const path = require('path');
const { chromium } = require('playwright');
const KAPSAM = process.argv[2] || 'hepsi';
const URL = 'file://' + path.resolve(__dirname, '..', 'index.html') + '?dil=en';
// Türkçeye özgü harfler ya da sık Türkçe sözcükler; oyun adı ve özel adlar hariç tutulabilir
const TR_HARF = /[çğıöşüÇĞİÖŞÜ]/;
const TR_SOZ = /(?<![’'\w])(ve|bir|bu|için|ile|yol|yolu|ev|evler|köprü|kavşak|bölüm|tamam|başlat|durdur|geri|sil|ipucu|yıldız|trafik|araç|tren|uçak|kapı|ray|hat|makas|tünel|pist|seç|çiz|şehir|nüfus|talep|neden|olsun|yok|var|daha|kaybettin|kazandın|harika)(?![’'\w])/i;
const IZINLI = new Set(['TR', 'EN']);

(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'en-US', hasTouch: true, isMobile: true });
  const p = await ctx.newPage();
  const hatalar = [];
  p.on('pageerror', (e) => hatalar.push(e.message));
  await p.addInitScript(() => {
    window.__yazi = new Map(); // metin → kaynak
    const ekle = (t, k) => { t = String(t || '').replace(/\s+/g, ' ').trim(); if (t && !window.__yazi.has(t)) window.__yazi.set(t, k); };
    window.__ekle = ekle;
    for (const f of ['fillText', 'strokeText']) {
      const o = CanvasRenderingContext2D.prototype[f];
      CanvasRenderingContext2D.prototype[f] = function (t, ...a) { ekle(t, 'sahne'); return o.call(this, t, ...a); };
    }
    const tara = (root) => {
      const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let n = w.nextNode(); n; n = w.nextNode()) { const pe = n.parentElement; if (pe && !/^(SCRIPT|STYLE)$/.test(pe.nodeName)) ekle(n.nodeValue, 'sayfa'); }
      if (root.querySelectorAll) for (const el of root.querySelectorAll('[aria-label],[title],[placeholder]')) for (const a of ['aria-label', 'title', 'placeholder']) if (el.hasAttribute(a)) ekle(el.getAttribute(a), 'etiket');
    };
    window.__tara = () => tara(document.body);
    const izle = () => new MutationObserver((ms) => { for (const m of ms) { if (m.type === 'characterData') ekle(m.target.nodeValue, 'sayfa'); else for (const n of m.addedNodes) { if (n.nodeType === 3) ekle(n.nodeValue, 'sayfa'); else if (n.nodeType === 1) tara(n); } } })
      .observe(document.documentElement, { subtree: true, childList: true, characterData: true });
    if (document.documentElement) izle(); else document.addEventListener('DOMContentLoaded', izle);
  });
  await p.goto(URL);
  await p.waitForFunction(() => window.RA && RA.app);
  await p.waitForTimeout(500);
  const ev = (fn, a) => p.evaluate(fn, a);

  if (KAPSAM === 'hepsi' || KAPSAM === 'menu') {
    await ev(() => { window.__tara(); for (const m of ['road', 'rail', 'air']) { RA.app.menu.set = m; RA.app.showMenu(); window.__tara(); } });
  }
  if (KAPSAM === 'hepsi' || KAPSAM === 'bolum') {
    // her bölümün kartı; her setten örnekler oynanır (kazanma ve kaybetme), kesişim kutusu, köprü yerleri, önceden köprü
    await ev(() => {
      for (const L of RA.LV.ALL) { RA.LV.progress.set(L.id, 1); RA.app.openLevel(L.id); window.__tara(); }
      const oyna = (id, naive, sn) => {
        RA.app.openLevel(id); RA.app.manual = true; const g = RA.app.lv; g.hideCard(); window.__tara();
        g.playSolution(naive); window.__tara(); g.togglePlay();
        for (let t = 0; t < sn && !g.ended; t += 0.5) RA.app.advance(0.5);
        window.__tara();
      };
      for (const id of [1, 3, 10, 101, 104, 106, 201, 203, 204, 205, 206, 216]) oyna(id, false, 400);
      for (const id of [3, 104, 204]) oyna(id, true, 400);
      // kesişim kutusu ve araçlar
      RA.app.openLevel(3); RA.app.manual = true; let g = RA.app.lv; g.hideCard();
      for (const [, raw] of g.level.solution) g.addStroke(raw.map(([x, z]) => ({ x, z })));
      const c = g.net.crossings.find((q) => q.type === 'pending'); if (c) g.openPick(c); window.__tara(); g.closePick && g.closePick();
      for (const t of ['bridge', 'tunnel', 'erase', 'road']) { try { g.setTool(t); } catch (e) {} window.__tara(); }
      try { g.togglePlay(); RA.app.advance(1); } catch (e) {}
      RA.app.openLevel(3); g = RA.app.lv; g.hideCard(); try { g.setTool('bridge'); g.placePlan({ x: 0.3, z: 0.4 }, { x: 0.48, z: -0.88 }); } catch (e) {} window.__tara();
      // yolsuz eve başlatma, kısa çizgi, bina üstü uyarıları
      RA.app.openLevel(1); g = RA.app.lv; g.hideCard(); try { g.togglePlay(); RA.app.advance(1); } catch (e) {} window.__tara();
      try { g.addStroke([{ x: 0, z: 0 }, { x: 0.2, z: 0 }]); } catch (e) {} window.__tara();
      RA.app.showMenu();
    });
  }
  if (KAPSAM === 'hepsi' || KAPSAM === 'atolye') {
    await ev(() => {
      for (const m of ['road', 'rail', 'air']) {
        RA.app.openWorkshop(m); RA.app.manual = true; window.__tara();
        for (let k = 0; k < 120; k++) { RA.app.advance(1); if (k % 20 === 0) window.__tara(); }
        window.__tara();
        RA.app.showMenu();
      }
    });
    // atölye menüleri
    await p.evaluate(() => RA.app.openWorkshop('road'));
    for (const sel of ['#ws-menu', '#ws-ai', '#ws-play']) { const el = await p.$(sel); if (el) { await el.click().catch(() => {}); await p.waitForTimeout(150); await ev(() => window.__tara()); } }
  }
  const yazilar = await ev(() => Array.from(window.__yazi.entries()));
  const kalan = yazilar.filter(([t]) => !IZINLI.has(t) && (TR_HARF.test(t) || TR_SOZ.test(t)));
  for (const [t, k] of kalan) console.log(`[${k}] ${t}`);
  console.log(`\n${yazilar.length} metin tarandı; Türkçe kalan: ${kalan.length}` + (hatalar.length ? `\nSayfa hataları:\n${hatalar.join('\n')}` : ''));
  await b.close();
  process.exit(kalan.length || hatalar.length ? 1 : 0);
})();
