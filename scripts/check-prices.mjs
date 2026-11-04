#!/usr/bin/env node
// products.json'daki ürünlerin fiyatlarını kontrol eder, data/prices.json'u günceller,
// indirim olduğunda bildirim gönderir.
//
//   node scripts/check-prices.mjs             → tüm ürünleri normal HTTP isteğiyle kontrol et
//   node scripts/check-prices.mjs --tarayici  → önceki adımda başarısız olanları gerçek tarayıcıyla (Playwright) dene
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractProduct, looksBlocked, siteAdi } from './lib/extract.mjs';
import { bildir } from './lib/notify.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG = process.env.FIYAT_CONFIG || path.join(ROOT, 'products.json');
const DATA = process.env.FIYAT_DATA || path.join(ROOT, 'data', 'prices.json');
const FAILED = process.env.FIYAT_FAILED || path.join(ROOT, '.basarisiz.json');

const MAX_GECMIS = 2000;
const MAX_ALARM = 200;
const ZORUNLU_YAZMA_SAAT = 6;

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const HEADERS = {
  'User-Agent': UA,
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.6,en;q=0.5',
  'Cache-Control': 'no-cache',
  'Upgrade-Insecure-Requests': '1',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const idOf = (url) => createHash('sha1').update(url.trim()).digest('hex').slice(0, 10);

async function readJson(file, fallback) {
  try { return JSON.parse(await readFile(file, 'utf8')); } catch { return fallback; }
}

// ---------- Sayfa indirme ----------
async function fetchHtml(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 25000);
  try {
    const res = await fetch(url, { headers: HEADERS, redirect: 'follow', signal: ctrl.signal });
    const html = await res.text();
    if (looksBlocked(html, res.status)) throw new Error(`site isteği engelledi (HTTP ${res.status})`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return html;
  } finally {
    clearTimeout(t);
  }
}

let browser;
async function browserHtml(url) {
  if (!browser) {
    const { chromium } = await import('playwright');
    browser = await chromium.launch({ args: ['--disable-blink-features=AutomationControlled'] });
  }
  const ctx = await browser.newContext({ userAgent: UA, locale: 'tr-TR', timezoneId: 'Europe/Istanbul', viewport: { width: 1366, height: 900 } });
  const page = await ctx.newPage();
  try {
    const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    const html = await page.content();
    if (looksBlocked(html, res?.status() ?? 200)) throw new Error(`site tarayıcıyı da engelledi (HTTP ${res?.status()})`);
    return html;
  } finally {
    await ctx.close();
  }
}

// ---------- Alarm kuralları ----------
function alarmNedenleri(kayit, yeni, ayarlar) {
  const nedenler = [];
  const once = kayit.fiyat;
  const hedef = kayit.hedefFiyat;
  const minYuzde = kayit.minIndirimYuzdesi ?? ayarlar.minIndirimYuzdesi ?? 5;

  if (hedef && yeni <= hedef && (once == null || once > hedef || kayit.hedefBildirildi !== hedef)) {
    nedenler.push(`Hedef fiyata ulaştı (hedef ${hedef.toLocaleString('tr-TR')} ₺)`);
  }
  if (once != null && yeni < once) {
    const yuzde = ((once - yeni) / once) * 100;
    if (yuzde >= minYuzde) nedenler.push(`Fiyat %${yuzde.toFixed(1)} düştü`);
    if (kayit.enDusuk != null && yeni < kayit.enDusuk && kayit.gecmis.length >= 2 && nedenler.length) {
      nedenler.push('Takip edilen en düşük fiyat!');
    }
  }
  if (kayit.stok === false && yeni != null && kayit.yeniStok === true && ayarlar.stokBildirimi !== false) {
    nedenler.push('Ürün yeniden stokta');
  }
  return nedenler;
}

// ---------- Ana akış ----------
async function main() {
  const tarayiciModu = process.argv.includes('--tarayici');
  const config = await readJson(CONFIG, null);
  if (!config || !Array.isArray(config.urunler)) throw new Error('products.json okunamadı veya "urunler" listesi yok.');
  const ayarlar = config.ayarlar || {};

  const onceki = await readJson(DATA, { urunler: {}, alarmlar: [] });
  const oncekiMetin = JSON.stringify(stabil(onceki));
  const data = { guncelleme: onceki.guncelleme, urunler: {}, alarmlar: onceki.alarmlar || [] };

  const urunler = config.urunler
    .map((u) => (typeof u === 'string' ? { url: u } : u))
    .filter((u) => u && typeof u.url === 'string' && /^https?:\/\//.test(u.url));

  const hedefIdler = tarayiciModu ? new Set(await readJson(FAILED, [])) : null;
  const basarisiz = [];
  let denenen = 0;
  const yeniAlarmlar = [];
  const simdi = new Date().toISOString();

  for (const u of urunler) {
    const id = idOf(u.url);
    const kayit = {
      id, url: u.url.trim(), site: siteAdi(u.url), ad: u.ad || null, gorsel: null,
      fiyat: null, eskiFiyat: null, stok: null, enDusuk: null, enYuksek: null,
      sonKontrol: null, sonBasari: null, hata: null, gecmis: [],
      ...(onceki.urunler?.[id] || {}),
    };
    kayit.hedefFiyat = u.hedefFiyat ?? null;
    kayit.minIndirimYuzdesi = u.minIndirimYuzdesi ?? null;
    kayit.kategori = u.kategori ?? null;
    if (u.ad) kayit.ad = u.ad;
    data.urunler[id] = kayit;

    if (hedefIdler && !hedefIdler.has(id)) continue;
    if (u.aktif === false) continue;

    if (denenen++ > 0) await sleep(1500 + Math.random() * 2000);
    try {
      const html = tarayiciModu ? await browserHtml(kayit.url) : await fetchHtml(kayit.url);
      const bilgi = extractProduct(html, kayit.url);
      if (bilgi.fiyat == null) throw new Error('fiyat sayfada bulunamadı');

      kayit.yeniStok = bilgi.stok;
      const nedenler = alarmNedenleri(kayit, bilgi.fiyat, ayarlar);
      if (nedenler.length) {
        const alarm = {
          zaman: simdi, id, ad: kayit.ad || bilgi.ad || kayit.url, site: kayit.site, url: kayit.url,
          fiyat: bilgi.fiyat, oncekiFiyat: kayit.fiyat, nedenler,
        };
        yeniAlarmlar.push(alarm);
      }
      delete kayit.yeniStok;

      if (kayit.hedefFiyat && bilgi.fiyat <= kayit.hedefFiyat) kayit.hedefBildirildi = kayit.hedefFiyat;
      else delete kayit.hedefBildirildi;

      const son = kayit.gecmis[kayit.gecmis.length - 1];
      if (!son || son[1] !== bilgi.fiyat) kayit.gecmis.push([simdi, bilgi.fiyat]);
      if (kayit.gecmis.length > MAX_GECMIS) kayit.gecmis.splice(0, kayit.gecmis.length - MAX_GECMIS);

      Object.assign(kayit, {
        fiyat: bilgi.fiyat,
        eskiFiyat: bilgi.eskiFiyat,
        stok: bilgi.stok,
        ad: u.ad || bilgi.ad || kayit.ad,
        gorsel: bilgi.gorsel || kayit.gorsel,
        enDusuk: Math.min(bilgi.fiyat, kayit.enDusuk ?? Infinity),
        enYuksek: Math.max(bilgi.fiyat, kayit.enYuksek ?? -Infinity),
        sonKontrol: simdi, sonBasari: simdi, hata: null,
      });
      console.log(`✓ [${kayit.site}] ${kayit.ad?.slice(0, 60)} → ${bilgi.fiyat} ₺`);
    } catch (err) {
      kayit.sonKontrol = simdi;
      kayit.hata = String(err.message || err);
      basarisiz.push(id);
      console.warn(`✗ [${kayit.site}] ${kayit.url} → ${kayit.hata}`);
    }
  }

  if (browser) await browser.close();

  if (yeniAlarmlar.length) {
    data.alarmlar = [...yeniAlarmlar, ...data.alarmlar].slice(0, MAX_ALARM);
    await bildir(yeniAlarmlar);
  }

  // Yalnızca zaman damgası değiştiyse dosyayı her seferinde yazma (gereksiz commit olmasın)
  const degisti = JSON.stringify(stabil(data)) !== oncekiMetin;
  const eski = onceki.guncelleme ? (Date.now() - Date.parse(onceki.guncelleme)) / 36e5 : Infinity;
  if (degisti || eski >= ZORUNLU_YAZMA_SAAT) {
    data.guncelleme = simdi;
    await mkdir(path.dirname(DATA), { recursive: true });
    await writeFile(DATA, JSON.stringify(data, null, 1) + '\n');
    console.log(`\ndata/prices.json güncellendi (${Object.keys(data.urunler).length} ürün, ${yeniAlarmlar.length} yeni alarm).`);
  } else {
    console.log('\nDeğişiklik yok.');
  }

  if (!tarayiciModu && basarisiz.length) await writeFile(FAILED, JSON.stringify(basarisiz));
  else await rm(FAILED, { force: true });

  console.log(`Denenen: ${denenen}, başarılı: ${denenen - basarisiz.length}, başarısız: ${basarisiz.length}`);
}

// Karşılaştırma için zaman damgalarını çıkar
function stabil(d) {
  const urunler = {};
  for (const [id, u] of Object.entries(d.urunler || {})) {
    const { sonKontrol, sonBasari, ...rest } = u;
    urunler[id] = rest;
  }
  return { urunler, alarmlar: d.alarmlar || [] };
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
