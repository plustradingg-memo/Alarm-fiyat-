/* Fiyat Alarmı – data/prices.json'u gösteren pano */
(() => {
  'use strict';

  // GitHub Pages dışında (ör. yerelde) açıldığında kullanılacak depo bilgisi
  const VARSAYILAN_DEPO = 'plustradingg-memo/Alarm-fiyat-';
  const DAL = 'claude/fiyat-takibi-website-xytd6e';

  const $ = (s) => document.querySelector(s);
  const depo = (() => {
    const m = location.hostname.match(/^([^.]+)\.github\.io$/);
    const yol = location.pathname.split('/').filter(Boolean)[0];
    return m && yol ? `${m[1]}/${yol}` : VARSAYILAN_DEPO;
  })();

  $('#lnkRun').href = `https://github.com/${depo}/actions/workflows/fiyat-kontrol.yml`;
  $('#lnkEdit').href = `https://github.com/${depo}/edit/${DAL}/products.json`;

  // ---------- Yardımcılar ----------
  const tl = (n) => n == null ? '—' : new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: n < 100 ? 2 : 0 }).format(n);
  const tarih = (t) => t ? new Date(t).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' }) : '—';
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const guvenliUrl = (u) => /^https?:\/\//i.test(u || '') ? u : '#';

  function once(ms) {
    const d = (Date.now() - Date.parse(ms)) / 1000;
    if (!Number.isFinite(d)) return '—';
    if (d < 90) return 'az önce';
    if (d < 3600) return `${Math.round(d / 60)} dk önce`;
    if (d < 86400) return `${Math.round(d / 3600)} saat önce`;
    return `${Math.round(d / 86400)} gün önce`;
  }

  function toast(text) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = text;
    $('#toasts').appendChild(el);
    setTimeout(() => el.remove(), 3000);
  }

  // ---------- Hesaplamalar ----------
  function zenginlestir(u) {
    const g = u.gecmis || [];
    const onceki = g.length > 1 ? g[g.length - 2][1] : null;
    const ilk = g.length ? g[0][1] : null;
    // İndirim oranı: sitenin gösterdiği eski fiyat, yoksa takip edilen en yüksek fiyat
    const referans = u.eskiFiyat || (u.enYuksek > u.fiyat ? u.enYuksek : null);
    return {
      ...u,
      onceki,
      ilk,
      sonDegisim: g.length ? g[g.length - 1][0] : null,
      degisimYuzde: onceki && u.fiyat ? ((u.fiyat - onceki) / onceki) * 100 : 0,
      indirimYuzde: referans && u.fiyat ? ((referans - u.fiyat) / referans) * 100 : 0,
      hedefte: u.hedefFiyat && u.fiyat != null && u.fiyat <= u.hedefFiyat,
      hedefeKalan: u.hedefFiyat && u.fiyat ? ((u.fiyat - u.hedefFiyat) / u.fiyat) * 100 : null,
      enDusukte: u.fiyat != null && u.enDusuk === u.fiyat && u.enYuksek > u.fiyat,
    };
  }

  // ---------- Grafik ----------
  function grafik(u) {
    const pts = (u.gecmis || []).map(([t, p]) => [Date.parse(t), p]);
    const W = 260, H = 90, pad = 6;
    if (pts.length < 2) {
      return `<svg class="chart" viewBox="0 0 ${W} ${H}" aria-hidden="true"><text x="${W / 2}" y="${H / 2}" text-anchor="middle" class="chart-note">Fiyat değişince grafik oluşur</text></svg>`;
    }
    pts.push([Date.now(), pts[pts.length - 1][1]]); // son fiyatı bugüne uzat
    const vals = pts.map((d) => d[1]);
    if (u.hedefFiyat) vals.push(u.hedefFiyat);
    let min = Math.min(...vals), max = Math.max(...vals);
    if (min === max) { min *= 0.95; max *= 1.05; }
    const t0 = pts[0][0], t1 = pts[pts.length - 1][0];
    const x = (t) => pad + ((t - t0) / Math.max(t1 - t0, 1)) * (W - pad * 2);
    const y = (v) => H - pad - ((v - min) / (max - min)) * (H - pad * 2);
    // Fiyatlar basamak şeklinde değişir
    let d = `M${x(pts[0][0]).toFixed(1)},${y(pts[0][1]).toFixed(1)}`;
    for (let i = 1; i < pts.length; i++) d += ` H${x(pts[i][0]).toFixed(1)} V${y(pts[i][1]).toFixed(1)}`;
    const area = `${d} V${H - pad} H${pad} Z`;
    const hedef = u.hedefFiyat ? `<line class="target" x1="0" x2="${W}" y1="${y(u.hedefFiyat).toFixed(1)}" y2="${y(u.hedefFiyat).toFixed(1)}"/>` : '';
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Fiyat geçmişi">
      <path class="area" d="${area}"/>${hedef}<path class="line" d="${d}" vector-effect="non-scaling-stroke"/></svg>`;
  }

  // ---------- Görünüm ----------
  let urunler = [];
  let veri = null;

  function kart(u) {
    const rozet = [];
    if (u.hedefte) rozet.push('<span class="badge hit">🎯 Hedefte</span>');
    if (u.enDusukte) rozet.push('<span class="badge low">En düşük fiyat</span>');
    if (u.stok === false) rozet.push('<span class="badge muted">Stokta yok</span>');
    if (u.hata) rozet.push(`<span class="badge err" title="${esc(u.hata)}">⚠ Kontrol edilemedi</span>`);

    const degisim = u.degisimYuzde
      ? `<span class="change ${u.degisimYuzde > 0 ? 'up' : 'down'}">${u.degisimYuzde > 0 ? '▲' : '▼'} %${Math.abs(u.degisimYuzde).toFixed(1)}</span>` : '';
    const eski = u.indirimYuzde >= 1
      ? `<span class="old">${tl(u.eskiFiyat || u.enYuksek)}</span><span class="disc">-%${u.indirimYuzde.toFixed(0)}</span>` : '';

    let hedefSatiri = '<span class="meta">Hedef fiyat belirlenmemiş</span>';
    if (u.hedefFiyat) {
      const oran = u.fiyat ? Math.min(u.hedefFiyat / u.fiyat, 1) * 100 : 0;
      hedefSatiri = `<div class="meta">Hedef: <strong>${tl(u.hedefFiyat)}</strong> · ${u.hedefte ? 'ulaşıldı ✓' : u.hedefeKalan != null ? `%${u.hedefeKalan.toFixed(1)} düşüş gerekiyor` : ''}</div>
        <div class="progress"><div style="width:${oran.toFixed(1)}%"></div></div>`;
    }

    return `<article class="item ${u.hedefte ? 'alarm' : ''}">
      <a class="thumb" href="${esc(guvenliUrl(u.url))}" target="_blank" rel="noopener noreferrer">
        ${u.gorsel ? `<img src="${esc(guvenliUrl(u.gorsel))}" alt="" loading="lazy" referrerpolicy="no-referrer">` : '<span>📦</span>'}
      </a>
      <div class="body">
        <div class="item-title">
          <span class="badge site">${esc(u.site)}</span>${rozet.join('')}
        </div>
        <a class="name" href="${esc(guvenliUrl(u.url))}" target="_blank" rel="noopener noreferrer">${esc(u.ad || u.url)}</a>
        <div class="price-row"><span class="price">${tl(u.fiyat)}</span>${eski}${degisim}</div>
        ${hedefSatiri}
        <div class="meta">En düşük ${tl(u.enDusuk)} · En yüksek ${tl(u.enYuksek)} · Son kontrol ${u.sonBasari ? once(u.sonBasari) : '—'}</div>
        ${u.hata ? `<div class="meta err-text">Son hata: ${esc(u.hata)}</div>` : ''}
      </div>
      <div class="chart-wrap">${grafik(u)}
        <div class="meta">${(u.gecmis || []).length} fiyat kaydı${u.sonDegisim ? ' · son değişim ' + tarih(u.sonDegisim) : ''}</div>
      </div>
    </article>`;
  }

  function ciz() {
    const q = $('#search').value.trim().toLocaleLowerCase('tr');
    const site = $('#site').value;
    const only = $('#only').value;
    const sort = $('#sort').value;

    let list = urunler.filter((u) =>
      (!q || (u.ad || u.url).toLocaleLowerCase('tr').includes(q)) &&
      (!site || u.site === site) &&
      (!only || (only === 'indirim' && u.indirimYuzde >= 1) || (only === 'hedef' && u.hedefte) || (only === 'hata' && u.hata)));

    const by = {
      dusus: (a, b) => b.indirimYuzde - a.indirimYuzde,
      hedef: (a, b) => (a.hedefeKalan ?? Infinity) - (b.hedefeKalan ?? Infinity),
      degisim: (a, b) => (Date.parse(b.sonDegisim) || 0) - (Date.parse(a.sonDegisim) || 0),
      fiyat: (a, b) => (a.fiyat ?? Infinity) - (b.fiyat ?? Infinity),
      ad: (a, b) => (a.ad || '').localeCompare(b.ad || '', 'tr'),
    };
    list.sort(by[sort]);

    $('#list').innerHTML = list.map(kart).join('');
    const empty = $('#empty');
    empty.hidden = list.length > 0;
    empty.innerHTML = urunler.length
      ? 'Filtreyle eşleşen ürün yok.'
      : 'Henüz takip edilen ürün yok. <a href="#ekle">Aşağıdan ürün ekleyin.</a>';
  }

  function istatistik() {
    const say = (f) => urunler.filter(f).length;
    $('#stats').innerHTML = [
      ['Takip edilen', urunler.length],
      ['İndirimde', say((u) => u.indirimYuzde >= 1)],
      ['Hedefe ulaşan', say((u) => u.hedefte)],
      ['Son 7 gün alarm', (veri.alarmlar || []).filter((a) => Date.now() - Date.parse(a.zaman) < 7 * 864e5).length],
    ].map(([l, v]) => `<div class="stat"><div class="label">${l}</div><div class="value">${v}</div></div>`).join('');
  }

  function alarmlar() {
    const a = (veri.alarmlar || []).slice(0, 10);
    $('#alarmsCard').hidden = !a.length;
    $('#alarms').innerHTML = a.map((x) => `<li>
      <span class="when">${once(x.zaman)}</span>
      <a href="${esc(guvenliUrl(x.url))}" target="_blank" rel="noopener noreferrer">${esc(x.ad)}</a>
      <span class="badge site">${esc(x.site)}</span>
      <strong>${tl(x.fiyat)}</strong>${x.oncekiFiyat ? ` <span class="old">${tl(x.oncekiFiyat)}</span>` : ''}
      <span class="meta">${esc((x.nedenler || []).join(' · '))}</span></li>`).join('');
  }

  async function yukle() {
    try {
      const res = await fetch(`data/prices.json?_=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(res.status);
      veri = await res.json();
    } catch {
      $('#updated').textContent = 'Veri yüklenemedi';
      veri = { urunler: {}, alarmlar: [] };
      if (location.protocol === 'file:') toast('Sayfayı bir sunucu üzerinden açın (README\'ye bakın).');
    }
    urunler = Object.values(veri.urunler || {}).map(zenginlestir);
    $('#updated').textContent = veri.guncelleme ? `Son güncelleme: ${tarih(veri.guncelleme)} (${once(veri.guncelleme)})` : 'Henüz kontrol yapılmadı';

    const siteler = [...new Set(urunler.map((u) => u.site))].sort((a, b) => a.localeCompare(b, 'tr'));
    const sel = $('#site');
    const secili = sel.value;
    sel.innerHTML = '<option value="">Tüm siteler</option>' + siteler.map((s) => `<option>${esc(s)}</option>`).join('');
    sel.value = siteler.includes(secili) ? secili : '';

    istatistik();
    alarmlar();
    ciz();
  }

  ['#search', '#site', '#only', '#sort'].forEach((s) => $(s).addEventListener('input', ciz));

  // ---------- Ürün ekleme yardımcısı ----------
  const form = $('#addForm');
  function snippet() {
    const f = form.elements;
    const url = f.url.value.trim();
    if (!url) { $('#snippet').textContent = '{ "url": "https://...", "hedefFiyat": 25000 }'; return; }
    const o = { url };
    if (f.hedef.value) o.hedefFiyat = Number(f.hedef.value);
    if (f.ad.value.trim()) o.ad = f.ad.value.trim();
    $('#snippet').textContent = JSON.stringify(o) + ',';
  }
  form.addEventListener('input', snippet);
  form.addEventListener('submit', (e) => e.preventDefault());
  $('#btnCopy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText($('#snippet').textContent); toast('Kopyalandı.'); }
    catch { toast('Kopyalanamadı; metni elle seçin.'); }
  });
  snippet();

  yukle();
  setInterval(yukle, 5 * 60 * 1000);
})();
