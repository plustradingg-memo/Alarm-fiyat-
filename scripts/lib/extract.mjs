// Ürün sayfası HTML'inden fiyat, eski fiyat, ad, görsel ve stok bilgisini çıkarır.
import * as cheerio from 'cheerio';

/** Desteklenen sitelerin görünen adları (alan adına göre). */
export const SITELER = {
  'trendyol.com': 'Trendyol',
  'hepsiburada.com': 'Hepsiburada',
  'amazon.com.tr': 'Amazon',
  'n11.com': 'n11',
  'teknosa.com': 'Teknosa',
  'vatanbilgisayar.com': 'Vatan',
  'mediamarkt.com.tr': 'MediaMarkt',
  'pttavm.com': 'PttAVM',
  'itopya.com': 'İtopya',
  'incehesap.com': 'İncehesap',
  'gaming.gen.tr': 'Gaming.gen.tr',
  'akakce.com': 'Akakçe',
  'ciceksepeti.com': 'Çiçeksepeti',
  'koctas.com.tr': 'Koçtaş',
  'troyestore.com': 'Troy',
  'apple.com': 'Apple',
  'samsung.com': 'Samsung',
};

export function siteAdi(url) {
  let host = '';
  try { host = new URL(url).hostname.replace(/^www\./, ''); } catch { return 'Bilinmeyen'; }
  const key = Object.keys(SITELER).find((k) => host === k || host.endsWith('.' + k));
  return key ? SITELER[key] : host;
}

/**
 * Türkçe ya da İngilizce biçimli fiyatı sayıya çevirir.
 * "24.999,90 TL" → 24999.9 · "24999.90" → 24999.9 · "1.299" → 1299 · 1299 → 1299
 */
export function parsePrice(value) {
  if (value == null) return null;
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? value : null;
  let s = String(value).replace(/\s| /g, '').replace(/[^\d.,]/g, '');
  if (!s || !/\d/.test(s)) return null;
  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  if (lastDot !== -1 && lastComma !== -1) {
    // İkisi de varsa sonda olan ondalık ayırıcıdır
    const dec = lastComma > lastDot ? ',' : '.';
    const thou = dec === ',' ? '.' : ',';
    s = s.split(thou).join('').replace(dec, '.');
  } else if (lastComma !== -1) {
    const tail = s.length - lastComma - 1;
    s = (tail === 3 && s.split(',').length >= 2 && !/^0,/.test(s)) ? s.replace(/,/g, '') : s.replace(/,/g, '.');
    if (s.split('.').length > 2) return null;
  } else if (lastDot !== -1) {
    const parts = s.split('.');
    // "1.299" / "12.499.000" → binlik ayırıcı; "1299.5" → ondalık
    if (parts.length > 2 || (parts[parts.length - 1].length === 3 && parts[0] !== '0')) s = parts.join('');
  }
  const n = parseFloat(s);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

// ---------- JSON-LD ----------
function* walk(node) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) { for (const n of node) yield* walk(n); return; }
  yield node;
  if (node['@graph']) yield* walk(node['@graph']);
  if (node.mainEntity) yield* walk(node.mainEntity);
  if (node.hasVariant) yield* walk(node.hasVariant);
}

const isType = (node, type) => {
  const t = node['@type'];
  return Array.isArray(t) ? t.includes(type) : t === type;
};

function offerPrice(offers) {
  const list = Array.isArray(offers) ? offers : [offers];
  let best = null;
  let stok = null;
  for (const o of list) {
    if (!o || typeof o !== 'object') continue;
    const p = parsePrice(o.price ?? o.lowPrice ?? o.priceSpecification?.price);
    if (p != null && (best == null || p < best)) best = p;
    if (o.availability) {
      const inStock = !/OutOfStock|SoldOut|Discontinued/i.test(String(o.availability));
      stok = stok === true ? true : inStock;
    }
    if (o.offers) {
      const inner = offerPrice(o.offers);
      if (inner.fiyat != null && (best == null || inner.fiyat < best)) best = inner.fiyat;
    }
  }
  return { fiyat: best, stok };
}

function fromJsonLd($) {
  const out = {};
  $('script[type="application/ld+json"]').each((_, el) => {
    let data;
    try { data = JSON.parse($(el).contents().text().trim()); } catch { return; }
    for (const node of walk(data)) {
      if (!isType(node, 'Product') && !isType(node, 'ProductGroup')) continue;
      if (!out.ad && node.name) out.ad = String(node.name).trim();
      if (!out.gorsel && node.image) {
        const img = Array.isArray(node.image) ? node.image[0] : node.image;
        out.gorsel = typeof img === 'string' ? img : img?.url || img?.contentUrl;
      }
      if (node.offers && out.fiyat == null) {
        const { fiyat, stok } = offerPrice(node.offers);
        if (fiyat != null) out.fiyat = fiyat;
        if (stok != null) out.stok = stok;
      }
    }
  });
  return out;
}

