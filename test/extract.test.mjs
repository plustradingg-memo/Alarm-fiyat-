import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePrice, extractProduct, siteAdi, looksBlocked } from '../scripts/lib/extract.mjs';

test('parsePrice: Türkçe ve İngilizce biçimler', () => {
  assert.equal(parsePrice('24.999,90 TL'), 24999.9);
  assert.equal(parsePrice('24.999 TL'), 24999);
  assert.equal(parsePrice('1.299'), 1299);
  assert.equal(parsePrice('12.499.000'), 12499000);
  assert.equal(parsePrice('24999.90'), 24999.9);
  assert.equal(parsePrice('24999.0'), 24999);
  assert.equal(parsePrice('₺1.234,5'), 1234.5);
  assert.equal(parsePrice('1,299.99'), 1299.99);
  assert.equal(parsePrice('899,99'), 899.99);
  assert.equal(parsePrice(15999), 15999);
  assert.equal(parsePrice(''), null);
  assert.equal(parsePrice('Fiyat yok'), null);
  assert.equal(parsePrice(0), null);
});

test('siteAdi', () => {
  assert.equal(siteAdi('https://www.trendyol.com/apple/iphone-p-123'), 'Trendyol');
  assert.equal(siteAdi('https://www.hepsiburada.com/x-p-HB00'), 'Hepsiburada');
  assert.equal(siteAdi('https://www.amazon.com.tr/dp/B0CHX1W1XY'), 'Amazon');
  assert.equal(siteAdi('https://urun.n11.com/x'), 'n11');
  assert.equal(siteAdi('https://ornek.com/x'), 'ornek.com');
});

test('JSON-LD Product (Trendyol/Hepsiburada tipi)', () => {
  const html = `<html><head><title>x</title>
  <script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"Apple iPhone 15 128 GB","image":["https://cdn/x.jpg"],
  "offers":{"@type":"Offer","price":"52999.00","priceCurrency":"TRY","availability":"https://schema.org/InStock"}}</script></head><body></body></html>`;
  const r = extractProduct(html, 'https://www.hepsiburada.com/apple-iphone-15-p-HBC1');
  assert.equal(r.fiyat, 52999);
  assert.equal(r.ad, 'Apple iPhone 15 128 GB');
  assert.equal(r.gorsel, 'https://cdn/x.jpg');
  assert.equal(r.stok, true);
  assert.equal(r.site, 'Hepsiburada');
});

test('JSON-LD @graph + AggregateOffer + stokta yok', () => {
  const html = `<script type="application/ld+json">{"@graph":[{"@type":"BreadcrumbList"},{"@type":["Product"],"name":"Kulaklık",
  "offers":{"@type":"AggregateOffer","lowPrice":"1.899,00","offers":[{"price":2100,"availability":"OutOfStock"}],"availability":"https://schema.org/OutOfStock"}}]}</script>`;
  const r = extractProduct(html, 'https://www.n11.com/urun/x');
  assert.equal(r.fiyat, 1899);
  assert.equal(r.stok, false);
});

test('Trendyol seçicileri ve eski fiyat', () => {
  const html = `<h1 class="pr-new-br"><a>Samsung</a> <span>Galaxy S24 256 GB</span></h1>
  <div class="product-price-container"><span class="prc-org">44.999 TL</span><span class="prc-dsc">38.499,90 TL</span></div>`;
  const r = extractProduct(html, 'https://www.trendyol.com/samsung/galaxy-s24-p-1');
  assert.equal(r.fiyat, 38499.9);
  assert.equal(r.eskiFiyat, 44999);
  assert.equal(r.ad, 'Samsung Galaxy S24 256 GB');
});

test('Amazon seçicileri', () => {
  const html = `<span id="productTitle">  Logitech MX Master 3S  </span>
  <div id="corePriceDisplay_desktop_feature_div"><span class="priceToPay"><span class="a-offscreen">3.249,00 TL</span></span>
  <span class="basisPrice"><span class="a-offscreen">3.999,00 TL</span></span></div>
  <meta property="og:image" content="https://m.media-amazon.com/x.jpg">`;
  const r = extractProduct(html, 'https://www.amazon.com.tr/dp/B09HM94VDS');
  assert.equal(r.fiyat, 3249);
  assert.equal(r.eskiFiyat, 3999);
  assert.equal(r.ad, 'Logitech MX Master 3S');
  assert.equal(r.gorsel, 'https://m.media-amazon.com/x.jpg');
});

test('meta etiketi ve gömülü JSON yedekleri', () => {
  assert.equal(extractProduct('<meta property="product:price:amount" content="7499.99">', 'https://www.teknosa.com/x').fiyat, 7499.99);
  assert.equal(extractProduct('<script>window.s={"sellingPrice":{"text":"9.999 TL","value":9999}}</script>', 'https://www.trendyol.com/x').fiyat, 9999);
  assert.equal(extractProduct('<p>fiyat yok</p>', 'https://ornek.com/x').fiyat, null);
});

test('looksBlocked', () => {
  assert.equal(looksBlocked('<html>ok</html>', 403), true);
  assert.equal(looksBlocked('<html>Please verify captcha</html>', 200), true);
  assert.equal(looksBlocked('<html>ürün</html>', 200), false);
});
