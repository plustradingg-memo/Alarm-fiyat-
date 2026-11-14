// Bubu ile İngilizce — uçtan uca test (Playwright, Chromium).
// Çalıştırma (repo kökünden):
//   npm install --no-save playwright@1.48.2 && npx playwright install chromium   (bir kez)
//   node ingilizce-oyun/test/e2e.mjs            -> ekran görüntüleri: ingilizce-oyun/test/shots/
// Konuşma motoru sahtelenir: hangi cümlenin hangi dilde istendiği kaydedilir (gerçek ses çalınmaz).
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const here = path.dirname(fileURLToPath(import.meta.url));
const PAGE = pathToFileURL(path.join(here, '..', 'index.html')).href;
const SHOTS = path.join(here, 'shots');
fs.mkdirSync(SHOTS, { recursive: true });

// --- sahte konuşma motoru (sayfa betiklerinden önce yüklenir) ---
function fakeSpeech(opts){
  window.__spoken = [];
  window.__ev = [];                       // takılma olursa son dokunuş hedefleri raporlanır
  ['pointerdown', 'pointerup', 'click'].forEach(t => document.addEventListener(t, e => {
    const el = e.target && e.target.closest ? (e.target.closest('[data-key],[id]') || e.target) : e.target;
    window.__ev.push(t + ':' + (el && (el.dataset && el.dataset.key || el.id || el.className || el.tagName)) + '@' + Math.round(e.clientX) + ',' + Math.round(e.clientY));
    if (window.__ev.length > 30) window.__ev.shift();
  }, true));
  const voices = [{ name: 'Samantha', lang: 'en-US', localService: true, default: true, voiceURI: 'sam' }];
  if (opts.tr === 'local') voices.push({ name: 'Yelda', lang: 'tr-TR', localService: true, default: false, voiceURI: 'yel' });
  if (opts.tr === 'remote') voices.push({ name: 'Microsoft Emel Online (Natural)', lang: 'tr-TR', localService: false, default: false, voiceURI: 'emel' });
  class FakeU extends EventTarget {
    constructor(t){ super(); this.text = t; this.lang = ''; this.voice = null; this.rate = 1; this.pitch = 1; this.volume = 1; this.onend = null; this.onerror = null; }
  }
  let q = [], cur = null, timer = 0;
  const fire = (u, type) => { const ev = new Event(type); if (type === 'error') ev.error = 'interrupted'; u.dispatchEvent(ev); const h = u['on' + type]; if (h) h(ev); };
  const nextU = () => {
    cur = q.shift() || null; if (!cur) return;
    if (cur.text.trim()) window.__spoken.push({ text: cur.text, lang: cur.lang, voice: cur.voice && cur.voice.name });
    timer = setTimeout(() => { const u = cur; cur = null; fire(u, 'end'); nextU(); }, Math.max(40, cur.text.length * 6));
  };
  const synth = {
    get speaking(){ return !!cur; }, get pending(){ return q.length > 0; }, paused: false,
    speak(u){ q.push(u); if (!cur) nextU(); },
    cancel(){ clearTimeout(timer); const all = (cur ? [cur] : []).concat(q); q = []; cur = null; all.forEach(u => fire(u, 'error')); },
    pause(){}, resume(){}, getVoices(){ return voices; }, onvoiceschanged: null
  };
  Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
  window.SpeechSynthesisUtterance = FakeU;
}

const OLD_SAVE = { // önceki sürümün kaydı: story/market/trVoice alanları yok
  stars: 12, chest: 12, seen: { 'animals:cat': 1, 'animals:dog': 1, 'fruits:banana': 1, 'fruits:apple': 1 },
  best: { 'animals:find': 3 }, specials: ['special:dragon'],
  settings: { slow: false, accent: 'us', showTr: true, sfx: false }
};

