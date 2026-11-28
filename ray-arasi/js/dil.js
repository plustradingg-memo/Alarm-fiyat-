/* Dil desteği: Türkçe (kaynak dil) ve İngilizce.
   - Metinler kodda Türkçe yazılır ve RA.t('...') ile gösterilir; İngilizce karşılıkları js/en-*.js dosyalarındaki
     RA.EN sözlüğündedir (anahtar: Türkçe metnin kendisi). Karşılığı olmayan metin Türkçe kalır.
   - Değişkenler: RA.t('Bir ev {n} kişiyi bekletirse kaybedersin.', { n: 8 }).
     İngilizcede tekil/çoğul: '{n:car:cars}' → n 1 ise 'car', değilse 'cars' (sayı yazılmaz; yanına '{n} ' koy).
   - Bölüm metinleri (ad, tanıtım, ipucu): RA.LV_EN[id] = { name, intro, tip } → RA.lvYazi(L, 'intro').
   - Sayfadaki sabit metinler (index.html) RA.dilUygula ile çevrilir; özgün Türkçesi saklanır, geri dönülebilir.
   - Dil: kayıtlı seçim → cihaz dili (tr ise Türkçe) → İngilizce. Menüdeki TR/EN düğmesi değiştirir. */
(function () {
  'use strict';
  const RA = window.RA;
  RA.EN = RA.EN || {};
  RA.LV_EN = RA.LV_EN || {};
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

  const qs = /[?&]dil=(tr|en)\b/.exec((typeof location !== 'undefined' && location.search) || '');
  if (qs) RA.store.set('dil', qs[1]); // testler ve paylaşılan bağlantılar için: ?dil=en
  const kayit = RA.store.get('dil', null);
  const cihaz = window.__cihazDili || (navigator.languages && navigator.languages[0]) || navigator.language || 'en';
  RA.dil = kayit === 'tr' || kayit === 'en' ? kayit : /^tr/i.test(cihaz) ? 'tr' : 'en';
  document.documentElement.lang = RA.dil;

  RA.t = function (s, v) {
    let o = RA.dil === 'en' && own(RA.EN, s) ? RA.EN[s] : s;
    if (v) o = o.replace(/\{(\w+)(?::([^:}]*):([^}]*))?\}/g, (m, k, a, b) => (a !== undefined ? (Number(v[k]) === 1 ? a : b) : v[k] != null ? v[k] : m));
    return o;
  };
  // oyunun adı tek yerden gelir (İngilizcesi sözlükte)
  RA.ad = () => RA.t('Trafik Ustası'); // İngilizcesi: Traffic Maestro
  RA.lvYazi = (L, k) => (RA.dil === 'en' && RA.LV_EN[L.id] && RA.LV_EN[L.id][k]) || L[k];

  // ---- sayfadaki sabit metinler ----
  const ORIG = new WeakMap();
  const ATTRS = ['aria-label', 'title', 'placeholder', 'alt'];
  const cevir = (orig) => {
    const t = orig.trim();
    if (!t) return orig;
    const out = RA.t(t);
    return out === t ? orig : orig.replace(t, out);
  };
  RA.dilUygula = function (root) {
    if (typeof document.createTreeWalker !== 'function') return; // tarayıcısız testler
    root = root || document.body;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (n.parentNode && /^(SCRIPT|STYLE)$/.test(n.parentNode.nodeName) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
    });
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      if (!ORIG.has(n)) ORIG.set(n, n.nodeValue);
      const o = ORIG.get(n);
      const v = RA.dil === 'en' ? cevir(o) : o;
      if (n.nodeValue !== v) n.nodeValue = v;
    }
    const els = root.querySelectorAll ? root.querySelectorAll('[' + ATTRS.join('],[') + ']') : [];
    for (const el of els) {
      let m = ORIG.get(el);
      if (!m) { m = {}; ORIG.set(el, m); }
      for (const a of ATTRS) {
        if (!el.hasAttribute(a)) continue;
        if (!own(m, a)) m[a] = el.getAttribute(a);
        const v = RA.dil === 'en' ? cevir(m[a]) : m[a];
        if (el.getAttribute(a) !== v) el.setAttribute(a, v);
      }
    }
    if (root === document.body) {
      document.title = RA.ad();
      const h = document.getElementById('oyun-adi');
      if (h) { h.textContent = RA.ad().toLocaleUpperCase(RA.dil === 'tr' ? 'tr-TR' : 'en-US'); RA.baslikSigdir(); }
      const b = document.getElementById('btn-dil');
      if (b) { b.textContent = RA.dil === 'tr' ? 'TR' : 'EN'; b.setAttribute('aria-label', RA.dil === 'tr' ? 'Dil: Türkçe. İngilizceye geç' : 'Language: English. Switch to Turkish'); }
    }
  };
  const plate0 = (h, pad) => { h.parentElement.style.padding = pad; };
  // oyun adı tek satırda kalsın: levhaya sığana kadar yazı küçülür
  RA.baslikSigdir = function () {
    const h = document.getElementById('oyun-adi');
    if (!h || !h.parentElement || !h.offsetParent) return;
    h.style.fontSize = ''; h.style.letterSpacing = ''; h.style.textIndent = ''; plate0(h, '');
    const plate = h.parentElement, cs = getComputedStyle(plate);
    const room = () => plate.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    // önce harf aralığı ve levha kenarı daralır, sonra yazı küçülür
    if (h.scrollWidth > room() + 0.5) { h.style.letterSpacing = '0.04em'; h.style.textIndent = '0.04em'; plate0(h, '7px 12px 4px'); }
    let fs = parseFloat(getComputedStyle(h).fontSize);
    for (let i = 0; i < 40 && h.scrollWidth > room() + 0.5 && fs > 12; i++) { fs -= 1; h.style.fontSize = fs + 'px'; }
  };
  if (window.addEventListener) window.addEventListener('resize', () => RA.baslikSigdir && RA.baslikSigdir());
  RA.setDil = function (d) {
    if (d !== 'tr' && d !== 'en') return;
    RA.dil = d;
    RA.store.set('dil', d);
    document.documentElement.lang = d;
    RA.dilUygula(document.body);
    if (window.dispatchEvent && typeof Event === 'function') window.dispatchEvent(new Event('ra-dil'));
  };
  const ilk = () => {
    RA.dilUygula(document.body);
    const b = document.getElementById('btn-dil');
    if (b) b.addEventListener('click', () => { RA.setDil(RA.dil === 'tr' ? 'en' : 'tr'); if (RA.audio) RA.audio.play('tap'); });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ilk); else ilk();
})();