// ---------- Siteye özel seçiciler ----------
// Seçiciler sırayla denenir; ilk bulunan fiyat kullanılır.
const SECICILER = {
  Amazon: {
    fiyat: ['#corePrice_feature_div .priceToPay .a-offscreen', '#corePrice_feature_div .a-offscreen',
      '#corePriceDisplay_desktop_feature_div .priceToPay .a-offscreen', '#corePriceDisplay_desktop_feature_div .a-offscreen',
      '#priceblock_dealprice', '#priceblock_ourprice', '#price_inside_buybox', '.a-price .a-offscreen'],
    eski: ['#corePriceDisplay_desktop_feature_div .basisPrice .a-offscreen', '.basisPrice .a-offscreen', '.a-price.a-text-price .a-offscreen'],
    ad: ['#productTitle'],
    stokYok: ['#outOfStock', '#availability .a-color-price'],
  },
  Trendyol: {
    fiyat: ['.product-price-container .prc-dsc', '.prc-dsc', '.price-container .discounted', '.product-price-container .prc-slg'],
    eski: ['.product-price-container .prc-org', '.prc-org', '.price-container .original'],
    ad: ['h1.pr-new-br', 'h1'],
  },
  Hepsiburada: {
    fiyat: ['[data-test-id="price-current-price"]', '[data-test-id="default-price"] span', '#offering-price', '.product-price'],
    eski: ['[data-test-id="prev-price"]', '[data-test-id="price-prev-price"]', '#originalPrice'],
    ad: ['h1[data-test-id="title"]', '#product-name', 'h1'],
  },
  n11: {
    fiyat: ['.newPrice ins', '.unf-p-summary-price', '.price ins'],
    eski: ['.oldPrice del', '.unf-p-summary-old-price'],
    ad: ['h1.proName', 'h1'],
  },
  Teknosa: {
    fiyat: ['.prc-last', '.pdp-prices .prc', '[data-product-price]'],
    eski: ['.prc-first', '.pdp-prices .prc-old'],
  },
  Vatan: {
    fiyat: ['.product-list__price', '.product-detail__price .product-list__price'],
    eski: ['.product-list__current-price'],
  },
  MediaMarkt: {
    fiyat: ['[data-test="branded-price-whole-value"]', '[data-test="mms-price"] span'],
    eski: ['[data-test="mms-strike-price-type-rrp"]'],
  },
};

function firstText($, selectors = []) {
  for (const sel of selectors) {
    const el = $(sel).first();
    if (!el.length) continue;
    const v = el.attr('content') || el.attr('data-product-price') || el.text();
    if (v && v.trim()) return v.trim();
  }
  return null;
}

function metaContent($, names) {
  for (const n of names) {
    const v = $(`meta[property="${n}"]`).attr('content') || $(`meta[name="${n}"]`).attr('content') ||
      $(`[itemprop="${n}"]`).attr('content');
    if (v) return v;
  }
  return null;
}

// Sayfa içine gömülü JSON verilerinden fiyat (ör. Trendyol "sellingPrice")
function fromEmbeddedJson(html) {
  const patterns = [
    /"discountedPrice"\s*:\s*\{[^{}]*?"value"\s*:\s*([\d.]+)/,
    /"sellingPrice"\s*:\s*\{[^{}]*?"value"\s*:\s*([\d.]+)/,
    /"finalPrice"\s*:\s*([\d.]+)/,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m) { const p = parsePrice(Number(m[1])); if (p) return p; }
  }
  return null;
}

/**
 * HTML'den ürün bilgisini çıkarır.
 * @returns {{fiyat: number|null, eskiFiyat: number|null, ad: string|null, gorsel: string|null, stok: boolean|null, site: string}}
 */
export function extractProduct(html, url) {
  const $ = cheerio.load(html);
  const site = siteAdi(url);
  const sel = SECICILER[site] || {};
  const ld = fromJsonLd($);

  // Siteye özel seçici > JSON-LD > meta > gömülü JSON
  let fiyat = parsePrice(firstText($, sel.fiyat));
  if (fiyat == null) fiyat = ld.fiyat ?? null;
  if (fiyat == null) fiyat = parsePrice(metaContent($, ['product:price:amount', 'og:price:amount', 'price']));
  if (fiyat == null) fiyat = fromEmbeddedJson(html);

  let eskiFiyat = parsePrice(firstText($, sel.eski));
  if (eskiFiyat != null && fiyat != null && eskiFiyat <= fiyat) eskiFiyat = null;

  const ad = (firstText($, sel.ad) || ld.ad || metaContent($, ['og:title']) || $('title').text() || '')
    .replace(/\s+/g, ' ').trim() || null;
  const gorsel = ld.gorsel || metaContent($, ['og:image']) || null;

  let stok = ld.stok ?? null;
  if (sel.stokYok && firstText($, sel.stokYok) && /stokta yok|mevcut değil|currently unavailable/i.test(firstText($, sel.stokYok))) {
    stok = false;
  }

  return { fiyat, eskiFiyat, ad, gorsel, stok, site };
}

/** Sayfa bir bot engelleme / doğrulama sayfası gibi mi görünüyor? */
export function looksBlocked(html, status) {
  if ([403, 429, 503].includes(status)) return true;
  return /captcha|robot olmadığınızı|Access Denied|cf-browser-verification|challenge-platform|px-captcha/i.test(html.slice(0, 20000)) &&
    !/application\/ld\+json/.test(html);
}