const ONLY = (process.env.E2E_ONLY || '').split(',').filter(Boolean);
const want = k => !ONLY.length || ONLY.includes(k);
const results = [];
async function step(name, fn, section){
  if (section && !want(section)) return;
  try { await fn(); results.push(['ok', name]); console.log('  ✓', name); }
  catch (e){ results.push(['FAIL', name, e.message]); console.log('  ✗', name, '\n    ', e.message.split('\n').filter(l => /waiting for|Expected|actual|expected|Error|assert|^[^ ]/.test(l)).slice(0, 4).join(' / ')); }
}

async function openPage(browser, { viewport = { width: 375, height: 667 }, dark = false, reducedMotion = false, tr = 'local', save = OLD_SAVE } = {}){
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, hasTouch: true, colorScheme: dark ? 'dark' : 'light', reducedMotion: reducedMotion ? 'reduce' : 'no-preference' });
  const page = await ctx.newPage();
  page.__errors = []; page.__requests = [];
  page.on('pageerror', e => page.__errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') page.__errors.push('console: ' + m.text()); });
  page.on('request', r => page.__requests.push(r.url()));
  await page.addInitScript(fakeSpeech, { tr });
  if (save) await page.addInitScript(s => { if (!sessionStorage.getItem('seeded')){ localStorage.setItem('bubu-english-v1', JSON.stringify(s)); sessionStorage.setItem('seeded', '1'); } }, save);
  await page.goto(PAGE);
  await page.waitForTimeout(300);
  return page;
}
const spoken = page => page.evaluate(() => window.__spoken.slice());
const clearSpoken = page => page.evaluate(() => { window.__spoken.length = 0; });
const store = page => page.evaluate(() => JSON.parse(localStorage.getItem('bubu-english-v1')));
const tap = (page, sel) => page.click(sel, { force: true });
async function fits(page){
  return page.evaluate(() => {
    const d = document.scrollingElement, body = document.querySelector('.act-body');
    return { docOverflow: d.scrollHeight - innerHeight, bodyOverflow: body ? body.scrollHeight - body.clientHeight : 0, wide: d.scrollWidth - innerWidth };
  });
}
async function drag(page, fromSel, toSel){
  const a = await page.locator(fromSel).boundingBox(), b = await page.locator(toSel).boundingBox();
  const x0 = a.x + a.width / 2, y0 = a.y + a.height / 2, x1 = b.x + b.width / 2, y1 = b.y + b.height / 2;
  await page.mouse.move(x0, y0); await page.mouse.down();
  for (let k = 1; k <= 12; k++) await page.mouse.move(x0 + (x1 - x0) * k / 12, y0 + (y1 - y0) * k / 12);
  await page.mouse.up();
}
const waitFor = (page, sel, timeout = 12000) => page.waitForSelector(sel, { timeout, state: 'attached' });
async function nextVisible(page){ await page.waitForSelector('.next-btn:not([hidden])', { timeout: 12000 }); await page.waitForTimeout(550); await tap(page, '.next-btn'); }

// Hikâyeyi baştan sona oynatır. mode: 'tap' | 'drag'. wrong: yanlış denemeler de yapılsın mı.
async function playStory(page, { mode = 'tap', wrong = true, shots = '' } = {}){
  await tap(page, '[data-act="story"]');
  await waitFor(page, '.scene-intro');
  if (shots) await page.screenshot({ path: path.join(SHOTS, shots + '-1-intro.png') });
  await page.waitForTimeout(550); await tap(page, '.next-btn');                       // intro
  await waitFor(page, '.teach'); if (shots) { await page.waitForSelector('.next-btn:not([hidden])'); await page.screenshot({ path: path.join(SHOTS, shots + '-2-teach.png') }); }
  await nextVisible(page);                                                         // teach apple
  await waitFor(page, '#field');
  // İlk oyunda gösterim biter, sonra kilit açılır.
  await page.waitForFunction(() => !document.querySelector('#demo-bread') || document.querySelector('#demo-bread').classList.contains('gone'), null, { timeout: 15000 });
  await page.waitForTimeout(600);
  if (shots) await page.screenshot({ path: path.join(SHOTS, shots + '-3-apple.png') });
  if (wrong){
    await tap(page, '#field [data-key="fruits:banana"]'); await tap(page, '#basket');
    await page.waitForTimeout(300);
    if (shots) await page.screenshot({ path: path.join(SHOTS, shots + '-4-apple-hint.png') });
  }
  if (mode === 'drag') await drag(page, '#field [data-key="fruits:apple"]', '#basket');
  else { await tap(page, '#field [data-key="fruits:apple"]'); await tap(page, '#basket'); }
  await waitFor(page, '.teach .blob');                                              // teach red
  await nextVisible(page);
  await waitFor(page, '#blankets');
  await page.waitForTimeout(550);
  if (wrong){ await tap(page, '.blanket[data-key="colors:blue"]'); await page.waitForTimeout(250); }
  if (shots) await page.screenshot({ path: path.join(SHOTS, shots + '-5-red.png') });
  await tap(page, '.blanket[data-key="colors:red"]');
  await waitFor(page, '.teach [data-act="teachhear"]');
  await page.waitForFunction(() => document.querySelector('.teach-word') && document.querySelector('.teach-word').textContent === 'rabbit');
  await nextVisible(page);                                                         // teach rabbit
  await waitFor(page, '#bushes'); await page.waitForTimeout(550);
  if (wrong){
    await tap(page, '.bush[data-key="animals:frog"]'); await page.waitForTimeout(500);
    if (shots) await page.screenshot({ path: path.join(SHOTS, shots + '-6-bush-hint.png') });
  }
  await tap(page, '.bush[data-key="animals:rabbit"]');
  await waitFor(page, '.scene-finale');
  await page.waitForTimeout(400);
  if (shots) await page.screenshot({ path: path.join(SHOTS, shots + '-7-finale.png') });
  await waitFor(page, '#picks', 20000);
  await page.waitForTimeout(800);
}

(async () => {
  const browser = await chromium.launch();

  console.log('Kayıt uyumluluğu ve mevcut özellikler');
  let page = await openPage(browser);
  await step('eski kayıt korunur ve yeni alanlar eklenir', async () => {
    const st = await store(page);
    assert.equal(st.stars, 12); assert.equal(st.chest, 12);
    assert.deepEqual(st.specials, ['special:dragon']);
    assert.equal(st.seen['animals:cat'], 1);
    const n = await page.textContent('#stat-stickers');
    assert.equal(n.trim(), '5');                      // 4 kelime + 1 hazine
    assert.equal(await page.isVisible('.topbar'), true);
  });
  await step('ana sayfada hikâye ve market kartları + 15 dünya', async () => {
    assert.equal(await page.locator('.feature').count(), 2);
    assert.equal(await page.locator('.cat-tile').count(), 15);
    await page.screenshot({ path: path.join(SHOTS, 'home-light.png') });
  });
  await step('Bul Bakalım hâlâ çalışır', async () => {
    await tap(page, '[data-act="cat"][data-id="animals"]');
    for (let k = 0; k < 4; k++) await tap(page, `.word-card >> nth=${k + 2}`);
    await tap(page, '[data-act="game"][data-mode="find"]');
    for (let r = 0; r < 8; r++){
      await page.waitForSelector('#ask b');
      const w = await page.$eval('#ask b', e => e.textContent);
      await tap(page, `.choice[data-key="animals:${w}"]`);
      await page.waitForTimeout(1700);
    }
    await page.waitForSelector('.end-modal', { timeout: 8000 });
    await tap(page, '.end-modal [data-act="cat"]');
    if (await page.isVisible('.chest-btn')){ await tap(page, '.chest-btn'); await page.waitForTimeout(600); await tap(page, '#chest-ok'); }
  }, 'games');
  await step('Hafıza hâlâ çalışır', async () => {
    await tap(page, '[data-act="game"][data-mode="memory"]');
    const deck = await page.$$eval('.mcard small', els => els.map(e => e.textContent));
    const done = new Set();
    for (let k = 0; k < deck.length; k++){
      if (done.has(k)) continue;
      const j = deck.findIndex((w, m) => m !== k && w === deck[k] && !done.has(m));
      await tap(page, `.mcard[data-i="${k}"]`); await tap(page, `.mcard[data-i="${j}"]`);
      await page.waitForTimeout(650); done.add(k); done.add(j);
    }
    await page.waitForSelector('.end-modal', { timeout: 8000 });
    await tap(page, '.end-modal [data-act="cat"]');
    if (await page.isVisible('.chest-btn')){ await tap(page, '.chest-btn'); await page.waitForTimeout(600); await tap(page, '#chest-ok'); }
  }, 'games');
  await step('Balon Patlat hâlâ başlar ve hedef balonu patlatır', async () => {
    await tap(page, '[data-act="game"][data-mode="balloon"]');
    await page.waitForTimeout(3500);
    let popped = 0;
    for (let t = 0; t < 60 && popped < 1; t++){
      const w = await page.$eval('#ask b', e => e.textContent).catch(() => null);
      const hit = await page.evaluate(w => {
        const sky = document.querySelector('#sky').getBoundingClientRect();
        const el = [...document.querySelectorAll('.balloon:not(.popped):not(.gold)')].find(b => b.getAttribute('aria-label') === w && b.getBoundingClientRect().top > sky.top + 5 && b.getBoundingClientRect().bottom < sky.bottom - 40);
        if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      }, w);
      if (hit){ await page.mouse.click(hit.x, hit.y); popped++; } else await page.waitForTimeout(300);
    }
    assert.equal(popped, 1);
    await tap(page, '.page-head [data-act="cat"]');
    await tap(page, '[data-act="home"]');
  }, 'games');

  console.log('Bubu’nun Pikniği (ilk oyun, dokun-seç / dokun-bırak, yanlışlarla)');
  await clearSpoken(page);
  await step('ilk oyun: "önce ben yapayım" gösterimi ekmeği sepete koyar', async () => {
    await tap(page, '[data-act="story"]');
    assert.equal(await page.isVisible('.topbar'), false);        // odak modu
    await page.waitForTimeout(550); await tap(page, '.next-btn');
    await nextVisible(page);
    await waitFor(page, '#demo-bread');
    await page.waitForFunction(() => document.querySelector('#demo-bread').classList.contains('gone'), null, { timeout: 15000 });
    await page.waitForFunction(() => document.querySelector('#basket-in').textContent.includes('🍞'));
    const sp = await spoken(page);
    assert.ok(sp.some(s => /önce ben yapayım/.test(s.text) && s.lang.startsWith('tr')), 'gösterim Türkçe anlatılmalı');
    await tap(page, '[data-act="exit"]');
    await page.waitForSelector('.feature');
    assert.equal(await page.isVisible('.topbar'), true);          // çıkışta üst çubuk geri gelir
    assert.equal(await page.locator('.hand, .drag-ghost, .fly-item').count(), 0);
  }, 'story');
  await clearSpoken(page);
  const before = await store(page);
  await step('hikâye baştan sona: elma, kırmızı, tavşan + ipuçları', async () => {
    await playStory(page, { mode: 'tap', wrong: true, shots: 'story-light' });
    const sp = await spoken(page);
    const tr = sp.filter(s => s.lang.startsWith('tr')).map(s => s.text).join(' | ');
    const en = sp.filter(s => s.lang.startsWith('en')).map(s => s.text);
    for (const w of ['Apple!', 'Red!', 'Rabbit!']) assert.ok(en.includes(w), 'İngilizce söylenmeli: ' + w);
    assert.match(tr, /Elma kırmızı ve yuvarlak/, 'elma için açıklayıcı ipucu');
    assert.match(tr, /Kırmızı, elma gibi/, 'kırmızı için açıklayıcı ipucu');
    assert.match(tr, /Tavşanın uzun kulakları var/, 'tavşan için açıklayıcı ipucu');
    assert.ok(sp.every(s => !s.lang.startsWith('tr') || s.voice === 'Yelda'), 'Türkçe yalnızca Türkçe sesle okunmalı');
  }, 'story');
  await step('çıkartma seçimi: rastgele değil, çocuk seçer ve kaydedilir', async () => {
    assert.equal(await page.locator('#picks .pick').count(), 3);
    await page.screenshot({ path: path.join(SHOTS, 'story-light-8-picks.png') });
    await tap(page, '.pick[data-key="story:ladybug"]');
    await page.waitForSelector('.end-actions');
    await page.screenshot({ path: path.join(SHOTS, 'story-light-9-picked.png') });
    const st = await store(page);
    assert.deepEqual(st.story.picnic.stickers, ['story:ladybug']);
    assert.equal(st.story.picnic.plays, 1);
    assert.equal(st.stars, before.stars);                         // hikâye yıldız vermez,
    assert.equal(st.chest, before.chest);                         // rastgele sandığı beslemez
    assert.deepEqual(st.specials, before.specials);
    assert.deepEqual(st.seen, before.seen);
  }, 'story');
  await step('ikinci oynayış: sürükle-bırak, gösterim yok, sahip olunan çıkartmada ✓', async () => {
    await tap(page, '.end-actions [data-act="again"]');
    await waitFor(page, '.scene-intro');
    await page.waitForTimeout(550); await tap(page, '.next-btn');
    await nextVisible(page);
    await waitFor(page, '#field');
    assert.equal(await page.locator('#demo-bread').count(), 0);
    await page.waitForTimeout(600);
    await drag(page, '#field [data-key="fruits:apple"]', '#basket');
    await waitFor(page, '.teach .blob');
    await page.goBack();                                          // telefonun "geri" hareketi = çıkış
    await page.waitForSelector('.feature', { timeout: 5000 });
    assert.equal(await page.isVisible('.topbar'), true);
  }, 'story');
  await step('albümde seçilen hikâye çıkartması görünür', async () => {
    await tap(page, '#stat-stickers');
    await page.waitForSelector('[data-key="story:ladybug"]');
    const sec = page.locator('.album-sec.treasure').first();
    assert.match(await sec.locator('h3').textContent(), /Hikâye/);          // hikâye çıkartmaları önce
    assert.equal(await sec.locator('[data-key="story:ladybug"]').count(), 1);
    assert.equal(await sec.locator('[data-act="story"]').count(), 0);         // sahipken eksik/gölge baskısı yok
    await tap(page, '[data-act="home"]');
  }, 'story');

  if (want('story')){
    const tp = await openPage(browser, { save: { ...OLD_SAVE, story: { picnic: { plays: 2, stickers: [] } } } });
    await step('parmakla sürükleme (dokunmatik) elmayı sepete koyar', async () => {
      await tap(tp, '[data-act="story"]'); await tp.waitForTimeout(550); await tap(tp, '.next-btn');
      await nextVisible(tp); await waitFor(tp, '#field'); await tp.waitForTimeout(650);
      const a = await tp.locator('#field [data-key="fruits:apple"]').boundingBox(), b = await tp.locator('#basket').boundingBox();
      const cdp = await tp.context().newCDPSession(tp);
      const x0 = a.x + a.width / 2, y0 = a.y + a.height / 2, x1 = b.x + b.width / 2, y1 = b.y + b.height / 2;
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0 }] });
      for (let k = 1; k <= 14; k++){ await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + (x1 - x0) * k / 14, y: y0 + (y1 - y0) * k / 14 }] }); await tp.waitForTimeout(16); }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await waitFor(tp, '.teach .blob', 8000);
      assert.deepEqual(tp.__errors, []);
    }, 'story');
    await tp.context().close();
  }

  console.log('Minik Market');
  await clearSpoken(page);
  await step('market: tanıtım, ısınma, ipuçları, sürükle + dokun, sepet', async () => { try {
    await tap(page, '[data-act="market"]');
    await page.waitForFunction(() => document.querySelectorAll('#shelf .item.waiting').length === 0, null, { timeout: 20000 });
    await page.screenshot({ path: path.join(SHOTS, 'market-light-1.png') });
    for (let r = 0; r < 4; r++){
      await page.waitForSelector('#mk[data-turn="child"]', { timeout: 15000 });   // önce sıra çocuğa geçsin,
      await page.waitForTimeout(550);
      const key = await page.$eval('#shelf', e => e.dataset.want);                  // sonra yeni hedef okunur
      if (r === 1){
        const wrong = await page.$$eval('#shelf .item[data-item]', (els, k) => els.find(e => e.dataset.key !== k).dataset.key, key);
        await tap(page, `#shelf [data-key="${wrong}"]`); await tap(page, '#basket'); await page.waitForTimeout(300);
        assert.equal(await page.$eval('#want-pic', e => e.className.includes('lvl1')), true);
        await tap(page, `#shelf [data-key="${wrong}"]`); await tap(page, '#basket'); await page.waitForTimeout(300);
        assert.equal(await page.$eval('#want-pic', e => e.className.includes('lvl2')), true);
        await page.screenshot({ path: path.join(SHOTS, 'market-light-2-hint.png') });
      }
      if (r === 2) await drag(page, `#shelf [data-key="${key}"]`, '#basket');
      else { await tap(page, `#shelf [data-key="${key}"]`); await tap(page, '#basket'); }
      try { await page.waitForFunction(n => document.querySelectorAll('#slots .slot.full').length >= n, r + 1, { timeout: 8000 }); }
      catch (e){
        const info = await page.evaluate(() => ({ want: document.querySelector('#shelf') && document.querySelector('#shelf').dataset.want, turn: document.querySelector('#mk') && document.querySelector('#mk').dataset.turn, full: document.querySelectorAll('#slots .slot.full').length, sel: [...document.querySelectorAll('#shelf .selected')].map(x => x.dataset.key), last: window.__spoken.slice(-3).map(x => x.text), ev: window.__ev.slice(-12),
          items: [...document.querySelectorAll('#shelf [data-key]')].map(x => { const r = x.getBoundingClientRect(), cs = getComputedStyle(x), hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return x.dataset.key.split(':')[1] + ' ' + x.className + ' ' + Math.round(r.left) + ',' + Math.round(r.top) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height) + ' vis=' + cs.visibility + ' pe=' + cs.pointerEvents + ' hit=' + (hit && (hit.closest('[data-key]') ? hit.closest('[data-key]').dataset.key : hit.className || hit.tagName)); }) }));
        throw new Error(`market turu ${r} takıldı (${r === 2 ? 'sürükle' : 'dokun'}): ` + JSON.stringify(info));
      }
    }
    await waitFor(page, '.full-basket', 15000);
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(SHOTS, 'market-light-3-end.png') });
    const st = await store(page);
    assert.equal(st.market.visits, 1);
    assert.equal(Object.values(st.market.bought).reduce((a, b) => a + b, 0), 4);
    const sp = await spoken(page);
    assert.ok(sp.some(s => /please!$/.test(s.text) && s.lang.startsWith('en')));
    assert.ok(sp.some(s => /Önce ona dokun, sonra sepete/.test(s.text)), 'ilk ziyarette ısınma gösterimi');
    assert.ok(sp.some(s => /Bubu başka bir şey istiyor/.test(s.text)), '1. yanlışta açıklayıcı ipucu');
    await tap(page, '.end-actions [data-act="exit"]');
    await page.waitForSelector('.feature');
  } catch (e){ const ev = await page.evaluate(() => window.__ev.slice(-14)).catch(() => []); e.message += ' | olaylar: ' + ev.join(' '); throw e; } }, 'market');
  await step('hiç konsol hatası yok', async () => { assert.deepEqual(page.__errors, []); });
  if (want('market')){
    const bp = await openPage(browser, { save: { ...OLD_SAVE, market: { visits: 3, bought: {} } } });
    await step('arka plana gidince market durur, dönünce konuşmadan bekler, dokununca sürer', async () => {
      await tap(bp, '[data-act="market"]');
      await bp.waitForFunction(() => document.querySelectorAll('#shelf .item:not(.waiting)').length >= 2, null, { timeout: 10000 });
      const setHidden = h => bp.evaluate(h => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => h }); Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => h ? 'hidden' : 'visible' }); document.dispatchEvent(new Event('visibilitychange')); }, h);
      await setHidden(true);
      const shown = await bp.$$eval('#shelf .item:not(.waiting)', e => e.length);
      await bp.waitForTimeout(2500);
      assert.ok(await bp.$$eval('#shelf .item:not(.waiting)', e => e.length) <= shown + 1, 'gizliyken tanıtım ilerlememeli');
      await clearSpoken(bp);
      await setHidden(false);
      await bp.waitForTimeout(1500);
      assert.equal((await spoken(bp)).length, 0, 'dönünce kendiliğinden konuşmamalı');
      await bp.mouse.click(30, 300);                               // çocuğun ilk dokunuşu
      await bp.waitForFunction(() => window.__spoken.length > 0, null, { timeout: 5000 });
      await bp.waitForFunction(() => document.querySelectorAll('#shelf .item.waiting').length === 0, null, { timeout: 15000 });
      assert.deepEqual(bp.__errors, []);
    }, 'market');
    await bp.context().close();
  }
  await step('dışarıya yalnızca mevcut Google Fonts isteği var', async () => {
    const ext = page.__requests.filter(u => !u.startsWith('file:') && !u.startsWith('data:'));
    assert.ok(ext.every(u => /^https:\/\/fonts\.(googleapis|gstatic)\.com\//.test(u)), ext.join('\n'));
  });
  await page.context().close();

  console.log('Telefon ekranları (açık / koyu), sığma kontrolü');
  if (want('screens')) {
  const VIEWS = [[375, 548, 'iphone-safari', 1], [360, 560, 'android', 0], [390, 664, 'iphone-se3', 0], [390, 844, 'iphone-pro', 1], [320, 460, 'tiny', 0], [667, 320, 'landscape', 1], [740, 360, 'landscape-wide', 0]];
  for (const [w, h, label, both] of VIEWS){
    for (const dark of (both ? [false, true] : [false])){
      const tag = `${label}-${dark ? 'dark' : 'light'}`;
      const p = await openPage(browser, { viewport: { width: w, height: h }, dark, save: { ...OLD_SAVE, story: { picnic: { plays: 1, stickers: ['story:sunflower'] } }, market: { visits: 1, bought: {} } } });
      await step(`${tag}: hikâye ve market ekranları kaydırmasız sığar`, async () => {
        await tap(p, '[data-act="story"]'); await p.waitForTimeout(600);
        const allow = label === 'tiny' ? 400 : 2;
        let f = await fits(p); assert.ok(f.docOverflow <= 0 && f.bodyOverflow <= allow && f.wide <= 0, 'intro ' + JSON.stringify(f));
        await tap(p, '.next-btn'); await nextVisible(p); await waitFor(p, '#field'); await p.waitForTimeout(700);
        f = await fits(p); assert.ok(f.bodyOverflow <= allow && f.wide <= 0, 'apple ' + JSON.stringify(f));
        await p.screenshot({ path: path.join(SHOTS, `${tag}-apple.png`) });
        await tap(p, '#field [data-key="fruits:apple"]'); await tap(p, '#basket');
        await nextVisible(p); await waitFor(p, '#blankets'); await p.waitForTimeout(500);
        f = await fits(p); assert.ok(f.bodyOverflow <= allow, 'red ' + JSON.stringify(f));
        await tap(p, '[data-act="exit"]'); await p.waitForSelector('.feature');
        await tap(p, '[data-act="market"]');
        await p.waitForFunction(() => document.querySelectorAll('#shelf .item.waiting').length === 0, null, { timeout: 20000 });
        await p.waitForTimeout(400);
        f = await fits(p); assert.ok(f.bodyOverflow <= allow && f.wide <= 0, 'market ' + JSON.stringify(f));
        const shelfItems = await p.$$eval('#shelf .item', els => els.map(e => Math.round(e.getBoundingClientRect().width)));
        assert.ok(Math.min(...shelfItems) >= (label === 'tiny' ? 72 : 72), 'raf öğesi küçük: ' + Math.min(...shelfItems));
        await p.screenshot({ path: path.join(SHOTS, `${tag}-market.png`) });
        const sizes = await p.$$eval('#shelf .item, .act-btn, #basket', els => els.map(e => Math.round(Math.min(e.getBoundingClientRect().width, e.getBoundingClientRect().height))));
        assert.ok(Math.min(...sizes) >= (56), 'dokunma hedefi çok küçük: ' + Math.min(...sizes));
        assert.deepEqual(p.__errors, []);
      });
      await p.context().close();
    }
  }

  }
  console.log('Türkçe ses olmayan / bulutta olan cihaz');
  if (want('notr'))
  for (const tr of ['none', 'remote']){
    const p = await openPage(browser, { tr });
    await step(`Türkçe ses ${tr}: Türkçe parçalar okunmaz, hikâye yine tamamlanır`, async () => {
      await playStory(p, { mode: 'tap', wrong: true });
      const sp = await spoken(p);
      assert.ok(sp.length > 0);
      assert.ok(sp.every(s => s.lang.startsWith('en')), 'Türkçe metin İngilizce sesle okunmamalı / bulut sesi kullanılmamalı');
      await tap(p, '#picks .pick >> nth=0');
      await p.waitForSelector('.end-actions');
      assert.deepEqual(p.__errors, []);
    });
    await p.context().close();
  }

  console.log('Azaltılmış hareket ve klavye');
  if (want('a11y')) {
  page = await openPage(browser, { reducedMotion: true, save: { ...OLD_SAVE, story: { picnic: { plays: 2, stickers: [] } } } });
  await step('azaltılmış harekette ikinci yanlışta durağan halka ipucu', async () => {
    await tap(page, '[data-act="story"]'); await page.waitForTimeout(550); await tap(page, '.next-btn');
    await nextVisible(page); await waitFor(page, '#field'); await page.waitForTimeout(600);
    for (let k = 0; k < 2; k++){ await tap(page, '#field [data-key="vegetables:carrot"]'); await tap(page, '#basket'); await page.waitForTimeout(200); }
    const sh = await page.$eval('#field [data-key="fruits:apple"]', e => getComputedStyle(e).boxShadow);
    assert.ok(/\b10px\b/.test(sh), 'durağan halka yok: ' + sh);
  });
  await step('klavye: Tab + Enter ile elma seçilip sepete konur', async () => {
    await page.focus('#field [data-key="fruits:apple"]'); await page.keyboard.press('Enter');
    await page.focus('#basket'); await page.keyboard.press('Enter');
    await waitFor(page, '.teach .blob');
  });
  await step('Escape ile ana sayfaya çıkılır', async () => {
    await page.keyboard.press('Escape');
    await page.waitForSelector('.feature', { timeout: 5000 });
  });
  await page.context().close();
  }

  await browser.close();
  const fails = results.filter(r => r[0] === 'FAIL');
  console.log(`\n${results.length - fails.length}/${results.length} geçti. Ekran görüntüleri: ${SHOTS}`);
  process.exit(fails.length ? 1 : 0);
})();
